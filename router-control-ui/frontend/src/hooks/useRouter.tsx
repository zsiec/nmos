import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { socketService } from '../services/socket.service';
import {
  CrosspointState,
  RouterLabel,
  RouterStatus,
  SalvoGroup,
  RouterConfig
} from '../types/router.types';

interface RouterContextState {
  // Connection state
  connected: boolean;
  connecting: boolean;
  error: string | null;
  
  // Router state
  status: RouterStatus | null;
  crosspoints: Map<string, CrosspointState>;
  labels: Map<string, RouterLabel>;
  salvos: Map<number, SalvoGroup>;
  config: RouterConfig | null;
  
  // Methods
  connect: () => Promise<void>;
  disconnect: () => void;
  takeCrosspoint: (destination: number, source: number, level?: number, matrix?: number) => Promise<void>;
  takeMultiLevel: (destination: number, source: number, levels: number[], matrix?: number) => Promise<void>;
  setLabel: (type: 'source' | 'destination', index: number, label: string, level?: number, matrix?: number) => void;
  getLabel: (type: 'source' | 'destination', index: number, level?: number, matrix?: number) => string;
  createSalvo: (id: number, name: string, crosspoints: SalvoGroup['crosspoints']) => void;
  executeSalvo: (id: number) => Promise<void>;
  getCrosspointState: (destination: number, level?: number, matrix?: number) => CrosspointState | undefined;
  getSourceForDestination: (destination: number, level?: number, matrix?: number) => number;
}

const RouterContext = createContext<RouterContextState | null>(null);

export const useRouter = () => {
  const context = useContext(RouterContext);
  if (!context) {
    throw new Error('useRouter must be used within RouterProvider');
  }
  return context;
};

interface RouterProviderProps {
  children: React.ReactNode;
}

