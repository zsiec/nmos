import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Card,
  CardContent,
  CardActions,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  Alert,
  Snackbar,
  Menu,
  MenuItem,
  Tooltip
} from '@mui/material';
import {
  Save,
  PlayArrow,
  Delete,
  Edit,
  FileDownload,
  FileUpload,
  MoreVert,
  Schedule,
  Update
} from '@mui/icons-material';
import { useRouter } from '../../hooks/useRouter';
import { CrosspointState } from '../../types/router.types';
import './PresetManager.css';

interface Preset {
  id: string;
  name: string;
  description?: string;
  crosspoints: CrosspointState[];
  createdAt: Date;
  updatedAt: Date;
}

interface PresetDialogProps {
  open: boolean;
  preset: Preset | null;
  currentCrosspoints: CrosspointState[];
  onClose: () => void;
  onSave: (preset: Preset) => void;
}

const PresetDialog: React.FC<PresetDialogProps> = ({
  open,
  preset,
  currentCrosspoints,
  onClose,
  onSave
}) => {
  const [name, setName] = useState(preset?.name || '');
  const [description, setDescription] = useState(preset?.description || '');

  useEffect(() => {
    if (preset) {
      setName(preset.name);
      setDescription(preset.description || '');
    } else {
      setName('');
      setDescription('');
    }
  }, [preset]);

  const handleSave = () => {
    if (name.trim()) {
      const newPreset: Preset = {
        id: preset?.id || Date.now().toString(),
        name: name.trim(),
        description: description.trim(),
        crosspoints: preset?.crosspoints || currentCrosspoints.filter(cp => cp.status === 'connected'),
        createdAt: preset?.createdAt || new Date(),
        updatedAt: new Date()
      };
      onSave(newPreset);
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {preset ? 'Edit Preset' : 'Save Current State as Preset'}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 2 }}>
          <TextField
            fullWidth
            label="Preset Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            sx={{ mb: 2 }}
            autoFocus
          />
          <TextField
            fullWidth
            label="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            multiline
            rows={3}
          />
          {!preset && (
            <Alert severity="info" sx={{ mt: 2 }}>
              This will save {currentCrosspoints.filter(cp => cp.status === 'connected').length} active crosspoints
            </Alert>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" disabled={!name.trim()}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export const PresetManager: React.FC = () => {
  const { crosspoints, takeCrosspoint, getLabel } = useRouter();
  const [presets, setPresets] = useState<Preset[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPreset, setEditingPreset] = useState<Preset | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success'
  });

  const crosspointList = Array.from(crosspoints.values());

  // Load presets from localStorage on mount
  useEffect(() => {
    const savedPresets = localStorage.getItem('router-presets');
    if (savedPresets) {
      try {
        const parsed = JSON.parse(savedPresets);
        setPresets(parsed.map((p: any) => ({
          ...p,
          createdAt: new Date(p.createdAt),
          updatedAt: new Date(p.updatedAt)
        })));
      } catch (error) {
        console.error('Failed to load presets:', error);
      }
    }
  }, []);

  // Save presets to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('router-presets', JSON.stringify(presets));
  }, [presets]);

  const handleSaveCurrentState = () => {
    setEditingPreset(null);
    setDialogOpen(true);
  };

  const handleEditPreset = (preset: Preset) => {
    setEditingPreset(preset);
    setDialogOpen(true);
  };

  const handleSavePreset = (preset: Preset) => {
    setPresets(prev => {
      const existing = prev.findIndex(p => p.id === preset.id);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = preset;
        return updated;
      }
      return [...prev, preset];
    });
    
    setSnackbar({
      open: true,
      message: `Preset "${preset.name}" saved successfully`,
      severity: 'success'
    });
  };

  const handleRecallPreset = async (preset: Preset) => {
    try {
      // Apply all crosspoints from the preset
      for (const cp of preset.crosspoints) {
        await takeCrosspoint(cp.destination, cp.source, cp.level, cp.matrix);
      }
      
      setSnackbar({
        open: true,
        message: `Preset "${preset.name}" recalled successfully`,
        severity: 'success'
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: `Failed to recall preset: ${error}`,
        severity: 'error'
      });
    }
  };

  const handleDeletePreset = (presetId: string) => {
    const preset = presets.find(p => p.id === presetId);
    setPresets(prev => prev.filter(p => p.id !== presetId));
    setAnchorEl(null);
    
    setSnackbar({
      open: true,
      message: `Preset "${preset?.name}" deleted`,
      severity: 'success'
    });
  };

  const handleExportPresets = () => {
    const dataStr = JSON.stringify(presets, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `router-presets-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    setSnackbar({
      open: true,
      message: 'Presets exported successfully',
      severity: 'success'
    });
  };

  const handleImportPresets = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const imported = JSON.parse(event.target?.result as string);
            const validPresets = imported.map((p: any) => ({
              ...p,
              id: Date.now().toString() + Math.random(), // Generate new IDs to avoid conflicts
              createdAt: new Date(p.createdAt),
              updatedAt: new Date(p.updatedAt)
            }));
            setPresets(prev => [...prev, ...validPresets]);
            
            setSnackbar({
              open: true,
              message: `Imported ${validPresets.length} presets successfully`,
              severity: 'success'
            });
          } catch (error) {
            setSnackbar({
              open: true,
              message: 'Failed to import presets: Invalid file format',
              severity: 'error'
            });
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const renderPresetCard = (preset: Preset) => {
    const crosspointCount = preset.crosspoints.length;
    const levels = new Set(preset.crosspoints.map(cp => cp.level)).size;
    
    return (
      <Box key={preset.id} sx={{ width: { xs: '100%', sm: '50%', md: '33.33%' }, p: 1 }}>
        <Card className="preset-card">
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="flex-start">
              <Typography variant="h6" gutterBottom>
                {preset.name}
              </Typography>
              <IconButton
                size="small"
                onClick={(e) => {
                  setAnchorEl(e.currentTarget);
                  setSelectedPreset(preset.id);
                }}
              >
                <MoreVert />
              </IconButton>
            </Box>
            
            {preset.description && (
              <Typography variant="body2" color="text.secondary" paragraph>
                {preset.description}
              </Typography>
            )}
            
            <Box display="flex" gap={1} flexWrap="wrap" mb={2}>
              <Chip
                size="small"
                label={`${crosspointCount} crosspoint${crosspointCount !== 1 ? 's' : ''}`}
              />
              <Chip
                size="small"
                label={`${levels} level${levels !== 1 ? 's' : ''}`}
                color="primary"
                variant="outlined"
              />
            </Box>
            
            <Typography variant="caption" color="text.secondary">
              <Schedule fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
              Created: {preset.createdAt.toLocaleDateString()}
            </Typography>
          </CardContent>
          
          <CardActions>
            <Button
              startIcon={<PlayArrow />}
              onClick={() => handleRecallPreset(preset)}
              color="primary"
            >
              Recall
            </Button>
            <Tooltip title="Update with current state">
              <IconButton
                onClick={() => {
                  const updated: Preset = {
                    ...preset,
                    crosspoints: crosspointList.filter(cp => cp.status === 'connected'),
                    updatedAt: new Date()
                  };
                  handleSavePreset(updated);
                }}
              >
                <Update />
              </IconButton>
            </Tooltip>
          </CardActions>
        </Card>
      </Box>
    );
  };

  return (
    <Paper elevation={3} className="preset-manager">
      <Box p={3}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h5">
            Preset Management
          </Typography>
          
          <Box display="flex" gap={2}>
            <Button
              variant="outlined"
              startIcon={<FileDownload />}
              onClick={handleExportPresets}
              disabled={presets.length === 0}
            >
              Export
            </Button>
            <Button
              variant="outlined"
              startIcon={<FileUpload />}
              onClick={handleImportPresets}
            >
              Import
            </Button>
            <Button
              variant="contained"
              startIcon={<Save />}
              onClick={handleSaveCurrentState}
            >
              Save Current State
            </Button>
          </Box>
        </Box>

        {presets.length === 0 ? (
          <Alert severity="info">
            No presets saved yet. Click "Save Current State" to create your first preset.
          </Alert>
        ) : (
          <Box display="flex" flexWrap="wrap" mx={-1}>
            {presets.map(renderPresetCard)}
          </Box>
        )}
      </Box>

      <PresetDialog
        open={dialogOpen}
        preset={editingPreset}
        currentCrosspoints={crosspointList}
        onClose={() => setDialogOpen(false)}
        onSave={handleSavePreset}
      />

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl) && selectedPreset !== null}
        onClose={() => {
          setAnchorEl(null);
          setSelectedPreset(null);
        }}
      >
        <MenuItem onClick={() => {
          const preset = presets.find(p => p.id === selectedPreset);
          if (preset) handleEditPreset(preset);
          setAnchorEl(null);
        }}>
          <Edit sx={{ mr: 1 }} /> Edit
        </MenuItem>
        <MenuItem onClick={() => {
          if (selectedPreset) handleDeletePreset(selectedPreset);
        }}>
          <Delete sx={{ mr: 1 }} /> Delete
        </MenuItem>
      </Menu>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Paper>
  );
};