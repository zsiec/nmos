import React, { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Tabs,
  Tab,
  TextField,
  Button,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  InputAdornment,
  Chip,
  Menu,
  MenuItem,
  Snackbar,
  Alert
} from '@mui/material';
import {
  Edit,
  Save,
  Cancel,
  Search,
  FileDownload,
  FileUpload,
  MoreVert
} from '@mui/icons-material';
import { useRouter } from '../../hooks/useRouter';
import './LabelManager.css';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => {
  return (
    <div hidden={value !== index} className="label-tab-panel">
      {value === index && <Box>{children}</Box>}
    </div>
  );
};

interface LabelRowProps {
  type: 'source' | 'destination';
  index: number;
  label: string;
  level: number;
  matrix: number;
  onSave: (index: number, label: string) => void;
}

const LabelRow: React.FC<LabelRowProps> = ({
  type,
  index,
  label,
  level,
  matrix,
  onSave
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(label);

  const handleSave = () => {
    onSave(index, editValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(label);
    setIsEditing(false);
  };

  return (
    <TableRow>
      <TableCell>{index + 1}</TableCell>
      <TableCell>
        {isEditing ? (
          <TextField
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            size="small"
            fullWidth
            autoFocus
            onKeyPress={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') handleCancel();
            }}
          />
        ) : (
          <Typography>{label}</Typography>
        )}
      </TableCell>
      <TableCell align="right">
        {isEditing ? (
          <>
            <IconButton size="small" onClick={handleSave} color="primary">
              <Save />
            </IconButton>
            <IconButton size="small" onClick={handleCancel}>
              <Cancel />
            </IconButton>
          </>
        ) : (
          <IconButton size="small" onClick={() => setIsEditing(true)}>
            <Edit />
          </IconButton>
        )}
      </TableCell>
    </TableRow>
  );
};

export const LabelManager: React.FC = () => {
  const { config, getLabel, setLabel } = useRouter();
  const [tabValue, setTabValue] = useState(0);
  const [level, setLevel] = useState(0);
  const [matrix, setMatrix] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string }>({
    open: false,
    message: ''
  });

  const type: 'source' | 'destination' = tabValue === 0 ? 'source' : 'destination';
  const maxCount = type === 'source' ? (config?.maxSources || 32) : (config?.maxDestinations || 32);

  // Generate label data
  const labelData = useMemo(() => {
    return Array.from({ length: maxCount }, (_, i) => ({
      index: i,
      label: getLabel(type, i, level, matrix)
    }));
  }, [type, maxCount, level, matrix, getLabel]);

  // Filter labels based on search
  const filteredLabels = useMemo(() => {
    if (!searchTerm) return labelData;
    
    return labelData.filter(item => 
      item.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.index + 1).toString().includes(searchTerm)
    );
  }, [labelData, searchTerm]);

  // Paginated labels
  const paginatedLabels = filteredLabels.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  const handleLabelSave = useCallback((index: number, newLabel: string) => {
    setLabel(type, index, newLabel, level, matrix);
    setSnackbar({
      open: true,
      message: `${type} ${index + 1} label updated to "${newLabel}"`
    });
  }, [type, level, matrix, setLabel]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    setPage(0);
  };

  const handleExport = () => {
    const csvContent = [
      `Type,Index,Label`,
      ...labelData.map(item => `${type},${item.index + 1},${item.label}`)
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}_labels_level${level}_matrix${matrix}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    setSnackbar({
      open: true,
      message: 'Labels exported successfully'
    });
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const csv = event.target?.result as string;
          const lines = csv.split('\n');
          
          // Skip header
          for (let i = 1; i < lines.length; i++) {
            const [, indexStr, label] = lines[i].split(',');
            if (indexStr && label) {
              const index = parseInt(indexStr) - 1;
              if (index >= 0 && index < maxCount) {
                setLabel(type, index, label.trim(), level, matrix);
              }
            }
          }
          
          setSnackbar({
            open: true,
            message: 'Labels imported successfully'
          });
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const handleBulkRename = () => {
    // TODO: Implement bulk rename dialog
    setAnchorEl(null);
    setSnackbar({
      open: true,
      message: 'Bulk rename feature coming soon'
    });
  };

  return (
    <Paper elevation={3} className="label-manager">
      <Box p={3}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h5">
            Label Management
          </Typography>
          
          <Box display="flex" gap={2} alignItems="center">
            <Chip label={`Level: ${level}`} />
            <Chip label={`Matrix: ${matrix}`} />
            
            <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
              <MoreVert />
            </IconButton>
            
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={() => setAnchorEl(null)}
            >
              <MenuItem onClick={handleExport}>
                <FileDownload sx={{ mr: 1 }} /> Export CSV
              </MenuItem>
              <MenuItem onClick={handleImport}>
                <FileUpload sx={{ mr: 1 }} /> Import CSV
              </MenuItem>
              <MenuItem onClick={handleBulkRename}>
                <Edit sx={{ mr: 1 }} /> Bulk Rename
              </MenuItem>
            </Menu>
          </Box>
        </Box>

        <Box mb={2}>
          <TextField
            fullWidth
            placeholder={`Search ${type}s...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              )
            }}
          />
        </Box>

        <Tabs value={tabValue} onChange={handleTabChange} className="label-tabs">
          <Tab label={`Sources (${config?.maxSources || 32})`} />
          <Tab label={`Destinations (${config?.maxDestinations || 32})`} />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell width={100}>Index</TableCell>
                  <TableCell>Label</TableCell>
                  <TableCell width={120} align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedLabels.map((item) => (
                  <LabelRow
                    key={item.index}
                    type="source"
                    index={item.index}
                    label={item.label}
                    level={level}
                    matrix={matrix}
                    onSave={handleLabelSave}
                  />
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell width={100}>Index</TableCell>
                  <TableCell>Label</TableCell>
                  <TableCell width={120} align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedLabels.map((item) => (
                  <LabelRow
                    key={item.index}
                    type="destination"
                    index={item.index}
                    label={item.label}
                    level={level}
                    matrix={matrix}
                    onSave={handleLabelSave}
                  />
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        <TablePagination
          rowsPerPageOptions={[10, 25, 50, 100]}
          component="div"
          count={filteredLabels.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
        />
      </Box>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity="success" onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Paper>
  );
};