import { EventEmitter } from 'events';
import { SWP08Protocol } from '../protocol/swp08-protocol';
import { 
  ConnectionConfig, 
  CrosspointState, 
  RouterLabel, 
  SalvoGroup,
  SWP08Message 
} from '../types/swp08.types';

export interface RouterConfig extends ConnectionConfig {
  maxSources: number;
  maxDestinations: number;
  maxLevels: number;
}

export interface RouterStatus {
  connected: boolean;
  connectionType: 'serial' | 'tcp';
  crosspointCount: number;
  lastUpdate: Date;
}

export class RouterService extends EventEmitter {
  private protocol: SWP08Protocol;
  private config: RouterConfig;
  private labels: Map<string, RouterLabel> = new Map();
  private salvos: Map<number, SalvoGroup> = new Map();
  private status: RouterStatus;

  constructor(config: RouterConfig) {
    super();
    this.config = config;
    this.protocol = new SWP08Protocol(config);
    
    this.status = {
      connected: false,
      connectionType: config.type,
      crosspointCount: 0,
      lastUpdate: new Date()
    };

    this.setupEventHandlers();
  }

  /**
   * Setup protocol event handlers
   */
  private setupEventHandlers(): void {
    this.protocol.on('connected', () => {
      this.status.connected = true;
      this.emit('connected');
      this.initializeRouter();
    });

    this.protocol.on('disconnected', () => {
      this.status.connected = false;
      this.emit('disconnected');
    });

    this.protocol.on('error', (error) => {
      this.emit('error', error);
    });

    this.protocol.on('crosspoint-change', (state) => {
      this.status.lastUpdate = new Date();
      this.status.crosspointCount = this.protocol.getAllCrosspointStates().length;
      this.emit('crosspoint-change', state);
    });

    this.protocol.on('tally-update', (message) => {
      this.emit('tally-update', message);
    });
  }

