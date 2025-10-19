import './force-normalizer.js';
import 'dotenv/config';
import runSaudiScraper from './scrapers/saudiJobsScraper.js';
import { aiCleanupAndWrite } from './pipeline.js';

const pages = Number(process.env.SAUDI_PAGES || 8);
const pause = Number(process.env.PAUSE_MS || 800);

console.log('[RapidApply SA] Starting scraper: pages=%d, pauseMs=%d', pages, pause);

await runSaudiScraper({
  pages,
  pauseMs: pause,
  // IMPORTANT: your scraper should call this for each { url,title,description,company,location,postedAt }
  onJob: aiCleanupAndWrite
});
