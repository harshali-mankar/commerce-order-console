import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import request from 'supertest';
import { createApp } from '../server/app.js';
import { getDb, closeDb, setDbPath } from '../server/db.js';
import { seedProducts } from '../server/seed.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const testDbPath = path.resolve(__dirname, '../data/test-commerce.db');

describe('Commerce Order Console — Order Lifecycle & Stock Integrity Tests', () => {
  let app;
  let db;

  before(async () => {
    process.env.DB_PATH = testDbPath;
    setDbPath(testDbPath);

    // Remove old test db file if exists
    await closeDb();
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch (e) {}
    }

    // Initialize test database
    db = await getDb(testDbPath);
    await seedProducts(db);
    app = createApp();
  });

  after(async () => {
    await closeDb();
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch (e) {}
    }
  });

  // TEST 1 — Successful placement:
  // - Create an order using available stock.
  // - Confirm the order is created.
  // - Confirm stock is deducted correctly.
  it('TEST 1: Successful placement deducts stock correctly', async () => {
    const initialProductD = await db.get('SELECT stock_quantity FROM products WHERE sku = "PROD-D"');
    assert.equal(initialProductD.stock_quantity, 12);

    const res = await request(app)
      .post('/api/orders')
      .send({
        items: [
          { productId: 4, quantity: 2 } // 2 units of Laptop Stand (id 4, SKU PROD-D)
        ]
      });

    assert.equal(res.status, 201, `Failed to place order: ${JSON.stringify(res.body)}`);
    assert.equal(res.body.order.status, 'Placed');
    assert.equal(res.body.order.total, 199800); // 2 * 99900 paise = 199800 paise (₹1,998)
    assert.ok(res.body.order.reference.startsWith('ORD-'));

    // Confirm stock in database is deducted by exactly 2
    const updatedProductD = await db.get('SELECT stock_quantity FROM products WHERE sku = "PROD-D"');
    assert.equal(updatedProductD.stock_quantity, 10);
  });

  // TEST 2 — Insufficient stock:
  // - Attempt an order containing one available and one unavailable product.
  // - Confirm the order is rejected.
  // - Confirm the available product's stock remains unchanged.
  // - Confirm no order record is created.
  it('TEST 2: Insufficient stock rolls back entirely and creates no order', async () => {
    const initialA = await db.get('SELECT stock_quantity FROM products WHERE sku = "PROD-A"');
    const initialB = await db.get('SELECT stock_quantity FROM products WHERE sku = "PROD-B"');
    assert.equal(initialA.stock_quantity, 5);
    assert.equal(initialB.stock_quantity, 0);

    const initialOrdersCount = await db.get('SELECT COUNT(*) AS count FROM orders');

    // Attempt to order 2 units of A and 1 unit of B (unavailable)
    const res = await request(app)
      .post('/api/orders')
      .send({
        items: [
          { productId: 1, quantity: 2 },
          { productId: 2, quantity: 1 }
        ]
      });

    assert.equal(res.status, 400);
    assert.match(res.body.error, /Insufficient stock/i);

    // Confirm stock of Product A remained exactly 5 (no partial deduction)
    const afterA = await db.get('SELECT stock_quantity FROM products WHERE sku = "PROD-A"');
    const afterB = await db.get('SELECT stock_quantity FROM products WHERE sku = "PROD-B"');
    assert.equal(afterA.stock_quantity, 5);
    assert.equal(afterB.stock_quantity, 0);

    // Confirm no order record was created
    const finalOrdersCount = await db.get('SELECT COUNT(*) AS count FROM orders');
    assert.equal(finalOrdersCount.count, initialOrdersCount.count);
  });

  // TEST 3 — Invalid state transition:
  // - Attempt Placed → Shipped.
  // - Confirm the server rejects it.
  // - Confirm the order remains Placed.
  it('TEST 3: Invalid state transition (Placed -> Shipped) is rejected and status remains Placed', async () => {
    const createRes = await request(app)
      .post('/api/orders')
      .send({
        items: [{ productId: 1, quantity: 1 }]
      });
    assert.equal(createRes.status, 201, `Failed to create order: ${JSON.stringify(createRes.body)}`);
    const orderId = createRes.body.order.id;

    // Attempt invalid transition Placed -> Shipped
    const patchRes = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .send({ status: 'Shipped' });

    assert.equal(patchRes.status, 400);
    assert.match(patchRes.body.error, /Invalid transition/i);

    // Confirm order remains Placed in database
    const order = await db.get('SELECT status FROM orders WHERE id = ?', [orderId]);
    assert.equal(order.status, 'Placed');
  });

  // TEST 4 — Valid fulfilment:
  // - Placed → Packed succeeds.
  // - Packed → Shipped succeeds.
  it('TEST 4: Valid fulfilment sequence (Placed -> Packed -> Shipped) succeeds', async () => {
    const createRes = await request(app)
      .post('/api/orders')
      .send({
        items: [{ productId: 3, quantity: 1 }]
      });
    assert.equal(createRes.status, 201, `Order create failed: ${JSON.stringify(createRes.body)}`);
    const orderId = createRes.body.order.id;

    // Step 1: Placed -> Packed
    const packRes = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .send({ status: 'Packed' });
    assert.equal(packRes.status, 200, `Pack failed: ${JSON.stringify(packRes.body)}`);
    assert.equal(packRes.body.order.status, 'Packed');

    const dbOrderPacked = await db.get('SELECT status FROM orders WHERE id = ?', [orderId]);
    assert.equal(dbOrderPacked.status, 'Packed');

    // Step 2: Packed -> Shipped
    const shipRes = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .send({ status: 'Shipped' });
    assert.equal(shipRes.status, 200, `Ship failed: ${JSON.stringify(shipRes.body)}`);
    assert.equal(shipRes.body.order.status, 'Shipped');

    const dbOrderShipped = await db.get('SELECT status FROM orders WHERE id = ?', [orderId]);
    assert.equal(dbOrderShipped.status, 'Shipped');
  });

  // TEST 5 — Successful cancellation:
  // - Place an order for two units of Product A.
  // - Cancel the order.
  // - Confirm that stock is restored correctly.
  it('TEST 5: Successful cancellation restores stock correctly', async () => {
    const beforeStockA = (await db.get('SELECT stock_quantity FROM products WHERE sku = "PROD-A"')).stock_quantity;

    // Place order for 2 units of Product A
    const orderRes = await request(app)
      .post('/api/orders')
      .send({
        items: [{ productId: 1, quantity: 2 }]
      });
    assert.equal(orderRes.status, 201, `Order failed: ${JSON.stringify(orderRes.body)}`);
    const orderId = orderRes.body.order.id;

    // Stock should have decreased by 2
    const midStockA = (await db.get('SELECT stock_quantity FROM products WHERE sku = "PROD-A"')).stock_quantity;
    assert.equal(midStockA, beforeStockA - 2);

    // Cancel order
    const cancelRes = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .send({ status: 'Cancelled' });

    assert.equal(cancelRes.status, 200, `Cancel failed: ${JSON.stringify(cancelRes.body)}`);
    assert.equal(cancelRes.body.order.status, 'Cancelled');

    // Confirm stock is restored to beforeStockA
    const afterStockA = (await db.get('SELECT stock_quantity FROM products WHERE sku = "PROD-A"')).stock_quantity;
    assert.equal(afterStockA, beforeStockA);
  });

  // TEST 6 — Repeated cancellation:
  // - Cancel the same order again.
  // - Confirm that the second request is rejected.
  // - Confirm that stock does not increase again.
  it('TEST 6: Repeated cancellation is rejected and does not restore duplicate stock', async () => {
    const createRes = await request(app)
      .post('/api/orders')
      .send({
        items: [{ productId: 5, quantity: 1 }] // HD Webcam
      });
    assert.equal(createRes.status, 201);
    const orderId = createRes.body.order.id;

    // First cancellation
    const firstCancel = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .send({ status: 'Cancelled' });
    assert.equal(firstCancel.status, 200);

    const stockAfterFirstCancel = (await db.get('SELECT stock_quantity FROM products WHERE sku = "PROD-E"')).stock_quantity;

    // Repeated cancellation attempt
    const secondCancel = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .send({ status: 'Cancelled' });

    assert.equal(secondCancel.status, 400);
    assert.match(secondCancel.body.error, /already Cancelled/i);

    // Verify stock did not increase a second time
    const stockAfterSecondCancel = (await db.get('SELECT stock_quantity FROM products WHERE sku = "PROD-E"')).stock_quantity;
    assert.equal(stockAfterSecondCancel, stockAfterFirstCancel);
  });

  // TEST 7 — Shipped order cancellation:
  // - Attempt to cancel a shipped order.
  // - Confirm rejection.
  // - Confirm stock remains unchanged.
  it('TEST 7: Shipped order cancellation is rejected and stock remains unchanged', async () => {
    const createRes = await request(app)
      .post('/api/orders')
      .send({
        items: [{ productId: 5, quantity: 1 }]
      });
    assert.equal(createRes.status, 201);
    const orderId = createRes.body.order.id;

    await request(app).patch(`/api/orders/${orderId}/status`).send({ status: 'Packed' });
    await request(app).patch(`/api/orders/${orderId}/status`).send({ status: 'Shipped' });

    const stockAtShipped = (await db.get('SELECT stock_quantity FROM products WHERE sku = "PROD-E"')).stock_quantity;

    // Attempt cancellation on shipped order
    const cancelRes = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .send({ status: 'Cancelled' });

    assert.equal(cancelRes.status, 400);
    assert.match(cancelRes.body.error, /already been Shipped/i);

    // Confirm stock remains unchanged
    const stockAfterAttempt = (await db.get('SELECT stock_quantity FROM products WHERE sku = "PROD-E"')).stock_quantity;
    assert.equal(stockAfterAttempt, stockAtShipped);
  });

  // TEST 8 — Persistence:
  // - Create an order and update stock.
  // - Close and restart the application / db connection.
  // - Confirm the order and stock values are retained.
  it('TEST 8: Orders and stock survive application and database restart', async () => {
    // 1. Create an order
    const createRes = await request(app)
      .post('/api/orders')
      .send({
        items: [{ productId: 4, quantity: 3 }] // 3 Laptop Stands
      });
    assert.equal(createRes.status, 201);
    const orderReference = createRes.body.order.reference;
    const stockBeforeRestart = (await db.get('SELECT stock_quantity FROM products WHERE sku = "PROD-D"')).stock_quantity;

    // 2. Simulate closing application & database connection
    await closeDb();

    // 3. Simulate restarting application and reopening the persistent SQLite file
    const restartedDb = await getDb(testDbPath);
    // Safe seed on startup: must NOT overwrite modified stock or duplicate items
    await seedProducts(restartedDb);

    // 4. Verify order is intact
    const persistedOrder = await restartedDb.get('SELECT * FROM orders WHERE reference = ?', [orderReference]);
    assert.ok(persistedOrder);
    assert.equal(persistedOrder.reference, orderReference);
    assert.equal(persistedOrder.status, 'Placed');

    // 5. Verify stock level was NOT reset by startup seeding
    const stockAfterRestart = (await restartedDb.get('SELECT stock_quantity FROM products WHERE sku = "PROD-D"')).stock_quantity;
    assert.equal(stockAfterRestart, stockBeforeRestart);

    // Restore active db instance reference for after() cleanup
    db = restartedDb;
  });

  // TEST 9 — Search orders by reference (case-insensitive)
  it('TEST 9: Order search works by reference and is case-insensitive', async () => {
    // Create an order
    const createRes = await request(app)
      .post('/api/orders')
      .send({ items: [{ productId: 1, quantity: 1 }] });
    assert.equal(createRes.status, 201);
    const ref = createRes.body.order.reference;

    // Search with lower-case reference snippet
    const snippet = ref.slice(4, 12).toLowerCase();
    const res = await request(app).get(`/api/orders?search=${snippet}`);
    assert.equal(res.status, 200);
    assert.ok(res.body.orders.length >= 1);
    const matched = res.body.orders.find(o => o.reference === ref);
    assert.ok(matched, `Expected order with reference ${ref} to be found with search query "${snippet}"`);
  });

  // TEST 10 — Status filtering
  it('TEST 10: Order filtering works accurately by status', async () => {
    // We have orders in various statuses (Placed, Packed, Shipped, Cancelled)
    const placedRes = await request(app).get('/api/orders?status=Placed');
    assert.equal(placedRes.status, 200);
    assert.ok(placedRes.body.orders.every(o => o.status === 'Placed'));

    const shippedRes = await request(app).get('/api/orders?status=Shipped');
    assert.equal(shippedRes.status, 200);
    assert.ok(shippedRes.body.orders.every(o => o.status === 'Shipped'));

    const cancelledRes = await request(app).get('/api/orders?status=Cancelled');
    assert.equal(cancelledRes.status, 200);
    assert.ok(cancelledRes.body.orders.every(o => o.status === 'Cancelled'));
  });

  // TEST 11 — Order details with snapshot
  it('TEST 11: Order details endpoint returns full order and product snapshots', async () => {
    const createRes = await request(app)
      .post('/api/orders')
      .send({
        items: [
          { productId: 3, quantity: 2 } // Mechanical Keyboard @ ₹2,499 (249900 paise)
        ]
      });
    const orderId = createRes.body.order.id;

    const detailsRes = await request(app).get(`/api/orders/${orderId}`);
    assert.equal(detailsRes.status, 200);
    const order = detailsRes.body.order;
    assert.equal(order.id, orderId);
    assert.equal(order.total, 499800);
    assert.equal(order.items.length, 1);
    assert.equal(order.items[0].product_name_snapshot, 'Mechanical Keyboard');
    assert.equal(order.items[0].sku, 'PROD-C');
    assert.equal(order.items[0].unit_price, 249900);
    assert.equal(order.items[0].quantity, 2);
    assert.equal(order.items[0].line_total, 499800);
  });

  // TEST 12 — Successful order with multiple different products
  it('TEST 12: Successful multi-product order creates order, snaps items, and deducts all stocks', async () => {
    const beforeA = (await db.get('SELECT stock_quantity, price FROM products WHERE sku = "PROD-A"'));
    const beforeD = (await db.get('SELECT stock_quantity, price FROM products WHERE sku = "PROD-D"'));
    assert.ok(beforeA.stock_quantity >= 2, 'Product A must have at least 2 units in stock');
    assert.ok(beforeD.stock_quantity >= 2, 'Product D must have at least 2 units in stock');

    const expectedTotal = (2 * beforeA.price) + (2 * beforeD.price);

    const res = await request(app)
      .post('/api/orders')
      .send({
        items: [
          { productId: 1, quantity: 2 }, // Product A
          { productId: 4, quantity: 2 }  // Product D
        ]
      });

    assert.equal(res.status, 201, `Failed to place multi-product order: ${JSON.stringify(res.body)}`);
    assert.ok(res.body.reference && res.body.reference.startsWith('ORD-'));
    assert.ok(res.body.orderId || res.body.id);
    assert.equal(res.body.status, 'Placed');
    assert.equal(res.body.total, expectedTotal);
    assert.ok(res.body.createdAt || res.body.created_at);
    assert.equal(res.body.items.length, 2);

    // Verify stock deduction for Product A
    const afterA = await db.get('SELECT stock_quantity FROM products WHERE sku = "PROD-A"');
    assert.equal(afterA.stock_quantity, beforeA.stock_quantity - 2);

    // Verify stock deduction for Product D
    const afterD = await db.get('SELECT stock_quantity FROM products WHERE sku = "PROD-D"');
    assert.equal(afterD.stock_quantity, beforeD.stock_quantity - 2);

    // Verify order item snapshots in DB
    const savedItems = await db.all(
      'SELECT product_id, product_name_snapshot, unit_price, quantity, line_total FROM order_items WHERE order_id = ? ORDER BY product_id ASC',
      [res.body.orderId || res.body.id]
    );
    assert.equal(savedItems.length, 2);
    assert.equal(savedItems[0].product_id, 1);
    assert.equal(savedItems[0].quantity, 2);
    assert.equal(savedItems[0].unit_price, beforeA.price);
    assert.equal(savedItems[0].line_total, 2 * beforeA.price);

    assert.equal(savedItems[1].product_id, 4);
    assert.equal(savedItems[1].quantity, 2);
    assert.equal(savedItems[1].unit_price, beforeD.price);
    assert.equal(savedItems[1].line_total, 2 * beforeD.price);
  });

  // TEST 13 — Insufficient stock for one item in multi-item order leaves ALL stocks unchanged
  it('TEST 13: Insufficient stock for one item rejects entire order and leaves ALL stocks unchanged', async () => {
    const beforeA = (await db.get('SELECT stock_quantity FROM products WHERE sku = "PROD-A"')).stock_quantity;
    const beforeC = (await db.get('SELECT stock_quantity FROM products WHERE sku = "PROD-C"')).stock_quantity;
    const initialOrdersCount = (await db.get('SELECT COUNT(*) AS count FROM orders')).count;

    // Request 1 unit of A (available) and 999 units of C (insufficient)
    const res = await request(app)
      .post('/api/orders')
      .send({
        items: [
          { productId: 1, quantity: 1 },
          { productId: 3, quantity: 999 }
        ]
      });

    assert.equal(res.status, 400);
    assert.match(res.body.error, /Insufficient stock/i);

    // Verify ALL stock remains completely unchanged
    const afterA = (await db.get('SELECT stock_quantity FROM products WHERE sku = "PROD-A"')).stock_quantity;
    const afterC = (await db.get('SELECT stock_quantity FROM products WHERE sku = "PROD-C"')).stock_quantity;
    assert.equal(afterA, beforeA, 'Stock of product A must remain untouched');
    assert.equal(afterC, beforeC, 'Stock of product C must remain untouched');

    // Verify no new order record created
    const finalOrdersCount = (await db.get('SELECT COUNT(*) AS count FROM orders')).count;
    assert.equal(finalOrdersCount, initialOrdersCount, 'No order should be created');
  });

  // TEST 14 — Server-side payload & quantity validations
  it('TEST 14: Server independently validates all submitted payload data', async () => {
    // 1. Empty payload
    const emptyRes = await request(app).post('/api/orders').send({});
    assert.equal(emptyRes.status, 400);
    assert.match(emptyRes.body.error, /at least one item/i);

    // 2. Empty items array
    const emptyItemsRes = await request(app).post('/api/orders').send({ items: [] });
    assert.equal(emptyItemsRes.status, 400);
    assert.match(emptyItemsRes.body.error, /at least one item/i);

    // 3. Zero quantity
    const zeroQtyRes = await request(app).post('/api/orders').send({
      items: [{ productId: 1, quantity: 0 }]
    });
    assert.equal(zeroQtyRes.status, 400);
    assert.match(zeroQtyRes.body.error, /positive integer/i);

    // 4. Negative quantity
    const negQtyRes = await request(app).post('/api/orders').send({
      items: [{ productId: 1, quantity: -2 }]
    });
    assert.equal(negQtyRes.status, 400);
    assert.match(negQtyRes.body.error, /positive integer/i);

    // 5. Non-integer / float quantity
    const floatQtyRes = await request(app).post('/api/orders').send({
      items: [{ productId: 1, quantity: 1.5 }]
    });
    assert.equal(floatQtyRes.status, 400);
    assert.match(floatQtyRes.body.error, /positive integer/i);

    // 6. Non-existent product ID
    const notFoundProdRes = await request(app).post('/api/orders').send({
      items: [{ productId: 999999, quantity: 1 }]
    });
    assert.equal(notFoundProdRes.status, 400);
    assert.match(notFoundProdRes.body.error, /does not exist/i);

    // 7. Client price tampering is ignored; server calculates totals from DB price
    const prodA = await db.get('SELECT price FROM products WHERE id = 1');
    const priceTamperRes = await request(app).post('/api/orders').send({
      items: [{ productId: 1, quantity: 1, price: 1 }] // fake client price of ₹0.01
    });
    assert.equal(priceTamperRes.status, 201);
    assert.equal(priceTamperRes.body.total, prodA.price, 'Order total must match trusted DB price, ignoring client price');
  });

  // TEST 15 — Duplicate product IDs in single request are combined correctly
  it('TEST 15: Duplicate product IDs in single request are combined and validated', async () => {
    const beforeD = (await db.get('SELECT stock_quantity FROM products WHERE sku = "PROD-D"')).stock_quantity;
    assert.ok(beforeD >= 2);

    const res = await request(app).post('/api/orders').send({
      items: [
        { productId: 4, quantity: 1 },
        { productId: 4, quantity: 1 }
      ]
    });

    assert.equal(res.status, 201);
    const afterD = (await db.get('SELECT stock_quantity FROM products WHERE sku = "PROD-D"')).stock_quantity;
    assert.equal(afterD, beforeD - 2, 'Stock should be deducted for combined quantity of 2');
  });

  // TEST 16 — Combined search and status filter
  it('TEST 16: Combined search and status filtering narrows down results accurately', async () => {
    // 1. Fetch placed orders
    const allPlacedRes = await request(app).get('/api/orders?status=Placed');
    assert.equal(allPlacedRes.status, 200);
    assert.ok(allPlacedRes.body.orders.length > 0);
    const targetOrder = allPlacedRes.body.orders[0];

    // 2. Search by snippet of reference + status=Placed
    const snippet = targetOrder.reference.slice(4, 12).toLowerCase();
    const combinedRes = await request(app).get(`/api/orders?search=${snippet}&status=Placed`);
    assert.equal(combinedRes.status, 200);
    assert.ok(combinedRes.body.orders.length >= 1);
    assert.ok(combinedRes.body.orders.some(o => o.reference === targetOrder.reference));
    assert.ok(combinedRes.body.orders.every(o => o.status === 'Placed'));

    // 3. Search with non-matching status
    const mismatchRes = await request(app).get(`/api/orders?search=${snippet}&status=Shipped`);
    assert.equal(mismatchRes.status, 200);
    assert.ok(!mismatchRes.body.orders.some(o => o.reference === targetOrder.reference));
  });

  // TEST 17 — Historical snapshot integrity
  it('TEST 17: Historical snapshot preserves original price and name even if catalog changes', async () => {
    // 1. Create an order with Mechanical Keyboard (id 3)
    const createRes = await request(app).post('/api/orders').send({
      items: [{ productId: 3, quantity: 1 }]
    });
    assert.equal(createRes.status, 201);
    const orderId = createRes.body.orderId || createRes.body.id;

    // 2. Artificially change the product name and price in catalogue table
    await db.run('UPDATE products SET name = "Futuristic RGB Keyboard 2099", price = 999999 WHERE id = 3');

    // 3. Retrieve order details
    const getRes = await request(app).get(`/api/orders/${orderId}`);
    assert.equal(getRes.status, 200);
    const orderData = getRes.body.order || getRes.body;

    assert.equal(orderData.items.length, 1);
    // Snapshot name should remain 'Mechanical Keyboard'
    assert.equal(orderData.items[0].product_name_snapshot, 'Mechanical Keyboard');
    // Snapshot price should remain ₹2,499 (249900 paise), NOT 999999
    assert.equal(orderData.items[0].unit_price, 249900);
    assert.equal(orderData.items[0].line_total, 249900);
    assert.equal(orderData.total, 249900);

    // Restore product name and price
    await db.run('UPDATE products SET name = "Mechanical Keyboard", price = 249900 WHERE id = 3');
  });

  // TEST 18 — Edge cases for order discovery and details
  it('TEST 18: Returns 404 for missing order and 400 for invalid order ID or status', async () => {
    const notFoundRes = await request(app).get('/api/orders/999999');
    assert.equal(notFoundRes.status, 404);
    assert.match(notFoundRes.body.error, /not found/i);

    const invalidIdRes = await request(app).get('/api/orders/invalid-id');
    assert.equal(invalidIdRes.status, 400);
    assert.match(invalidIdRes.body.error, /invalid order id/i);

    const invalidStatusRes = await request(app).get('/api/orders?status=UnknownStatus');
    assert.equal(invalidStatusRes.status, 400);
    assert.match(invalidStatusRes.body.error, /invalid status filter/i);
  });

  // TEST 19 — Comprehensive state machine transitions & rejection of invalid paths
  it('TEST 19: Strict server-side enforcement of all forbidden state transitions', async () => {
    // 1. Packed -> Cancelled is allowed and restores stock
    const createRes1 = await request(app).post('/api/orders').send({
      items: [{ productId: 5, quantity: 1 }] // HD Webcam
    });
    const orderId1 = createRes1.body.orderId || createRes1.body.id;
    await request(app).patch(`/api/orders/${orderId1}/status`).send({ status: 'Packed' });
    const cancelPackedRes = await request(app).patch(`/api/orders/${orderId1}/status`).send({ status: 'Cancelled' });
    assert.equal(cancelPackedRes.status, 200);
    assert.equal(cancelPackedRes.body.order.status, 'Cancelled');

    // 2. Cancelled order cannot transition to Placed, Packed, or Shipped
    const cToPlaced = await request(app).patch(`/api/orders/${orderId1}/status`).send({ status: 'Placed' });
    assert.equal(cToPlaced.status, 400);
    assert.match(cToPlaced.body.error, /already Cancelled|Invalid target status/i);

    const cToPacked = await request(app).patch(`/api/orders/${orderId1}/status`).send({ status: 'Packed' });
    assert.equal(cToPacked.status, 400);
    assert.match(cToPacked.body.error, /already Cancelled/i);

    const cToShipped = await request(app).patch(`/api/orders/${orderId1}/status`).send({ status: 'Shipped' });
    assert.equal(cToShipped.status, 400);
    assert.match(cToShipped.body.error, /already Cancelled/i);

    // 3. Shipped order cannot transition to Packed or Placed
    const createRes2 = await request(app).post('/api/orders').send({
      items: [{ productId: 5, quantity: 1 }]
    });
    const orderId2 = createRes2.body.orderId || createRes2.body.id;
    await request(app).patch(`/api/orders/${orderId2}/status`).send({ status: 'Packed' });
    await request(app).patch(`/api/orders/${orderId2}/status`).send({ status: 'Shipped' });

    const sToPacked = await request(app).patch(`/api/orders/${orderId2}/status`).send({ status: 'Packed' });
    assert.equal(sToPacked.status, 400);
    assert.match(sToPacked.body.error, /already been Shipped/i);

    const sToPlaced = await request(app).patch(`/api/orders/${orderId2}/status`).send({ status: 'Placed' });
    assert.equal(sToPlaced.status, 400);
    assert.match(sToPlaced.body.error, /already been Shipped|Invalid target status/i);

    // 4. Unknown target status rejected
    const unknownStatusRes = await request(app).patch(`/api/orders/${orderId2}/status`).send({ status: 'Delivered' });
    assert.equal(unknownStatusRes.status, 400);
    assert.match(unknownStatusRes.body.error, /Invalid target status/i);
  });
});
