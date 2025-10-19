// src/ai/cleaners.js
// OpenAI-only cleaners — no heuristic fallback.
import OpenAI from "openai";

const key = process.env.OPENAI_API_KEY?.trim();
if (!key) {
  throw new Error("[Fatal] OPENAI_API_KEY is required (AI mandatory).");
}
export const openai = new OpenAI({ apiKey: key });

const MODEL = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";

async function callOpenAI(system, user, max_tokens = 200) {
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const resp = await openai.chat.completions.create({
        model: MODEL,
        temperature: 0.2,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user }
        ],
        max_tokens
      });
      const text = resp?.choices?.[0]?.message?.content?.trim();
      if (text) return text;
      throw new Error("Empty OpenAI response");
    } catch (e) {
      lastErr = e;
      await new Promise(r => setTimeout(r, 150 * attempt));
    }
  }
  throw lastErr || new Error("OpenAI call failed");
}

export function safeText(v) {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.filter(Boolean).join(" ").trim();
  return String(v ?? "").trim();
}

export async function ensureTitle(possibleTitle = "", bodyText = "") {
  possibleTitle = safeText(possibleTitle);
  bodyText = safeText(bodyText);
  const sys = "Infer a precise professional job title if missing/weak. Output only Title Case text.";
  const usr = `Given Title: ${possibleTitle || "(none)"}\nBody: ${bodyText}`;
  const out = await callOpenAI(sys, usr, 50);
  return out.replace(/\s+/g, " ").trim();
}

export async function cleanTitle(rawTitle = "", bodyText = "") {
  rawTitle = safeText(rawTitle);
  bodyText = safeText(bodyText);
  const sys = "Normalize job titles. Output only the final Title Case role (no fluff, no location, no urgency, no punctuation).";
  const usr = `Raw Title: ${rawTitle}\nBody: ${bodyText}`;
  const out = await callOpenAI(sys, usr, 50);
  return out.replace(/\s+/g, " ").trim();
}

export async function cleanLocation(rawTitle = "", bodyText = "") {
  rawTitle = safeText(rawTitle);
  bodyText = safeText(bodyText);
  const sys = "Extract location. Output only city or 'Saudi Arabia'. If unknown, return 'Saudi Arabia'.";
  const usr = `Title: ${rawTitle}\nBody: ${bodyText}`;
  const out = await callOpenAI(sys, usr, 30);
  return out.replace(/\s+/g, " ").trim() || "Saudi Arabia";
}

export async function summarizeSnippet(bodyText = "") {
  bodyText = safeText(bodyText);
  const sys = "Return one concise sentence (<=30 words) summarizing role & key requirements. No headings or lists.";
  const usr = `Body:\n${bodyText}`;
  const out = await callOpenAI(sys, usr, 80);
  return out.replace(/\s+/g, " ").trim();
}

export async function guessCategory(cleanedTitle = "", bodyText = "") {
  cleanedTitle = safeText(cleanedTitle);
  bodyText = safeText(bodyText);
  const sys = "Classify role into ONE of: Civil Engineering, Electrical (Power/ELV), Mechanical (MEP), HSE & Safety, QA/QC, Project Management, Procurement, Planning, General Engineering, Other. Output the category only.";
  const usr = `Title: ${cleanedTitle}\nBody: ${bodyText}`;
  const out = await callOpenAI(sys, usr, 22);
  return out.replace(/\s+/g, " ").trim();
}

export async function extractEmailsAI(bodyText = "") {
  bodyText = safeText(bodyText);
  const sys = "Extract valid emails. Output JSON array of unique lowercase emails, [] if none.";
  const usr = `Text:\n${bodyText}`;
  const out = await callOpenAI(sys, usr, 120);
  try {
    const s = out.indexOf("["), e = out.lastIndexOf("]");
    if (s >= 0 && e > s) {
      const arr = JSON.parse(out.slice(s, e+1));
      const uniq = Array.from(new Set(arr.map(x => String(x).trim().toLowerCase())));
      return uniq;
    }
  } catch {}
  const regex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
  const fallback = bodyText.match(regex) || [];
  return Array.from(new Set(fallback.map(e => e.toLowerCase())));
}

// doctor helper for quick key preflight
export async function __doctor() {
  try {
    const txt = await callOpenAI("Health check", "Reply with OK", 3);
    return /ok/i.test(txt);
  } catch {
    return false;
  }
}
