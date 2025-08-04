import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Box, Paper, Typography, Tooltip, IconButton, TextField } from '@mui/material';
import { ZoomIn, ZoomOut, ZoomOutMap, Search } from '@mui/icons-material';
import { useRouter } from '../../hooks/useRouter';
import { MatrixCell } from '../../types/router.types';
import './MatrixGrid.css';

interface MatrixGridProps {
  level?: number;
  matrix?: number;
  maxSources?: number;
  maxDestinations?: number;
  cellSize?: number;
  showLabels?: boolean;
}

export const MatrixGrid: React.FC<MatrixGridProps> = ({
  level = 0,
  matrix = 0,
  maxSources = 32,
  maxDestinations = 32,
  cellSize = 24,
  showLabels = true
}) => {
  const { crosspoints, getLabel, takeCrosspoint, getCrosspointState } = useRouter();
  const [zoom, setZoom] = useState(1);
  const [searchSource, setSearchSource] = useState('');
  const [searchDest, setSearchDest] = useState('');
  const [selectedCell, setSelectedCell] = useState<MatrixCell | null>(null);
  const [hoveredCell, setHoveredCell] = useState<MatrixCell | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Calculate visible range based on viewport
  const [visibleRange, setVisibleRange] = useState({
    startRow: 0,
    endRow: maxDestinations,
    startCol: 0,
    endCol: maxSources
  });

  // Filter sources and destinations based on search
  const filteredSources = useMemo(() => {
    if (!searchSource) return Array.from({ length: maxSources }, (_, i) => i);
    
    return Array.from({ length: maxSources }, (_, i) => i).filter(i => {
      const label = getLabel('source', i, level, matrix);
      return label.toLowerCase().includes(searchSource.toLowerCase()) || 
             i.toString().includes(searchSource);
    });
  }, [searchSource, maxSources, getLabel, level, matrix]);

  const filteredDestinations = useMemo(() => {
    if (!searchDest) return Array.from({ length: maxDestinations }, (_, i) => i);
    
    return Array.from({ length: maxDestinations }, (_, i) => i).filter(i => {
      const label = getLabel('destination', i, level, matrix);
      return label.toLowerCase().includes(searchDest.toLowerCase()) || 
             i.toString().includes(searchDest);
    });
  }, [searchDest, maxDestinations, getLabel, level, matrix]);

  // Handle cell click
  const handleCellClick = useCallback((row: number, col: number) => {
    const state = getCrosspointState(row, level, matrix);
    const isConnected = state?.source === col && state?.status === 'connected';
    
    if (!isConnected) {
      takeCrosspoint(row, col, level, matrix);
    }
    
    setSelectedCell({ row, col, connected: !isConnected });
  }, [getCrosspointState, takeCrosspoint, level, matrix]);

  // Handle zoom
  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.1, 2));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.1, 0.5));
  const handleZoomReset = () => setZoom(1);

  // Get cell state
  const getCellState = useCallback((row: number, col: number): MatrixCell => {
    const state = getCrosspointState(row, level, matrix);
    const connected = state?.source === col && state?.status === 'connected';
    const pending = state?.source === col && state?.status === 'pending';
    const selected = selectedCell?.row === row && selectedCell?.col === col;
    
    return {
      row,
      col,
      connected,
      pending,
      selected
    };
  }, [getCrosspointState, selectedCell, level, matrix]);

  // Render grid cell
  const renderCell = (row: number, col: number) => {
    const cellState = getCellState(row, col);
    const sourceLabel = getLabel('source', col, level, matrix);
    const destLabel = getLabel('destination', row, level, matrix);
    
    const cellClass = [
      'matrix-cell',
      cellState.connected && 'connected',
      cellState.pending && 'pending',
      cellState.selected && 'selected',
      hoveredCell?.row === row && 'hover-row',
      hoveredCell?.col === col && 'hover-col'
    ].filter(Boolean).join(' ');

    return (
      <Tooltip
        key={`${row}-${col}`}
        title={`${destLabel} ← ${sourceLabel}`}
        arrow
        placement="top"
      >
        <div
          className={cellClass}
          style={{
            width: cellSize * zoom,
            height: cellSize * zoom
          }}
          onClick={() => handleCellClick(row, col)}
          onMouseEnter={() => setHoveredCell({ row, col, connected: cellState.connected })}
          onMouseLeave={() => setHoveredCell(null)}
        />
      </Tooltip>
    );
  };

  // Render source labels
  const renderSourceLabels = () => {
    if (!showLabels) return null;

    return (
      <div className="matrix-source-labels" style={{ marginLeft: 120 * zoom }}>
        {filteredSources.map(i => (
          <div
            key={i}
            className={`matrix-label source ${hoveredCell?.col === i ? 'hover' : ''}`}
            style={{
              width: cellSize * zoom,
              fontSize: `${12 * zoom}px`
            }}
          >
            <span className="label-index">{i + 1}</span>
            <span className="label-text">{getLabel('source', i, level, matrix)}</span>
          </div>
        ))}
      </div>
    );
  };

  // Render destination labels
  const renderDestinationLabels = () => {
    if (!showLabels) return null;

    return (
      <div className="matrix-dest-labels" style={{ width: 120 * zoom }}>
        {filteredDestinations.map(i => (
          <div
            key={i}
            className={`matrix-label destination ${hoveredCell?.row === i ? 'hover' : ''}`}
            style={{
              height: cellSize * zoom,
              fontSize: `${12 * zoom}px`
            }}
          >
            <span className="label-index">{i + 1}</span>
            <span className="label-text">{getLabel('destination', i, level, matrix)}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Paper className="matrix-grid-container" elevation={3}>
      {/* Controls */}
      <Box className="matrix-controls" p={2}>
        <Box display="flex" gap={2} alignItems="center">
          <TextField
            size="small"
            placeholder="Search sources..."
            value={searchSource}
            onChange={(e) => setSearchSource(e.target.value)}
            InputProps={{
              startAdornment: <Search fontSize="small" />
            }}
          />
          <TextField
            size="small"
            placeholder="Search destinations..."
            value={searchDest}
            onChange={(e) => setSearchDest(e.target.value)}
            InputProps={{
              startAdornment: <Search fontSize="small" />
            }}
          />
          <Box display="flex" gap={1}>
            <IconButton size="small" onClick={handleZoomOut}>
              <ZoomOut />
            </IconButton>
            <IconButton size="small" onClick={handleZoomReset}>
              <ZoomOutMap />
            </IconButton>
            <IconButton size="small" onClick={handleZoomIn}>
              <ZoomIn />
            </IconButton>
          </Box>
          <Typography variant="body2">
            Zoom: {Math.round(zoom * 100)}%
          </Typography>
        </Box>
      </Box>

      {/* Grid */}
      <Box className="matrix-grid-wrapper" ref={gridRef}>
        {renderSourceLabels()}
        
        <div className="matrix-grid-content">
          {showLabels && renderDestinationLabels()}
          
          <div className="matrix-cells">
            {filteredDestinations.map(row => (
              <div key={row} className="matrix-row">
                {filteredSources.map(col => renderCell(row, col))}
              </div>
            ))}
          </div>
        </div>
      </Box>

      {/* Status bar */}
      <Box className="matrix-status" p={1}>
        <Typography variant="caption">
          {hoveredCell && (
            <>
              {getLabel('destination', hoveredCell.row, level, matrix)} ← {getLabel('source', hoveredCell.col, level, matrix)}
              {hoveredCell.connected && ' (Connected)'}
            </>
          )}
        </Typography>
      </Box>
    </Paper>
  );
};