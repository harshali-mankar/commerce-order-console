# Commerce Order Console

A robust, full-lifecycle browser-based store operations console designed for managing customer orders, monitoring product catalogue stock in real time, and enforcing transactional inventory integrity and fulfilment state machines.

> **Technical Architecture Guide:** For a deep-dive walkthrough of control flows, database transaction sequences, state machines, and concurrency handling from a programmatic perspective, see [HOW_IT_WORKS.md](file:///c:/Users/khush/.gemini/antigravity/scratch/commerce-order-console/HOW_IT_WORKS.md).  
> **Visual Walkthrough:** For step-by-step UI screenshots across the order lifecycle, see [WALKTHROUGH.md](file:///c:/Users/khush/.gemini/antigravity/scratch/commerce-order-console/WALKTHROUGH.md).

---

## 1. Project Overview

The **Commerce Order Console** is a specialized web application built for retail store staff and warehouse operations teams. It manages the complete lifecycle of customer orders—from catalogue discovery and multi-product cart creation to order fulfilment (packing, shipping) and transactional order cancellations.

The application uses an Express REST backend backed by a persistent SQLite relational database (`data/commerce.db`) and a modern React 18 frontend built with Vite. It adheres strictly to database transactional guarantees (`BEGIN IMMEDIATE TRANSACTION`), ensuring that stock can never become negative, partial stock deductions never occur, and cancellations restore inventory exactly once.

---

## 2. Features

- **Real-Time Product Catalogue & Stock Monitoring:**
  - Displays product titles, descriptions, SKUs, formatted prices in Indian Rupees (₹), and live stock counts.
  - Dynamically distinguishes in-stock items from out-of-stock items with clear visual badges.
  - Automatically disables addition when stock is depleted or when cart quantity reaches available stock.

- **Transactional Multi-Product Order Creation:**
  - Multi-item shopping cart allowing store staff to add different products into a single order.
  - Quantity controls (interactive step buttons and direct numeric input) that strictly prevent 0, negative values, and non-integer inputs.
  - Line-item calculations and grand total computed dynamically in the UI and independently re-verified on the server.
  - Two-stage checkout: Cart Review → Confirmation Summary before atomic commit.

- **Atomic Inventory Integrity:**
  - Order creation executes inside a single database transaction: verifies stock, deducts stock, creates the order, and saves order items.
  - Any failure or stock shortage triggers an immediate rollback, leaving all product stock and records unchanged.
  - Database-level constraint `CHECK (stock_quantity >= 0)` ensures stock cannot be oversold under concurrent submissions.

- **Order Discovery, Search & Filtering:**
  - High-density table displaying order reference, creation date, number of items/units, order total, current status badge, and detail view actions.
  - Debounced case-insensitive search by order reference (e.g. `ORD-2026`).
  - Status dropdown filtering (`All`, `Placed`, `Packed`, `Shipped`, `Cancelled`).
  - Search and status filters work together seamlessly via backend query parameters.

- **Strict Fulfilment State Machine:**
  - Supported lifecycle: `Placed` → `Packed` → `Shipped`.
  - Cancellation permitted only for `Placed` or `Packed` orders.
  - Server rejects invalid jumps (e.g., `Placed` → `Shipped`), regressions, or unknown statuses with descriptive HTTP 400 errors.
  - Terminal states (`Shipped` and `Cancelled`) disable all further actions both on the frontend and on the server.

- **Exactly-Once Stock Restoration:**
  - Cancelling an order restores all line-item quantities back to the inventory inside a single atomic transaction.
  - Prevents duplicate cancellations and duplicate stock restoration.

- **Immutable Order Snapshots:**
  - Saves frozen snapshots of product names, SKUs, and unit prices inside `order_items`.
  - Historical order details and totals remain 100% accurate even if catalogue prices or product names change in the future.

---

## 3. Technology Stack

- **Frontend:**
  - **React 18** (Modern functional components, hooks)
  - **Vite 5** (Fast ES modules bundler & development proxy)
  - **Lucide React** (Consistent iconography)
  - **Pure Modern CSS System** (Responsive layout, CSS custom properties, accessible status badges, modal dialogs)
- **Backend:**
  - **Node.js (v20+)** (ES modules runtime)
  - **Express 4** (RESTful API routes & error handling)
  - **CORS** (Cross-origin resource sharing)
- **Database & Storage:**
  - **SQLite3** via `sqlite` asynchronous driver
  - Persistent file storage: `data/commerce.db`
  - Write-Ahead Logging: `PRAGMA journal_mode = WAL;`
  - Foreign key enforcement: `PRAGMA foreign_keys = ON;`
- **Testing & Tooling:**
  - **Node.js Native Test Runner** (`node:test`, `node:assert/strict`)
  - **Supertest** (End-to-end API HTTP integration tests)
  - **Puppeteer Core** (Automated headless Chrome screenshot capture)

---

## 4. Project Folder Structure

```
commerce-order-console/
├── data/
│   ├── commerce.db                  # Persistent SQLite database file
│   └── test-commerce.db             # Ephemeral isolated database for test runner
├── dist/                            # Production compiled frontend bundle
│   ├── index.html
│   └── assets/
├── screenshots/                     # Actual Chrome application screenshots
│   ├── 01-catalogue-initial.png
│   ├── 02-cart-multiple-items.png
│   ├── 03-order-confirmation.png
│   ├── 04-order-placed-success.png
│   ├── 05-orders-list.png
│   ├── 06-order-details-placed.png
│   ├── 07-order-packed.png
│   ├── 08-order-shipped.png
│   ├── 09-order-cancelled.png
│   └── 10-stock-restored-catalogue.png
├── scripts/
│   └── capture-screenshots.js       # Live Chrome screenshot capture script
├── server/
│   ├── app.js                       # Express app configuration & static asset serving
│   ├── db.js                        # SQLite connection, WAL mode, schema definitions
│   ├── index.js                     # Server entrypoint (initializes DB, seeds, listens)
│   ├── seed.js                      # Idempotent synthetic catalogue seeder
│   └── routes/
│       ├── products.js              # GET /api/products
│       └── orders.js                # GET/POST /api/orders, GET :id, PATCH :id/status
├── src/
│   ├── components/
│   │   ├── Header.jsx               # Navigation bar & cart quantity badge
│   │   ├── Catalogue.jsx            # Product catalogue grid & floating cart summary
│   │   ├── CartModal.jsx            # Multi-product order creation & confirmation
│   │   ├── OrdersList.jsx           # Order search, status filter, and data table
│   │   └── OrderDetailsModal.jsx    # Fulfilment actions, snapshots, confirmation
│   ├── api.js                       # API client, INR currency & date formatters
│   ├── App.jsx                      # Root state coordination & tab routing
│   ├── index.html                   # HTML template
│   ├── main.jsx                     # React entrypoint
│   └── styles.css                   # Complete design system styles
├── tests/
│   └── order-lifecycle.test.js      # 19 automated integration tests covering all requirements
├── package.json                     # Scripts & dependencies
├── vite.config.js                   # Vite dev server configuration
├── README.md                        # Complete project manual & documentation
└── WALKTHROUGH.md                   # Step-by-step visual walkthrough
```

---

## 5. Database Design

All database tables are created in SQLite with strict constraints, foreign keys, and indexes. All monetary values are stored as integers in minor units (**paise**, where ₹1 = 100 paise) to avoid floating-point rounding errors.

### Schema Architecture

```
+--------------------+        +---------------------+        +-------------------------+
|      products      |        |        orders       |        |       order_items       |
+--------------------+        +---------------------+        +-------------------------+
| id (PK, AUTOINC)   |        | id (PK, AUTOINC)    |        | id (PK, AUTOINC)        |
| sku (UNIQUE)       |        | reference (UNIQUE)  |        | order_id (FK -> orders) |
| name               |        | status              |        | product_id (FK -> prod) |
| description        |        | total               |        | product_name_snapshot   |
| price (paise)      |        | created_at          |        | unit_price (paise)      |
| stock_quantity     |        | updated_at          |        | quantity (> 0)          |
| created_at         |        | cancelled_at        |        | line_total (paise)      |
+--------------------+        +---------------------+        +-------------------------+
```

### 1. `products` Table
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique product ID |
| `sku` | TEXT | UNIQUE, NOT NULL | Stock Keeping Unit (e.g. `PROD-A`) |
| `name` | TEXT | NOT NULL | Display name |
| `description` | TEXT | | Product description |
| `price` | INTEGER | NOT NULL, CHECK (price >= 0) | Price in paise (e.g. ₹799 = `79900`) |
| `stock_quantity`| INTEGER | NOT NULL, CHECK (stock_quantity >= 0) | Inventory count (never negative) |
| `created_at` | TEXT | NOT NULL | ISO 8601 creation timestamp |

### 2. `orders` Table
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique internal order ID |
| `reference` | TEXT | UNIQUE, NOT NULL | Staff order reference (`ORD-YYYYMMDD-XXXX`) |
| `status` | TEXT | NOT NULL, CHECK (status IN ('Placed','Packed','Shipped','Cancelled')) | Current state |
| `total` | INTEGER | NOT NULL, CHECK (total >= 0) | Grand total in paise |
| `created_at` | TEXT | NOT NULL | Placement ISO timestamp |
| `updated_at` | TEXT | NOT NULL | Last status update ISO timestamp |
| `cancelled_at`| TEXT | NULLABLE | Cancellation ISO timestamp |

### 3. `order_items` Table
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique order line ID |
| `order_id` | INTEGER | NOT NULL, FK -> `orders(id)` ON DELETE CASCADE | Parent order ID |
| `product_id` | INTEGER | NOT NULL, FK -> `products(id)` | Associated product ID |
| `product_name_snapshot` | TEXT | NOT NULL | Immutable snapshot of product title |
| `unit_price` | INTEGER | NOT NULL, CHECK (unit_price >= 0) | Immutable unit price snapshot in paise |
| `quantity` | INTEGER | NOT NULL, CHECK (quantity > 0) | Positive whole number quantity |
| `line_total` | INTEGER | NOT NULL, CHECK (line_total >= 0) | `unit_price * quantity` in paise |

---

## 6. API Endpoints

### `GET /api/products`
Retrieves the catalogue of products with live inventory counts.
- **Query Params:** None
- **Response (200 OK):**
  ```json
  {
    "products": [
      {
        "id": 1,
        "sku": "PROD-A",
        "name": "Wireless Mouse",
        "description": "Ergonomic 2.4GHz wireless mouse...",
        "price": 79900,
        "stock_quantity": 5,
        "created_at": "2026-11-21T06:00:00.000Z"
      }
    ]
  }
  ```

---

### `POST /api/orders`
Creates an order inside an atomic transaction, validates and deducts inventory, and stores snapshots.
- **Request Body:**
  ```json
  {
    "items": [
      { "productId": 1, "quantity": 2 },
      { "productId": 4, "quantity": 1 }
    ]
  }
  ```
- **Validation Rules:**
  - Non-empty `items` array required.
  - `productId` and `quantity` must be valid positive integers.
  - Duplicate product IDs in payload are combined and checked against stock.
  - Database price is used exclusively; client-submitted prices are ignored.
- **Response (201 Created):**
  ```json
  {
    "message": "Order placed successfully.",
    "reference": "ORD-20261121-7A3B",
    "orderId": 1,
    "status": "Placed",
    "total": 259700,
    "created_at": "2026-11-21T06:15:00.000Z",
    "items": [
      {
        "productId": 1,
        "productName": "Wireless Mouse",
        "sku": "PROD-A",
        "unitPrice": 79900,
        "quantity": 2,
        "lineTotal": 159800
      }
    ]
  }
  ```
- **Response (400 Bad Request):** Returns error message when stock is insufficient, payload is invalid, or a product is not found.

---

### `GET /api/orders`
Retrieves orders with aggregated item counts and totals.
- **Query Params:**
  - `search` (optional): Case-insensitive substring match against order reference (e.g. `?search=ORD-2026`).
  - `status` (optional): Filter by `Placed`, `Packed`, `Shipped`, or `Cancelled`.
- **Response (200 OK):**
  ```json
  {
    "orders": [
      {
        "id": 1,
        "reference": "ORD-20261121-7A3B",
        "status": "Placed",
        "total": 259700,
        "created_at": "2026-11-21T06:15:00.000Z",
        "updated_at": "2026-11-21T06:15:00.000Z",
        "cancelled_at": null,
        "item_count": 2,
        "total_quantity": 3
      }
    ]
  }
  ```

---

### `GET /api/orders/:id`
Retrieves complete order detail with historical snapshots.
- **Path Params:** `id` (integer)
- **Response (200 OK):**
  ```json
  {
    "order": {
      "id": 1,
      "reference": "ORD-20261121-7A3B",
      "status": "Placed",
      "total": 259700,
      "created_at": "2026-11-21T06:15:00.000Z",
      "updated_at": "2026-11-21T06:15:00.000Z",
      "cancelled_at": null,
      "items": [
        {
          "id": 1,
          "order_id": 1,
          "product_id": 1,
          "product_name_snapshot": "Wireless Mouse",
          "sku": "PROD-A",
          "unit_price": 79900,
          "quantity": 2,
          "line_total": 159800
        }
      ]
    }
  }
  ```
- **Response (404 Not Found):** `{ "error": "Order not found" }`

---

### `PATCH /api/orders/:id/status`
Executes order lifecycle state transitions and triggers stock restoration on cancellation.
- **Request Body:**
  ```json
  {
    "status": "Packed"
  }
  ```
- **Allowed Transitions:**
  - `Placed` → `Packed`
  - `Packed` → `Shipped`
  - `Placed` → `Cancelled` (restores stock atomically)
  - `Packed` → `Cancelled` (restores stock atomically)
- **Rejected Transitions (400 Bad Request):**
  - Direct skip: `Placed` → `Shipped`
  - Regressions: `Shipped` → `Packed`, `Packed` → `Placed`
  - Cancellation of terminal orders: `Shipped` → `Cancelled`, `Cancelled` → `Cancelled`
  - Reopening: `Cancelled` → `Placed` / `Packed` / `Shipped`
  - Any unknown status string
- **Response (200 OK):**
  ```json
  {
    "message": "Order marked as Packed.",
    "order": {
      "id": 1,
      "reference": "ORD-20261121-7A3B",
      "status": "Packed",
      "updated_at": "2026-11-21T06:20:00.000Z"
    }
  }
  ```

---

## 7. Database Seeding Instructions

The seeding routine in `server/seed.js` initializes the catalogue idempotently. It uses `INSERT OR IGNORE` keyed by the unique `sku` column:
- If a product does not exist, it is inserted with the initial synthetic catalogue baseline.
- If a product already exists (e.g. after orders have deducted stock or the server restarts), SQLite preserves the existing stock and does not reset or overwrite it.

To manually run the seeder:
```bash
node server/seed.js
```

---

## 8. Installation Instructions

### Prerequisites
- Node.js version 20 or higher
- npm version 9 or higher

### Install Dependencies
```bash
npm install --legacy-peer-deps
```

### Build Production Assets
Compiles the React frontend with Vite into `dist/`:
```bash
npm run build
```

---

## 9. Development Run Commands

### Single-Process Production Server (Recommended)
Runs the unified Node.js/Express server on port `3001` serving both the REST API and the compiled React frontend:
```bash
npm start
```
Access the application in your browser at:
`http://localhost:3001`

### Concurrent Development Server (Vite HMR)
To run the live Vite hot-reloading development server alongside the backend:
```bash
# Terminal 1: Backend API
npm start

# Terminal 2: Vite Dev Frontend
npm run dev
```
Access the dev server at: `http://localhost:3000` (API calls are proxied to port `3001`).

---

## 10. Test Commands

Run the full automated integration test suite:
```bash
npm test
```

The test runner utilizes Node.js's native test module (`node:test`) and Supertest to run against an isolated test SQLite database (`data/test-commerce.db`). Old test databases are automatically cleared between test suite executions.

---

## 11. Synthetic Catalogue Details

| SKU | Name | Description | Price (Paise) | Price (₹) | Stock | Status |
|---|---|---|---|---|---|---|
| `PROD-A` | Wireless Mouse | Ergonomic 2.4GHz wireless mouse with adjustable DPI and silent clicks. | 79900 | ₹799 | 5 | In Stock |
| `PROD-B` | USB-C Hub | 7-in-1 multi-port adapter with 4K HDMI, 100W PD charging, and USB 3.0 ports. | 149900 | ₹1,499 | 0 | **Out of Stock** |
| `PROD-C` | Mechanical Keyboard | Compact 75% mechanical keyboard with tactile brown switches and RGB backlighting. | 249900 | ₹2,499 | 8 | In Stock |
| `PROD-D` | Laptop Stand | Adjustable aluminium desktop riser with heat dissipation pads. | 99900 | ₹999 | 12 | In Stock |
| `PROD-E` | HD Webcam | 1080p full HD streaming camera with stereo noise-cancelling microphones. | 189900 | ₹1,899 | 4 | In Stock |

---

## 12. Order Lifecycle Explanation

The order lifecycle is governed by a strict finite state machine enforced on the backend:

```
          +-----------------------------------------+
          |                                         |
          v                                         |
      [ Placed ] ----> [ Packed ] ----> [ Shipped ] | (Terminal: No changes / No cancellation)
          |                 |
          |                 |
          +--------+--------+
                   |
                   v
             [ Cancelled ] (Terminal: Stock restored exactly once)
```

1. **Initial State:** Every new order is created with status `Placed`.
2. **Packing:** Staff pack the items and update status to `Packed`.
3. **Shipping:** Staff dispatch the parcel and update status to `Shipped`. Once shipped, order fulfilment is terminal. Shipped orders cannot be modified, packed again, or cancelled.
4. **Cancellation:** Permitted exclusively while the order is in `Placed` or `Packed` status.
5. **Terminal Safeguards:** Cancelled orders cannot be re-opened, packed, or shipped. Shipped orders cannot be cancelled.

---

## 13. Explanation of Atomic Stock Deduction and Cancellation

### Atomic Order Placement
1. **Immediate Exclusive Lock:** The server starts the transaction using `BEGIN IMMEDIATE TRANSACTION;`. In SQLite with WAL mode, this reserves the database write lock, preventing concurrent transactions from interleaving or reading stale stock.
2. **Authoritative Stock Verification:** Products are queried inside the transaction. If `stock_quantity < requested_quantity` for any requested item, the transaction throws an error.
3. **All-or-Nothing Mutation:**
   - Inventory is deducted using conditional SQL: `UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ? AND stock_quantity >= ?`.
   - The `orders` record is created.
   - All `order_items` snapshot rows are inserted.
   - `COMMIT` executes only when all statements succeed.
4. **Guaranteed Rollback:** If any item is unavailable or any error occurs, `ROLLBACK` executes. No records are created and all inventory remains completely unchanged.

### Exactly-Once Cancellation & Stock Restoration
1. Inside a `BEGIN IMMEDIATE TRANSACTION;`, the order's current status is inspected.
2. If the order is already `Cancelled`, the request is rejected with `400 Bad Request` (`"Order is already Cancelled"`), preventing double-restoration.
3. If the order is `Shipped`, cancellation is rejected (`"Order has already been Shipped"`).
4. If eligible (`Placed` or `Packed`), the order's line items are retrieved and each quantity is restored to the `products` table:
   ```sql
   UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?;
   ```
5. The order status is set to `Cancelled`, the `cancelled_at` timestamp is recorded, and `COMMIT` finalizes the restoration. Concurrent cancellation requests cannot restore stock more than once.

---

## 14. Known Limitations

1. **Single-Node SQLite Architecture:**
   - SQLite with WAL mode provides outstanding local ACID transactions and high read concurrency on a single server.
   - For horizontally autoscaled, multi-node cloud deployments, a managed distributed database (such as Google Cloud Spanner or Cloud SQL) would replace the local SQLite file.
2. **Deliberate Scope Boundaries:**
   - In accordance with the assignment specifications, user authentication/RBAC, customer payment gateway integrations, and external shipping courier webhooks are intentionally omitted to maintain focus on transactional integrity, inventory consistency, and order state machines.
