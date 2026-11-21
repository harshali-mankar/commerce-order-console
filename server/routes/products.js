import express from 'express';
import { getDb } from '../db.js';

const router = express.Router();

/**
 * GET /api/products
 * Retrieve all products in the catalogue.
 */
router.get('/', async (req, res, next) => {
  try {
    const db = await getDb();
    const products = await db.all(`
      SELECT id, sku, name, description, price, stock_quantity, created_at
      FROM products
      ORDER BY id ASC
    `);
    res.json({ products });
  } catch (error) {
    next(error);
  }
});

export default router;
