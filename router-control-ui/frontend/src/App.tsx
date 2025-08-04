import React, { useEffect, useState } from 'react';
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  AppBar,
  Toolbar,
  Typography,
  Container,
  Box,
  Button,
  Paper,
  ToggleButton,
  ToggleButtonGroup,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  IconButton,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent
} from '@mui/material';
import { 
  GridView, 
  ViewList, 
  PlaylistPlay, 
  Label,
  Menu as MenuIcon,
  Settings,
  Close,
  SaveAlt
} from '@mui/icons-material';
import { RouterProvider, useRouter } from './hooks/useRouter';
import { MatrixGrid } from './components/MatrixGrid';
import { XYPanel } from './components/XYPanel';
import { SalvoManager } from './components/SalvoManager';
import { LabelManager } from './components/LabelManager';
import { PresetManager } from './components/PresetManager';
import { ConnectionStatus } from './components/ConnectionStatus/ConnectionStatus';
import { ViewMode } from './types/router.types';
import './App.css';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#2196f3',
    },
    secondary: {
      main: '#ff9800',
    },
    success: {
      main: '#4caf50',
    },
  },
});

const AppContent: React.FC = () => {
  const { connect, connected, connecting } = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>('matrix');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showLabels, setShowLabels] = useState(false);
  const [showPresets, setShowPresets] = useState(false);

  useEffect(() => {
    // Auto-connect on mount
    connect();
  }, []);

  const handleViewModeChange = (_event: React.MouseEvent<HTMLElement>, newMode: ViewMode | null) => {
    if (newMode !== null) {
      setViewMode(newMode);
    }
  };

  const renderView = () => {
    switch (viewMode) {
      case 'matrix':
        return (
          <MatrixGrid
            level={0}
            matrix={0}
            maxSources={32}
            maxDestinations={32}
            showLabels={true}
          />
        );
      case 'xy-panel':
        return (
          <XYPanel
            level={0}
            matrix={0}
            maxSources={32}
            maxDestinations={32}
          />
        );
      case 'list':
        return <SalvoManager />;
      default:
        return null;
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <AppBar position="static">
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={() => setDrawerOpen(!drawerOpen)}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Router Control - SWP08 Protocol
          </Typography>
          
          {connected && (
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={handleViewModeChange}
              aria-label="view mode"
              size="small"
              sx={{ mr: 2 }}
            >
              <ToggleButton value="matrix" aria-label="matrix view">
                <GridView sx={{ mr: 1 }} />
                Matrix
              </ToggleButton>
              <ToggleButton value="xy-panel" aria-label="xy panel view">
                <ViewList sx={{ mr: 1 }} />
                XY Panel
              </ToggleButton>
              <ToggleButton value="list" aria-label="salvo view">
                <PlaylistPlay sx={{ mr: 1 }} />
                Salvos
              </ToggleButton>
            </ToggleButtonGroup>
          )}
          
          <ConnectionStatus />
          {!connected && !connecting && (
            <Button
              color="inherit"
              onClick={connect}
              sx={{ ml: 2 }}
            >
              Connect
            </Button>
          )}
        </Toolbar>
      </AppBar>

      <Container maxWidth={false} sx={{ flex: 1, py: 3, overflow: 'hidden' }}>
        {connected ? (
          renderView()
        ) : (
          <Paper
            elevation={3}
            sx={{
              p: 4,
              textAlign: 'center',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: 2
            }}
          >
            <Typography variant="h5" gutterBottom>
              {connecting ? 'Connecting to Router...' : 'Not Connected'}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {connecting
                ? 'Please wait while we establish connection to the router'
                : 'Click the Connect button to establish connection to the router'}
            </Typography>
          </Paper>
        )}
      </Container>

      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      >
        <Box sx={{ width: 250 }} role="presentation">
          <List>
            <ListItem>
              <Typography variant="h6" sx={{ p: 2 }}>
                Navigation
              </Typography>
            </ListItem>
            <Divider />
            
            <ListItemButton onClick={() => { setViewMode('matrix'); setDrawerOpen(false); }}>
              <ListItemIcon>
                <GridView />
              </ListItemIcon>
              <ListItemText primary="Matrix View" />
            </ListItemButton>
            
            <ListItemButton onClick={() => { setViewMode('xy-panel'); setDrawerOpen(false); }}>
              <ListItemIcon>
                <ViewList />
              </ListItemIcon>
              <ListItemText primary="XY Panel" />
            </ListItemButton>
            
            <ListItemButton onClick={() => { setViewMode('list'); setDrawerOpen(false); }}>
              <ListItemIcon>
                <PlaylistPlay />
              </ListItemIcon>
              <ListItemText primary="Salvos" />
            </ListItemButton>
            
            <Divider />
            
            <ListItemButton onClick={() => { setShowLabels(true); setDrawerOpen(false); }}>
              <ListItemIcon>
                <Label />
              </ListItemIcon>
              <ListItemText primary="Label Management" />
            </ListItemButton>
            
            <ListItemButton onClick={() => { setShowPresets(true); setDrawerOpen(false); }}>
              <ListItemIcon>
                <SaveAlt />
              </ListItemIcon>
              <ListItemText primary="Preset Management" />
            </ListItemButton>
            
            <ListItemButton>
              <ListItemIcon>
                <Settings />
              </ListItemIcon>
              <ListItemText primary="Settings" />
            </ListItemButton>
          </List>
        </Box>
      </Drawer>

      {showLabels && (
        <Dialog
          open={showLabels}
          onClose={() => setShowLabels(false)}
          maxWidth="lg"
          fullWidth
        >
          <DialogTitle>
            Label Management
            <IconButton
              aria-label="close"
              onClick={() => setShowLabels(false)}
              sx={{ position: 'absolute', right: 8, top: 8 }}
            >
              <Close />
            </IconButton>
          </DialogTitle>
          <DialogContent>
            <LabelManager />
          </DialogContent>
        </Dialog>
      )}

      {showPresets && (
        <Dialog
          open={showPresets}
          onClose={() => setShowPresets(false)}
          maxWidth="lg"
          fullWidth
        >
          <DialogTitle>
            Preset Management
            <IconButton
              aria-label="close"
              onClick={() => setShowPresets(false)}
              sx={{ position: 'absolute', right: 8, top: 8 }}
            >
              <Close />
            </IconButton>
          </DialogTitle>
          <DialogContent sx={{ height: '70vh' }}>
            <PresetManager />
          </DialogContent>
        </Dialog>
      )}
    </Box>
  );
};

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <RouterProvider>
        <AppContent />
      </RouterProvider>
    </ThemeProvider>
  );
}

export default App;