import { getDb } from './db.js';

export const SYNTHETIC_PRODUCTS = [
  {
    sku: 'PROD-A',
    name: 'Wireless Mouse',
    description: 'Ergonomic 2.4GHz wireless mouse with adjustable DPI and silent clicks.',
    price: 79900, // ₹799 in paise
    stock_quantity: 5
  },
  {
    sku: 'PROD-B',
    name: 'USB-C Hub',
    description: '7-in-1 multi-port adapter with 4K HDMI, 100W PD charging, and USB 3.0 ports.',
    price: 149900, // ₹1,499 in paise
    stock_quantity: 0 // Out of stock by requirement
  },
  {
    sku: 'PROD-C',
    name: 'Mechanical Keyboard',
    description: 'Compact 75% mechanical keyboard with tactile brown switches and RGB backlighting.',
    price: 249900, // ₹2,499 in paise
    stock_quantity: 8
  },
  {
    sku: 'PROD-D',
    name: 'Laptop Stand',
    description: 'Adjustable aluminium desktop riser with heat dissipation pads.',
    price: 99900, // ₹999 in paise
    stock_quantity: 12
  },
  {
    sku: 'PROD-E',
    name: 'HD Webcam',
    description: '1080p full HD streaming camera with stereo noise-cancelling microphones.',
    price: 189900, // ₹1,899 in paise
    stock_quantity: 4
  }
];

export async function seedProducts(db) {
  const targetDb = db || (await getDb());
  const now = new Date().toISOString();

  // Insert products safely. INSERT OR IGNORE ensures that:
  // 1. Existing SKUs are preserved
  // 2. Stock levels are NEVER reset on application restart
  // 3. No duplicate products are ever inserted
  const stmt = await targetDb.prepare(`
    INSERT OR IGNORE INTO products (sku, name, description, price, stock_quantity, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  try {
    for (const prod of SYNTHETIC_PRODUCTS) {
      await stmt.run(prod.sku, prod.name, prod.description, prod.price, prod.stock_quantity, now);
    }
  } finally {
    await stmt.finalize();
  }
}

// Allow direct execution: node server/seed.js
if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  (async () => {
    try {
      const db = await getDb();
      await seedProducts(db);
      console.log('Catalogue seeded successfully.');
      const products = await db.all('SELECT sku, name, price, stock_quantity FROM products');
      console.table(products);
      process.exit(0);
    } catch (err) {
      console.error('Seeding failed:', err);
      process.exit(1);
    }
  })();
}
