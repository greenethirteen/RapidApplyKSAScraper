import axios from "axios";
import * as cheerio from "cheerio";
import { CookieJar } from "tough-cookie";
import { wrapper } from "axios-cookiejar-support";
import fs from "fs";
import path from "path";
import { decode } from "html-entities";

// ---- Config ----
const BASE = "https://www.saudijobs.in";

// Build one axios client with cookie support
const jar = new CookieJar();
const client = wrapper(axios.create({
  jar,
  withCredentials: true,
  timeout: 20000,
  // Try to look like a regular browser
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
    "Accept":
      "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
  },
}));

function sleep(ms) {
  const jitter = Math.floor(Math.random() * 200); // 0-199ms
  return new Promise((r) => setTimeout(r, ms + jitter));
}

// Normalize and GET with our client; also print the final URL we hit
async function get(url) {
  // Normalize the legacy patterns we saw in error logs
  url = url
    .replace("/jobs?page=", "/index?page=")
    .replace("https://saudijobs.in", BASE);

  console.log("[GET]", url);
  const res = await client.get(url);
  return res.data;
}

async function warmUp() {
  try {
    await get(`${BASE}/`);
  } catch (e) {
    console.warn("[warmUp] non-fatal:", e?.response?.status || e.message);
  }
}

function extractListLinks(html) {
  const $ = cheerio.load(html);
  const links = new Set();

  // Primary selector seen during successful runs
  $('a[href*="job-details?jobid="]').each((_, a) => {
    const href = $(a).attr("href");
    if (!href) return;
    try {
      const abs = new URL(href, BASE).toString();
      links.add(abs);
    } catch {}
  });

  // Fallback: sometimes links are nested in cards with onclick, attempt a parse
  $('[onclick]').each((_, el) => {
    const onclick = $(el).attr("onclick") || "";
    const m = onclick.match(/job-details\?jobid=\d+[^"']*/i);
    if (m) {
      try {
        const abs = new URL(m[0], BASE).toString();
        links.add(abs);
      } catch {}
    }
  });

  return Array.from(links);
}

async function fetchListPage(page) {
  const tried = [];
  const candidates = [
    `${BASE}/index?page=${page}`,
    `${BASE}/?page=${page}`,
    `${BASE}/index.php?page=${page}`,
  ];

  for (const url of candidates) {
    tried.push(url);
    const html = await get(url);
    const links = extractListLinks(html);

    if (links.length > 0) {
      console.log(`[links] page ${page}: found ${links.length}`);
      return links;
    }

    // Save a snapshot so you can view what was actually served
    const dir = path.join(process.cwd(), "debug", "saudi");
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `list-p${page}-${Date.now()}.html`);
    try {
      fs.writeFileSync(file, html);
      console.log(`[links] page ${page}: found 0 (saved ${file})`);
    } catch (err) {
      console.warn("[debug save failed]", err?.message);
    }
    await sleep(400);
  }

  console.warn(`[links] page ${page}: all fallbacks yielded 0. tried=`, tried);
  return [];
}

// --- helpers for detail parsing ---
function largestText($) {
  let best = "";
  $("p, div, section, article, main").each((_, el) => {
    const t = $(el).text().replace(/\s+/g, " ").trim();
    if (t.length > best.length) best = t;
  });
  return best;
}

function guessCompany($, fallbackBlob) {
  const cand =
    $('[class*="company"], [id*="company"]').first().text().trim() ||
    $('[class*="employer"], [id*="employer"]').first().text().trim() ||
    "";
  if (cand && cand.length > 1 && cand.length < 120) return cand;
  const m = fallbackBlob.match(/Company\s*:\s*([A-Za-z0-9&\.\-\s]{2,80})/i);
  return (m && m[1].trim()) || "";
}

function guessLocation($, fallbackBlob) {
  const lab =
    $('[class*="location"], [id*="location"]').first().text().trim() || "";
  if (lab) return lab;
  const city = fallbackBlob.match(
    /(Riyadh|Jeddah|Dammam|Khobar|Al[-\s]?Khobar|Dhahran|Jubail|Yanbu|Makkah|Mecca|Madinah|Medina|Tabuk|Jazan|NEOM|KAEC)/i
  );
  return (city && city[0]) || "Saudi Arabia";
}

function guessSalary(blob) {
  const m = blob.match(/(SAR|SR)\s?[\d,]+(?:\s*-\s*[\d,]+)?/i);
  return (m && m[0]) || "";
}

function parsePostedAt(dateTextFromDom) {
  const raw = (dateTextFromDom || "").trim();
  if (raw) {
    const isoTry = Date.parse(raw);
    if (!Number.isNaN(isoTry)) return new Date(isoTry).toISOString();
    const dmy = raw.match(/(\d{1,2})[\/\-\s](\w{3,}|\d{1,2})[\/\-\s](\d{4})/);
    if (dmy) {
      const s = dmy[0].replace(/\s+/g, " ");
      const try2 = Date.parse(s);
      if (!Number.isNaN(try2)) return new Date(try2).toISOString();
    }
  }
  return new Date().toISOString();
}

function cleanDescription(raw) {
  return (raw || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/(adsbygoogle|Back To Main Jobs|Home About Sign Up Login Contact Post A Job)/gi, " ")
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Parse a single job page. Keep it tolerant (site markup may vary).
function parseJob(html, url) {
  const $ = cheerio.load(html);

  const h1 = $("h1").first().text().trim();
  const ogTitle = $('meta[property="og:title"]').attr("content") || "";
  const pageTitle = $("title").text().trim();
  let urlTitle = "";
  try {
    const u = new URL(url);
    urlTitle = (u.searchParams.get("jobtitle") || "")
      .replace(/[-_/]+/g, " ")
      .trim();
    urlTitle = decode(urlTitle);
  } catch {}

  let rawTitle = h1 || ogTitle || pageTitle || urlTitle || "";
  if (/^(recent jobs|home|saudi jobs)$/i.test(rawTitle)) rawTitle = urlTitle || h1 || ogTitle || pageTitle;

  // Prefer focused containers; fall back to largest block
  const focused =
    $(".job-description").text() ||
    $(".post-content").text() ||
    $(".content").text() ||
    $("article").text() ||
    $("#content, main").text() ||
    "";
  const blob = (focused || largestText($) || "").trim();
  const desc = cleanDescription(blob);
  const description_snippet = (desc.length > 220 ? desc.slice(0,220) + "…" : desc);

  const dateText =
    ($('[class*="date"], time, .posted, .post-date').first().text() || "").trim();

  // lightweight company/location/salary guesses
  const company = guessCompany($, desc);
  const location = guessLocation($, desc);
  const salary = guessSalary(desc);
  const postedAt = parsePostedAt(dateText);

  return {
    source: "saudijobs.in",
    url,
    // leave title "rawTitle" for AI cleaner in pipeline; keep here for debug too
    title: rawTitle,
    rawTitle,
    description: desc,
    description_snippet,
    company,
    location,
    salary,
    postedAt,
    dateText,                         // keep for debugging
    scraped_at: new Date().toISOString(),
  };
}

async function fetchJob(url) {
  const html = await get(url);
  return parseJob(html, url);
}

/**
 * Entrypoint used by index.js
 * @param {Object} opts
 * @param {number} opts.pages   how many list pages to scan
 * @param {number} opts.pauseMs base delay between list pages
 * @param {(job: object) => Promise<void>|void} [opts.onJob] optional callback per parsed job
 */
export async function runSaudiScraper(opts = {}) {
  const pages =
    Number.isFinite(+opts.pages)
      ? +opts.pages
      : Number.isFinite(+process.env.SAUDI_PAGES)
      ? +process.env.SAUDI_PAGES
      : 8;

  const pauseMs =
    Number.isFinite(+opts.pauseMs)
      ? +opts.pauseMs
      : Number.isFinite(+process.env.PAUSE_MS)
      ? +process.env.PAUSE_MS
      : 800;

  console.log(`[RapidApply SA] Starting scraper: pages=${pages}, pauseMs=${pauseMs}`);

  await warmUp();

  let totalFound = 0;
  let totalErrors = 0;

  for (let p = 1; p <= pages; p++) {
    console.log("[list]", `${BASE}/index?page=${p}`);
    try {
      const links = await fetchListPage(p);

      for (const link of links) {
        try {
          const job = await fetchJob(link);
          totalFound++;

          if (typeof opts.onJob === "function") {
            await opts.onJob(job); // Pipeline hook (AI cleanup + RTDB write)
          } else {
            console.log("[job]", JSON.stringify({ url: job.url, title: job.title }).slice(0, 300));
          }

          await sleep(250);
        } catch (err) {
          totalErrors++;
          console.warn("[job error]", link, err?.message || err);
        }
      }
    } catch (err) {
      totalErrors++;
      console.warn(`[list error] page=${p}:`, err?.message || err);
    }

    await sleep(pauseMs);
  }

  console.log(
    `[RapidApply SA] Done. found=${totalFound}, errors=${totalErrors}`
  );

  return { found: totalFound, errors: totalErrors };
}

export default runSaudiScraper;
