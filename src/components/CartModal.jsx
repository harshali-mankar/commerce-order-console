import React, { useState } from 'react';
import { X, Trash2, ShoppingCart, CheckCircle, AlertCircle, ArrowRight, Clock, Hash } from 'lucide-react';
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
      // Map items for API payload strictly matching { productId, quantity }
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
    <div className="modal-overlay" onClick={handleModalClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShoppingCart size={20} color="var(--accent-primary)" />
            <h2 className="modal-title">
              {createdOrder
                ? 'Order Confirmed'
                : showConfirmSummary
                ? 'Review Order Summary'
                : 'Customer Order Cart'}
            </h2>
          </div>
          <button className="btn-close" onClick={handleModalClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {errorMessage && (
            <div className="alert-banner error">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertCircle size={18} />
                <span>{errorMessage}</span>
              </div>
              <button
                className="btn-close"
                onClick={() => setErrorMessage(null)}
                style={{ color: 'inherit' }}
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Success State */}
          {createdOrder ? (
            <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: 'var(--color-success-bg)',
                  color: 'var(--color-success)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1rem'
                }}
              >
                <CheckCircle size={32} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                Order Placed Successfully!
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
                Transactional stock deduction committed to SQLite.
              </p>

              <div
                style={{
                  background: 'var(--bg-muted)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.25rem',
                  textAlign: 'left',
                  marginBottom: '1.25rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Reference:</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-main)' }}>
                    {createdOrder.reference}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Order ID:</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                    #{createdOrder.id || createdOrder.orderId}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Initial Status:</span>
                  <span className="status-pill Placed">Placed</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Created At:</span>
                  <span style={{ fontSize: '0.875rem' }}>
                    {formatDate(createdOrder.created_at || createdOrder.createdAt)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Total Amount:</span>
                  <span style={{ fontWeight: 700, color: 'var(--accent-primary)', fontSize: '1.1rem' }}>
                    {formatCurrency(createdOrder.total)}
                  </span>
                </div>

                {createdOrder.items && createdOrder.items.length > 0 && (
                  <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem', marginTop: '0.75rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                      Items Snapshot ({createdOrder.items.length})
                    </div>
                    {createdOrder.items.map((item, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '0.8125rem',
                          padding: '0.2rem 0'
                        }}
                      >
                        <span>
                          {item.quantity} × {item.productName || item.product_name_snapshot} ({item.sku || 'SKU'})
                        </span>
                        <span style={{ fontWeight: 600 }}>
                          {formatCurrency(item.lineTotal || (item.unitPrice * item.quantity))}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button className="btn-primary btn-continue-operations" style={{ width: '100%' }} onClick={handleModalClose}>
                Continue Operations
              </button>
            </div>
          ) : showConfirmSummary ? (
            /* Confirmation Summary Step */
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>
                Please review the order details before committing. Stock will be atomically deducted from SQLite inventory.
              </p>

              <div
                style={{
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1rem',
                  marginBottom: '1.25rem',
                  background: 'var(--bg-card)'
                }}
              >
                {cartItems.map((item) => (
                  <div
                    key={item.productId}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.6rem 0',
                      borderBottom: '1px solid var(--border-subtle)',
                      fontSize: '0.875rem'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600 }}>{item.name}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                        {item.quantity} × {formatCurrency(item.price)} • Stock Avail: {item.maxStock}
                      </div>
                    </div>
                    <div style={{ fontWeight: 600, textAlign: 'right' }}>
                      <div>{formatCurrency(item.price * item.quantity)}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {item.quantity} {item.quantity === 1 ? 'unit' : 'units'}
                      </div>
                    </div>
                  </div>
                ))}

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    paddingTop: '0.75rem',
                    fontSize: '1.05rem',
                    fontWeight: 700
                  }}
                >
                  <span>Grand Total:</span>
                  <span style={{ color: 'var(--accent-primary)' }}>{formatCurrency(orderTotal)}</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  className="btn-secondary"
                  style={{ flex: 1 }}
                  disabled={submitting}
                  onClick={() => setShowConfirmSummary(false)}
                >
                  Edit Cart
                </button>
                <button
                  className="btn-primary btn-confirm-place-order"
                  style={{ flex: 2 }}
                  disabled={submitting}
                  onClick={handleConfirmOrder}
                >
                  {submitting ? 'Committing Transaction...' : 'Confirm & Place Order'}
                </button>
              </div>
            </div>
          ) : cartItems.length === 0 ? (
            /* Empty Cart */
            <div style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
              <ShoppingCart size={40} color="var(--text-dim)" style={{ marginBottom: '1rem' }} />
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.25rem' }}>Your Cart is Empty</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                Select items from the catalogue to begin creating a customer order.
              </p>
              <button className="btn-secondary" onClick={handleModalClose}>
                Browse Catalogue
              </button>
            </div>
          ) : (
            /* Items List */
            <div>
              <div className="cart-list">
                {cartItems.map((item) => {
                  const lineTotal = item.price * item.quantity;
                  const canIncrease = item.quantity < item.maxStock;

                  return (
                    <div key={item.productId} className="cart-item">
                      <div className="cart-item-info">
                        <div className="cart-item-name">{item.name}</div>
                        <div className="cart-item-meta">
                          Unit: {formatCurrency(item.price)} • In Stock: {item.maxStock}
                        </div>
                      </div>

                      <div className="qty-controls">
                        <button
                          className="qty-btn"
                          disabled={item.quantity <= 1}
                          onClick={() => onUpdateQuantity(item.productId, item.quantity - 1)}
                          title="Decrease Quantity"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          className="qty-input qty-value"
                          aria-label={`Quantity for ${item.name}`}
                          min="1"
                          max={item.maxStock}
                          step="1"
                          value={item.quantity}
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
                        <button
                          className="qty-btn"
                          disabled={!canIncrease}
                          onClick={() => onUpdateQuantity(item.productId, item.quantity + 1)}
                          title={canIncrease ? 'Increase Quantity' : 'Stock limit reached'}
                        >
                          +
                        </button>
                      </div>

                      <div className="cart-item-total">{formatCurrency(lineTotal)}</div>

                      <button
                        className="btn-remove"
                        onClick={() => onRemoveItem(item.productId)}
                        title="Remove from Cart"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="cart-summary">
                <div className="summary-row">
                  <span>Selected Products:</span>
                  <span>{cartItems.length}</span>
                </div>
                <div className="summary-row">
                  <span>Total Quantity:</span>
                  <span>{cartItems.reduce((acc, i) => acc + i.quantity, 0)} units</span>
                </div>
                <div className="summary-row summary-total">
                  <span>Order Total:</span>
                  <span>{formatCurrency(orderTotal)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {!createdOrder && !showConfirmSummary && cartItems.length > 0 && (
          <div className="modal-footer">
            <button className="btn-secondary" onClick={onClearCart}>
              Clear Cart
            </button>
            <button
              className="btn-primary btn-review-order"
              onClick={() => setShowConfirmSummary(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
            >
              Review & Place Order
              <ArrowRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
