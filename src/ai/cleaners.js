// src/ai/cleaners.js
// Purpose: Clean and normalize job titles using OpenAI, reading API key from ENV ONLY.
// IMPORTANT: No hardcoded keys; production relies on Railway -> Variables -> OPENAI_API_KEY

import OpenAI from "openai";

/** Utility: basic HTML to text (very lightweight) */
function htmlToText(html = "") {
  if (!html) return "";
  // Remove scripts/styles
  html = html.replace(/<script[\s\S]*?<\/script>/gi, " ");
  html = html.replace(/<style[\s\S]*?<\/style>/gi, " ");
  // Replace <br> and block tags with newlines
  html = html.replace(/<(?:br|BR)\s*\/?>/g, "\n");
  html = html.replace(/<\/(?:p|div|li|ul|ol|h[1-6])>/gi, "\n");
  // Strip all remaining tags
  html = html.replace(/<[^>]+>/g, " ");
  // Collapse whitespace
  return html.replace(/\s+/g, " ").trim();
}

/** Heuristic fallback cleaner in case the API fails */
function fallbackTitle(rawTitle = "", bodyText = "") {
  const t = (rawTitle || "").trim();
  // If title is long or generic, try to extract a role-like phrase from the body
  const tooGeneric = /urgent|hiring|requirement|vacancies|positions|opportunities|opening|we\s*are\s*looking|job\s*vacancy/i;
  let candidate = t;
  if (!t || t.length < 3 || tooGeneric.test(t)) {
    // Look for lines like "Position: XXX", bullets, or short role-like fragments
    const m =
      bodyText.match(/(?:position\s*:\s*|role\s*:\s*)([A-Za-z0-9\-/&(),\. ]{3,80})/i) ||
      bodyText.match(/\b([A-Z][A-Za-z /&\-]{2,60}?\b(?:Engineer|Supervisor|Manager|Inspector|Coordinator|Controller|Technician|Planner|Estimator|Draftsman|Operator|Foreman|Architect|Surveyor|Specialist|Analyst|Consultant|Executive))\b/i);
    if (m) candidate = m[1].trim();
  }
  // Trim trailing garbage like dashes or punctuation
  candidate = (candidate || "").replace(/^[-–:]+\s*/, "").replace(/\s*[-–:,\.]\s*$/,"").trim();
  // Capitalize simple patterns
  if (candidate && candidate.length <= 80) return candidate;
  return t.slice(0, 80);
}

/** Strict post-processor to ensure we keep only the role words */
function strictTrimRole(s = "") {
  if (!s) return s;
  // Remove leading emojis/quotes/brackets and marketing fluff
  s = s.replace(/^[^A-Za-z0-9]+/, "");
  s = s.replace(/\b(urgent|hiring|required|requirement|vacancy|job|opportunity|opportunities|multiple|opening|openings|positions|we are looking for|looking for)\b[,:\- ]*/gi, "");
  // Drop trailing counts and location tails
  s = s.replace(/\b\(?\s*\d+\s*(?:nos|ea|positions?)\s*\)?$/i, "");
  s = s.replace(/\b(in|at|for)\s+[A-Za-z ,\-]+$/i, "").trim();
  // Collapse spaces and trim punctuation
  s = s.replace(/\s+/g, " ").replace(/^[-–:]+\s*/, "").replace(/\s*[-–:,\.]\s*$/,"").trim();
  // If after trimming it's too short, return empty so caller can fallback
  if (s.length < 2) return "";
  return s;
}

/**
 * Clean a job title using OpenAI with a strict JSON response format.
 * Returns { title, meta }, where title is a single role-only string (<= 80 chars).
 */
export async function cleanTitle({ rawTitle = "", bodyHtml = "", url = "" }) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required (Railway Variables). No hardcoded keys allowed.");
  }

  const client = new OpenAI({ apiKey: OPENAI_API_KEY });
  const bodyText = htmlToText(bodyHtml).slice(0, 6000); // keep prompt smallish

  const system = `You extract *only the job title* from messy headlines/descriptions.
Rules (must follow):
- Output a single concise role like "Civil Engineer" (<= 80 chars).
- NO company names, locations, seniority symbols, counts, or marketing words.
- If headline is generic (e.g., "Urgent Hiring"), derive the title from the body text.
- If the page clearly lists multiple roles, return the token MULTI_ROLE_HEADING.
- Return JSON ONLY: {"title": "<string>", "note": "<optional>"} (no backticks).`;

  const user = JSON.stringify({
    url,
    headline: rawTitle,
    body_excerpt: bodyText.slice(0, 2000)
  });

  let aiTitle = "";
  let note = "";
  try {
    const resp = await client.responses.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      input: [
        { role: "system", content: system },
        { role: "user", content: user }
      ]
    });

    const content = resp?.output_text || resp?.content?.[0]?.text || "";
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      // Some SDKs put text in a different place; last resort grab text blocks
      const textChunk = (resp?.content || [])
        .map(c => (typeof c?.text === "string" ? c.text : ""))
        .join("\n");
      parsed = JSON.parse(textChunk || "{}");
    }
    aiTitle = strictTrimRole(parsed?.title || "");
    note = parsed?.note || "";
  } catch (e) {
    // fall back to heuristic
    aiTitle = "";
  }

  if (!aiTitle) {
    const t = fallbackTitle(rawTitle, bodyText);
    aiTitle = strictTrimRole(t) || t;
  }

  // Final guardrails
  aiTitle = aiTitle
    .replace(/\b(saudi arabia|riyadh|jeddah|dammam|makkah|madinah)\b/gi, "")
    .replace(/\s+/g, " ")
    .replace(/^[-–:]+\s*/, "")
    .replace(/\s*[-–:,\.]\s*$/,"")
    .trim();

  if (!aiTitle || aiTitle.length < 2) {
    aiTitle = fallbackTitle(rawTitle, bodyText);
  }

  return { title: aiTitle, meta: { note, from: "ai" } };
}
