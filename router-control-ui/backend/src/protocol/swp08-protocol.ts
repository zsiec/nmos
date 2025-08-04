import { EventEmitter } from 'events';
import { 
  SWP08Commands, 
  SWP08Message, 
  SWP08Frame,
  CrosspointState,
  SWP08_CONSTANTS,
  ConnectionConfig,
  SWP08Events
} from '../types/swp08.types';
import { SWP08Parser } from './swp08-parser';
import * as net from 'net';
import { SerialPort } from 'serialport';

interface PendingCommand {
  frame: Buffer;
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  retries: number;
  timeout?: NodeJS.Timeout;
}

export class SWP08Protocol extends EventEmitter {
  private parser: SWP08Parser;
  private connection?: net.Socket | SerialPort;
  private config: ConnectionConfig;
  private pendingCommands: Map<string, PendingCommand> = new Map();
  private crosspointCache: Map<string, CrosspointState> = new Map();
  private isConnected: boolean = false;

  constructor(config: ConnectionConfig) {
    super();
    this.config = config;
    this.parser = new SWP08Parser();
  }

  /**
   * Connect to router
   */
  async connect(): Promise<void> {
    if (this.config.type === 'tcp') {
      return this.connectTCP();
    } else {
      return this.connectSerial();
    }
  }

  /**
   * Connect via TCP
   */
  private async connectTCP(): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      
      socket.on('connect', () => {
        this.isConnected = true;
        this.emit('connected');
        resolve();
      });

      socket.on('data', (data: Buffer) => {
        this.handleData(data);
      });

      socket.on('error', (error) => {
        this.emit('error', error);
        reject(error);
      });

      socket.on('close', () => {
        this.isConnected = false;
        this.emit('disconnected');
      });

