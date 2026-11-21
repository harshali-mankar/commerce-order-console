import React, { useState, useEffect, useCallback } from 'react';
import { Box, Container } from '@mui/material';
import Header from './components/Header';
import Catalogue from './components/Catalogue';
import CartModal from './components/CartModal';
import OrdersList from './components/OrdersList';
import OrderDetailsModal from './components/OrderDetailsModal';
import { fetchProducts, fetchOrders } from './api';

export default function App() {
  const [activeTab, setActiveTab] = useState('catalogue'); // 'catalogue' | 'orders'

  // Catalogue State
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState(null);

  // Cart State
  const [cartItems, setCartItems] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Orders State
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedOrderId, setSelectedOrderId] = useState(null);

  // Load Products
  const loadProducts = useCallback(async () => {
    try {
      setProductsLoading(true);
      setProductsError(null);
      const data = await fetchProducts();
      setProducts(data);
    } catch (err) {
      setProductsError(err.message || 'Failed to load products');
    } finally {
      setProductsLoading(false);
    }
  }, []);

  // Load Orders
  const loadOrders = useCallback(async () => {
    try {
      setOrdersLoading(true);
      setOrdersError(null);
      const data = await fetchOrders({ search: searchQuery, status: statusFilter });
      setOrders(data);
    } catch (err) {
      setOrdersError(err.message || 'Failed to load orders');
    } finally {
      setOrdersLoading(false);
    }
  }, [searchQuery, statusFilter]);

  // Initial load
  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadOrders();
    }, 250);
    return () => clearTimeout(timer);
  }, [loadOrders]);

  // Cart actions
  const handleAddToCart = (product) => {
    setCartItems((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        if (existing.quantity >= product.stock_quantity) return prev;
        return prev.map((i) =>
          i.productId === product.id
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          sku: product.sku,
          name: product.name,
          price: product.price,
          quantity: 1,
          maxStock: product.stock_quantity
        }
      ];
    });
  };

  const handleUpdateCartQuantity = (productId, newQty) => {
    setCartItems((prev) => {
      const item = prev.find((i) => i.productId === productId);
      if (!item) return prev;
      const num = Number(newQty);
      if (!Number.isInteger(num) || num <= 0) return prev;
      const clampedQty = Math.min(num, item.maxStock);
      return prev.map((i) =>
        i.productId === productId ? { ...i, quantity: clampedQty } : i
      );
    });
  };

  const handleRemoveFromCart = (productId) => {
    setCartItems((prev) => prev.filter((i) => i.productId !== productId));
  };

  const handleClearCart = () => {
    setCartItems([]);
  };

  const handleOrderSuccess = () => {
    loadProducts();
    loadOrders();
  };

  const handleOrderUpdated = () => {
    loadProducts();
    loadOrders();
  };

  const totalCartCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default' }} className="app-container">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        cartCount={totalCartCount}
        setIsCartOpen={setIsCartOpen}
        ordersCount={orders.length}
      />

      <Container maxWidth="lg" component="main" sx={{ pt: 4, pb: 6 }} className="main-content">
        {activeTab === 'catalogue' ? (
          <Catalogue
            products={products}
            loading={productsLoading}
            error={productsError}
            onRefresh={loadProducts}
            onAddToCart={handleAddToCart}
            cartItems={cartItems}
            onOpenCart={() => setIsCartOpen(true)}
          />
        ) : (
          <OrdersList
            orders={orders}
            loading={ordersLoading}
            error={ordersError}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            onRefresh={loadOrders}
            onSelectOrder={(id) => setSelectedOrderId(id)}
            onNavigateCatalogue={() => setActiveTab('catalogue')}
          />
        )}
      </Container>

      {/* Cart Modal */}
      <CartModal
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cartItems={cartItems}
        onUpdateQuantity={handleUpdateCartQuantity}
        onRemoveItem={handleRemoveFromCart}
        onClearCart={handleClearCart}
        onOrderSuccess={handleOrderSuccess}
      />

      {/* Order Details Modal */}
      {selectedOrderId && (
        <OrderDetailsModal
          orderId={selectedOrderId}
          onClose={() => setSelectedOrderId(null)}
          onOrderUpdated={handleOrderUpdated}
        />
      )}
    </Box>
  );
}
