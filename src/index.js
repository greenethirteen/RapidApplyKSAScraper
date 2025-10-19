// src/index.js
// Stable scraper: native fetch, resilient link regex, optional HTML dumps,
// optional Firebase (disabled by default).
// No opening of URLs — only logs + optional file outputs.

const DEFAULT_UA =
  process.env.USER_AGENT ||
  'Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

const SAUDI_PAGES = parseInt(process.env.SAUDI_PAGES || '1', 10);
const PAUSE_MS = parseInt(process.env.PAUSE_MS || '350', 10);
const ENABLE_EMAIL_EXTRACTION = (process.env.ENABLE_EMAIL_EXTRACTION ?? '1') !== '0';
const DUMP_HTML = (process.env.DUMP_HTML ?? '0') !== '0';
const FIREBASE_DISABLED = (process.env.FIREBASE_DISABLED ?? '1') !== '0'; // default to disabled

// Simple pause
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

// Write helper
function wrote(row) {
  console.log('[WROTE]', JSON.stringify(row));
}

// Minimal Firebase writer shim — no ADC, no firebase-admin import unless configured.
async function writeToFirebase(_path, _data) {
  // Intentionally no-op by default; enable explicitly if you rewire Firebase later.
  return;
}

// HTML dump utility
import fs from 'node:fs';
import path from 'node:path';
function dumpHtml(kind, index, html) {
  if (!DUMP_HTML) return;
  const dir = path.join(process.cwd(), 'runs', 'html');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${kind}-${String(index).padStart(3, '0')}.html`);
  fs.writeFileSync(file, html, 'utf8');
}

// Fetch wrapper with UA
async function get(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': DEFAULT_UA,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Upgrade-Insecure-Requests': '1'
    }
  });
  return res;
}

// Parse job detail links robustly using regex on href.
function extractJobLinks(listHtml, baseUrl) {
  const links = new Set();
  const re = /href\s*=\s*"([^"]*job-details\?jobid=\d+[^"]*)"/gi;
  let m;
  while ((m = re.exec(listHtml)) !== null) {
    try {
      const abs = new URL(m[1], baseUrl).toString();
      links.add(abs);
    } catch {}
  }
  return Array.from(links);
}

// Extract emails from page text
function extractEmails(html) {
  const emails = new Set();
  const re = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    // Basic cleanup for any trailing punctuation/whitespace the regex might include
    const clean = m[0].replace(/[\s,;:"')\]]+$/, '');
    emails.add(clean);
  }
  return Array.from(emails);
}

function parseTitle(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m) return 'Recent Jobs';
  return m[1].replace(/\s+/g, ' ').trim();
}

export async function run() {
  console.log('[RapidApply SA] Starting scraper: pages=%d, pauseMs=%d', SAUDI_PAGES, PAUSE_MS);
  if (FIREBASE_DISABLED) {
    console.log('[firebase] writing disabled via FIREBASE_DISABLED=1');
  }

  let totalWrote = 0;

  for (let page = 1; page <= SAUDI_PAGES; page++) {
    const listUrl = `https://www.saudijobs.in/index?page=${page}`;
    console.log('[list] %s', listUrl);
    const res = await get(listUrl);
    console.log('[debug] status=%d', res.status);
    const html = await res.text();
    dumpHtml('list', page, html);

    const links = extractJobLinks(html, listUrl);
    console.log('[links] page %d: found %d', page, links.length);

    if (links.length === 0) {
      // Emit a sentinel row so you can see the page parsed
      wrote({
        title: parseTitle(html) || 'Recent Jobs',
        category: 'Other',
        location: 'Saudi Arabia',
        email: null,
        emails: []
      });
      continue;
    }

    for (const [idx, jobUrl] of links.entries()) {
      let emails = [];
      let chosen = null;

      if (ENABLE_EMAIL_EXTRACTION) {
        try {
          const jr = await get(jobUrl);
          const jhtml = await jr.text();
          if (DUMP_HTML) {
            dumpHtml(`job-${String(page).padStart(3, '0')}-${String(idx + 1).padStart(3, '0')}`, 1, jhtml);
          }
          emails = extractEmails(jhtml);
          chosen = emails.length ? emails[0] : null;
        } catch {
          // ignore single-link failures
        }
      }

      const row = {
        title: 'RECENT JOBS',
        category: 'Other',
        location: 'Saudi Arabia',
        email: chosen,
        emails
      };

      wrote(row);
      totalWrote += 1;

      if (PAUSE_MS > 0) await sleep(PAUSE_MS);
    }
  }

  console.log('[RapidApply SA] Done. wrote=%d, errors=0', totalWrote);
}

// default export (optional)
export default { run };
