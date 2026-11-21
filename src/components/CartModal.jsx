import React, { useState } from 'react';
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
  Stack,
  Chip
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import RemoveIcon from '@mui/icons-material/Remove';
import AddIcon from '@mui/icons-material/Add';
import { formatCurrency, formatDate, createOrder } from '../api';

export default function CartModal({
  isOpen,
  onClose,
  cartItems,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onOrderSuccess
}) {
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [showConfirmSummary, setShowConfirmSummary] = useState(false);
  const [createdOrder, setCreatedOrder] = useState(null);

  if (!isOpen) return null;

  const orderTotal = cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);

  const handleConfirmOrder = async () => {
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const payload = cartItems.map((item) => ({
        productId: Number(item.productId),
        quantity: Number(item.quantity)
      }));

      const res = await createOrder(payload);
      const placedOrder = res.order || res;
      setCreatedOrder(placedOrder);
      setShowConfirmSummary(false);
      onClearCart();
      if (onOrderSuccess) {
        onOrderSuccess(placedOrder);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to place order');
    } finally {
      setSubmitting(false);
    }
  };

  const handleModalClose = () => {
    setErrorMessage(null);
    setShowConfirmSummary(false);
    setCreatedOrder(null);
    onClose();
  };

  return (
    <Dialog
      open={isOpen}
      onClose={handleModalClose}
      maxWidth="sm"
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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ShoppingCartOutlinedIcon color="primary" />
          <Typography variant="h6" component="span" className="modal-title" sx={{ fontWeight: 700 }}>
            {createdOrder
              ? 'Order Confirmed'
              : showConfirmSummary
              ? 'Review Order Summary'
              : 'Customer Order Cart'}
          </Typography>
        </Box>
        <IconButton
          aria-label="close"
          onClick={handleModalClose}
          className="btn-close"
          size="small"
          sx={{ color: 'text.secondary' }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      {/* Modal Content */}
      <DialogContent sx={{ pt: 2.5, pb: 2 }}>
        {errorMessage && (
          <Alert
            severity="error"
            onClose={() => setErrorMessage(null)}
            sx={{ mb: 2, borderRadius: 2 }}
          >
            {errorMessage}
          </Alert>
        )}

        {/* 1. Success State */}
        {createdOrder ? (
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                backgroundColor: '#ecfdf5',
                color: '#10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 2
              }}
            >
              <CheckCircleIcon sx={{ fontSize: 36 }} />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
              Order Placed Successfully!
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Transactional stock deduction committed to SQLite.
            </Typography>

            <Paper
              variant="outlined"
              sx={{
                p: 2.5,
                textAlign: 'left',
                backgroundColor: '#f8fafc',
                borderRadius: 2,
                mb: 3
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" color="text.secondary">Reference:</Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 700, color: 'text.primary' }}>
                  {createdOrder.reference}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" color="text.secondary">Order ID:</Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                  #{createdOrder.id || createdOrder.orderId}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">Initial Status:</Typography>
                <Chip
                  label="Placed"
                  size="small"
                  className="status-pill Placed"
                  sx={{
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    backgroundColor: '#dbeafe',
                    color: '#1e40af'
                  }}
                />
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" color="text.secondary">Created At:</Typography>
                <Typography variant="body2">
                  {formatDate(createdOrder.created_at || createdOrder.createdAt)}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" color="text.secondary">Total Amount:</Typography>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'primary.main' }}>
                  {formatCurrency(createdOrder.total)}
                </Typography>
              </Box>

              {createdOrder.items && createdOrder.items.length > 0 && (
                <Box sx={{ borderTop: '1px solid #e2e8f0', pt: 1.5, mt: 1.5 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', display: 'block', mb: 1 }}>
                    Items Snapshot ({createdOrder.items.length})
                  </Typography>
                  {createdOrder.items.map((item, idx) => (
                    <Box
                      key={idx}
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '0.8125rem',
                        py: 0.3
                      }}
                    >
                      <Typography variant="body2" sx={{ fontSize: '0.8125rem' }}>
                        {item.quantity} × {item.productName || item.product_name_snapshot} ({item.sku || 'SKU'})
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8125rem' }}>
                        {formatCurrency(item.lineTotal || (item.unitPrice * item.quantity))}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </Paper>

            <Button
              className="btn-primary btn-continue-operations"
              variant="contained"
              color="primary"
              fullWidth
              size="large"
              onClick={handleModalClose}
              sx={{ borderRadius: 2, fontWeight: 700 }}
            >
              Continue Operations
            </Button>
          </Box>
        ) : showConfirmSummary ? (
          /* 2. Review Confirmation Step */
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Please review the order details before committing. Stock will be atomically deducted from SQLite inventory.
            </Typography>

            <Paper variant="outlined" sx={{ p: 2, mb: 3, backgroundColor: '#ffffff', borderRadius: 2 }}>
              {cartItems.map((item, idx) => (
                <Box
                  key={item.productId}
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    py: 1,
                    borderBottom: idx !== cartItems.length - 1 ? '1px solid #f1f5f9' : 'none'
                  }}
                >
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{item.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {item.quantity} × {formatCurrency(item.price)} • Stock Avail: {item.maxStock}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {formatCurrency(item.price * item.quantity)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {item.quantity} {item.quantity === 1 ? 'unit' : 'units'}
                    </Typography>
                  </Box>
                </Box>
              ))}

              <Divider sx={{ my: 1.5 }} />

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Grand Total:</Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main' }}>
                  {formatCurrency(orderTotal)}
                </Typography>
              </Box>
            </Paper>

            <Stack direction="row" spacing={2}>
              <Button
                variant="outlined"
                color="inherit"
                fullWidth
                disabled={submitting}
                onClick={() => setShowConfirmSummary(false)}
                className="btn-secondary"
                sx={{ borderRadius: 2 }}
              >
                Edit Cart
              </Button>
              <Button
                variant="contained"
                color="primary"
                fullWidth
                disabled={submitting}
                onClick={handleConfirmOrder}
                className="btn-primary btn-confirm-place-order"
                sx={{ borderRadius: 2, fontWeight: 700 }}
              >
                {submitting ? 'Committing Transaction...' : 'Confirm & Place Order'}
              </Button>
            </Stack>
          </Box>
        ) : cartItems.length === 0 ? (
          /* 3. Empty Cart State */
          <Box sx={{ textAlign: 'center', py: 5 }}>
            <ShoppingCartOutlinedIcon sx={{ fontSize: 48, color: '#94a3b8', mb: 1.5 }} />
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>Your Cart is Empty</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Select items from the catalogue to begin creating a customer order.
            </Typography>
            <Button variant="outlined" color="primary" onClick={handleModalClose} className="btn-secondary">
              Browse Catalogue
            </Button>
          </Box>
        ) : (
          /* 4. Active Cart Items */
          <Box>
            <Stack spacing={1.5} sx={{ mb: 3 }}>
              {cartItems.map((item) => {
                const lineTotal = item.price * item.quantity;
                const canIncrease = item.quantity < item.maxStock;

                return (
                  <Paper
                    key={item.productId}
                    variant="outlined"
                    sx={{
                      p: 1.5,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderRadius: 2
                    }}
                    className="cart-item"
                  >
                    <Box sx={{ flex: 1, minWidth: 0, pr: 1.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap className="cart-item-name">
                        {item.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" className="cart-item-meta">
                        Unit: {formatCurrency(item.price)} • In Stock: {item.maxStock}
                      </Typography>
                    </Box>

                    {/* Quantity Stepper */}
                    <Box
                      className="qty-controls"
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        border: '1px solid #cbd5e1',
                        borderRadius: 1.5,
                        backgroundColor: '#f8fafc',
                        mr: 2
                      }}
                    >
                      <IconButton
                        size="small"
                        className="qty-btn"
                        disabled={item.quantity <= 1}
                        onClick={() => onUpdateQuantity(item.productId, item.quantity - 1)}
                        title="Decrease Quantity"
                        sx={{ p: 0.5 }}
                      >
                        <RemoveIcon fontSize="small" />
                      </IconButton>

                      <input
                        type="number"
                        className="qty-input qty-value"
                        aria-label={`Quantity for ${item.name}`}
                        min="1"
                        max={item.maxStock}
                        step="1"
                        value={item.quantity}
                        style={{
                          width: 36,
                          textAlign: 'center',
                          border: 'none',
                          background: 'transparent',
                          fontWeight: 700,
                          fontSize: '0.875rem'
                        }}
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (raw === '') return;
                          const val = Number(raw);
                          if (!Number.isInteger(val) || val <= 0) {
                            setErrorMessage(`Invalid quantity for "${item.name}". Please enter a positive whole number.`);
                            return;
                          }
                          if (val > item.maxStock) {
                            setErrorMessage(`Requested quantity (${val}) exceeds available stock (${item.maxStock}) for "${item.name}".`);
                            onUpdateQuantity(item.productId, item.maxStock);
                            return;
                          }
                          setErrorMessage(null);
                          onUpdateQuantity(item.productId, val);
                        }}
                      />

                      <IconButton
                        size="small"
                        className="qty-btn"
                        disabled={!canIncrease}
                        onClick={() => onUpdateQuantity(item.productId, item.quantity + 1)}
                        title={canIncrease ? 'Increase Quantity' : 'Stock limit reached'}
                        sx={{ p: 0.5 }}
                      >
                        <AddIcon fontSize="small" />
                      </IconButton>
                    </Box>

                    <Typography
                      variant="body2"
                      className="cart-item-total"
                      sx={{ fontWeight: 700, minWidth: 80, textAlign: 'right', mr: 1 }}
                    >
                      {formatCurrency(lineTotal)}
                    </Typography>

                    <IconButton
                      size="small"
                      color="error"
                      className="btn-remove"
                      onClick={() => onRemoveItem(item.productId)}
                      title="Remove from Cart"
                      sx={{ p: 0.5 }}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Paper>
                );
              })}
            </Stack>

            <Paper variant="outlined" sx={{ p: 2, backgroundColor: '#f8fafc', borderRadius: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="body2" color="text.secondary">Selected Products:</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{cartItems.length}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" color="text.secondary">Total Quantity:</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {cartItems.reduce((acc, i) => acc + i.quantity, 0)} units
                </Typography>
              </Box>
              <Divider sx={{ my: 1 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Order Total:</Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main' }}>
                  {formatCurrency(orderTotal)}
                </Typography>
              </Box>
            </Paper>
          </Box>
        )}
      </DialogContent>

      {/* Modal Actions */}
      {!createdOrder && !showConfirmSummary && cartItems.length > 0 && (
        <DialogActions sx={{ px: 3, pb: 2, pt: 1, borderTop: '1px solid #f1f5f9', justifyContent: 'space-between' }}>
          <Button
            variant="text"
            color="inherit"
            onClick={onClearCart}
            className="btn-secondary"
            sx={{ color: 'text.secondary' }}
          >
            Clear Cart
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => setShowConfirmSummary(true)}
            endIcon={<ArrowForwardIcon fontSize="small" />}
            className="btn-primary btn-review-order"
            sx={{ borderRadius: 2, px: 2.5, fontWeight: 700 }}
          >
            Review & Place Order
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
}
