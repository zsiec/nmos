import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { RouterService } from './services/router.service';
import { WebSocketService } from './services/websocket.service';

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000'
}));
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    router: routerService?.getStatus() || { connected: false }
  });
});

// API Routes
app.get('/api/config', (req, res) => {
  res.json({
    maxSources: parseInt(process.env.MAX_SOURCES || '1024'),
    maxDestinations: parseInt(process.env.MAX_DESTINATIONS || '1024'),
    maxLevels: parseInt(process.env.MAX_LEVELS || '16')
  });
});

// Initialize services
let routerService: RouterService;
let websocketService: WebSocketService;

async function startServer() {
  try {
    // Configure router service
    const routerConfig = {
      type: process.env.CONNECTION_TYPE as 'serial' | 'tcp' || 'tcp',
      tcpHost: process.env.TCP_HOST || 'localhost',
      tcpPort: parseInt(process.env.TCP_PORT || '2000'),
      serialPort: process.env.SERIAL_PORT || '/dev/ttyUSB0',
      baudRate: parseInt(process.env.SERIAL_BAUD_RATE || '38400'),
      maxSources: parseInt(process.env.MAX_SOURCES || '1024'),
      maxDestinations: parseInt(process.env.MAX_DESTINATIONS || '1024'),
      maxLevels: parseInt(process.env.MAX_LEVELS || '16')
    };

    // Initialize router service
    routerService = new RouterService(routerConfig);
    
    // Initialize WebSocket service
    websocketService = new WebSocketService(server, routerService);

    // Connect to router
    if (process.env.AUTO_CONNECT !== 'false') {
      console.log('Attempting to connect to router...');
      try {
        await routerService.connect();
        console.log('Connected to router successfully');
      } catch (error) {
        console.error('Failed to connect to router:', error);
        console.log('Server will continue running, router connection can be established later');
      }
    }

    // Router service event logging
    routerService.on('connected', () => {
      console.log('Router connected');
    });

    routerService.on('disconnected', () => {
      console.log('Router disconnected');
    });

    routerService.on('error', (error) => {
      console.error('Router error:', error);
    });

    routerService.on('crosspoint-change', (state) => {
      console.log(`Crosspoint change: Dest ${state.destination} <- Source ${state.source} (Level ${state.level})`);
    });

    // Start HTTP server
    const port = parseInt(process.env.PORT || '3001');
    server.listen(port, () => {
      console.log(`Server running on port ${port}`);
      console.log(`WebSocket server available on ws://localhost:${port}`);
      console.log(`Health check: http://localhost:${port}/health`);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

async function shutdown() {
  console.log('Shutting down gracefully...');
  
  if (websocketService) {
    websocketService.shutdown();
  }
  
  if (routerService) {
    routerService.disconnect();
  }
  
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
  
  // Force exit after 10 seconds
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

// Start the server
startServer().catch(console.error);