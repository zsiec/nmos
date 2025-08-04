// SW-P-08 Protocol Types

// Protocol constants
export const SWP08_CONSTANTS = {
  // Frame bytes
  DLE: 0x10,
  STX: 0x02,
  ETX: 0x03,
  ACK: 0x06,
  NAK: 0x15,
  
  // Timing
  ACK_TIMEOUT_MS: 1000,
  MAX_RETRIES: 5,
  
  // Size limits
  MAX_MESSAGE_SIZE: 128,
  MAX_SOURCES: 1024,
  MAX_DESTINATIONS: 1024,
  MAX_LEVELS: 16
} as const;

// Command bytes for SW-P-08 protocol
export enum SWP08Commands {
  // Input commands (Remote → Controller)
  CROSSPOINT_INTERROGATE = 0x01,
  CROSSPOINT_CONNECT = 0x02,
  CROSSPOINT_TALLY_DUMP_REQUEST = 0x15,
  CROSSPOINT_CONNECT_ON_GO_GROUP_SALVO = 0x78,
  CROSSPOINT_GO_GROUP_SALVO = 0x79,
  CROSSPOINT_GROUP_SALVO_INTERROGATE = 0x7C,
  
  // Output commands (Controller → Remote)
  CROSSPOINT_TALLY = 0x03,
  CROSSPOINT_CONNECTED = 0x04,
  CROSSPOINT_TALLY_DUMP_BYTE = 0x16,
  CROSSPOINT_TALLY_DUMP_WORD = 0x17,
  CROSSPOINT_CONNECT_ON_GO_GROUP_SALVO_ACK = 0x7A,
  CROSSPOINT_GO_DONE_GROUP_SALVO_ACK = 0x7B,
  CROSSPOINT_GROUP_SALVO_TALLY = 0x7D
}

// Message structure interfaces
export interface SWP08Frame {
  command: number;
  data: Buffer;
  checksum?: number;
}

export interface SWP08Message {
  command: SWP08Commands;
  matrix: number;
  level: number;
  destination: number;
  source?: number;
  salvoGroup?: number;
  sourceStatus?: boolean; // For TDM routers
}

export interface CrosspointState {
  matrix: number;
  level: number;
  destination: number;
  source: number;
  status: 'connected' | 'pending' | 'disconnected';
  timestamp: Date;
}

export interface RouterLabel {
  type: 'source' | 'destination';
  index: number;
  label: string;
  matrix: number;
  level: number;
}

export interface SalvoGroup {
  id: number;
  name: string;
  crosspoints: Array<{
    destination: number;
    source: number;
    level: number;
  }>;
}

// Protocol parsing helpers
export interface ParsedMultiplier {
  destinationHigh: number;
  sourceStatus: boolean;
  sourceHigh: number;
}

// Connection types
export type ConnectionType = 'serial' | 'tcp';

export interface ConnectionConfig {
  type: ConnectionType;
  serialPort?: string;
  baudRate?: number;
  tcpHost?: string;
  tcpPort?: number;
}

// Event types for the protocol handler
export interface SWP08Events {
  'crosspoint-change': (state: CrosspointState) => void;
  'tally-update': (message: SWP08Message) => void;
  'connected': () => void;
  'disconnected': () => void;
  'error': (error: Error) => void;
}