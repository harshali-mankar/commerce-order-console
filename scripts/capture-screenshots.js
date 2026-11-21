import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer-core';
import { createApp } from '../server/app.js';
import { getDb, closeDb } from '../server/db.js';
import { seedProducts } from '../server/seed.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const screenshotsDir = path.resolve(__dirname, '../screenshots');

if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function capture() {
  console.log('Setting up application for live screenshot capture...');
  
  // Initialize DB and reset to clean baseline for consistent visual walkthrough
  const db = await getDb();
  await db.exec('DELETE FROM order_items;');
  await db.exec('DELETE FROM orders;');
  await db.exec(`
    UPDATE products SET stock_quantity = 5 WHERE sku = 'PROD-A';
    UPDATE products SET stock_quantity = 0 WHERE sku = 'PROD-B';
    UPDATE products SET stock_quantity = 8 WHERE sku = 'PROD-C';
    UPDATE products SET stock_quantity = 12 WHERE sku = 'PROD-D';
    UPDATE products SET stock_quantity = 4 WHERE sku = 'PROD-E';
  `);
  await seedProducts(db);

  // Start app on port 3001
  const app = createApp();
  const server = app.listen(3001);
  console.log('App running on http://localhost:3001');

  console.log('Launching Chrome via puppeteer-core...');
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,850'],
    defaultViewport: { width: 1280, height: 850, deviceScaleFactor: 1.5 }
  });

  const page = await browser.newPage();

  try {
    // 1. Initial Catalogue
    console.log('Capturing: 01-catalogue-initial.png');
    await page.goto('http://localhost:3001', { waitUntil: 'networkidle0' });
    await delay(1000);
    await page.screenshot({ path: path.join(screenshotsDir, '01-catalogue-initial.png') });

    // 2. Add products to Cart
    console.log('Adding products to cart...');
    // Click Add to Order on Product A (index 0)
    const addButtons = await page.$$('.btn-add');
    if (addButtons.length > 0) {
      await addButtons[0].click(); // Product A
      await delay(400);
      await addButtons[2].click(); // Product C (Mechanical Keyboard)
      await delay(400);
      await addButtons[3].click(); // Product D (Laptop Stand)
      await delay(400);
    }

    // Open Cart
    console.log('Capturing: 02-cart-multiple-items.png');
    await page.click('.cart-button');
    await delay(800);
    await page.screenshot({ path: path.join(screenshotsDir, '02-cart-multiple-items.png') });

    // 3. Review Order Summary
    console.log('Capturing: 03-order-confirmation.png');
    await page.waitForSelector('.btn-review-order', { timeout: 6000 });
    await page.click('.btn-review-order');
    await delay(600);
    await page.screenshot({ path: path.join(screenshotsDir, '03-order-confirmation.png') });

    // 4. Submit Order
    console.log('Capturing: 04-order-placed-success.png');
    await page.waitForSelector('.btn-confirm-place-order', { timeout: 6000 });
    await page.click('.btn-confirm-place-order');
    await page.waitForSelector('.btn-continue-operations', { timeout: 8000 });
    await delay(500);
    await page.screenshot({ path: path.join(screenshotsDir, '04-order-placed-success.png') });

    // Close Modal via Continue Operations
    await page.click('.btn-continue-operations');
    await delay(600);

    // 5. Navigate to Orders List
    console.log('Capturing: 05-orders-list.png');
    await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('.nav-tab'));
      const ordersTab = tabs.find(t => t.textContent.includes('Orders'));
      if (ordersTab) ordersTab.click();
    });
    await page.waitForSelector('.btn-view', { timeout: 8000 });
    await delay(600);
    await page.screenshot({ path: path.join(screenshotsDir, '05-orders-list.png') });

    // 6. Inspect Order Details
    console.log('Capturing: 06-order-details-placed.png');
    await page.waitForSelector('.btn-view', { timeout: 6000 });
    const viewButtons = await page.$$('.btn-view');
    if (viewButtons.length > 0) {
      await viewButtons[0].click();
      await page.waitForSelector('.btn-pack', { timeout: 6000 });
      await delay(600);
      await page.screenshot({ path: path.join(screenshotsDir, '06-order-details-placed.png') });

      // 7. Pack Order
      console.log('Packing order and capturing: 07-order-packed.png');
      const packBtn = await page.$('.btn-pack');
      if (packBtn) {
        await packBtn.click();
        await delay(500);
        // Confirm pack in modal prompt
        const confirmPack = await page.$('.btn-primary:not(:disabled)');
        if (confirmPack) await confirmPack.click();
        await page.waitForSelector('.btn-ship', { timeout: 6000 });
        await delay(600);
        await page.screenshot({ path: path.join(screenshotsDir, '07-order-packed.png') });
      }

      // 8. Ship Order
      console.log('Shipping order and capturing: 08-order-shipped.png');
      const shipBtn = await page.$('.btn-ship');
      if (shipBtn) {
        await shipBtn.click();
        await delay(500);
        const confirmShip = await page.$('.btn-primary:not(:disabled)');
        if (confirmShip) await confirmShip.click();
        await delay(1200);
        await page.screenshot({ path: path.join(screenshotsDir, '08-order-shipped.png') });
      }

      // Close modal
      const closeBtn = await page.$('.modal-header .btn-close');
      if (closeBtn) {
        await closeBtn.click();
        await delay(500);
      }
    }

    // 9. Create another order and cancel it to demonstrate single-transaction stock restoration
    console.log('Placing second order to demonstrate cancellation...');
    await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('.nav-tab'));
      const catTab = tabs.find(t => t.textContent.includes('Catalogue'));
      if (catTab) catTab.click();
    });
    await page.waitForSelector('.btn-add', { timeout: 8000 });
    await delay(500);

    // Add Product A
    await page.evaluate(() => {
      const addBtns = Array.from(document.querySelectorAll('.btn-add'));
      if (addBtns.length > 0) addBtns[0].click();
    });
    await delay(500);

    // Open Cart
    await page.evaluate(() => {
      const cartBtn = document.querySelector('.cart-button');
      if (cartBtn) cartBtn.click();
    });
    await page.waitForSelector('.btn-review-order', { timeout: 8000 });
    await delay(400);
    await page.click('.btn-review-order');
    await delay(500);
    await page.waitForSelector('.btn-confirm-place-order', { timeout: 8000 });
    await page.click('.btn-confirm-place-order');
    await page.waitForSelector('.btn-continue-operations', { timeout: 8000 });
    await page.click('.btn-continue-operations');
    await delay(500);

    // View that order in Orders list and Cancel it
    await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('.nav-tab'));
      const ordersTab = tabs.find(t => t.textContent.includes('Orders'));
      if (ordersTab) ordersTab.click();
    });
    await page.waitForSelector('.btn-view', { timeout: 8000 });
    await delay(600);
    const updatedViewBtns = await page.$$('.btn-view');
    if (updatedViewBtns.length > 0) {
      await updatedViewBtns[0].click();
      await page.waitForSelector('.btn-cancel', { timeout: 8000 });
      await delay(600);
      console.log('Capturing: 09-order-cancelled.png');
      const cancelBtn = await page.$('.btn-cancel');
      if (cancelBtn) {
        await cancelBtn.click();
        await delay(500);
        const confirmCancel = await page.$('button.btn-cancel:not(:disabled)');
        if (confirmCancel) await confirmCancel.click();
        await delay(1200);
        await page.screenshot({ path: path.join(screenshotsDir, '09-order-cancelled.png') });
      }
      const closeDetails = await page.$('.modal-header .btn-close');
      if (closeDetails) await closeDetails.click();
      await delay(500);
    }

    // 10. Catalogue showing restored stock
    console.log('Capturing: 10-stock-restored-catalogue.png');
    await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('.nav-tab'));
      const catTab = tabs.find(t => t.textContent.includes('Catalogue'));
      if (catTab) catTab.click();
    });
    await delay(800);
    await page.screenshot({ path: path.join(screenshotsDir, '10-stock-restored-catalogue.png') });

    console.log('All screenshots captured successfully in screenshots/ directory!');
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
    await closeDb();
  }
}

capture().catch((err) => {
  console.error('Screenshot capture failed:', err);
  process.exit(1);
});
