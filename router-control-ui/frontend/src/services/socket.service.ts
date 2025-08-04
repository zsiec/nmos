import { io, Socket } from 'socket.io-client';
import { 
  ClientToServerEvents, 
  ServerToClientEvents,
  CrosspointState,
  RouterLabel,
  RouterStatus,
  SalvoGroup
} from '../types/router.types';

export type RouterSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

class SocketService {
  private socket: RouterSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private listeners: Map<string, Set<Function>> = new Map();

  constructor() {
    this.url = process.env.REACT_APP_WEBSOCKET_URL || 'http://localhost:3001';
  }

  /**
   * Connect to WebSocket server
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        resolve();
        return;
      }

      this.socket = io(this.url, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: this.reconnectDelay,
      }) as RouterSocket;

      this.socket.on('connect', () => {
        console.log('Connected to WebSocket server');
        this.reconnectAttempts = 0;
        
        // Auto-subscribe on connect
        this.socket!.emit('subscribe');
        
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        this.reconnectAttempts++;
        
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          reject(new Error('Failed to connect to server'));
        }
      });

      this.socket.on('disconnect', (reason) => {
        console.log('Disconnected from server:', reason);
      });

      // Setup event handlers
      this.setupEventHandlers();
    });
  }

  /**
   * Disconnect from server
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.emit('unsubscribe');
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    if (!this.socket) return;

    // Real-time updates
    this.socket.on('crosspoint-change', (state) => {
      this.emit('crosspoint-change', state);
    });

    this.socket.on('label-change', (data) => {
      this.emit('label-change', data);
    });

    this.socket.on('salvo-change', (data) => {
      this.emit('salvo-change', data);
    });

    this.socket.on('router-connected', () => {
      this.emit('router-connected');
    });

    this.socket.on('router-disconnected', () => {
      this.emit('router-disconnected');
    });

    this.socket.on('router-error', (error) => {
      this.emit('router-error', error);
    });

    this.socket.on('status-update', (status) => {
      this.emit('status-update', status);
    });

    this.socket.on('crosspoint-update', (crosspoints) => {
      this.emit('crosspoint-update', crosspoints);
    });
  }

  /**
   * Emit event to listeners
   */
  private emit(event: string, ...args: any[]): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(listener => listener(...args));
    }
  }

  /**
   * Add event listener
   */
  on(event: string, callback: Function): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    
    this.listeners.get(event)!.add(callback);

    // Return unsubscribe function
    return () => {
      const eventListeners = this.listeners.get(event);
      if (eventListeners) {
        eventListeners.delete(callback);
      }
    };
  }

  // Crosspoint Control Methods

  /**
   * Take crosspoint (connect source to destination)
   */
  takeCrosspoint(destination: number, source: number, level: number = 0, matrix: number = 0): void {
    if (!this.socket?.connected) {
      throw new Error('Not connected to server');
    }

    this.socket.emit('take-crosspoint', { destination, source, level, matrix });
  }

  /**
   * Take multiple levels
   */
  takeMultiLevel(destination: number, source: number, levels: number[], matrix: number = 0): void {
    if (!this.socket?.connected) {
      throw new Error('Not connected to server');
    }

    this.socket.emit('take-multi-level', { destination, source, levels, matrix });
  }

  /**
   * Query crosspoint
   */
  queryCrosspoint(destination: number, level: number = 0, matrix: number = 0): Promise<number> {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error('Not connected to server'));
        return;
      }

      this.socket.emit('query-crosspoint', { destination, level, matrix }, (source) => {
        resolve(source);
      });
    });
  }

  // Label Management Methods

  /**
   * Set label
   */
  setLabel(type: 'source' | 'destination', index: number, label: string, level: number = 0, matrix: number = 0): void {
    if (!this.socket?.connected) {
      throw new Error('Not connected to server');
    }

    this.socket.emit('set-label', { type, index, label, level, matrix });
  }

  /**
   * Get label
   */
  getLabel(type: 'source' | 'destination', index: number, level: number = 0, matrix: number = 0): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error('Not connected to server'));
        return;
      }

      this.socket.emit('get-label', { type, index, level, matrix }, (label) => {
        resolve(label);
      });
    });
  }

  /**
   * Get all labels
   */
  getAllLabels(): Promise<RouterLabel[]> {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error('Not connected to server'));
        return;
      }

      this.socket.emit('get-all-labels', (labels) => {
        resolve(labels);
      });
    });
  }

  // Salvo Management Methods

  /**
   * Create salvo
   */
  createSalvo(id: number, name: string, crosspoints: SalvoGroup['crosspoints']): void {
    if (!this.socket?.connected) {
      throw new Error('Not connected to server');
    }

    this.socket.emit('create-salvo', { id, name, crosspoints });
  }

  /**
   * Execute salvo
   */
  executeSalvo(id: number): void {
    if (!this.socket?.connected) {
      throw new Error('Not connected to server');
    }

    this.socket.emit('execute-salvo', { id });
  }

  /**
   * Get all salvos
   */
  getAllSalvos(): Promise<SalvoGroup[]> {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error('Not connected to server'));
        return;
      }

      this.socket.emit('get-all-salvos', (salvos) => {
        resolve(salvos);
      });
    });
  }

  // Status Methods

  /**
   * Get router status
   */
  getStatus(): Promise<RouterStatus> {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error('Not connected to server'));
        return;
      }

      this.socket.emit('get-status', (status) => {
        resolve(status);
      });
    });
  }

  /**
   * Get all crosspoints
   */
  getAllCrosspoints(): Promise<CrosspointState[]> {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error('Not connected to server'));
        return;
      }

      this.socket.emit('get-all-crosspoints', (crosspoints) => {
        resolve(crosspoints);
      });
    });
  }

  /**
   * Get crosspoints by level
   */
  getCrosspointsByLevel(level: number, matrix: number = 0): Promise<CrosspointState[]> {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error('Not connected to server'));
        return;
      }

      this.socket.emit('get-crosspoints-by-level', { level, matrix }, (crosspoints) => {
        resolve(crosspoints);
      });
    });
  }

  /**
   * Check if connected
   */
  get isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

// Export singleton instance
export const socketService = new SocketService();