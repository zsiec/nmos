# Router Control UI - SW-P-08 Protocol

A professional web-based router control interface implementing the SW-P-08 (Pro-Bel) protocol for broadcast router control. This system provides real-time control and monitoring of video/audio routers through an intuitive web interface.

## Features

- **Full SW-P-08 Protocol Support**: Complete implementation of the Pro-Bel SW-P-08 protocol
- **Real-time Updates**: WebSocket-based communication for instant crosspoint status updates
- **Matrix Grid View**: Interactive grid interface for visualizing and controlling crosspoints
- **Multi-level Support**: Control video and multiple audio levels simultaneously
- **Label Management**: Custom naming for sources and destinations
- **Salvo Operations**: Create and execute grouped crosspoint changes
- **Connection Options**: Support for both TCP/IP and serial (RS232/RS422) connections
- **Responsive Design**: Works on desktop and tablet devices
- **Dark Mode Support**: Automatic theme switching based on system preferences

## Architecture

The system consists of two main components:

### Backend (Node.js/TypeScript)
- SW-P-08 protocol implementation with message parsing and checksum validation
- WebSocket server for real-time client communication
- Support for both TCP and serial router connections
- Router state management and caching
- RESTful API for configuration

### Frontend (React/TypeScript)
- Material-UI based responsive interface
- Real-time WebSocket client
- Interactive matrix grid component
- Connection status monitoring
- Label and salvo management

## Quick Start

### Prerequisites
- Node.js (v16+ recommended)
- npm or yarn
- A router supporting SW-P-08 protocol (or a simulator)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd router-control-ui
```

2. Install backend dependencies:
```bash
cd backend
npm install
```

3. Install frontend dependencies:
```bash
cd ../frontend
npm install
```

### Configuration

1. Configure the backend by copying `.env.example` to `.env`:
```bash
cd backend
cp .env.example .env
```

2. Edit `.env` to match your router configuration:
```env
# Connection type: 'tcp' or 'serial'
CONNECTION_TYPE=tcp

# For TCP connections
TCP_HOST=localhost
TCP_PORT=2000

# For serial connections
SERIAL_PORT=/dev/ttyUSB0
SERIAL_BAUD_RATE=38400

# Router size
MAX_SOURCES=1024
MAX_DESTINATIONS=1024
MAX_LEVELS=16
```

### Running the Application

1. Start the backend server:
```bash
cd backend
npm run dev
```

2. In a new terminal, start the frontend:
```bash
cd frontend
npm start
```

3. Open your browser to http://localhost:3000

## Usage

### Matrix Grid Interface

- **Click any cell** to make a crosspoint connection
- **Hover** over cells to see source/destination labels
- **Green cells** indicate active connections
- **Orange cells** indicate pending connections
- **Use search** to filter sources and destinations
- **Zoom controls** allow you to adjust the grid size

### Keyboard Shortcuts (planned)
- `Space`: Take selected crosspoint
- `Arrow keys`: Navigate grid
- `Ctrl+F`: Focus search
- `Esc`: Clear selection

## API Documentation

### WebSocket Events

#### Client to Server
- `take-crosspoint`: Connect source to destination
- `take-multi-level`: Connect multiple levels
- `query-crosspoint`: Get current source for destination
- `set-label`: Set custom label
- `create-salvo`: Create salvo group
- `execute-salvo`: Execute salvo

#### Server to Client
- `crosspoint-change`: Crosspoint state update
- `router-connected`: Router connection established
- `router-disconnected`: Router connection lost
- `router-error`: Error message

### REST API Endpoints
- `GET /health`: Health check
- `GET /api/config`: Get router configuration

## Protocol Details

The SW-P-08 protocol implementation includes:
- Frame delimiters (DLE/STX/ETX)
- 7-bit 2's complement checksums
- DLE transparency (escaping)
- ACK/NAK handshaking
- Automatic retry on failure (up to 5 attempts)
- Support for up to 1024 sources/destinations

## Development

### Project Structure
```
router-control-ui/
├── backend/
│   ├── src/
│   │   ├── protocol/     # SW-P-08 protocol implementation
│   │   ├── services/     # Business logic
│   │   ├── types/        # TypeScript types
│   │   └── index.ts      # Server entry point
│   └── package.json
└── frontend/
    ├── src/
    │   ├── components/   # React components
    │   ├── hooks/        # Custom React hooks
    │   ├── services/     # API services
    │   └── types/        # TypeScript types
    └── package.json
```

### Building for Production

Backend:
```bash
cd backend
npm run build
npm start
```

Frontend:
```bash
cd frontend
npm run build
# Serve the build/ directory with any static web server
```

## Troubleshooting

### Connection Issues
- Verify router IP/port or serial port settings
- Check firewall rules for TCP port 2000 (SW-P-08) and 3001 (WebSocket)
- Ensure router supports SW-P-08 protocol
- Try using a serial connection if TCP fails

### Performance Issues
- Reduce matrix size in configuration
- Enable hardware acceleration in browser
- Use production builds for better performance

## View Modes

The application supports multiple view modes for different workflows:

### Matrix Grid View
- Traditional crosspoint matrix interface
- Click cells to make connections
- Visual feedback for active routes
- Zoom and search capabilities

### XY Panel View
- Destination-first workflow
- Select destination, then choose source
- Support for destination locking
- Multi-level routing (video + audio)

### Salvo Management
- Create and manage groups of crosspoint changes
- Execute multiple routes simultaneously
- Edit and organize salvos

## Additional Features

### Label Management
- Custom naming for sources and destinations
- Import/export labels via CSV
- Bulk rename functionality
- Per-level label support

### Preset Management
- Save complete router states
- Recall presets with one click
- Import/export preset configurations
- Update existing presets with current state

## Future Enhancements

- [ ] User authentication and permissions
- [ ] SNMP monitoring integration
- [ ] Mobile app
- [ ] Multi-router support
- [ ] Macro/automation system
- [ ] Scheduled preset recalls
- [ ] Router redundancy support

## License

MIT License - see LICENSE file for details

## Support

For issues and feature requests, please use the GitHub issue tracker.