import React from 'react';
import {
  Box,
  Typography,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Paper,
  TextField,
  Select,
  MenuItem,
  Chip,
  Button,
  Alert,
  CircularProgress,
  InputAdornment
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import SyncIcon from '@mui/icons-material/Sync';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import ShoppingBagOutlinedIcon from '@mui/icons-material/ShoppingBagOutlined';
import FilterListIcon from '@mui/icons-material/FilterList';
import { formatCurrency, formatDate } from '../api';

export default function OrdersList({
  orders,
  loading,
  error,
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  onRefresh,
  onSelectOrder,
  onNavigateCatalogue
}) {
  const statuses = ['All', 'Placed', 'Packed', 'Shipped', 'Cancelled'];

  const getStatusChipProps = (status) => {
    switch (status) {
      case 'Placed':
        return {
          sx: { backgroundColor: '#dbeafe', color: '#1e40af', fontWeight: 700 }
        };
      case 'Packed':
        return {
          sx: { backgroundColor: '#fef3c7', color: '#92400e', fontWeight: 700 }
        };
      case 'Shipped':
        return {
          sx: { backgroundColor: '#dcfce7', color: '#166534', fontWeight: 700 }
        };
      case 'Cancelled':
        return {
          sx: { backgroundColor: '#fee2e2', color: '#991b1b', fontWeight: 700 }
        };
      default:
        return {
          sx: { backgroundColor: '#f1f5f9', color: '#475569', fontWeight: 600 }
        };
    }
  };

  return (
    <Box sx={{ pb: 8 }}>
      {/* Page Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
          flexWrap: 'wrap',
          gap: 2
        }}
        className="page-header"
      >
        <Box>
          <Typography variant="h5" component="h1" className="page-title" sx={{ fontWeight: 700 }}>
            Customer Orders Management
          </Typography>
          <Typography variant="body2" color="text.secondary" className="page-subtitle">
            Track, filter, and fulfil orders across lifecycle stages
          </Typography>
        </Box>
        <Button
          variant="outlined"
          color="inherit"
          startIcon={<SyncIcon fontSize="small" />}
          onClick={onRefresh}
          className="btn-secondary"
          sx={{
            borderColor: '#cbd5e1',
            color: 'text.secondary',
            '&:hover': { borderColor: '#94a3b8', backgroundColor: '#f8fafc' }
          }}
        >
          Refresh
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      {/* Filter and Search Bar */}
      <Paper
        variant="outlined"
        sx={{
          p: 2,
          mb: 3,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          flexWrap: 'wrap',
          borderRadius: 2.5,
          backgroundColor: '#ffffff'
        }}
        className="orders-filter-bar"
      >
        <TextField
          size="small"
          placeholder="Search by order reference (e.g. ORD-2026...)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-wrapper"
          inputProps={{ className: 'search-input' }}
          sx={{ flex: 1, minWidth: 260 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
              </InputAdornment>
            ),
            sx: { borderRadius: 2, backgroundColor: '#f8fafc' }
          }}
        />

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FilterListIcon fontSize="small" sx={{ color: 'text.secondary' }} />
          <Select
            size="small"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="status-select"
            sx={{
              minWidth: 150,
              borderRadius: 2,
              backgroundColor: '#f8fafc',
              fontSize: '0.875rem'
            }}
          >
            {statuses.map((s) => (
              <MenuItem key={s} value={s}>
                {s === 'All' ? 'All Statuses' : s}
              </MenuItem>
            ))}
          </Select>
        </Box>
      </Paper>

      {/* Main Table Content */}
      {loading ? (
        <Paper
          elevation={0}
          sx={{
            p: 6,
            textAlign: 'center',
            borderRadius: 3,
            border: '1px dashed #cbd5e1',
            backgroundColor: '#ffffff'
          }}
          className="state-box"
        >
          <CircularProgress size={40} thickness={4} sx={{ mb: 2, color: 'primary.main' }} />
          <Typography variant="h6" className="state-title" sx={{ fontWeight: 600, mb: 0.5 }}>
            Loading Orders...
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Querying SQLite database records
          </Typography>
        </Paper>
      ) : orders.length === 0 ? (
        <Paper
          elevation={0}
          sx={{
            p: 6,
            textAlign: 'center',
            borderRadius: 3,
            border: '1px dashed #cbd5e1',
            backgroundColor: '#ffffff'
          }}
          className="state-box"
        >
          {searchQuery || statusFilter !== 'All' ? (
            <Box>
              <Typography variant="h6" className="state-title" sx={{ fontWeight: 600, mb: 1 }}>
                No matching orders found
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
                No orders match your filter criteria (Search: "{searchQuery}", Status: "{statusFilter}").
              </Typography>
              <Button
                variant="outlined"
                color="inherit"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('All');
                }}
                className="btn-secondary"
              >
                Clear Filters
              </Button>
            </Box>
          ) : (
            <Box>
              <ShoppingBagOutlinedIcon sx={{ fontSize: 48, color: '#94a3b8', mb: 1.5 }} />
              <Typography variant="h6" className="state-title" sx={{ fontWeight: 600, mb: 0.5 }}>
                No orders have been placed yet
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
                Create customer orders from the Product Catalogue to get started.
              </Typography>
              <Button
                variant="contained"
                color="primary"
                onClick={onNavigateCatalogue}
                className="btn-primary"
                sx={{ borderRadius: 2 }}
              >
                Go to Catalogue
              </Button>
            </Box>
          )}
        </Paper>
      ) : (
        <TableContainer
          component={Paper}
          variant="outlined"
          sx={{ borderRadius: 3, overflow: 'hidden' }}
          className="table-card"
        >
          <Table className="orders-table">
            <TableHead sx={{ backgroundColor: '#f8fafc' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.8125rem', color: '#475569' }}>
                  Order Reference
                </TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.8125rem', color: '#475569' }}>
                  Date Created
                </TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.8125rem', color: '#475569' }}>
                  Items
                </TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.8125rem', color: '#475569' }}>
                  Order Total
                </TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.8125rem', color: '#475569' }}>
                  Status
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.8125rem', color: '#475569' }}>
                  Action
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {orders.map((order) => {
                const chipProps = getStatusChipProps(order.status);
                return (
                  <TableRow
                    key={order.id}
                    hover
                    sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                  >
                    <TableCell>
                      <Typography
                        variant="body2"
                        className="order-ref"
                        sx={{ fontFamily: 'monospace', fontWeight: 700, color: 'text.primary' }}
                      >
                        {order.reference}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
                      {formatDate(order.created_at)}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" component="span" sx={{ fontWeight: 600 }}>
                        {order.item_count} product{order.item_count === 1 ? '' : 's'}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ ml: 0.5 }}
                      >
                        ({order.total_quantity} unit{order.total_quantity === 1 ? '' : 's'})
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, color: 'text.primary' }}>
                      {formatCurrency(order.total)}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={order.status}
                        size="small"
                        className={`status-pill ${order.status}`}
                        {...chipProps}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        variant="outlined"
                        color="primary"
                        startIcon={<VisibilityOutlinedIcon fontSize="small" />}
                        className="btn-view"
                        onClick={() => onSelectOrder(order.id)}
                        sx={{
                          borderRadius: 2,
                          fontWeight: 600,
                          fontSize: '0.8125rem',
                          textTransform: 'none'
                        }}
                      >
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
