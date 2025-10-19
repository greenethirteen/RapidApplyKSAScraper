// src/pipeline.js
// Drop-in email-aware pipeline helpers. ESM compatible.
// Exports `aiCleanupAndWrite` to remain compatible with earlier imports.

import * as cheerio from "cheerio";
import { extractEmails } from "./email/extract.js";

/**
 * Build a record with emails extracted from the job details HTML.
 * This function does not perform network I/O; it assumes you already fetched the page HTML.
 * It is safe to call even if `html` is empty.
 */
export function buildRecordWithEmails({
  html = "",
  url = "",
  title = "",
  category = "",
  location = "Saudi Arabia",
  id = "",
  extra = {},
}) {
  let emails = [];
  try {
    const $ = html ? cheerio.load(html) : null;
    emails = extractEmails(html || "", $ || null);
  } catch (e) {
    // cheerio might fail on malformed HTML; ignore and fallback to regex
    emails = extractEmails(html || "", null);
  }

  const record = {
    title: (title || "").toString().trim(),
    category: (category || "").toString().trim(),
    location: (location || "").toString().trim() || "Saudi Arabia",
    url,
    id,
    emails, // <= NEW
    ...extra,
  };
  return record;
}

/**
 * Backwards-compatible export used by some entrypoints:
 * Given a raw job object and HTML, return a normalized record ready to persist.
 * Usage in existing code: const rec = await aiCleanupAndWrite({ html, url, ...meta })
 */
export async function aiCleanupAndWrite(args) {
  // Keep name for compatibility; we only build the record here.
  // If your previous version wrote directly to Firebase, do that right after calling this.
  return buildRecordWithEmails(args || {});
}

export default { buildRecordWithEmails, aiCleanupAndWrite };