      socket.connect(this.config.tcpPort || 2000, this.config.tcpHost || 'localhost');
      this.connection = socket;
    });
  }

  /**
   * Connect via Serial
   */
  private async connectSerial(): Promise<void> {
    return new Promise((resolve, reject) => {
      const port = new SerialPort({
        path: this.config.serialPort || '/dev/ttyUSB0',
        baudRate: this.config.baudRate || 38400,
        dataBits: 8,
        stopBits: 1,
        parity: 'even'
      });

      port.on('open', () => {
        this.isConnected = true;
        this.emit('connected');
        resolve();
      });

      port.on('data', (data: Buffer) => {
        this.handleData(data);
      });

      port.on('error', (error) => {
        this.emit('error', error);
        reject(error);
      });

      port.on('close', () => {
        this.isConnected = false;
        this.emit('disconnected');
      });

      this.connection = port;
    });
  }

  /**
   * Disconnect from router
   */
  disconnect(): void {
    if (this.connection) {
      if (this.connection instanceof SerialPort) {
        this.connection.close();
      } else {
        this.connection.end();
      }
    }
  }

  /**
   * Handle incoming data
   */
  private handleData(data: Buffer): void {
    // Check for ACK/NAK first
    if (SWP08Parser.isAck(data)) {
      this.handleAck();
      return;
    }
    
    if (SWP08Parser.isNak(data)) {
      this.handleNak();
      return;
    }

    // Parse frames
    const frames = this.parser.parseData(data);
    
    for (const frame of frames) {
      this.handleFrame(frame);
    }
  }

  /**
   * Handle ACK response
   */
  private handleAck(): void {
    // ACK received, clear any pending command timeout
    const pendingKeys = Array.from(this.pendingCommands.keys());
    if (pendingKeys.length > 0) {
      const pending = this.pendingCommands.get(pendingKeys[0]);
      if (pending && pending.timeout) {
        clearTimeout(pending.timeout);
        pending.timeout = undefined;
      }
    }
  }

  /**
   * Handle NAK response
   */
  private handleNak(): void {
    const pendingKeys = Array.from(this.pendingCommands.keys());
    if (pendingKeys.length > 0) {
      const pending = this.pendingCommands.get(pendingKeys[0]);
      if (pending) {
        this.retryCommand(pendingKeys[0], pending);
      }
    }
  }

  /**
   * Handle parsed frame
   */
  private handleFrame(frame: SWP08Frame): void {
    // Send ACK for received frame
    this.sendAck();

    // Parse message based on command
    const message = this.parseMessage(frame);
    if (!message) return;

    // Handle different message types
    switch (message.command) {
      case SWP08Commands.CROSSPOINT_TALLY:
        this.handleTallyMessage(message);
        break;
      
      case SWP08Commands.CROSSPOINT_CONNECTED:
        this.handleConnectedMessage(message);
        break;
      
      case SWP08Commands.CROSSPOINT_TALLY_DUMP_BYTE:
      case SWP08Commands.CROSSPOINT_TALLY_DUMP_WORD:
        this.handleTallyDump(frame);
        break;
    }

    // Resolve any pending commands
    const key = this.getCommandKey(frame.command);
    const pending = this.pendingCommands.get(key);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingCommands.delete(key);
      pending.resolve(message);
    }
  }

  /**
   * Parse message from frame
   */
  private parseMessage(frame: SWP08Frame): SWP08Message | null {
    const { command, data } = frame;
    
    if (data.length < 3) return null;

    const matrixLevel = data[0];
    const matrix = (matrixLevel >> 4) & 0x0F;
    const level = matrixLevel & 0x0F;

    const multiplier = SWP08Parser.parseMultiplier(data[1]);
    const destination = SWP08Parser.combineAddress(multiplier.destinationHigh, data[2]);

    let source: number | undefined;
    if (data.length >= 4) {
      source = SWP08Parser.combineAddress(multiplier.sourceHigh, data[3]);
    }

    return {
      command: command as SWP08Commands,
      matrix,
      level,
      destination,
      source,
      sourceStatus: multiplier.sourceStatus
    };
  }

  /**
   * Handle tally message
   */
  private handleTallyMessage(message: SWP08Message): void {
    const state = this.updateCrosspointState(message, 'connected');
    this.emit('tally-update', message);
    this.emit('crosspoint-change', state);
  }

  /**
   * Handle connected message
   */
  private handleConnectedMessage(message: SWP08Message): void {
    const state = this.updateCrosspointState(message, 'connected');
    this.emit('crosspoint-change', state);
  }

  /**
   * Update crosspoint state cache
   */
  private updateCrosspointState(message: SWP08Message, status: CrosspointState['status']): CrosspointState {
    const key = `${message.matrix}:${message.level}:${message.destination}`;
    const state: CrosspointState = {
      matrix: message.matrix,
      level: message.level,
      destination: message.destination,
      source: message.source || 0,
      status,
      timestamp: new Date()
    };
    
    this.crosspointCache.set(key, state);
    return state;
  }

  /**
   * Send ACK
   */
  private sendAck(): void {
    const ack = SWP08Parser.buildAck();
    this.sendRaw(ack);
  }

  /**
   * Send raw data
   */
  private sendRaw(data: Buffer): void {
    if (this.connection && this.isConnected) {
      if (this.connection instanceof SerialPort) {
        this.connection.write(data);
      } else {
        this.connection.write(data);
      }
    }
  }

  /**
   * Send command and wait for response
   */
  private async sendCommand(command: SWP08Commands, data: Buffer, expectResponse: boolean = true): Promise<SWP08Message | void> {
    const frame = SWP08Parser.buildFrame(command, data);
    const key = this.getCommandKey(command);

    return new Promise((resolve, reject) => {
      const pending: PendingCommand = {
        frame,
        resolve,
        reject,
        retries: 0
      };

      if (expectResponse) {
        this.pendingCommands.set(key, pending);
        
        // Set timeout
        pending.timeout = setTimeout(() => {
          this.retryCommand(key, pending);
        }, SWP08_CONSTANTS.ACK_TIMEOUT_MS);
      }

      // Send the frame
      this.sendRaw(frame);

      if (!expectResponse) {
        resolve();
      }
    });
  }

  /**
   * Retry command
   */
  private retryCommand(key: string, pending: PendingCommand): void {
    if (pending.retries >= SWP08_CONSTANTS.MAX_RETRIES) {
      this.pendingCommands.delete(key);
      pending.reject(new Error('Max retries exceeded'));
      return;
    }

    pending.retries++;
    
    // Clear old timeout
    if (pending.timeout) {
      clearTimeout(pending.timeout);
    }

    // Set new timeout
    pending.timeout = setTimeout(() => {
      this.retryCommand(key, pending);
    }, SWP08_CONSTANTS.ACK_TIMEOUT_MS);

    // Resend frame
    this.sendRaw(pending.frame);
  }

  /**
   * Get command key for pending commands
   */
  private getCommandKey(command: number): string {
    return `cmd_${command}`;
  }

  /**
   * Handle tally dump
   */
  private handleTallyDump(frame: SWP08Frame): void {
    // TODO: Parse tally dump data
    console.log('Received tally dump:', frame);
  }

  // Public API methods

  /**
   * Interrogate crosspoint
   */
  async interrogate(matrix: number, level: number, destination: number): Promise<SWP08Message> {
    const matrixLevel = ((matrix & 0x0F) << 4) | (level & 0x0F);
    const { high, low } = SWP08Parser.splitAddress(destination);
    const multiplier = SWP08Parser.buildMultiplier(high, false, 0);
    
    const data = Buffer.from([matrixLevel, multiplier, low]);
    
    return await this.sendCommand(SWP08Commands.CROSSPOINT_INTERROGATE, data) as SWP08Message;
  }

  /**
   * Take crosspoint (connect source to destination)
   */
  async takeCrosspoint(matrix: number, level: number, destination: number, source: number): Promise<void> {
    const matrixLevel = ((matrix & 0x0F) << 4) | (level & 0x0F);
    const destAddr = SWP08Parser.splitAddress(destination);
    const srcAddr = SWP08Parser.splitAddress(source);
    const multiplier = SWP08Parser.buildMultiplier(destAddr.high, false, srcAddr.high);
    
    const data = Buffer.from([matrixLevel, multiplier, destAddr.low, srcAddr.low]);
    
    // Update state to pending
    this.updateCrosspointState({
      command: SWP08Commands.CROSSPOINT_CONNECT,
      matrix,
      level,
      destination,
      source
    }, 'pending');

    await this.sendCommand(SWP08Commands.CROSSPOINT_CONNECT, data, false);
  }

  /**
   * Request tally dump
   */
  async requestTallyDump(matrix: number, level: number): Promise<void> {
    const matrixLevel = ((matrix & 0x0F) << 4) | (level & 0x0F);
    const data = Buffer.from([matrixLevel]);
    
    await this.sendCommand(SWP08Commands.CROSSPOINT_TALLY_DUMP_REQUEST, data);
  }

  /**
   * Get current crosspoint state
   */
  getCrosspointState(matrix: number, level: number, destination: number): CrosspointState | undefined {
    const key = `${matrix}:${level}:${destination}`;
    return this.crosspointCache.get(key);
  }

  /**
   * Get all crosspoint states
   */
  getAllCrosspointStates(): CrosspointState[] {
    return Array.from(this.crosspointCache.values());
  }

  /**
   * Check if connected
   */
  get connected(): boolean {
    return this.isConnected;
  }
}

// Type-safe event emitter
export interface SWP08Protocol {
  on<K extends keyof SWP08Events>(event: K, listener: SWP08Events[K]): this;
  emit<K extends keyof SWP08Events>(event: K, ...args: Parameters<SWP08Events[K]>): boolean;
}