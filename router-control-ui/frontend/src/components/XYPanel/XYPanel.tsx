import React, { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Chip,
  ToggleButton,
  ToggleButtonGroup,
  InputAdornment,
  Divider,
  IconButton,
  Stack
} from '@mui/material';
import {
  Search,
  Videocam,
  VolumeUp,
  Lock,
  LockOpen,
  CheckCircle,
  RadioButtonUnchecked
} from '@mui/icons-material';
import { useRouter } from '../../hooks/useRouter';
import './XYPanel.css';

interface XYPanelProps {
  level?: number;
  matrix?: number;
  maxSources?: number;
  maxDestinations?: number;
  columnsPerRow?: number;
}

export const XYPanel: React.FC<XYPanelProps> = ({
  level = 0,
  matrix = 0,
  maxSources = 32,
  maxDestinations = 32,
  columnsPerRow = 8
}) => {
  const { getLabel, takeCrosspoint, getCrosspointState, takeMultiLevel } = useRouter();
  
  // State
  const [selectedDestination, setSelectedDestination] = useState<number | null>(null);
  const [selectedLevels, setSelectedLevels] = useState<number[]>([level]);
  const [searchSource, setSearchSource] = useState('');
  const [searchDest, setSearchDest] = useState('');
  const [lockedDestinations, setLockedDestinations] = useState<Set<number>>(new Set());
  const [showOnlyConnected, setShowOnlyConnected] = useState(false);

  // Filter sources based on search
  const filteredSources = useMemo(() => {
    return Array.from({ length: maxSources }, (_, i) => i).filter(i => {
      const label = getLabel('source', i, level, matrix);
      const matchesSearch = !searchSource || 
        label.toLowerCase().includes(searchSource.toLowerCase()) || 
        i.toString().includes(searchSource);
      
      if (!matchesSearch) return false;
      
      if (showOnlyConnected && selectedDestination !== null) {
        const state = getCrosspointState(selectedDestination, level, matrix);
        return state?.source === i;
      }
      
      return true;
    });
  }, [searchSource, maxSources, getLabel, level, matrix, showOnlyConnected, selectedDestination, getCrosspointState]);

  // Filter destinations based on search
  const filteredDestinations = useMemo(() => {
    return Array.from({ length: maxDestinations }, (_, i) => i).filter(i => {
      const label = getLabel('destination', i, level, matrix);
      return !searchDest || 
        label.toLowerCase().includes(searchDest.toLowerCase()) || 
        i.toString().includes(searchDest);
    });
  }, [searchDest, maxDestinations, getLabel, level, matrix]);

  // Handle destination selection
  const handleDestinationSelect = useCallback((dest: number) => {
    if (lockedDestinations.has(dest)) return;
    setSelectedDestination(dest);
  }, [lockedDestinations]);

  // Handle source selection (take crosspoint)
  const handleSourceSelect = useCallback(async (source: number) => {
    if (selectedDestination === null) return;
    
    try {
      if (selectedLevels.length > 1) {
        await takeMultiLevel(selectedDestination, source, selectedLevels, matrix);
      } else {
        await takeCrosspoint(selectedDestination, source, selectedLevels[0], matrix);
      }
    } catch (error) {
      console.error('Failed to take crosspoint:', error);
    }
  }, [selectedDestination, selectedLevels, matrix, takeCrosspoint, takeMultiLevel]);

  // Handle level selection
  const handleLevelChange = (_event: React.MouseEvent<HTMLElement>, newLevels: number[]) => {
    if (newLevels.length > 0) {
      setSelectedLevels(newLevels);
    }
  };

  // Toggle destination lock
  const toggleDestinationLock = useCallback((dest: number) => {
    setLockedDestinations(prev => {
      const next = new Set(prev);
      if (next.has(dest)) {
        next.delete(dest);
      } else {
        next.add(dest);
      }
      return next;
    });
  }, []);

  // Get current source for destination
  const getCurrentSource = useCallback((dest: number): number | null => {
    const state = getCrosspointState(dest, level, matrix);
    return state?.status === 'connected' ? state.source : null;
  }, [getCrosspointState, level, matrix]);

  // Render destination button
  const renderDestinationButton = (dest: number) => {
    const isSelected = selectedDestination === dest;
    const isLocked = lockedDestinations.has(dest);
    const currentSource = getCurrentSource(dest);
    const label = getLabel('destination', dest, level, matrix);
    const sourceLabel = currentSource !== null ? getLabel('source', currentSource, level, matrix) : null;
    
    return (
      <Paper
        key={dest}
          elevation={isSelected ? 4 : 1}
          className={`xy-destination-button ${isSelected ? 'selected' : ''} ${isLocked ? 'locked' : ''}`}
        >
          <Box p={2}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography variant="subtitle2" color="textSecondary">
                Dest {dest + 1}
              </Typography>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleDestinationLock(dest);
                }}
              >
                {isLocked ? <Lock fontSize="small" /> : <LockOpen fontSize="small" />}
              </IconButton>
            </Box>
            
            <Button
              fullWidth
              variant={isSelected ? "contained" : "outlined"}
              onClick={() => handleDestinationSelect(dest)}
              disabled={isLocked}
              sx={{ mb: 1 }}
            >
              <Typography variant="body2" noWrap>
                {label}
              </Typography>
            </Button>
            
            {sourceLabel && (
              <Chip
                label={sourceLabel}
                size="small"
                color="success"
                icon={<CheckCircle />}
                sx={{ width: '100%' }}
              />
            )}
          </Box>
        </Paper>
    );
  };

  // Render source button
  const renderSourceButton = (source: number) => {
    const label = getLabel('source', source, level, matrix);
    const isConnected = selectedDestination !== null && 
      getCurrentSource(selectedDestination) === source;
    
    return (
        <Button
          key={source}
          variant={isConnected ? "contained" : "outlined"}
          color={isConnected ? "success" : "primary"}
          onClick={() => handleSourceSelect(source)}
          disabled={selectedDestination === null}
          className="xy-source-button"
          startIcon={isConnected ? <CheckCircle /> : <RadioButtonUnchecked />}
        >
          <Box>
            <Typography variant="caption" display="block">
              Src {source + 1}
            </Typography>
            <Typography variant="body2" noWrap>
              {label}
            </Typography>
          </Box>
        </Button>
    );
  };

  return (
    <Box className="xy-panel-container">
      {/* Destination Panel */}
      <Paper className="xy-destination-panel" elevation={3}>
        <Box p={2}>
          <Typography variant="h6" gutterBottom>
            Destinations
          </Typography>
          
          <TextField
            fullWidth
            size="small"
            placeholder="Search destinations..."
            value={searchDest}
            onChange={(e) => setSearchDest(e.target.value)}
            sx={{ mb: 2 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              )
            }}
          />
          
          <Box display="flex" flexWrap="wrap" gap={2}>
            {filteredDestinations.map(renderDestinationButton)}
          </Box>
        </Box>
      </Paper>

      {/* Source Panel */}
      <Paper className="xy-source-panel" elevation={3}>
        <Box p={2}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">
              Sources
            </Typography>
            
            {selectedDestination !== null && (
              <Chip
                label={`For: ${getLabel('destination', selectedDestination, level, matrix)}`}
                color="primary"
              />
            )}
          </Box>

          <Stack spacing={2} mb={2}>
            {/* Level Selection */}
            <Box>
              <Typography variant="body2" gutterBottom>
                Levels:
              </Typography>
              <ToggleButtonGroup
                value={selectedLevels}
                onChange={handleLevelChange}
                aria-label="level selection"
                size="small"
              >
                <ToggleButton value={0} aria-label="video">
                  <Videocam /> Video
                </ToggleButton>
                <ToggleButton value={1} aria-label="audio 1">
                  <VolumeUp /> Audio 1
                </ToggleButton>
                <ToggleButton value={2} aria-label="audio 2">
                  <VolumeUp /> Audio 2
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>

            {/* Search and Filters */}
            <TextField
              fullWidth
              size="small"
              placeholder="Search sources..."
              value={searchSource}
              onChange={(e) => setSearchSource(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                )
              }}
            />

            <ToggleButton
              value="connected"
              selected={showOnlyConnected}
              onChange={() => setShowOnlyConnected(!showOnlyConnected)}
              size="small"
              disabled={selectedDestination === null}
            >
              Show Only Connected
            </ToggleButton>
          </Stack>

          <Divider sx={{ mb: 2 }} />

          {selectedDestination === null ? (
            <Box className="xy-no-destination">
              <Typography variant="body1" color="textSecondary" align="center">
                Select a destination first
              </Typography>
            </Box>
          ) : (
            <Box display="flex" flexWrap="wrap" gap={1}>
              {filteredSources.map(renderSourceButton)}
            </Box>
          )}
        </Box>
      </Paper>
    </Box>
  );
};