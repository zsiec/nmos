import React, { useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Stack,
  Divider,
  Alert,
  Snackbar
} from '@mui/material';
import {
  Add,
  Delete,
  Edit,
  PlayArrow,
  Save,
  Close
} from '@mui/icons-material';
import { useRouter } from '../../hooks/useRouter';
import { SalvoGroup, CrosspointState } from '../../types/router.types';
import './SalvoManager.css';

interface SalvoDialogProps {
  open: boolean;
  salvo: SalvoGroup | null;
  crosspoints: CrosspointState[];
  onClose: () => void;
  onSave: (salvo: SalvoGroup) => void;
}

const SalvoDialog: React.FC<SalvoDialogProps> = ({
  open,
  salvo,
  crosspoints,
  onClose,
  onSave
}) => {
  const { getLabel } = useRouter();
  const [name, setName] = useState(salvo?.name || '');
  const [selectedCrosspoints, setSelectedCrosspoints] = useState<SalvoGroup['crosspoints']>(
    salvo?.crosspoints || []
  );

  const handleAddCrosspoint = (cp: CrosspointState) => {
    const exists = selectedCrosspoints.some(
      scp => scp.destination === cp.destination && 
            scp.source === cp.source && 
            scp.level === cp.level
    );
    
    if (!exists) {
      setSelectedCrosspoints([...selectedCrosspoints, {
        destination: cp.destination,
        source: cp.source,
        level: cp.level
      }]);
    }
  };

  const handleRemoveCrosspoint = (index: number) => {
    setSelectedCrosspoints(selectedCrosspoints.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (name.trim() && selectedCrosspoints.length > 0) {
      onSave({
        id: salvo?.id || Date.now(),
        name: name.trim(),
        crosspoints: selectedCrosspoints
      });
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {salvo ? 'Edit Salvo' : 'Create New Salvo'}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 2 }}>
          <TextField
            fullWidth
            label="Salvo Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter salvo name..."
          />

          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Selected Crosspoints ({selectedCrosspoints.length})
            </Typography>
            <List dense className="salvo-crosspoint-list">
              {selectedCrosspoints.map((cp, index) => (
                <ListItem key={index}>
                  <ListItemText
                    primary={`${getLabel('destination', cp.destination)} ← ${getLabel('source', cp.source)}`}
                    secondary={`Level: ${cp.level}`}
                  />
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      size="small"
                      onClick={() => handleRemoveCrosspoint(index)}
                    >
                      <Delete />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </Box>

          <Divider />

          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Current Active Crosspoints
            </Typography>
            <Typography variant="caption" color="text.secondary" gutterBottom>
              Click to add to salvo
            </Typography>
            <Box className="salvo-available-crosspoints">
              {crosspoints
                .filter(cp => cp.status === 'connected')
                .map((cp, index) => (
                  <Chip
                    key={index}
                    label={`${getLabel('destination', cp.destination)} ← ${getLabel('source', cp.source)}`}
                    onClick={() => handleAddCrosspoint(cp)}
                    color="primary"
                    variant="outlined"
                    size="small"
                  />
                ))}
            </Box>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={!name.trim() || selectedCrosspoints.length === 0}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export const SalvoManager: React.FC = () => {
  const { salvos, crosspoints, createSalvo, executeSalvo } = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSalvo, setEditingSalvo] = useState<SalvoGroup | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success'
  });

  const salvoList = Array.from(salvos.values());
  const crosspointList = Array.from(crosspoints.values());

  const handleCreateSalvo = () => {
    setEditingSalvo(null);
    setDialogOpen(true);
  };

  const handleEditSalvo = (salvo: SalvoGroup) => {
    setEditingSalvo(salvo);
    setDialogOpen(true);
  };

  const handleSaveSalvo = (salvo: SalvoGroup) => {
    createSalvo(salvo.id, salvo.name, salvo.crosspoints);
    setSnackbar({
      open: true,
      message: `Salvo "${salvo.name}" saved successfully`,
      severity: 'success'
    });
  };

  const handleExecuteSalvo = async (salvo: SalvoGroup) => {
    try {
      await executeSalvo(salvo.id);
      setSnackbar({
        open: true,
        message: `Salvo "${salvo.name}" executed successfully`,
        severity: 'success'
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: `Failed to execute salvo: ${error}`,
        severity: 'error'
      });
    }
  };

  const handleDeleteSalvo = (salvo: SalvoGroup) => {
    // TODO: Implement delete functionality
    console.log('Delete salvo:', salvo);
  };

  return (
    <Paper elevation={3} className="salvo-manager">
      <Box p={3}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h5">
            Salvo Management
          </Typography>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={handleCreateSalvo}
          >
            Create Salvo
          </Button>
        </Box>

        {salvoList.length === 0 ? (
          <Alert severity="info">
            No salvos created yet. Click "Create Salvo" to get started.
          </Alert>
        ) : (
          <List>
            {salvoList.map((salvo) => (
              <ListItem
                key={salvo.id}
                className="salvo-item"
                divider
              >
                <ListItemText
                  primary={salvo.name}
                  secondary={`${salvo.crosspoints.length} crosspoint${salvo.crosspoints.length !== 1 ? 's' : ''}`}
                />
                <Box display="flex" gap={1}>
                  <IconButton
                    color="primary"
                    onClick={() => handleExecuteSalvo(salvo)}
                    title="Execute Salvo"
                  >
                    <PlayArrow />
                  </IconButton>
                  <IconButton
                    onClick={() => handleEditSalvo(salvo)}
                    title="Edit Salvo"
                  >
                    <Edit />
                  </IconButton>
                  <IconButton
                    color="error"
                    onClick={() => handleDeleteSalvo(salvo)}
                    title="Delete Salvo"
                  >
                    <Delete />
                  </IconButton>
                </Box>
              </ListItem>
            ))}
          </List>
        )}
      </Box>

      <SalvoDialog
        open={dialogOpen}
        salvo={editingSalvo}
        crosspoints={crosspointList}
        onClose={() => setDialogOpen(false)}
        onSave={handleSaveSalvo}
      />

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