  /**
   * Initialize router after connection
   */
  private async initializeRouter(): Promise<void> {
    try {
      // Request tally dump for all levels
      for (let level = 0; level < this.config.maxLevels; level++) {
        await this.protocol.requestTallyDump(0, level);
        // Add small delay to avoid overwhelming the router
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error('Error initializing router:', error);
    }
  }

  /**
   * Connect to router
   */
  async connect(): Promise<void> {
    await this.protocol.connect();
  }

  /**
   * Disconnect from router
   */
  disconnect(): void {
    this.protocol.disconnect();
  }

  /**
   * Take crosspoint (connect source to destination)
   */
  async takeCrosspoint(destination: number, source: number, level: number = 0, matrix: number = 0): Promise<void> {
    // Validate inputs
    if (source < 0 || source >= this.config.maxSources) {
      throw new Error(`Invalid source: ${source}`);
    }
    if (destination < 0 || destination >= this.config.maxDestinations) {
      throw new Error(`Invalid destination: ${destination}`);
    }
    if (level < 0 || level >= this.config.maxLevels) {
      throw new Error(`Invalid level: ${level}`);
    }

    await this.protocol.takeCrosspoint(matrix, level, destination, source);
  }

  /**
   * Take multiple levels (e.g., video + audio)
   */
  async takeMultiLevel(destination: number, source: number, levels: number[], matrix: number = 0): Promise<void> {
    const promises = levels.map(level => 
      this.takeCrosspoint(destination, source, level, matrix)
    );
    await Promise.all(promises);
  }

  /**
   * Query crosspoint
   */
  async queryCrosspoint(destination: number, level: number = 0, matrix: number = 0): Promise<number> {
    const result = await this.protocol.interrogate(matrix, level, destination);
    return result.source || -1;
  }

  /**
   * Get crosspoint state from cache
   */
  getCrosspointState(destination: number, level: number = 0, matrix: number = 0): CrosspointState | undefined {
    return this.protocol.getCrosspointState(matrix, level, destination);
  }

  /**
   * Get all crosspoint states
   */
  getAllCrosspoints(): CrosspointState[] {
    return this.protocol.getAllCrosspointStates();
  }

  /**
   * Get crosspoints for a specific level
   */
  getCrosspointsByLevel(level: number, matrix: number = 0): CrosspointState[] {
    return this.getAllCrosspoints().filter(
      cp => cp.level === level && cp.matrix === matrix
    );
  }

  /**
   * Set label
   */
  setLabel(type: 'source' | 'destination', index: number, label: string, level: number = 0, matrix: number = 0): void {
    const key = `${type}:${matrix}:${level}:${index}`;
    this.labels.set(key, {
      type,
      index,
      label,
      matrix,
      level
    });
    this.emit('label-change', { type, index, label, level, matrix });
  }

  /**
   * Get label
   */
  getLabel(type: 'source' | 'destination', index: number, level: number = 0, matrix: number = 0): string {
    const key = `${type}:${matrix}:${level}:${index}`;
    const label = this.labels.get(key);
    return label?.label || `${type.charAt(0).toUpperCase()}${index + 1}`;
  }

  /**
   * Get all labels
   */
  getAllLabels(): RouterLabel[] {
    return Array.from(this.labels.values());
  }

  /**
   * Create salvo group
   */
  createSalvo(id: number, name: string, crosspoints: SalvoGroup['crosspoints']): void {
    this.salvos.set(id, { id, name, crosspoints });
    this.emit('salvo-change', { id, name, crosspoints });
  }

  /**
   * Execute salvo
   */
  async executeSalvo(id: number): Promise<void> {
    const salvo = this.salvos.get(id);
    if (!salvo) {
      throw new Error(`Salvo ${id} not found`);
    }

    // Execute all crosspoints in parallel
    const promises = salvo.crosspoints.map(cp =>
      this.takeCrosspoint(cp.destination, cp.source, cp.level)
    );
    
    await Promise.all(promises);
  }

  /**
   * Get all salvos
   */
  getAllSalvos(): SalvoGroup[] {
    return Array.from(this.salvos.values());
  }

  /**
   * Get router status
   */
  getStatus(): RouterStatus {
    return { ...this.status };
  }

  /**
   * Get router configuration
   */
  getConfig(): RouterConfig {
    return { ...this.config };
  }

  /**
   * Lock destination (prevent changes)
   */
  lockDestination(destination: number, level: number = 0, matrix: number = 0): void {
    // TODO: Implement destination locking
    this.emit('destination-locked', { destination, level, matrix });
  }

  /**
   * Unlock destination
   */
  unlockDestination(destination: number, level: number = 0, matrix: number = 0): void {
    // TODO: Implement destination unlocking
    this.emit('destination-unlocked', { destination, level, matrix });
  }

  /**
   * Get source availability (for redundancy)
   */
  getSourceAvailability(source: number): boolean {
    // Check if source is available across all destinations
    const states = this.getAllCrosspoints();
    return states.some(state => state.source === source && state.status === 'connected');
  }

  /**
   * Find destinations using a specific source
   */
  findDestinationsBySource(source: number, level: number = 0, matrix: number = 0): number[] {
    return this.getAllCrosspoints()
      .filter(state => 
        state.source === source && 
        state.level === level && 
        state.matrix === matrix &&
        state.status === 'connected'
      )
      .map(state => state.destination);
  }
}

// Export event types for type safety
export interface RouterServiceEvents {
  'connected': () => void;
  'disconnected': () => void;
  'error': (error: Error) => void;
  'crosspoint-change': (state: CrosspointState) => void;
  'tally-update': (message: SWP08Message) => void;
  'label-change': (label: { type: string; index: number; label: string; level: number; matrix: number }) => void;
  'salvo-change': (salvo: { id: number; name: string; crosspoints: SalvoGroup['crosspoints'] }) => void;
  'destination-locked': (dest: { destination: number; level: number; matrix: number }) => void;
  'destination-unlocked': (dest: { destination: number; level: number; matrix: number }) => void;
}

// Type-safe event emitter
export interface RouterService {
  on<K extends keyof RouterServiceEvents>(event: K, listener: RouterServiceEvents[K]): this;
  emit<K extends keyof RouterServiceEvents>(event: K, ...args: Parameters<RouterServiceEvents[K]>): boolean;
}