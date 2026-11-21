import dotenv from 'dotenv';
import { createApp } from './app.js';
import { getDb } from './db.js';
import { seedProducts } from './seed.js';

dotenv.config();

const PORT = process.env.PORT || 3001;

async function startServer() {
  try {
    // 1. Ensure DB schema exists
    const db = await getDb();
    
    // 2. Safe idempotent seed
    await seedProducts(db);
    console.log('Database initialized and verified.');

    // 3. Create Express app and start listening
    const app = createApp();
    const server = app.listen(PORT, () => {
      console.log(`Commerce Order Console Server listening on port ${PORT}`);
      console.log(`API base URL: http://localhost:${PORT}/api`);
    });

    return server;
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
