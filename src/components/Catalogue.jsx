import React from 'react';
import { Plus, Check, AlertCircle, RefreshCw, ShoppingCart } from 'lucide-react';
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
      <div className="state-box">
        <div className="spinner" style={{ marginBottom: '1rem' }}></div>
        <div className="state-title">Loading Product Catalogue...</div>
        <p>Connecting to persistent SQLite database</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="state-box" style={{ borderColor: 'var(--color-danger)' }}>
        <AlertCircle size={32} color="var(--color-danger)" style={{ marginBottom: '0.75rem' }} />
        <div className="state-title" style={{ color: 'var(--color-danger)' }}>Failed to load catalogue</div>
        <p style={{ marginBottom: '1rem' }}>{error}</p>
        <button className="btn-secondary" onClick={onRefresh}>
          <RefreshCw size={14} style={{ marginRight: '0.4rem', verticalAlign: 'middle' }} />
          Retry
        </button>
      </div>
    );
  }

  if (!products || products.length === 0) {
    return (
      <div className="state-box">
        <div className="state-title">Catalogue is empty</div>
        <p>No products are currently available in the database.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Product Catalogue & Inventory</h1>
          <p className="page-subtitle">Real-time stock monitoring from persistent SQLite storage</p>
        </div>
        <button className="btn-secondary" onClick={onRefresh} title="Refresh Catalogue">
          <RefreshCw size={14} style={{ marginRight: '0.4rem', verticalAlign: 'middle' }} />
          Sync Stock
        </button>
      </div>

      <div className="products-grid">
        {products.map((product) => {
          const isOutOfStock = product.stock_quantity <= 0;
          const cartItem = cartItems.find((i) => i.productId === product.id);
          const quantityInCart = cartItem ? cartItem.quantity : 0;
          const remainingAvailable = product.stock_quantity - quantityInCart;
          const cannotAddMore = isOutOfStock || remainingAvailable <= 0;

          return (
            <div
              key={product.id}
              className={`product-card ${isOutOfStock ? 'out-of-stock' : ''}`}
            >
              <div>
                <div className="product-header">
                  <span className="product-sku">{product.sku}</span>
                  {isOutOfStock ? (
                    <span className="stock-badge out-of-stock">
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#9ca3af' }}></span>
                      0 in stock — Unavailable
                    </span>
                  ) : (
                    <span className="stock-badge in-stock">
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }}></span>
                      {product.stock_quantity} in stock
                    </span>
                  )}
                </div>

                <h3 className="product-name">{product.name}</h3>
                <p className="product-desc">{product.description || 'No description provided.'}</p>
              </div>

              <div className="product-footer">
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Unit Price</div>
                  <div className="product-price">{formatCurrency(product.price)}</div>
                </div>

                <button
                  className="btn-add"
                  disabled={cannotAddMore}
                  onClick={() => onAddToCart(product)}
                >
                  {isOutOfStock ? (
                    'Out of Stock'
                  ) : remainingAvailable <= 0 ? (
                    'Max in Cart'
                  ) : (
                    <>
                      <Plus size={16} />
                      Add to Order
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {cartItems && cartItems.length > 0 && (
        <div className="cart-floating-banner">
          <div className="cart-banner-info">
            <span className="cart-banner-badge">
              {cartItems.reduce((acc, i) => acc + i.quantity, 0)} {cartItems.reduce((acc, i) => acc + i.quantity, 0) === 1 ? 'unit' : 'units'}
            </span>
            <span className="cart-banner-text">
              {cartItems.length} {cartItems.length === 1 ? 'product' : 'products'} in cart
            </span>
            <span className="cart-banner-dot">•</span>
            <span className="cart-banner-total">
              Order Total: {formatCurrency(cartItems.reduce((acc, i) => acc + i.price * i.quantity, 0))}
            </span>
          </div>
          <button
            className="btn-primary"
            onClick={onOpenCart}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <ShoppingCart size={16} />
            Review & Create Order
          </button>
        </div>
      )}
    </div>
  );
}
