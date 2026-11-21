import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Data directory for persistent SQLite database
const dataDir = path.resolve(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const defaultDbPath = path.resolve(dataDir, 'commerce.db');
let currentDbPath = process.env.DB_PATH || defaultDbPath;
let dbInstance = null;

export function setDbPath(newPath) {
  currentDbPath = newPath;
  dbInstance = null;
}

export async function getDb(dbPath) {
  const targetPath = dbPath || currentDbPath;
  if (dbInstance && currentDbPath === targetPath) {
    return dbInstance;
  }

  const db = await open({
    filename: targetPath,
    driver: sqlite3.Database
  });

  // Enable WAL mode for better concurrency and foreign keys
  await db.exec('PRAGMA foreign_keys = ON;');
  await db.exec('PRAGMA journal_mode = WAL;');

  // Create tables if they do not exist
  await db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      price INTEGER NOT NULL CHECK (price >= 0),
      stock_quantity INTEGER NOT NULL CHECK (stock_quantity >= 0),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reference TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('Placed', 'Packed', 'Shipped', 'Cancelled')),
      total INTEGER NOT NULL CHECK (total >= 0),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      cancelled_at TEXT
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      product_name_snapshot TEXT NOT NULL,
      unit_price INTEGER NOT NULL CHECK (unit_price >= 0),
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      line_total INTEGER NOT NULL CHECK (line_total >= 0)
    );

    CREATE INDEX IF NOT EXISTS idx_orders_reference ON orders(reference);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
  `);

  currentDbPath = targetPath;
  dbInstance = db;

  return db;
}

export async function closeDb() {
  if (dbInstance) {
    await dbInstance.close();
    dbInstance = null;
  }
}
