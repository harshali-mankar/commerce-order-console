import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Button,
  Typography,
  Alert,
  Box,
  Divider,
  Paper,
  Grid,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Chip,
  CircularProgress
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import {
  fetchOrderDetails,
  updateOrderStatus,
  formatCurrency,
  formatDate
} from '../api';

export default function OrderDetailsModal({
  orderId,
  onClose,
  onOrderUpdated
}) {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [confirmPrompt, setConfirmPrompt] = useState(null);

  const loadDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchOrderDetails(orderId);
      setOrder(data);
    } catch (err) {
      setError(err.message || 'Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orderId) {
      loadDetails();
    }
  }, [orderId]);

  const handleStatusTransition = async (targetStatus) => {
    setActionLoading(true);
    setFeedback(null);

    try {
      const res = await updateOrderStatus(orderId, targetStatus);
      setFeedback({ type: 'success', message: res.message });
      setConfirmPrompt(null);
      await loadDetails();
      if (onOrderUpdated) {
        onOrderUpdated();
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
      setConfirmPrompt(null);
    } finally {
      setActionLoading(false);
    }
  };

  if (!orderId) return null;

  const getStatusChipProps = (status) => {
    switch (status) {
      case 'Placed':
        return { sx: { backgroundColor: '#dbeafe', color: '#1e40af', fontWeight: 700 } };
      case 'Packed':
        return { sx: { backgroundColor: '#fef3c7', color: '#92400e', fontWeight: 700 } };
      case 'Shipped':
        return { sx: { backgroundColor: '#dcfce7', color: '#166534', fontWeight: 700 } };
      case 'Cancelled':
        return { sx: { backgroundColor: '#fee2e2', color: '#991b1b', fontWeight: 700 } };
      default:
        return { sx: { backgroundColor: '#f1f5f9', color: '#475569', fontWeight: 600 } };
    }
  };

  return (
    <Dialog
      open={Boolean(orderId)}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 3, p: 1 }
      }}
    >
      {/* Modal Header */}
      <DialogTitle
        className="modal-header"
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          pb: 1.5,
          borderBottom: '1px solid #f1f5f9'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <IconButton
            size="small"
            onClick={onClose}
            className="btn-close"
            title="Back to Orders List"
            sx={{ color: 'text.secondary' }}
          >
            <ArrowBackIcon fontSize="small" />
          </IconButton>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="h6" component="span" className="modal-title" sx={{ fontWeight: 700 }}>
                {order ? order.reference : 'Order Details'}
              </Typography>
              {order && (
                <Chip
                  label={order.status}
                  size="small"
                  className={`status-pill ${order.status}`}
                  {...getStatusChipProps(order.status)}
                />
              )}
            </Box>
            <Typography variant="caption" color="text.secondary">
              Order #{orderId} • Historical snapshot record
            </Typography>
          </Box>
        </Box>

        <IconButton size="small" onClick={onClose} className="btn-close" sx={{ color: 'text.secondary' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      {/* Modal Content */}
      <DialogContent sx={{ pt: 2.5, pb: 2 }}>
        {loading ? (
          <Box sx={{ textAlign: 'center', py: 6 }} className="state-box">
            <CircularProgress size={36} sx={{ mb: 1.5 }} />
            <Typography variant="body2" color="text.secondary" className="state-title">
              Retrieving order details...
            </Typography>
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ borderRadius: 2 }} className="alert-banner error">
            {error}
          </Alert>
        ) : !order ? (
          <Box sx={{ textAlign: 'center', py: 4 }} className="state-box">
            <Typography variant="body1">Order not found</Typography>
          </Box>
        ) : (
          <Box>
            {/* Feedback Alert */}
            {feedback && (
              <Alert
                severity={feedback.type}
                onClose={() => setFeedback(null)}
                sx={{ mb: 2.5, borderRadius: 2 }}
                className={`alert-banner ${feedback.type}`}
              >
                {feedback.message}
              </Alert>
            )}

            {/* Confirmation Prompt Banner */}
            {confirmPrompt && (
              <Paper
                variant="outlined"
                sx={{
                  p: 2.5,
                  mb: 3,
                  borderRadius: 2,
                  backgroundColor: '#f8fafc',
                  border: '1px solid #cbd5e1'
                }}
              >
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
                  {confirmPrompt.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {confirmPrompt.message}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'flex-end' }}>
                  <Button
                    variant="outlined"
                    color="inherit"
                    size="small"
                    disabled={actionLoading}
                    onClick={() => setConfirmPrompt(null)}
                    className="btn-secondary"
                  >
                    Dismiss
                  </Button>
                  <Button
                    variant="contained"
                    size="small"
                    color={confirmPrompt.targetStatus === 'Cancelled' ? 'error' : 'primary'}
                    disabled={actionLoading}
                    onClick={() => handleStatusTransition(confirmPrompt.targetStatus)}
                    className={confirmPrompt.targetStatus === 'Cancelled' ? 'btn-cancel' : 'btn-primary'}
                    sx={{ fontWeight: 700 }}
                  >
                    {actionLoading ? 'Processing...' : 'Yes, Confirm'}
                  </Button>
                </Box>
              </Paper>
            )}

            {/* Metadata Overview Cards */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={order.cancelled_at ? 4 : 6}>
                <Paper variant="outlined" sx={{ p: 1.5, backgroundColor: '#f8fafc', borderRadius: 2 }}>
                  <Typography variant="caption" color="text.secondary">Created On</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.5 }}>
                    {formatDate(order.created_at)}
                  </Typography>
                </Paper>
              </Grid>

              <Grid item xs={12} sm={order.cancelled_at ? 4 : 6}>
                <Paper variant="outlined" sx={{ p: 1.5, backgroundColor: '#f8fafc', borderRadius: 2 }}>
                  <Typography variant="caption" color="text.secondary">Last Updated</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.5 }}>
                    {formatDate(order.updated_at)}
                  </Typography>
                </Paper>
              </Grid>

              {order.cancelled_at && (
                <Grid item xs={12} sm={4}>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 1.5,
                      backgroundColor: '#fef2f2',
                      borderColor: '#fca5a5',
                      borderRadius: 2
                    }}
                  >
                    <Typography variant="caption" sx={{ color: '#b91c1c', fontWeight: 600 }}>
                      Cancelled On
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, mt: 0.5, color: '#991b1b' }}>
                      {formatDate(order.cancelled_at)}
                    </Typography>
                  </Paper>
                </Grid>
              )}
            </Grid>

            {/* Ordered Items Table */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
                Ordered Items ({order.items?.length || 0})
              </Typography>

              <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                <Table size="small" className="orders-table">
                  <TableHead sx={{ backgroundColor: '#f8fafc' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Product & SKU</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Unit Price</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Quantity</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: '#475569' }}>Line Total</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {order.items?.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {item.product_name_snapshot}
                          </Typography>
                          <Typography
                            variant="caption"
                            className="product-sku"
                            sx={{ fontFamily: 'monospace', color: 'text.secondary' }}
                          >
                            {item.sku || 'N/A'}
                          </Typography>
                        </TableCell>
                        <TableCell>{formatCurrency(item.unit_price)}</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>{item.quantity}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>
                          {formatCurrency(item.line_total)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                <Paper
                  variant="outlined"
                  sx={{
                    px: 3,
                    py: 1.5,
                    backgroundColor: '#f8fafc',
                    borderRadius: 2,
                    textAlign: 'right'
                  }}
                >
                  <Typography variant="caption" color="text.secondary">Overall Order Total</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 800, color: 'text.primary' }}>
                    {formatCurrency(order.total)}
                  </Typography>
                </Paper>
              </Box>
            </Box>

            {/* Status Notices */}
            {order.status === 'Shipped' && (
              <Alert severity="success" icon={<LocalShippingOutlinedIcon />} sx={{ borderRadius: 2 }}>
                This order has been shipped to the customer and fulfilled. No further actions can be taken.
              </Alert>
            )}

            {order.status === 'Cancelled' && (
              <Alert severity="error" icon={<CancelOutlinedIcon />} sx={{ borderRadius: 2 }}>
                This order was cancelled on {formatDate(order.cancelled_at)}. Inventory was restored to the SQLite database.
              </Alert>
            )}
          </Box>
        )}
      </DialogContent>

      {/* Action Footer */}
      {order && (order.status === 'Placed' || order.status === 'Packed') && !confirmPrompt && (
        <DialogActions
          sx={{
            px: 3,
            pb: 2,
            pt: 1.5,
            borderTop: '1px solid #f1f5f9',
            justifyContent: 'space-between'
          }}
          className="modal-footer"
        >
          <Button
            variant="outlined"
            color="error"
            disabled={actionLoading}
            onClick={() =>
              setConfirmPrompt({
                targetStatus: 'Cancelled',
                title: 'Confirm Order Cancellation',
                message: `Are you sure you want to cancel order ${order.reference}? This will restore all ${order.items?.reduce(
                  (acc, i) => acc + i.quantity,
                  0
                )} item units back to inventory.`
              })
            }
            startIcon={<CancelOutlinedIcon fontSize="small" />}
            className="btn-cancel"
            sx={{ borderRadius: 2, fontWeight: 600 }}
          >
            Cancel Order
          </Button>

          <Box sx={{ display: 'flex', gap: 1.5 }}>
            {order.status === 'Placed' && (
              <Button
                variant="contained"
                color="primary"
                disabled={actionLoading}
                onClick={() =>
                  setConfirmPrompt({
                    targetStatus: 'Packed',
                    title: 'Mark Order as Packed',
                    message: `Confirm that all items in order ${order.reference} are verified and packed into shipment parcel.`
                  })
                }
                startIcon={<Inventory2OutlinedIcon fontSize="small" />}
                className="btn-pack"
                sx={{ borderRadius: 2, fontWeight: 700 }}
              >
                Pack Order
              </Button>
            )}

            {order.status === 'Packed' && (
              <Button
                variant="contained"
                color="success"
                disabled={actionLoading}
                onClick={() =>
                  setConfirmPrompt({
                    targetStatus: 'Shipped',
                    title: 'Mark Order as Shipped',
                    message: `Confirm dispatch for order ${order.reference}. Once shipped, order fulfilment is complete and cannot be cancelled.`
                  })
                }
                startIcon={<LocalShippingOutlinedIcon fontSize="small" />}
                className="btn-ship"
                sx={{ borderRadius: 2, fontWeight: 700 }}
              >
                Ship Order
              </Button>
            )}
          </Box>
        </DialogActions>
      )}
    </Dialog>
  );
}
