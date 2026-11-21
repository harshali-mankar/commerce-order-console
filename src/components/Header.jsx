import React from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Button,
  Badge,
  Chip,
  Container
} from '@mui/material';
import StorefrontIcon from '@mui/icons-material/Storefront';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import ShoppingBagOutlinedIcon from '@mui/icons-material/ShoppingBagOutlined';

export default function Header({
  activeTab,
  setActiveTab,
  cartCount,
  setIsCartOpen,
  ordersCount
}) {
  return (
    <AppBar
      position="sticky"
      color="inherit"
      elevation={0}
      sx={{
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        zIndex: 1100
      }}
      className="app-header"
    >
      <Container maxWidth="lg">
        <Toolbar disableGutters sx={{ minHeight: 64, justifyContent: 'space-between' }}>
          {/* Brand */}
          <Box className="brand" sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: 2,
                backgroundColor: 'primary.main',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 4px rgba(79, 70, 229, 0.25)'
              }}
            >
              <StorefrontIcon fontSize="small" />
            </Box>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography
                  variant="h6"
                  component="span"
                  className="brand-title"
                  sx={{
                    fontWeight: 700,
                    fontSize: '1.05rem',
                    color: 'text.primary',
                    lineHeight: 1.2
                  }}
                >
                  Commerce Order Console
                </Typography>
                <Chip
                  label="Store Operations"
                  size="small"
                  className="brand-tag"
                  sx={{
                    height: 20,
                    fontSize: '0.675rem',
                    fontWeight: 600,
                    backgroundColor: '#e0e7ff',
                    color: '#4338ca'
                  }}
                />
              </Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                Phone Orders & Real-time Inventory Management
              </Typography>
            </Box>
          </Box>

          {/* Navigation Controls */}
          <Box className="header-nav" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              className={`nav-tab ${activeTab === 'catalogue' ? 'active' : ''}`}
              variant={activeTab === 'catalogue' ? 'contained' : 'text'}
              color="primary"
              startIcon={<DashboardOutlinedIcon fontSize="small" />}
              onClick={() => setActiveTab('catalogue')}
              sx={{
                px: 2,
                py: 0.8,
                borderRadius: 2,
                fontWeight: 600,
                ...(activeTab !== 'catalogue' && {
                  color: 'text.secondary',
                  '&:hover': { backgroundColor: '#f1f5f9', color: 'text.primary' }
                })
              }}
            >
              Catalogue
            </Button>

            <Button
              className={`nav-tab ${activeTab === 'orders' ? 'active' : ''}`}
              variant={activeTab === 'orders' ? 'contained' : 'text'}
              color="primary"
              startIcon={
                <Badge
                  badgeContent={ordersCount}
                  color="secondary"
                  max={99}
                  sx={{ '& .MuiBadge-badge': { fontSize: '0.7rem', height: 18, minWidth: 18 } }}
                >
                  <ReceiptLongOutlinedIcon fontSize="small" />
                </Badge>
              }
              onClick={() => setActiveTab('orders')}
              sx={{
                px: 2,
                py: 0.8,
                borderRadius: 2,
                fontWeight: 600,
                ...(activeTab !== 'orders' && {
                  color: 'text.secondary',
                  '&:hover': { backgroundColor: '#f1f5f9', color: 'text.primary' }
                })
              }}
            >
              Orders
              {ordersCount > 0 && <span className="nav-badge" style={{ display: 'none' }}>{ordersCount}</span>}
            </Button>

            <Button
              className="cart-button"
              variant="outlined"
              color="primary"
              startIcon={
                <Badge
                  badgeContent={cartCount}
                  color="error"
                  max={99}
                  sx={{ '& .MuiBadge-badge': { fontSize: '0.7rem', height: 18, minWidth: 18 } }}
                >
                  <ShoppingBagOutlinedIcon fontSize="small" />
                </Badge>
              }
              onClick={() => setIsCartOpen(true)}
              sx={{
                ml: 1,
                px: 2,
                py: 0.8,
                borderRadius: 2,
                borderWidth: 1.5,
                fontWeight: 600
              }}
            >
              Cart
              {cartCount > 0 && <span className="cart-count" style={{ display: 'none' }}>{cartCount}</span>}
            </Button>
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
}
