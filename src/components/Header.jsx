import React from 'react';
import { Package, ShoppingBag, LayoutDashboard, ClipboardList } from 'lucide-react';

export default function Header({
  activeTab,
  setActiveTab,
  cartCount,
  setIsCartOpen,
  ordersCount
}) {
  return (
    <header className="app-header">
      <div className="header-inner">
        <div className="brand">
          <div className="brand-icon">
            <Package size={20} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span className="brand-title">Commerce Order Console</span>
            <span className="brand-tag">Store Operations</span>
          </div>
        </div>

        <nav className="header-nav">
          <button
            className={`nav-tab ${activeTab === 'catalogue' ? 'active' : ''}`}
            onClick={() => setActiveTab('catalogue')}
          >
            <LayoutDashboard size={16} />
            Catalogue
          </button>

          <button
            className={`nav-tab ${activeTab === 'orders' ? 'active' : ''}`}
            onClick={() => setActiveTab('orders')}
          >
            <ClipboardList size={16} />
            Orders
            {ordersCount > 0 && <span className="nav-badge">{ordersCount}</span>}
          </button>

          <button
            className="cart-button"
            onClick={() => setIsCartOpen(true)}
            title="View Cart"
          >
            <ShoppingBag size={16} />
            Cart
            {cartCount > 0 && <span className="cart-count">{cartCount}</span>}
          </button>
        </nav>
      </div>
    </header>
  );
}
