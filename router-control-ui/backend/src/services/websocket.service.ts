import { Server as IOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { RouterService } from './router.service';
import { CrosspointState, RouterLabel, SalvoGroup } from '../types/swp08.types';

export interface ClientToServerEvents {
  // Crosspoint control
  'take-crosspoint': (data: { destination: number; source: number; level?: number; matrix?: number }) => void;
  'take-multi-level': (data: { destination: number; source: number; levels: number[]; matrix?: number }) => void;
  'query-crosspoint': (data: { destination: number; level?: number; matrix?: number }, callback: (source: number) => void) => void;
  
  // Label management
  'set-label': (data: { type: 'source' | 'destination'; index: number; label: string; level?: number; matrix?: number }) => void;
  'get-label': (data: { type: 'source' | 'destination'; index: number; level?: number; matrix?: number }, callback: (label: string) => void) => void;
  'get-all-labels': (callback: (labels: RouterLabel[]) => void) => void;
  
  // Salvo management
  'create-salvo': (data: { id: number; name: string; crosspoints: SalvoGroup['crosspoints'] }) => void;
  'execute-salvo': (data: { id: number }) => void;
  'get-all-salvos': (callback: (salvos: SalvoGroup[]) => void) => void;
  
  // Status and state
  'get-status': (callback: (status: any) => void) => void;
  'get-all-crosspoints': (callback: (crosspoints: CrosspointState[]) => void) => void;
  'get-crosspoints-by-level': (data: { level: number; matrix?: number }, callback: (crosspoints: CrosspointState[]) => void) => void;
  
  // Connection
  'subscribe': () => void;
  'unsubscribe': () => void;
}

export interface ServerToClientEvents {
  // Real-time updates
  'crosspoint-change': (state: CrosspointState) => void;
  'label-change': (data: { type: string; index: number; label: string; level: number; matrix: number }) => void;
  'salvo-change': (data: { id: number; name: string; crosspoints: SalvoGroup['crosspoints'] }) => void;
  'router-connected': () => void;
  'router-disconnected': () => void;
  'router-error': (error: string) => void;
  
  // Status updates
  'status-update': (status: any) => void;
  'crosspoint-update': (crosspoints: CrosspointState[]) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  clientId: string;
  subscribed: boolean;
}

export class WebSocketService {
  private io: IOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
  private routerService: RouterService;
  private connectedClients: Map<string, Socket> = new Map();

  constructor(server: HTTPServer, routerService: RouterService) {
    this.routerService = routerService;
    
    // Initialize Socket.IO with CORS support
    this.io = new IOServer(server, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: ['GET', 'POST']
      },
      transports: ['websocket', 'polling']
    });

    this.setupEventHandlers();
    this.setupRouterEventHandlers();
  }

  /**
   * Setup Socket.IO event handlers
   */
  private setupEventHandlers(): void {
    this.io.on('connection', (socket) => {
      console.log(`Client connected: ${socket.id}`);
      this.connectedClients.set(socket.id, socket);

      // Set socket data
      socket.data.clientId = socket.id;
      socket.data.subscribed = false;

      // Handle subscription
      socket.on('subscribe', () => {
        socket.data.subscribed = true;
        
        // Send initial state
        const status = this.routerService.getStatus();
        const crosspoints = this.routerService.getAllCrosspoints();
        
        socket.emit('status-update', status);
        socket.emit('crosspoint-update', crosspoints);
      });

      socket.on('unsubscribe', () => {
        socket.data.subscribed = false;
      });

      // Crosspoint control
      socket.on('take-crosspoint', async (data) => {
        try {
          await this.routerService.takeCrosspoint(
            data.destination,
            data.source,
            data.level || 0,
            data.matrix || 0
          );
        } catch (error) {
          socket.emit('router-error', (error as Error).message);
        }
      });

      socket.on('take-multi-level', async (data) => {
        try {
          await this.routerService.takeMultiLevel(
            data.destination,
            data.source,
            data.levels,
            data.matrix || 0
          );
        } catch (error) {
          socket.emit('router-error', (error as Error).message);
        }
      });

      socket.on('query-crosspoint', async (data, callback) => {
        try {
          const source = await this.routerService.queryCrosspoint(
            data.destination,
            data.level || 0,
            data.matrix || 0
          );
          callback(source);
        } catch (error) {
          socket.emit('router-error', (error as Error).message);
          callback(-1);
        }
      });

      // Label management
      socket.on('set-label', (data) => {
        this.routerService.setLabel(
          data.type,
          data.index,
          data.label,
          data.level || 0,
          data.matrix || 0
        );
      });

      socket.on('get-label', (data, callback) => {
        const label = this.routerService.getLabel(
          data.type,
          data.index,
          data.level || 0,
          data.matrix || 0
        );
        callback(label);
      });

      socket.on('get-all-labels', (callback) => {
        const labels = this.routerService.getAllLabels();
        callback(labels);
      });

      // Salvo management
      socket.on('create-salvo', (data) => {
        this.routerService.createSalvo(data.id, data.name, data.crosspoints);
      });

      socket.on('execute-salvo', async (data) => {
        try {
          await this.routerService.executeSalvo(data.id);
        } catch (error) {
          socket.emit('router-error', (error as Error).message);
        }
      });

      socket.on('get-all-salvos', (callback) => {
        const salvos = this.routerService.getAllSalvos();
        callback(salvos);
      });

      // Status queries
      socket.on('get-status', (callback) => {
        const status = this.routerService.getStatus();
        callback(status);
      });

      socket.on('get-all-crosspoints', (callback) => {
        const crosspoints = this.routerService.getAllCrosspoints();
        callback(crosspoints);
      });

      socket.on('get-crosspoints-by-level', (data, callback) => {
        const crosspoints = this.routerService.getCrosspointsByLevel(
          data.level,
          data.matrix || 0
        );
        callback(crosspoints);
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
        this.connectedClients.delete(socket.id);
      });
    });
  }

  /**
   * Setup router service event handlers
   */
  private setupRouterEventHandlers(): void {
    // Forward router events to subscribed clients
    this.routerService.on('connected', () => {
      this.broadcastToSubscribed('router-connected');
    });

    this.routerService.on('disconnected', () => {
      this.broadcastToSubscribed('router-disconnected');
    });

    this.routerService.on('error', (error) => {
      this.broadcastToSubscribed('router-error', error.message);
    });

    this.routerService.on('crosspoint-change', (state) => {
      this.broadcastToSubscribed('crosspoint-change', state);
    });

    this.routerService.on('label-change', (data) => {
      this.broadcastToSubscribed('label-change', data);
    });

    this.routerService.on('salvo-change', (data) => {
      this.broadcastToSubscribed('salvo-change', data);
    });

    // Periodic status updates
    setInterval(() => {
      const status = this.routerService.getStatus();
      this.broadcastToSubscribed('status-update', status);
    }, 5000); // Every 5 seconds
  }

  /**
   * Broadcast to subscribed clients only
   */
  private broadcastToSubscribed<K extends keyof ServerToClientEvents>(
    event: K,
    ...args: Parameters<ServerToClientEvents[K]>
  ): void {
    this.connectedClients.forEach((socket) => {
      if (socket.data.subscribed) {
        (socket.emit as any)(event, ...args);
      }
    });
  }

  /**
   * Broadcast to all clients
   */
  private broadcastToAll<K extends keyof ServerToClientEvents>(
    event: K,
    ...args: Parameters<ServerToClientEvents[K]>
  ): void {
    (this.io.emit as any)(event, ...args);
  }

  /**
   * Send to specific client
   */
  private sendToClient<K extends keyof ServerToClientEvents>(
    clientId: string,
    event: K,
    ...args: Parameters<ServerToClientEvents[K]>
  ): void {
    const socket = this.connectedClients.get(clientId);
    if (socket) {
      (socket.emit as any)(event, ...args);
    }
  }

  /**
   * Get connected client count
   */
  getClientCount(): number {
    return this.connectedClients.size;
  }

  /**
   * Get subscribed client count
   */
  getSubscribedClientCount(): number {
    let count = 0;
    this.connectedClients.forEach((socket) => {
      if (socket.data.subscribed) count++;
    });
    return count;
  }

  /**
   * Shutdown WebSocket server
   */
  shutdown(): void {
    this.io.close();
  }
}