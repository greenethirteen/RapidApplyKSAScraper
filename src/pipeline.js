// src/pipeline.js
import crypto from "crypto";
import { cleanTitle, cleanLocation, summarizeSnippet } from "./ai/cleaners.js";
import { chooseCategory } from "./category.js";
import { writeJob } from "./writer.js";

function sha1(s) {
  return crypto.createHash("sha1").update(String(s)).digest("hex");
}

function coerceISODate(raw) {
  if (!raw || typeof raw !== "string") return new Date().toISOString();
  let s = raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  // Remove obvious UI junk
  s = s.replace(/\b(Apply Now|Report Ad|Share|Save)\b/gi, " ").trim();
  // Try native parse
  const t = Date.parse(s);
  if (!isNaN(t)) return new Date(t).toISOString();
  // Try DD/MM/YYYY or DD-MM-YYYY
  const m1 = s.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/);
  if (m1) {
    const [_, d, m, y] = m1;
    const yyyy = (y.length === 2 ? "20" + y : y);
    const iso = new Date(Number(yyyy), Number(m) - 1, Number(d));
    if (!isNaN(iso)) return iso.toISOString();
  }
  // Try "12 Oct 2025" / "Oct 12, 2025"
  const m2 = s.match(/\b(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})\b/);
  const m3 = s.match(/\b([A-Za-z]{3,})\s+(\d{1,2}),\s*(\d{4})\b/);
  const MONTHS = {jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
  if (m2) {
    const d = Number(m2[1]); const mon = MONTHS[m2[2].slice(0,3).toLowerCase()]; const y = Number(m2[3]);
    if (mon!=null) return new Date(y, mon, d).toISOString();
  }
  if (m3) {
    const mon = MONTHS[m3[1].slice(0,3).toLowerCase()]; const d = Number(m3[2]); const y = Number(m3[3]);
    if (mon!=null) return new Date(y, mon, d).toISOString();
  }
  // Fallback: now
  return new Date().toISOString();
}

/**
 * Accepts a raw scrape object and writes a normalized record.
 * No LLM. Deterministic. Returns the written job object.
 */
export async function processJob(raw) {
  if (!raw || !raw.url) throw new Error("Missing raw.url");

  const title = cleanTitle({
    pageTitle: raw.title,
    h1: raw.h1,
    ogTitle: raw.ogTitle,
    pageUrl: raw.url,
  });
  const location = cleanLocation(raw.location);
  const description_snippet = summarizeSnippet(raw.description);
  const category = chooseCategory(title, description_snippet);
  const id = sha1(raw.url);

  const posted_at = coerceISODate(raw.posted_at || raw.dateText || "");

  // HARD GUARD: refuse generic stomp unless truly a data role
  const isSuspect = title === "Senior Data Analyst";
  const isDataCat = /(data|analyst|analytics|bi|business intelligence)/i.test(category);
  if (isSuspect && !isDataCat) {
    throw new Error("Guard: refusing to write suspicious generic title 'Senior Data Analyst' for non-data category");
  }

  const job = {
    id,
    source: raw.source || "saudijobs.in",
    apply_url: raw.url,
    title,
    description_snippet,
    category,
    company: raw.company || "",
    location: location || "Saudi Arabia",
    country: "SA",
    salary: raw.salary || "",
    posted_at,
    scraped_at: raw.scraped_at || new Date().toISOString(),
    last_updated: new Date().toISOString(),
  };

  if (process.env.DEBUG_TITLES === "1") {
    // Minimal helpful debug
    console.log("[WROTE]", { title: job.title, category: job.category, location: job.location, id: job.id });
  }

  // Write to DB
  const written = await writeJob(job);
  return written;
}

// Backwards-compat export
export const aiCleanupAndWrite = processJob;
export default processJob;
