import express from 'express';
import crypto from 'crypto';
import { getDb } from '../db.js';

const router = express.Router();

/**
 * Generate a clean, unique order reference.
 * Format: ORD-YYYYMMDD-XXXX (e.g., ORD-20261121-7F4A)
 */
function generateOrderReference() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `ORD-${dateStr}-${randomSuffix}`;
}

/**
 * GET /api/orders
 * Supports query parameters:
 *  - search: case-insensitive reference match
 *  - status: filter by status ('Placed', 'Packed', 'Shipped', 'Cancelled')
 */
router.get('/', async (req, res, next) => {
  try {
    const db = await getDb();
    const { search, status } = req.query;

    const whereClauses = [];
    const params = [];

    if (search && search.trim()) {
      whereClauses.push('UPPER(o.reference) LIKE ?');
      params.push(`%${search.trim().toUpperCase()}%`);
    }

    if (status && status.trim() && status.trim().toLowerCase() !== 'all') {
      const validStatuses = ['Placed', 'Packed', 'Shipped', 'Cancelled'];
      const rawStatus = status.trim();
      const matchedStatus = validStatuses.find(s => s.toLowerCase() === rawStatus.toLowerCase());

      if (!matchedStatus) {
        return res.status(400).json({
          error: `Invalid status filter. Must be one of: ${validStatuses.join(', ')}`
        });
      }
      whereClauses.push('o.status = ?');
      params.push(matchedStatus);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const query = `
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
      ${whereSql}
      GROUP BY o.id
      ORDER BY o.id DESC
    `;

    const orders = await db.all(query, params);
    res.json({ orders });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/orders/:id
 * Retrieve complete order detail including historical snapshots of items.
 */
router.get('/:id', async (req, res, next) => {
  try {
    const db = await getDb();
    const orderId = parseInt(req.params.id, 10);

    if (isNaN(orderId) || orderId <= 0) {
      return res.status(400).json({ error: 'Invalid order ID' });
    }

    const order = await db.get(`
      SELECT id, reference, status, total, created_at, updated_at, cancelled_at
      FROM orders
      WHERE id = ?
    `, [orderId]);

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const items = await db.all(`
      SELECT 
        oi.id,
        oi.order_id,
        oi.product_id,
        oi.product_name_snapshot,
        p.sku,
        oi.unit_price,
        oi.quantity,
        oi.line_total
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
      ORDER BY oi.id ASC
    `, [orderId]);

    const formattedItems = items.map(oi => ({
      id: oi.id,
      orderId: oi.order_id,
      order_id: oi.order_id,
      productId: oi.product_id,
      product_id: oi.product_id,
      productName: oi.product_name_snapshot,
      product_name_snapshot: oi.product_name_snapshot,
      name: oi.product_name_snapshot,
      sku: oi.sku || 'N/A',
      unitPrice: oi.unit_price,
      unit_price: oi.unit_price,
      quantity: oi.quantity,
      lineTotal: oi.line_total,
      line_total: oi.line_total
    }));

    const orderDetail = {
      id: order.id,
      orderId: order.id,
      reference: order.reference,
      status: order.status,
      total: order.total,
      created_at: order.created_at,
      createdAt: order.created_at,
      updated_at: order.updated_at,
      updatedAt: order.updated_at,
      cancelled_at: order.cancelled_at,
      cancelledAt: order.cancelled_at,
      items: formattedItems
    };

    res.json({
      ...orderDetail,
      order: orderDetail
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/orders
 * Atomic transaction to validate stock, create order, deduct stock, and save items.
 * Request format:
 * {
 *   "items": [
 *     { "productId": 1, "quantity": 2 },
 *     ...
 *   ]
 * }
 */
router.post('/', async (req, res, next) => {
  const db = await getDb();
  let inTransaction = false;

  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'Invalid request body.' });
    }

    const { items } = req.body;

    // 1. Validate payload structure
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Order must contain at least one item.' });
    }

    // 2. Validate items & consolidate duplicates
    const consolidatedMap = new Map();
    for (const item of items) {
      if (!item || typeof item !== 'object') {
        return res.status(400).json({ error: 'Each item must be an object with productId and quantity.' });
      }

      const rawPid = Number(item.productId);
      const rawQty = Number(item.quantity);

      if (!Number.isInteger(rawPid) || rawPid <= 0) {
        return res.status(400).json({ error: `Invalid productId: ${item.productId}. Must be a positive integer.` });
      }

      if (!Number.isInteger(rawQty) || rawQty <= 0) {
        return res.status(400).json({ error: `Invalid quantity for productId ${rawPid}. Must be a positive integer.` });
      }

      consolidatedMap.set(rawPid, (consolidatedMap.get(rawPid) || 0) + rawQty);
    }

    const consolidatedItems = Array.from(consolidatedMap.entries()).map(([productId, quantity]) => ({
      productId,
      quantity
    }));

    // 3. Begin IMMEDIATE transaction to prevent concurrency conflicts and stale stock reads
    await db.run('BEGIN IMMEDIATE TRANSACTION;');
    inTransaction = true;

    // 4. Validate existence and stock for each product
    let orderTotal = 0;
    const validatedItems = [];

    for (const item of consolidatedItems) {
      const product = await db.get(
        'SELECT id, sku, name, price, stock_quantity FROM products WHERE id = ?;',
        [item.productId]
      );

      if (!product) {
        throw {
          status: 400,
          message: `Product with ID ${item.productId} does not exist.`
        };
      }

      if (product.stock_quantity < item.quantity) {
        throw {
          status: 400,
          message: `Insufficient stock for "${product.name}" (SKU: ${product.sku}). Requested: ${item.quantity}, Available: ${product.stock_quantity}.`
        };
      }

      const lineTotal = product.price * item.quantity;
      orderTotal += lineTotal;

      validatedItems.push({
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        unitPrice: product.price,
        quantity: item.quantity,
        lineTotal,
        currentStock: product.stock_quantity
      });
    }

    // 5. Deduct stock for each validated product with atomic condition
    for (const item of validatedItems) {
      const updateResult = await db.run(
        'UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ? AND stock_quantity >= ?;',
        [item.quantity, item.productId, item.quantity]
      );
      if (updateResult.changes === 0) {
        throw {
          status: 400,
          message: `Insufficient stock for "${item.productName}" (SKU: ${item.sku}). Stock cannot become negative.`
        };
      }
    }

    // 6. Create order record
    const now = new Date().toISOString();
    const reference = generateOrderReference();

    const orderResult = await db.run(
      `INSERT INTO orders (reference, status, total, created_at, updated_at)
       VALUES (?, 'Placed', ?, ?, ?);`,
      [reference, orderTotal, now, now]
    );

    const orderId = orderResult.lastID;

    // 7. Create order item records
    for (const item of validatedItems) {
      await db.run(
        `INSERT INTO order_items (order_id, product_id, product_name_snapshot, unit_price, quantity, line_total)
         VALUES (?, ?, ?, ?, ?, ?);`,
        [orderId, item.productId, item.productName, item.unitPrice, item.quantity, item.lineTotal]
      );
    }

    // 8. Commit transaction
    await db.run('COMMIT;');
    inTransaction = false;

    // 9. Return success response with both top-level and nested order representations
    const itemsSnapshot = validatedItems.map(i => ({
      productId: i.productId,
      productName: i.productName,
      sku: i.sku,
      unitPrice: i.unitPrice,
      quantity: i.quantity,
      lineTotal: i.lineTotal
    }));

    return res.status(201).json({
      message: 'Order placed successfully.',
      reference,
      orderReference: reference,
      id: orderId,
      orderId,
      status: 'Placed',
      total: orderTotal,
      created_at: now,
      createdAt: now,
      items: itemsSnapshot,
      order: {
        id: orderId,
        reference,
        status: 'Placed',
        total: orderTotal,
        created_at: now,
        updated_at: now,
        items: itemsSnapshot
      }
    });

  } catch (error) {
    if (inTransaction) {
      try {
        await db.run('ROLLBACK;');
      } catch (rbErr) {
        console.error('Failed to rollback order transaction:', rbErr);
      }
    }

    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    next(error);
  }
});

/**
 * PATCH /api/orders/:id/status
 * Handle valid state transitions and cancellation with atomic stock restoration.
 * Request body: { "status": "Packed" | "Shipped" | "Cancelled" }
 */
router.patch('/:id/status', async (req, res, next) => {
  const db = await getDb();
  let inTransaction = false;

  try {
    const orderId = parseInt(req.params.id, 10);
    const { status: targetStatus } = req.body;

    if (isNaN(orderId) || orderId <= 0) {
      return res.status(400).json({ error: 'Invalid order ID.' });
    }

    if (!targetStatus || typeof targetStatus !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid status in request body.' });
    }

    const validTargetStatuses = ['Packed', 'Shipped', 'Cancelled'];
    if (!validTargetStatuses.includes(targetStatus)) {
      return res.status(400).json({
        error: `Invalid target status "${targetStatus}". Allowed values: ${validTargetStatuses.join(', ')}.`
      });
    }

    // Begin IMMEDIATE transaction
    await db.run('BEGIN IMMEDIATE TRANSACTION;');
    inTransaction = true;

    // Fetch existing order
    const order = await db.get('SELECT id, reference, status FROM orders WHERE id = ?;', [orderId]);
    if (!order) {
      throw { status: 404, message: `Order #${orderId} not found.` };
    }

    const currentStatus = order.status;

    // Rule enforcement for state transitions
    if (currentStatus === 'Cancelled') {
      throw {
        status: 400,
        message: 'Order is already Cancelled. No further status changes or cancellations are permitted.'
      };
    }

    if (currentStatus === 'Shipped') {
      throw {
        status: 400,
        message: 'Order has already been Shipped. Shipped orders cannot be modified or cancelled.'
      };
    }

    // Handle Cancellation
    if (targetStatus === 'Cancelled') {
      // Allowed from Placed or Packed only
      if (currentStatus !== 'Placed' && currentStatus !== 'Packed') {
        throw {
          status: 400,
          message: `Cannot cancel an order in status "${currentStatus}". Only "Placed" or "Packed" orders can be cancelled.`
        };
      }

      // Fetch order items to restore stock
      const items = await db.all(
        'SELECT product_id, quantity FROM order_items WHERE order_id = ?;',
        [orderId]
      );

      // Restore stock for all items exactly once
      for (const item of items) {
        await db.run(
          'UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?;',
          [item.quantity, item.product_id]
        );
      }

      const now = new Date().toISOString();
      await db.run(
        `UPDATE orders 
         SET status = 'Cancelled', updated_at = ?, cancelled_at = ? 
         WHERE id = ?;`,
        [now, now, orderId]
      );

      await db.run('COMMIT;');
      inTransaction = false;

      return res.json({
        message: 'Order cancelled successfully and stock restored.',
        order: {
          id: orderId,
          reference: order.reference,
          status: 'Cancelled',
          updated_at: now,
          cancelled_at: now
        }
      });
    }

    // Handle Fulfilment Transitions:
    // Allowed: Placed -> Packed, Packed -> Shipped
    if (currentStatus === 'Placed' && targetStatus === 'Packed') {
      const now = new Date().toISOString();
      await db.run(
        `UPDATE orders SET status = 'Packed', updated_at = ? WHERE id = ?;`,
        [now, orderId]
      );
      await db.run('COMMIT;');
      inTransaction = false;

      return res.json({
        message: 'Order marked as Packed.',
        order: { id: orderId, reference: order.reference, status: 'Packed', updated_at: now }
      });
    }

    if (currentStatus === 'Packed' && targetStatus === 'Shipped') {
      const now = new Date().toISOString();
      await db.run(
        `UPDATE orders SET status = 'Shipped', updated_at = ? WHERE id = ?;`,
        [now, orderId]
      );
      await db.run('COMMIT;');
      inTransaction = false;

      return res.json({
        message: 'Order marked as Shipped.',
        order: { id: orderId, reference: order.reference, status: 'Shipped', updated_at: now }
      });
    }

    // Any other transition is rejected
    throw {
      status: 400,
      message: `Invalid transition from "${currentStatus}" to "${targetStatus}". Allowed sequence: Placed → Packed → Shipped.`
    };

  } catch (error) {
    if (inTransaction) {
      try {
        await db.run('ROLLBACK;');
      } catch (rbErr) {
        console.error('Failed to rollback status update transaction:', rbErr);
      }
    }

    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    next(error);
  }
});

export default router;
