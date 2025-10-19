// src/lib/email.js

const EMAIL_REGEX =
  /(?:mailto:)?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;

/**
 * Extracts unique emails from either a Cheerio instance + html,
 * or from a raw HTML/text string.
 *
 * Usage with Cheerio:
 *   const emails = extractEmails({ $, html });
 *
 * Usage with just a string:
 *   const emails = extractEmails('<p>Contact: hr@example.com</p>');
 */
export function extractEmails(input) {
  let text = "";

  if (typeof input === "string") {
    text = input;
  } else if (input && typeof input === "object") {
    const { $, html } = input;

    if ($ && typeof $.root === "function") {
      // Prefer text content (avoids duplicates from attributes), then add mailto: links
      text += $.root().text() + " ";
      $('a[href*="mailto:"]').each((_, el) => {
        const href = $(el).attr("href") || "";
        text += " " + href;
      });
    } else if (typeof html === "string") {
      text = html;
    }
  }

  const found = new Set();
  for (const m of text.matchAll(EMAIL_REGEX)) {
    // capture group 1 is the pure email without the mailto:
    if (m[1]) found.add(m[1].toLowerCase());
  }
  return [...found];
}
