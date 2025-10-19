// src/email/extract.js
// Robust email extractor for saudijobs.in job-detail pages.
// Handles:
//  - <a href="mailto:hr@company.com?subject=...">
//  - onclick="window.location='mailto:hr@...';" and similar inline JS
//  - Cloudflare obfuscation: <a class="__cf_email__" data-cfemail="...">
//  - Fallback regex over the whole HTML/text

function dedupe(arr) {
  return [...new Set(arr.map(e => e.trim().toLowerCase()))].filter(Boolean);
}

// Cloudflare email decoder: data-cfemail is a hex string
function cfDecodeEmail(cfhex) {
  try {
    const r = parseInt(cfhex.slice(0, 2), 16);
    let out = "";
    for (let i = 2; i < cfhex.length; i += 2) {
      const code = parseInt(cfhex.slice(i, i + 2), 16) ^ r;
      out += String.fromCharCode(code);
    }
    return out;
  } catch {
    return "";
  }
}

const EMAIL_REGEX = /[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}/gi;

// Pull "user@domain" out of a mailto href
function emailFromMailto(href) {
  try {
    const after = href.split(":")[1] || "";
    const addr = decodeURIComponent(after.split("?")[0] || "");
    const m = addr.match(EMAIL_REGEX);
    return m ? m[0] : "";
  } catch {
    return "";
  }
}

/**
 * extractEmails(html, $)
 * @param {string} html - full HTML of the job-details page
 * @param {$} $ - a cheerio instance loaded with the same HTML (optional but better)
 * @returns {string[]} array of unique emails (lowercased)
 */
export function extractEmails(html, $) {
  const found = [];

  // 1) <a href="mailto:...">
  if ($) {
    $('a[href^="mailto:"], a[href^="MAILTO:"]').each((_, el) => {
      const href = ($(el).attr("href") || "").trim();
      const email = emailFromMailto(href);
      if (email) found.push(email);
    });
  }

  // 2) onclick / inline JS that navigates to mailto:
  if ($) {
    $('[onclick], [onClick]').each((_, el) => {
      const onclick = ($(el).attr("onclick") || $(el).attr("onClick") || "").trim();
      if (/mailto:/i.test(onclick)) {
        const match = onclick.match(/mailto:[^'"]+/i);
        if (match) {
          const email = emailFromMailto(match[0]);
          if (email) found.push(email);
        }
      }
    });
  }

  // 3) Cloudflare obfuscation <a class="__cf_email__" data-cfemail="...">
  if ($) {
    $('a.__cf_email__, span.__cf_email__').each((_, el) => {
      const cf = ($(el).attr("data-cfemail") || "").trim();
      if (cf) {
        const decoded = cfDecodeEmail(cf);
        const m = decoded.match(EMAIL_REGEX);
        if (m) found.push(...m);
      }
    });
  }

  // 4) Fallback: search raw HTML for visible email strings
  if (html && typeof html === "string") {
    const matches = html.match(EMAIL_REGEX);
    if (matches) found.push(...matches);
  }

  return dedupe(found);
}
