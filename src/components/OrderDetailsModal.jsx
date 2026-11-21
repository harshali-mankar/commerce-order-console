import React, { useState, useEffect } from 'react';
import {
  X,
  PackageCheck,
  Truck,
  Ban,
  ArrowLeft,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock
} from 'lucide-react';
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
  const [confirmPrompt, setConfirmPrompt] = useState(null); // { targetStatus: 'Packed' | 'Shipped' | 'Cancelled', title, message }

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
      // Reload order details
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: 720 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button className="btn-close" onClick={onClose} title="Back to Orders List">
              <ArrowLeft size={18} />
            </button>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h2 className="modal-title">{order ? order.reference : 'Order Details'}</h2>
                {order && (
                  <span className={`status-pill ${order.status}`}>
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        backgroundColor: 'currentColor'
                      }}
                    ></span>
                    {order.status}
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Order #{orderId} • Historical snapshot record
              </div>
            </div>
          </div>

          <button className="btn-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {loading ? (
            <div className="state-box">
              <div className="spinner" style={{ marginBottom: '1rem' }}></div>
              <div className="state-title">Retrieving order details...</div>
            </div>
          ) : error ? (
            <div className="alert-banner error">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          ) : !order ? (
            <div className="state-box">
              <div className="state-title">Order not found</div>
            </div>
          ) : (
            <div>
              {/* Feedback banner */}
              {feedback && (
                <div className={`alert-banner ${feedback.type}`}>
                  {feedback.type === 'success' ? (
                    <CheckCircle2 size={18} />
                  ) : (
                    <AlertCircle size={18} />
                  )}
                  <span>{feedback.message}</span>
                </div>
              )}

              {/* Confirmation Prompt Modal Overlay if triggered */}
              {confirmPrompt && (
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1.25rem',
                    marginBottom: '1.5rem',
                    boxShadow: 'var(--shadow-sm)'
                  }}
                >
                  <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                    {confirmPrompt.title}
                  </h4>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                    {confirmPrompt.message}
                  </p>
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <button
                      className="btn-secondary"
                      disabled={actionLoading}
                      onClick={() => setConfirmPrompt(null)}
                    >
                      Dismiss
                    </button>
                    <button
                      className={confirmPrompt.targetStatus === 'Cancelled' ? 'btn-cancel' : 'btn-primary'}
                      disabled={actionLoading}
                      onClick={() => handleStatusTransition(confirmPrompt.targetStatus)}
                    >
                      {actionLoading ? 'Processing...' : 'Yes, Confirm'}
                    </button>
                  </div>
                </div>
              )}

              {/* Order Metadata Cards */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '1rem',
                  marginBottom: '1.5rem'
                }}
              >
                <div
                  style={{
                    background: 'var(--bg-muted)',
                    padding: '0.875rem 1rem',
                    borderRadius: 'var(--radius-md)'
                  }}
                >
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Created On</div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem', marginTop: '0.2rem' }}>
                    {formatDate(order.created_at)}
                  </div>
                </div>

                <div
                  style={{
                    background: 'var(--bg-muted)',
                    padding: '0.875rem 1rem',
                    borderRadius: 'var(--radius-md)'
                  }}
                >
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Last Updated</div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem', marginTop: '0.2rem' }}>
                    {formatDate(order.updated_at)}
                  </div>
                </div>

                {order.cancelled_at && (
                  <div
                    style={{
                      background: 'var(--color-danger-bg)',
                      padding: '0.875rem 1rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid rgba(239, 68, 68, 0.2)'
                    }}
                  >
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-danger-text)' }}>Cancelled On</div>
                    <div style={{ fontWeight: 700, fontSize: '0.875rem', marginTop: '0.2rem', color: 'var(--color-danger-text)' }}>
                      {formatDate(order.cancelled_at)}
                    </div>
                  </div>
                )}
              </div>

              {/* Items List Table */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.75rem' }}>
                  Ordered Items ({order.items?.length || 0})
                </h3>

                <div className="table-card">
                  <table className="orders-table">
                    <thead>
                      <tr>
                        <th>Product & SKU</th>
                        <th>Unit Price</th>
                        <th>Quantity</th>
                        <th style={{ textAlign: 'right' }}>Line Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.items?.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{item.product_name_snapshot}</div>
                            <div className="product-sku" style={{ marginTop: '0.2rem' }}>
                              {item.sku || 'N/A'}
                            </div>
                          </td>
                          <td>{formatCurrency(item.unit_price)}</td>
                          <td style={{ fontWeight: 600 }}>{item.quantity}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>
                            {formatCurrency(item.line_total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    marginTop: '1rem',
                    padding: '1rem',
                    background: 'var(--bg-muted)',
                    borderRadius: 'var(--radius-md)'
                  }}
                >
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Overall Order Total</div>
                    <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)' }}>
                      {formatCurrency(order.total)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Order Status Notice if Terminal */}
              {order.status === 'Shipped' && (
                <div
                  style={{
                    background: 'var(--color-success-bg)',
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                    padding: '0.875rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--color-success-text)',
                    fontSize: '0.875rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <Truck size={18} />
                  <span>
                    This order has been shipped to the customer and fulfilled. No further actions can be taken.
                  </span>
                </div>
              )}

              {order.status === 'Cancelled' && (
                <div
                  style={{
                    background: 'var(--color-danger-bg)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    padding: '0.875rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--color-danger-text)',
                    fontSize: '0.875rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <Ban size={18} />
                  <span>
                    This order was cancelled on {formatDate(order.cancelled_at)}. Inventory was restored to the SQLite database.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer with Action Buttons for Placed / Packed */}
        {order && (order.status === 'Placed' || order.status === 'Packed') && !confirmPrompt && (
          <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
            <button
              className="btn-cancel"
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
            >
              <Ban size={14} style={{ marginRight: '0.4rem', verticalAlign: 'middle' }} />
              Cancel Order
            </button>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              {order.status === 'Placed' && (
                <button
                  className="btn-pack"
                  disabled={actionLoading}
                  onClick={() =>
                    setConfirmPrompt({
                      targetStatus: 'Packed',
                      title: 'Mark Order as Packed',
                      message: `Confirm that all items in order ${order.reference} are verified and packed into shipment parcel.`
                    })
                  }
                >
                  <PackageCheck size={16} style={{ marginRight: '0.4rem', verticalAlign: 'middle' }} />
                  Pack Order
                </button>
              )}

              {order.status === 'Packed' && (
                <button
                  className="btn-ship"
                  disabled={actionLoading}
                  onClick={() =>
                    setConfirmPrompt({
                      targetStatus: 'Shipped',
                      title: 'Mark Order as Shipped',
                      message: `Confirm dispatch for order ${order.reference}. Once shipped, order fulfilment is complete and cannot be cancelled.`
                    })
                  }
                >
                  <Truck size={16} style={{ marginRight: '0.4rem', verticalAlign: 'middle' }} />
                  Ship Order
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
