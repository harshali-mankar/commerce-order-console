import React from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Chip,
  Button,
  Alert,
  CircularProgress,
  Paper,
  Stack
} from '@mui/material';
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart';
import SyncIcon from '@mui/icons-material/Sync';
import ShoppingCartCheckoutIcon from '@mui/icons-material/ShoppingCartCheckout';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import RemoveCircleOutlinedIcon from '@mui/icons-material/RemoveCircleOutlined';
import { formatCurrency } from '../api';

export default function Catalogue({
  products,
  loading,
  error,
  onRefresh,
  onAddToCart,
  cartItems,
  onOpenCart
}) {
  if (loading) {
    return (
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
          Loading Product Catalogue...
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Connecting to persistent SQLite database
        </Typography>
      </Paper>
    );
  }

  if (error) {
    return (
      <Alert
        severity="error"
        action={
          <Button color="inherit" size="small" onClick={onRefresh} startIcon={<SyncIcon />}>
            Retry
          </Button>
        }
        sx={{ borderRadius: 2, mb: 3 }}
      >
        {error}
      </Alert>
    );
  }

  if (!products || products.length === 0) {
    return (
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
        <Typography variant="h6" className="state-title" sx={{ fontWeight: 600, mb: 1 }}>
          Catalogue is empty
        </Typography>
        <Typography variant="body2" color="text.secondary">
          No products are currently available in the database.
        </Typography>
      </Paper>
    );
  }

  const totalCartUnits = cartItems.reduce((acc, i) => acc + i.quantity, 0);
  const totalCartValue = cartItems.reduce((acc, i) => acc + i.price * i.quantity, 0);

  return (
    <Box sx={{ pb: 10 }}>
      {/* Page Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 4,
          flexWrap: 'wrap',
          gap: 2
        }}
        className="page-header"
      >
        <Box>
          <Typography variant="h5" component="h1" className="page-title" sx={{ fontWeight: 700 }}>
            Product Catalogue & Inventory
          </Typography>
          <Typography variant="body2" color="text.secondary" className="page-subtitle">
            Real-time stock monitoring from persistent SQLite storage
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
          Sync Stock
        </Button>
      </Box>

      {/* Products Grid */}
      <Grid container spacing={3} className="products-grid">
        {products.map((product) => {
          const isOutOfStock = product.stock_quantity <= 0;
          const cartItem = cartItems.find((i) => i.productId === product.id);
          const quantityInCart = cartItem ? cartItem.quantity : 0;
          const remainingAvailable = product.stock_quantity - quantityInCart;
          const cannotAddMore = isOutOfStock || remainingAvailable <= 0;

          return (
            <Grid item xs={12} sm={6} md={4} key={product.id}>
              <Card
                className={`product-card ${isOutOfStock ? 'out-of-stock' : ''}`}
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  borderRadius: 3,
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                  border: isOutOfStock ? '1px dashed #cbd5e1' : '1px solid #e2e8f0',
                  backgroundColor: isOutOfStock ? '#fafafa' : '#ffffff',
                  opacity: isOutOfStock ? 0.78 : 1,
                  '&:hover': {
                    transform: isOutOfStock ? 'none' : 'translateY(-3px)',
                    boxShadow: isOutOfStock ? 'none' : '0 10px 15px -3px rgba(0, 0, 0, 0.08)'
                  }
                }}
              >
                <CardContent sx={{ p: 2.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                    <Typography
                      variant="caption"
                      className="product-sku"
                      sx={{
                        fontFamily: 'monospace',
                        fontWeight: 700,
                        backgroundColor: '#f1f5f9',
                        px: 1,
                        py: 0.3,
                        borderRadius: 1,
                        color: '#475569'
                      }}
                    >
                      {product.sku}
                    </Typography>

                    {isOutOfStock ? (
                      <Chip
                        icon={<RemoveCircleOutlinedIcon fontSize="small" />}
                        label="0 in stock — Unavailable"
                        size="small"
                        color="default"
                        className="stock-badge out-of-stock"
                        sx={{
                          fontWeight: 600,
                          fontSize: '0.725rem',
                          backgroundColor: '#f1f5f9',
                          color: '#64748b'
                        }}
                      />
                    ) : (
                      <Chip
                        icon={<CheckCircleOutlinedIcon fontSize="small" />}
                        label={`${product.stock_quantity} in stock`}
                        size="small"
                        color="success"
                        className="stock-badge in-stock"
                        sx={{
                          fontWeight: 600,
                          fontSize: '0.725rem',
                          backgroundColor: '#ecfdf5',
                          color: '#065f46',
                          '& .MuiChip-icon': { color: '#10b981' }
                        }}
                      />
                    )}
                  </Box>

                  <Typography
                    variant="h6"
                    component="h3"
                    className="product-name"
                    sx={{
                      fontWeight: 700,
                      fontSize: '1rem',
                      lineHeight: 1.3,
                      mb: 1,
                      color: isOutOfStock ? 'text.secondary' : 'text.primary'
                    }}
                  >
                    {product.name}
                  </Typography>

                  <Typography
                    variant="body2"
                    color="text.secondary"
                    className="product-desc"
                    sx={{
                      fontSize: '0.825rem',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      minHeight: 40
                    }}
                  >
                    {product.description || 'No description provided.'}
                  </Typography>
                </CardContent>

                <CardActions
                  sx={{
                    p: 2.5,
                    pt: 0,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                  className="product-footer"
                >
                  <Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                      Unit Price
                    </Typography>
                    <Typography
                      variant="h6"
                      component="span"
                      className="product-price"
                      sx={{ fontWeight: 700, color: 'text.primary', fontSize: '1.1rem' }}
                    >
                      {formatCurrency(product.price)}
                    </Typography>
                  </Box>

                  <Button
                    className="btn-add"
                    variant={isOutOfStock ? 'outlined' : 'contained'}
                    color="primary"
                    disabled={cannotAddMore}
                    onClick={() => onAddToCart(product)}
                    startIcon={!cannotAddMore && <AddShoppingCartIcon fontSize="small" />}
                    size="small"
                    sx={{
                      borderRadius: 2,
                      px: 2,
                      py: 0.8,
                      fontWeight: 600,
                      ...(cannotAddMore && {
                        backgroundColor: '#f1f5f9 !important',
                        color: '#94a3b8 !important',
                        borderColor: '#e2e8f0 !important'
                      })
                    }}
                  >
                    {isOutOfStock
                      ? 'Out of Stock'
                      : remainingAvailable <= 0
                      ? 'Max in Cart'
                      : 'Add to Order'}
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* Floating Bottom Bar for Cart Review */}
      {cartItems && cartItems.length > 0 && (
        <Paper
          elevation={4}
          className="cart-floating-banner"
          sx={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 3,
            px: 3,
            py: 1.5,
            borderRadius: 4,
            backgroundColor: '#0f172a',
            color: '#ffffff',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)',
            minWidth: { xs: '90%', sm: 540 }
          }}
        >
          <Box className="cart-banner-info" sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Chip
              label={`${totalCartUnits} ${totalCartUnits === 1 ? 'unit' : 'units'}`}
              size="small"
              className="cart-banner-badge"
              sx={{
                backgroundColor: 'primary.main',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.75rem'
              }}
            />
            <Typography variant="body2" sx={{ fontWeight: 500 }} className="cart-banner-text">
              {cartItems.length} {cartItems.length === 1 ? 'product' : 'products'}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.4 }} className="cart-banner-dot">
              •
            </Typography>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }} className="cart-banner-total">
              Total: {formatCurrency(totalCartValue)}
            </Typography>
          </Box>

          <Button
            className="btn-primary"
            variant="contained"
            color="primary"
            onClick={onOpenCart}
            startIcon={<ShoppingCartCheckoutIcon />}
            sx={{
              borderRadius: 2,
              px: 2.5,
              fontWeight: 700,
              backgroundColor: '#4f46e5',
              '&:hover': { backgroundColor: '#4338ca' }
            }}
          >
            Review & Create Order
          </Button>
        </Paper>
      )}
    </Box>
  );
}
