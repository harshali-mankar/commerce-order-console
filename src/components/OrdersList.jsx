import React from 'react';
import { Search, Eye, Filter, RefreshCw, AlertCircle, ShoppingBag } from 'lucide-react';
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

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Customer Orders Management</h1>
          <p className="page-subtitle">Track, filter, and fulfil orders across lifecycle stages</p>
        </div>
        <button className="btn-secondary" onClick={onRefresh} title="Refresh Orders List">
          <RefreshCw size={14} style={{ marginRight: '0.4rem', verticalAlign: 'middle' }} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="alert-banner error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="orders-filter-bar">
        <div className="search-wrapper">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search by order reference (e.g. ORD-2026...)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Filter size={16} color="var(--text-muted)" />
          <select
            className="status-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s === 'All' ? 'All Statuses' : s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table Content */}
      {loading ? (
        <div className="state-box">
          <div className="spinner" style={{ marginBottom: '1rem' }}></div>
          <div className="state-title">Loading Orders...</div>
          <p>Querying SQLite database records</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="state-box">
          {searchQuery || statusFilter !== 'All' ? (
            <div>
              <div className="state-title">No matching orders found</div>
              <p style={{ marginBottom: '1rem' }}>
                No orders match your filter criteria (Search: "{searchQuery}", Status: "{statusFilter}").
              </p>
              <button
                className="btn-secondary"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('All');
                }}
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <div>
              <ShoppingBag size={40} color="var(--text-dim)" style={{ marginBottom: '1rem' }} />
              <div className="state-title">No orders have been placed yet</div>
              <p style={{ marginBottom: '1.25rem' }}>
                Create customer orders from the Product Catalogue to get started.
              </p>
              <button className="btn-primary" onClick={onNavigateCatalogue}>
                Go to Catalogue
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="table-card">
          <table className="orders-table">
            <thead>
              <tr>
                <th>Order Reference</th>
                <th>Date Created</th>
                <th>Items</th>
                <th>Order Total</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <span className="order-ref">{order.reference}</span>
                  </td>
                  <td style={{ color: 'var(--text-muted)' }}>{formatDate(order.created_at)}</td>
                  <td>
                    <span style={{ fontWeight: 500 }}>
                      {order.item_count} product{order.item_count === 1 ? '' : 's'}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginLeft: '0.35rem' }}>
                      ({order.total_quantity} unit{order.total_quantity === 1 ? '' : 's'})
                    </span>
                  </td>
                  <td style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                    {formatCurrency(order.total)}
                  </td>
                  <td>
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
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="btn-view"
                      onClick={() => onSelectOrder(order.id)}
                      title="Inspect complete order details and handle fulfilment"
                    >
                      <Eye size={13} style={{ marginRight: '0.3rem', verticalAlign: 'middle' }} />
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