export const RouterProvider: React.FC<RouterProviderProps> = ({ children }) => {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<RouterStatus | null>(null);
  const [crosspoints, setCrosspoints] = useState<Map<string, CrosspointState>>(new Map());
  const [labels, setLabels] = useState<Map<string, RouterLabel>>(new Map());
  const [salvos, setSalvos] = useState<Map<number, SalvoGroup>>(new Map());
  const [config, setConfig] = useState<RouterConfig | null>(null);

  // Helper to create crosspoint key
  const getCrosspointKey = (destination: number, level: number = 0, matrix: number = 0) => {
    return `${matrix}:${level}:${destination}`;
  };

  // Helper to create label key
  const getLabelKey = (type: string, index: number, level: number = 0, matrix: number = 0) => {
    return `${type}:${matrix}:${level}:${index}`;
  };

  // Setup socket event listeners
  useEffect(() => {
    const unsubscribers: (() => void)[] = [];

    // Connection events
    unsubscribers.push(
      socketService.on('router-connected', () => {
        setConnected(true);
        setError(null);
      })
    );

    unsubscribers.push(
      socketService.on('router-disconnected', () => {
        setConnected(false);
      })
    );

    unsubscribers.push(
      socketService.on('router-error', (errorMsg: string) => {
        setError(errorMsg);
      })
    );

    // Status updates
    unsubscribers.push(
      socketService.on('status-update', (newStatus: RouterStatus) => {
        setStatus(newStatus);
        setConnected(newStatus.connected);
      })
    );

    // Crosspoint updates
    unsubscribers.push(
      socketService.on('crosspoint-change', (state: CrosspointState) => {
        setCrosspoints(prev => {
          const next = new Map(prev);
          const key = getCrosspointKey(state.destination, state.level, state.matrix);
          next.set(key, state);
          return next;
        });
      })
    );

    unsubscribers.push(
      socketService.on('crosspoint-update', (states: CrosspointState[]) => {
        setCrosspoints(prev => {
          const next = new Map(prev);
          states.forEach(state => {
            const key = getCrosspointKey(state.destination, state.level, state.matrix);
            next.set(key, state);
          });
          return next;
        });
      })
    );

    // Label updates
    unsubscribers.push(
      socketService.on('label-change', (data: any) => {
        setLabels(prev => {
          const next = new Map(prev);
          const key = getLabelKey(data.type, data.index, data.level, data.matrix);
          next.set(key, {
            type: data.type,
            index: data.index,
            label: data.label,
            level: data.level,
            matrix: data.matrix
          });
          return next;
        });
      })
    );

    // Salvo updates
    unsubscribers.push(
      socketService.on('salvo-change', (salvo: any) => {
        setSalvos(prev => {
          const next = new Map(prev);
          next.set(salvo.id, salvo);
          return next;
        });
      })
    );

    // Cleanup
    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, []);

  // Connect to server
  const connect = useCallback(async () => {
    if (connecting || connected) return;

    setConnecting(true);
    setError(null);

    try {
      await socketService.connect();
      
      // Fetch initial data
      const [initialStatus, initialCrosspoints, initialLabels, initialSalvos] = await Promise.all([
        socketService.getStatus(),
        socketService.getAllCrosspoints(),
        socketService.getAllLabels(),
        socketService.getAllSalvos()
      ]);

      setStatus(initialStatus);
      setConnected(initialStatus.connected);

      // Process crosspoints
      const cpMap = new Map<string, CrosspointState>();
      initialCrosspoints.forEach(cp => {
        const key = getCrosspointKey(cp.destination, cp.level, cp.matrix);
        cpMap.set(key, cp);
      });
      setCrosspoints(cpMap);

      // Process labels
      const labelMap = new Map<string, RouterLabel>();
      initialLabels.forEach(label => {
        const key = getLabelKey(label.type, label.index, label.level, label.matrix);
        labelMap.set(key, label);
      });
      setLabels(labelMap);

      // Process salvos
      const salvoMap = new Map<number, SalvoGroup>();
      initialSalvos.forEach(salvo => {
        salvoMap.set(salvo.id, salvo);
      });
      setSalvos(salvoMap);

      // Fetch config
      const response = await fetch('/api/config');
      if (response.ok) {
        const configData = await response.json();
        setConfig(configData);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
    } finally {
      setConnecting(false);
    }
  }, [connecting, connected]);

  // Disconnect from server
  const disconnect = useCallback(() => {
    socketService.disconnect();
    setConnected(false);
  }, []);

  // Take crosspoint
  const takeCrosspoint = useCallback(async (destination: number, source: number, level: number = 0, matrix: number = 0) => {
    try {
      socketService.takeCrosspoint(destination, source, level, matrix);
      
      // Optimistically update local state
      setCrosspoints(prev => {
        const next = new Map(prev);
        const key = getCrosspointKey(destination, level, matrix);
        next.set(key, {
          matrix,
          level,
          destination,
          source,
          status: 'pending',
          timestamp: new Date()
        });
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to take crosspoint');
      throw err;
    }
  }, []);

  // Take multiple levels
  const takeMultiLevel = useCallback(async (destination: number, source: number, levels: number[], matrix: number = 0) => {
    try {
      socketService.takeMultiLevel(destination, source, levels, matrix);
      
      // Optimistically update local state for all levels
      setCrosspoints(prev => {
        const next = new Map(prev);
        levels.forEach(level => {
          const key = getCrosspointKey(destination, level, matrix);
          next.set(key, {
            matrix,
            level,
            destination,
            source,
            status: 'pending',
            timestamp: new Date()
          });
        });
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to take multi-level');
      throw err;
    }
  }, []);

  // Set label
  const setLabel = useCallback((type: 'source' | 'destination', index: number, label: string, level: number = 0, matrix: number = 0) => {
    socketService.setLabel(type, index, label, level, matrix);
    
    // Optimistically update local state
    setLabels(prev => {
      const next = new Map(prev);
      const key = getLabelKey(type, index, level, matrix);
      next.set(key, { type, index, label, level, matrix });
      return next;
    });
  }, []);

  // Get label
  const getLabel = useCallback((type: 'source' | 'destination', index: number, level: number = 0, matrix: number = 0): string => {
    const key = getLabelKey(type, index, level, matrix);
    const label = labels.get(key);
    return label?.label || `${type.charAt(0).toUpperCase()}${index + 1}`;
  }, [labels]);

  // Create salvo
  const createSalvo = useCallback((id: number, name: string, crosspoints: SalvoGroup['crosspoints']) => {
    socketService.createSalvo(id, name, crosspoints);
    
    // Optimistically update local state
    setSalvos(prev => {
      const next = new Map(prev);
      next.set(id, { id, name, crosspoints });
      return next;
    });
  }, []);

  // Execute salvo
  const executeSalvo = useCallback(async (id: number) => {
    try {
      socketService.executeSalvo(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to execute salvo');
      throw err;
    }
  }, []);

  // Get crosspoint state
  const getCrosspointState = useCallback((destination: number, level: number = 0, matrix: number = 0): CrosspointState | undefined => {
    const key = getCrosspointKey(destination, level, matrix);
    return crosspoints.get(key);
  }, [crosspoints]);

  // Get source for destination
  const getSourceForDestination = useCallback((destination: number, level: number = 0, matrix: number = 0): number => {
    const state = getCrosspointState(destination, level, matrix);
    return state?.source ?? -1;
  }, [getCrosspointState]);

  const value: RouterContextState = {
    connected,
    connecting,
    error,
    status,
    crosspoints,
    labels,
    salvos,
    config,
    connect,
    disconnect,
    takeCrosspoint,
    takeMultiLevel,
    setLabel,
    getLabel,
    createSalvo,
    executeSalvo,
    getCrosspointState,
    getSourceForDestination
  };

  return (
    <RouterContext.Provider value={value}>
      {children}
    </RouterContext.Provider>
  );
};