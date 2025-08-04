// Router types shared between frontend and backend

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

export interface RouterStatus {
  connected: boolean;
  connectionType: 'serial' | 'tcp';
  crosspointCount: number;
  lastUpdate: Date;
}

export interface RouterConfig {
  maxSources: number;
  maxDestinations: number;
  maxLevels: number;
}

// WebSocket event types
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
  'get-status': (callback: (status: RouterStatus) => void) => void;
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
  'status-update': (status: RouterStatus) => void;
  'crosspoint-update': (crosspoints: CrosspointState[]) => void;
}

// View modes for the UI
export type ViewMode = 'matrix' | 'xy-panel' | 'button-grid' | 'list';

// Matrix cell state for UI
export interface MatrixCell {
  row: number; // destination
  col: number; // source
  connected: boolean;
  pending?: boolean;
  locked?: boolean;
  selected?: boolean;
}

// UI Theme
export interface Theme {
  mode: 'light' | 'dark';
  primaryColor: string;
  secondaryColor: string;
  connectedColor: string;
  pendingColor: string;
  disconnectedColor: string;
}