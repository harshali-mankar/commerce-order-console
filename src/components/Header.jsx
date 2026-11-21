import React from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Button,
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
      elevation={0}
      sx={{
        backgroundColor: '#0f172a',
        color: '#ffffff',
        borderBottom: '1px solid #1e293b',
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
                backgroundColor: '#4f46e5',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(79, 70, 229, 0.4)'
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
                    color: '#f8fafc',
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
                    backgroundColor: 'rgba(99, 102, 241, 0.2)',
                    color: '#a5b4fc',
                    border: '1px solid rgba(99, 102, 241, 0.3)'
                  }}
                />
              </Box>
              <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block' }}>
                Phone Orders & Real-time Inventory Management
              </Typography>
            </Box>
          </Box>

          {/* Navigation Controls */}
          <Box className="header-nav" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              className={`nav-tab ${activeTab === 'catalogue' ? 'active' : ''}`}
              variant="text"
              startIcon={<DashboardOutlinedIcon fontSize="small" />}
              onClick={() => setActiveTab('catalogue')}
              sx={{
                px: 2,
                py: 0.75,
                borderRadius: 2,
                fontWeight: 600,
                fontSize: '0.875rem',
                backgroundColor: activeTab === 'catalogue' ? '#4f46e5' : 'transparent',
                color: activeTab === 'catalogue' ? '#ffffff' : '#94a3b8',
                '&:hover': {
                  backgroundColor: activeTab === 'catalogue' ? '#4338ca' : 'rgba(255, 255, 255, 0.08)',
                  color: '#ffffff'
                }
              }}
            >
              Catalogue
            </Button>

            <Button
              className={`nav-tab ${activeTab === 'orders' ? 'active' : ''}`}
              variant="text"
              startIcon={<ReceiptLongOutlinedIcon fontSize="small" />}
              onClick={() => setActiveTab('orders')}
              sx={{
                px: 2,
                py: 0.75,
                borderRadius: 2,
                fontWeight: 600,
                fontSize: '0.875rem',
                backgroundColor: activeTab === 'orders' ? '#4f46e5' : 'transparent',
                color: activeTab === 'orders' ? '#ffffff' : '#94a3b8',
                '&:hover': {
                  backgroundColor: activeTab === 'orders' ? '#4338ca' : 'rgba(255, 255, 255, 0.08)',
                  color: '#ffffff'
                }
              }}
            >
              Orders
              {ordersCount > 0 && (
                <Chip
                  label={ordersCount}
                  size="small"
                  className="nav-badge"
                  sx={{
                    ml: 1,
                    height: 18,
                    fontSize: '0.675rem',
                    fontWeight: 700,
                    backgroundColor: '#38bdf8',
                    color: '#0f172a'
                  }}
                />
              )}
            </Button>

            <Button
              className="cart-button"
              variant="outlined"
              startIcon={<ShoppingBagOutlinedIcon fontSize="small" />}
              onClick={() => setIsCartOpen(true)}
              sx={{
                ml: 1,
                px: 2,
                py: 0.75,
                borderRadius: 2,
                fontWeight: 600,
                fontSize: '0.875rem',
                borderColor: '#334155',
                color: '#f8fafc',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                '&:hover': {
                  borderColor: '#64748b',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)'
                }
              }}
            >
              Cart
              {cartCount > 0 && (
                <Chip
                  label={cartCount}
                  size="small"
                  className="cart-count"
                  sx={{
                    ml: 1,
                    height: 18,
                    fontSize: '0.675rem',
                    fontWeight: 700,
                    backgroundColor: '#ef4444',
                    color: '#ffffff'
                  }}
                />
              )}
            </Button>
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
}
