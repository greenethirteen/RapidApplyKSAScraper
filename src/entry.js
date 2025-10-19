// src/entry.js
// Loads .env automatically and starts the scraper.
// Usage: node src/entry.js   (no need for -r dotenv/config)
import 'dotenv/config';
import { run } from './index.js';

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
