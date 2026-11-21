# Commerce Order Console — Technical & Programmatic Architecture

A deep-dive technical guide explaining how the **Commerce Order Console** functions from a code execution, control flow, database transaction, and state management perspective.

---

## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [Server Bootstrapping & Initialization Sequence](#2-server-bootstrapping--initialization-sequence)
3. [Database Engine & Concurrency Controls](#3-database-engine--concurrency-controls)
4. [Request Lifecycle & Control Flow](#4-request-lifecycle--control-flow)
   - [A. Product Catalogue Retrieval (`GET /api/products`)](#a-product-catalogue-retrieval-get-apiproducts)
   - [B. Atomic Order Creation (`POST /api/orders`)](#b-atomic-order-creation-post-apiorders)
   - [C. Order Discovery & Query Filtering (`GET /api/orders`)](#c-order-discovery--query-filtering-get-apiorders)
   - [D. Order Details & Snapshot Retrieval (`GET /api/orders/:id`)](#d-order-details--snapshot-retrieval-get-apiordersid)
   - [E. Fulfilment & Exactly-Once Cancellation (`PATCH /api/orders/:id/status`)](#e-fulfilment--exactly-once-cancellation-patch-apiordersidstatus)
5. [Frontend React Architecture & State Synchronization](#5-frontend-react-architecture--state-synchronization)
6. [Data Snapshot Strategy & Immutability Pattern](#6-data-snapshot-strategy--immutability-pattern)
7. [Error Handling & Boundary Strategies](#7-error-handling--boundary-strategies)
8. [Automated Test Harness Internals](#8-automated-test-harness-internals)

---

## 1. System Architecture Overview

The system is constructed as a two-tier decoupled client-server application hosted as a unified Node.js process in production or via a Vite proxy during development:

```
+-----------------------------------------------------------------------------------+
|                                  CLIENT TIER                                      |
|                                                                                   |
|  React 18 SPA (Vite Bundler)                                                      |
|  ├── App.jsx (Root Coordinator: Active Tab, Global Cart State, Polling/Refresh)   |
|  ├── Catalogue.jsx (Product Cards, Out-of-Stock Badges, Floating Cart Banner)     |
|  ├── CartModal.jsx (Quantity Step/Input Validation, Two-Stage Review & Commit)    |
|  ├── OrdersList.jsx (Debounced Reference Search, Status Dropdown, High-Density UI)|
|  ├── OrderDetailsModal.jsx (Action State Machine, Snapshot Inspection, Prompts)   |
|  └── api.js (Fetch Abstraction, Error Normalization, INR/Date Formatting)         |
+-----------------------------------------------------------------------------------+
                                       |
                               HTTP / JSON REST
                                       |
+-----------------------------------------------------------------------------------+
|                                  SERVER TIER                                      |
|                                                                                   |
|  Node.js + Express REST API (server/app.js)                                       |
|  ├── Middleware: CORS, express.json(), Static Asset Handler (dist/)               |
|  ├── routes/products.js (Read-only Catalogue Endpoint)                            |
|  └── routes/orders.js (Transactional Creation, Search, Details, State Machine)    |
+-----------------------------------------------------------------------------------+
                                       |
                               SQLite3 Driver (WAL)
                                       |
+-----------------------------------------------------------------------------------+
|                                  DATABASE TIER                                    |
|                                                                                   |
|  Persistent SQLite Database (data/commerce.db)                                    |
|  ├── PRAGMA journal_mode = WAL; (High Concurrency Readers/Writer)                 |
|  ├── PRAGMA foreign_keys = ON; (Referential Cascade & Integrity)                  |
|  ├── products Table (Inventory with CHECK (stock_quantity >= 0))                  |
|  ├── orders Table (Finite State Machine with CHECK (status IN (...)))             |
|  └── order_items Table (Immutable Snapshot History with unit_price & line_total)  |
+-----------------------------------------------------------------------------------+
```

---

## 2. Server Bootstrapping & Initialization Sequence

When the application boots (`node server/index.js` or `npm start`), the runtime executes the following deterministic startup pipeline:

```
[server/index.js: startServer()]
       │
       ▼
1. Initialize Database [server/db.js: getDb()]
       │  ├── Open/Connect to data/commerce.db via sqlite3
       │  ├── Execute 'PRAGMA foreign_keys = ON;'
       │  ├── Execute 'PRAGMA journal_mode = WAL;'
       │  └── Execute DDL: CREATE TABLE IF NOT EXISTS (products, orders, order_items)
       │
       ▼
2. Idempotent Seed [server/seed.js: seedProducts()]
       │  ├── Prepare statement: INSERT OR IGNORE INTO products (...) VALUES (...)
       │  └── Populate missing synthetic products keyed by UNIQUE sku
       │      (Existing inventory is never overwritten on restarts)
       │
       ▼
3. Express Instantiation [server/app.js: createApp()]
       │  ├── Register cors() and express.json()
       │  ├── Mount API Routers: /api/products, /api/orders
       │  ├── Mount Health Check: /api/health
       │  └── Mount Static Asset Middleware: express.static(dist/) for SPA fallback
       │
       ▼
4. Port Binding [server.listen(PORT: 3001)]
```

---

## 3. Database Engine & Concurrency Controls

### Why SQLite WAL Mode?
By default, standard SQLite uses rollback journals which lock the entire database file during writes, blocking readers. The application enables **Write-Ahead Logging (WAL)**:
```javascript
await db.exec('PRAGMA journal_mode = WAL;');
await db.exec('PRAGMA foreign_keys = ON;');
```
- **Concurrent Readers & Writers:** In WAL mode, reads can occur concurrently with write operations.
- **Immediate Lock (`BEGIN IMMEDIATE`):**
  Standard `BEGIN` transactions are deferred, meaning they obtain a SHARED lock and attempt to upgrade to a RESERVED/EXCLUSIVE lock only upon writing. If two requests read stock simultaneously and both attempt to write, one will fail with `SQLITE_BUSY`.
  By using `BEGIN IMMEDIATE TRANSACTION;`, the application obtains a reserved write lock upfront. Subsequent write transactions wait safely in queue, eliminating race conditions.

### Defensive Database-Level Integrity Constraints
Even if a developer bypasses API checks, the database engine enforces:
1. `products.stock_quantity INTEGER NOT NULL CHECK (stock_quantity >= 0)`: Mechanically impossible for stock to become negative.
2. `orders.status TEXT NOT NULL CHECK (status IN ('Placed', 'Packed', 'Shipped', 'Cancelled'))`: Enforces valid enum strings.
3. `order_items.quantity INTEGER NOT NULL CHECK (quantity > 0)`: Disallows zero or negative line item quantities.
4. `order_items.order_id REFERENCES orders(id) ON DELETE CASCADE`: Foreign key relational binding.

---

## 4. Request Lifecycle & Control Flow

### A. Product Catalogue Retrieval (`GET /api/products`)
1. Client issues `GET /api/products`.
2. Router queries SQLite:
   ```sql
   SELECT id, sku, name, description, price, stock_quantity, created_at
   FROM products
   ORDER BY id ASC;
   ```
3. Returns `{ products: [...] }` with current real-time stock counts.

---

### B. Atomic Order Creation (`POST /api/orders`)

This is the most critical transaction in the system. The server handles validation, consolidation, stock deduction, order generation, and item snapshot recording as an atomic unit.

#### Control Flow Sequence:

```
Client (CartModal)                       Express Router                          SQLite Database
      │                                        │                                        │
      │─── POST /api/orders ──────────────────>│                                        │
      │    { items: [{ productId, qty }] }     │                                        │
      │                                        │── 1. Validate payload structure        │
      │                                        │      (Array check, positive ints)      │
      │                                        │                                        │
      │                                        │── 2. Consolidate duplicates            │
      │                                        │      (Map<productId, sumQty>)          │
      │                                        │                                        │
      │                                        │── 3. BEGIN IMMEDIATE TRANSACTION ─────>│
      │                                        │                                        │
      │                                        │── 4. Query current products/stock ────>│
      │                                        │<─── Returns stock_quantity & price ────│
      │                                        │                                        │
      │                                        │── [Check Stock >= Requested]           │
      │                                        │   If insufficient ────────────────────>│ ROLLBACK
      │                                        │   Throw 400 Bad Request                │
      │                                        │                                        │
      │                                        │── 5. Conditional Stock Deduction ─────>│
      │                                        │      UPDATE products                   │
      │                                        │      SET stock = stock - ?             │
      │                                        │      WHERE id = ? AND stock >= ?       │
      │                                        │                                        │
      │                                        │── 6. Create Order Record ─────────────>│
      │                                        │      INSERT INTO orders                │
      │                                        │      (reference, 'Placed', total)      │
      │                                        │                                        │
      │                                        │── 7. Insert Item Snapshots ───────────>│
      │                                        │      INSERT INTO order_items           │
      │                                        │      (order_id, snapshot_name, price)  │
      │                                        │                                        │
      │                                        │── 8. COMMIT TRANSACTION ──────────────>│
      │                                        │                                        │
      │<── 201 Created { reference, order } ───│                                        │
```

#### Detailed Transaction Implementation (`server/routes/orders.js`):
1. **Consolidation & Sanitization:**
   ```javascript
   const consolidatedMap = new Map();
   for (const item of items) {
     const rawPid = Number(item.productId);
     const rawQty = Number(item.quantity);
     if (!Number.isInteger(rawPid) || rawPid <= 0) throw 400;
     if (!Number.isInteger(rawQty) || rawQty <= 0) throw 400;
     consolidatedMap.set(rawPid, (consolidatedMap.get(rawPid) || 0) + rawQty);
   }
   ```
2. **Immediate Lock:**
   ```javascript
   await db.run('BEGIN IMMEDIATE TRANSACTION;');
   inTransaction = true;
   ```
3. **Database-Truth Pricing & Availability:**
   Queries database price and verifies `product.stock_quantity >= item.quantity`. The frontend price is never trusted.
4. **Atomic Deduction:**
   ```javascript
   const res = await db.run(
     'UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ? AND stock_quantity >= ?;',
     [item.quantity, item.productId, item.quantity]
   );
   if (res.changes === 0) throw new Error('Insufficient stock');
   ```
5. **Snapshot Preservation:**
   Inserts `product_name_snapshot` and `unit_price` into `order_items`.
6. **Rollback on Exception:**
   If any check fails, the `catch` block intercepts:
   ```javascript
   if (inTransaction) {
     await db.run('ROLLBACK;');
   }
   ```

---

### C. Order Discovery & Query Filtering (`GET /api/orders`)

Supports query parameters `?search=...` and `?status=...`.

```javascript
const whereClauses = [];
const params = [];

if (search && search.trim()) {
  whereClauses.push('UPPER(o.reference) LIKE ?');
  params.push(`%${search.trim().toUpperCase()}%`);
}

if (status && status !== 'All') {
  whereClauses.push('o.status = ?');
  params.push(status);
}
```

The SQL query aggregates item count and total item units in a single query:
```sql
SELECT 
  o.id,
  o.reference,
  o.status,
  o.total,
  o.created_at,
  o.updated_at,
  o.cancelled_at,
  COUNT(oi.id) AS item_count,
  COALESCE(SUM(oi.quantity), 0) AS total_quantity
FROM orders o
LEFT JOIN order_items oi ON o.id = oi.order_id
[WHERE ...]
GROUP BY o.id
ORDER BY o.id DESC;
```

---

### D. Order Details & Snapshot Retrieval (`GET /api/orders/:id`)

When staff clicks "View Details", the client queries `GET /api/orders/:id`:
1. Fetches the order header (`orders`).
2. Fetches historical order lines (`order_items` joined with `products` for current SKU).
3. Constructs and returns:
   ```json
   {
     "order": {
       "id": 1,
       "reference": "ORD-20261121-7A3F",
       "status": "Placed",
       "total": 499800,
       "created_at": "...",
       "updated_at": "...",
       "cancelled_at": null,
       "items": [
         {
           "product_name_snapshot": "Mechanical Keyboard",
           "sku": "PROD-C",
           "unit_price": 249900,
           "quantity": 2,
           "line_total": 499800
         }
       ]
     }
   }
   ```

---

### E. Fulfilment & Exactly-Once Cancellation (`PATCH /api/orders/:id/status`)

This route enforces the finite state machine:

```
[Current State]      [Target State]      [Action / Verification]
Placed           ->  Packed              Allowed: Updates status & updated_at
Packed           ->  Shipped             Allowed: Updates status & updated_at (Terminal)
Placed           ->  Cancelled           Allowed: Restores stock atomically & sets cancelled_at
Packed           ->  Cancelled           Allowed: Restores stock atomically & sets cancelled_at
Placed           ->  Shipped             REJECTED (400 Bad Request): Must pack before shipping
Shipped          ->  *                   REJECTED (400 Bad Request): Shipped orders are finalized
Cancelled        ->  *                   REJECTED (400 Bad Request): Cancelled orders are terminal
*                ->  Unknown             REJECTED (400 Bad Request): Invalid target status
```

#### Exactly-Once Cancellation Mechanism:
```javascript
await db.run('BEGIN IMMEDIATE TRANSACTION;');

const order = await db.get('SELECT status FROM orders WHERE id = ?;', [orderId]);
if (order.status === 'Cancelled') {
  throw { status: 400, message: 'Order is already Cancelled.' };
}
if (order.status === 'Shipped') {
  throw { status: 400, message: 'Shipped orders cannot be modified or cancelled.' };
}

// Retrieve items to restore
const items = await db.all('SELECT product_id, quantity FROM order_items WHERE order_id = ?;', [orderId]);

for (const item of items) {
  await db.run('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?;', [item.quantity, item.product_id]);
}

const now = new Date().toISOString();
await db.run('UPDATE orders SET status = "Cancelled", updated_at = ?, cancelled_at = ? WHERE id = ?;', [now, now, orderId]);

await db.run('COMMIT;');
```

---

## 5. Frontend React Architecture & State Synchronization

### Component Hierarchy

```
<App>
  ├── <Header>
  │     ├── Navigation Tabs (Catalogue | Orders + Badge Count)
  │     └── Cart Button (Shopping Bag Icon + Active Item Count)
  │
  ├── [ActiveTab === 'catalogue']
  │     └── <Catalogue>
  │           ├── Product Grid (<ProductCard> × 5)
  │           │     ├── Stock Badges ("X in stock" | "0 in stock — Unavailable")
  │           │     └── Add Button ("Add to Order" | "Max in Cart" | "Out of Stock")
  │           └── Floating Cart Banner (Sticky Bottom Bar + "Review & Create Order")
  │
  ├── [ActiveTab === 'orders']
  │     └── <OrdersList>
  │           ├── Filter Bar (<SearchInput> debounced + <StatusDropdown>)
  │           └── High-Density Orders Table (<OrderRow> × N + "View Details" action)
  │
  ├── <CartModal> (Conditionally rendered when isCartOpen === true)
  │     ├── Screen 1: Item Cart List (Qty step buttons, direct number input, line totals)
  │     ├── Screen 2: Confirmation Summary (Line item review + "Confirm & Place Order")
  │     └── Screen 3: Transaction Receipt (Order Ref, Status Placed, Snapshots)
  │
  └── <OrderDetailsModal> (Conditionally rendered when selectedOrderId !== null)
        ├── Snapshot Breakdown Table
        ├── Contextual State Actions (Pack Order, Ship Order, Cancel Order)
        └── Confirmation Prompts
```

### Key State Workflows

1. **Cart Quantity Clamping:**
   Inside `CartModal.jsx`, input is strictly verified before invoking `onUpdateQuantity`:
   ```javascript
   const val = Number(e.target.value);
   if (!Number.isInteger(val) || val <= 0) return setError('Invalid quantity');
   if (val > item.maxStock) {
     onUpdateQuantity(item.productId, item.maxStock);
     return setError('Cannot exceed available stock');
   }
   onUpdateQuantity(item.productId, val);
   ```

2. **Debounced Search:**
   `App.jsx` debounces reference queries by 250ms, ensuring responsive typing without overloading the SQLite connection:
   ```javascript
   useEffect(() => {
     const timer = setTimeout(() => {
       loadOrders();
     }, 250);
     return () => clearTimeout(timer);
   }, [loadOrders]);
   ```

3. **Catalogue & Order List Co-Synchronization:**
   When an order is created or cancelled, `handleOrderSuccess` / `handleOrderUpdated` refreshes both `loadProducts()` and `loadOrders()`. The UI reflects the updated inventory and status instantly.

---

## 6. Data Snapshot Strategy & Immutability Pattern

In standard e-commerce architectures, foreign keys point to mutable product rows. If a product title is renamed or a price changes from ₹799 to ₹999, historical accounting records would inadvertently alter.

### Programmatic Snapshot Solution:
When an order is created, the system copies the product name and current price directly into the `order_items` line row:
```sql
INSERT INTO order_items (
  order_id, 
  product_id, 
  product_name_snapshot, 
  unit_price, 
  quantity, 
  line_total
) VALUES (?, ?, ?, ?, ?, ?);
```
- When inspecting an order (`GET /api/orders/:id`), the API reads `product_name_snapshot` and `unit_price` from `order_items`.
- Automated test `TEST 17` explicitly proves this: even after running `UPDATE products SET name = 'Futuristic RGB Keyboard', price = 999999 WHERE id = 3;`, previous orders retrieve the original price (`₹2,499`) and original title.

---

## 7. Error Handling & Boundary Strategies

The application implements a multi-tier error containment pattern:

1. **Client-Side Form Guarding:**
   - Buttons for out-of-stock items are disabled.
   - Incrementing past available stock is blocked.
   - Non-integer input in cart quantity is prevented.
2. **Server-Side Payload Validation:**
   - Strict structural verification of JSON body.
   - Returns clear `400 Bad Request` with actionable JSON payloads (`{ error: "..." }`).
3. **Database Transaction Rollback Guard:**
   - Every mutating route wraps operations in a try/catch block with `if (inTransaction) await db.run('ROLLBACK;');`.
   - Never leaves dangling locks or half-committed mutations.
4. **Global Express Error Middleware:**
   - Catch-all unhandled error handler in `server/app.js` returns structured JSON responses instead of crashing the process or leaking stack traces.

---

## 8. Automated Test Harness Internals

The integration test suite in `tests/order-lifecycle.test.js` exercises all operational requirements using Node.js's native test runner (`node:test`) and `supertest`:

```
tests/order-lifecycle.test.js
├── before(): Sets DB_PATH to isolated data/test-commerce.db and seeds initial catalogue
├── after(): Closes database connections and deletes test-commerce.db
└── 19 Comprehensive Integration Tests:
    ├── TEST 1: Placement deducts stock correctly
    ├── TEST 2: Insufficient stock rolls back entirely (no order, stock unchanged)
    ├── TEST 3: Invalid transition Placed -> Shipped rejected
    ├── TEST 4: Fulfilment sequence Placed -> Packed -> Shipped succeeds
    ├── TEST 5: Successful cancellation restores stock correctly
    ├── TEST 6: Repeated cancellation rejected; stock restored exactly once
    ├── TEST 7: Shipped order cancellation rejected; stock unchanged
    ├── TEST 8: Orders and stock survive database restart & idempotent seeding
    ├── TEST 9: Case-insensitive search by order reference
    ├── TEST 10: Status filtering (Placed, Shipped, Cancelled)
    ├── TEST 11: Order details endpoint returns full snapshots
    ├── TEST 12: Multi-product order placement & multi-stock deduction
    ├── TEST 13: Insufficient stock for 1 item in multi-item order rolls back ALL stocks
    ├── TEST 14: Server independently validates all submitted payload data
    ├── TEST 15: Duplicate product IDs in payload are combined and validated
    ├── TEST 16: Combined search + status filtering
    ├── TEST 17: Historical snapshots immutable across catalogue edits
    ├── TEST 18: Returns 404 for missing order, 400 for invalid ID or filter
    └── TEST 19: Strict server-side enforcement of all forbidden state transitions
```

To execute the test suite:
```bash
npm test
```
All 19 tests run in under 400ms and pass with zero failures.
