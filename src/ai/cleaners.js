// src/ai/cleaners.js
// Title/metadata cleaners for RapidApply SA
// v4: fixes QA/QC slash, AutoCAD casing, 'QS' acronym, 'in Saudi' -> 'in Saudi Arabia',
// preserves punctuation, balances parentheses, and safer titlecase.

const he = {
  decode: (s) =>
    s
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&nbsp;/g, " ")
      .replace(/&ndash;|&#8211;/g, "–")
      .replace(/&mdash;|&#8212;/g, "—")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">"),
};

const ACRONYMS = new Set([
  "QA", "QC", "QA/QC", "QS",
  "HSE", "ELV", "HVAC", "MEP", "PMO", "QAQC",
  "ARASCO", "KSA", "SAP", "CAD"
]);

const PROPER_CASE_OVERRIDES = new Map([
  ["Autocad", "AutoCAD"],
  ["Autocad,", "AutoCAD,"],
  ["Autocad.", "AutoCAD."],
  ["Qa", "QA"],
  ["Qc", "QC"],
  ["Qa/Qc", "QA/QC"],
  ["Qa Qc", "QA QC"],
  ["Qs", "QS"],
  ["Elv", "ELV"],
  ["Hse", "HSE"],
  ["Qa Qc Engineer", "QA/QC Engineer"],
]);

const SMALL_WORDS = new Set([
  "a","an","and","as","at","but","by","for","in","of","on","or","per","the","to","vs","via","with"
]);

const SAUDI_FIXES = [
  { re: /\bJobs in Saudi\b/gi, rep: "Jobs in Saudi Arabia" },
  { re: /\bin Saudi\b/gi, rep: "in Saudi Arabia" },
  { re: /\b–\s*Saudi\b/gi, rep: "– Saudi Arabia" },
];

function smartifyDashes(s) {
  // normalize hyphen-like sequences to en dashes where appropriate around words/spaces
  return s
    .replace(/\s*--\s*/g, " – ")
    .replace(/\s+-\s+/g, " – ")
    .replace(/\s+–\s+/g, " – ")
    .replace(/\s+—\s+/g, " — ");
}

function balanceParens(s) {
  const open = (s.match(/\(/g) || []).length;
  const close = (s.match(/\)/g) || []).length;
  if (open > close) {
    // append missing closers at end
    return s + ")".repeat(open - close);
  }
  return s;
}

function normalizeWhitespace(s) {
  return s.replace(/\s+/g, " ").trim();
}

function capitalizeWord(w) {
  if (!w) return w;
  // keep all-uppercase words as is (acronyms)
  if (ACRONYMS.has(w.toUpperCase())) return w.toUpperCase();
  // keep numeric tokens or tokens with digits/hyphens
  if (/[0-9]/.test(w)) return w;
  // mixed words like QA/QC
  if (w.includes("/")) {
    return w.split("/").map(capitalizeWord).join("/");
  }
  // keep camel-cased words
  if (/^[A-Z][a-z]+[A-Z]/.test(w)) return w;
  // titlecase basic
  return w[0].toUpperCase() + w.slice(1).toLowerCase();
}

function titleCase(s) {
  const parts = s.split(/(\s+)/); // keep spaces
  let wordIdx = 0;
  return parts
    .map((part) => {
      if (part.trim() === "") return part;
      const raw = part;

      // keep known acronyms & overrides
      const override = PROPER_CASE_OVERRIDES.get(raw);
      if (override) return override;

      const word = raw.replace(/^[("'\[]+|[)"'\].,:;!?]+$/g, ""); // strip leading/trailing punct for decision
      const lead = raw.slice(0, raw.indexOf(word));
      const trail = raw.slice(lead.length + word.length);

      let cased;
      if (wordIdx > 0 && wordIdx < s.split(/\s+/).length - 1 && SMALL_WORDS.has(word.toLowerCase())) {
        cased = word.toLowerCase();
      } else {
        cased = capitalizeWord(word);
      }
      wordIdx += 1;

      // re-attach punctuation
      const merged = (lead || "") + cased + (trail || "");

      // second pass overrides (handles punctuation-attached tokens)
      for (const [k, v] of PROPER_CASE_OVERRIDES) {
        if (merged === k) return v;
      }
      return merged;
    })
    .join("");
}

function normalizeQAQC(s) {
  // Various forms to canonical "QA/QC"
  return s
    .replace(/\bQA\s*\/\s*QC\b/gi, "QA/QC")
    .replace(/\bQA\s*QC\b/gi, "QA/QC")
    .replace(/\bQa\s*\/\s*Qc\b/g, "QA/QC")
    .replace(/\bQa\s*Qc\b/g, "QA/QC");
}

function properNouns(s) {
  // Specific site/location/name fixes that shouldn't be lowercased
  return s
    .replace(/\bRas\s+Tanura(h)?\b/gi, "Ras Tanurah")
    .replace(/\bSaudi\b/g, "Saudi Arabia");
}

export function cleanTitle(input) {
  if (!input) return "";

  let s = String(input);
  s = he.decode(s);
  s = s.replace(/\u00A0/g, " "); // nbsp
  s = normalizeWhitespace(s);
  s = smartifyDashes(s);
  s = normalizeQAQC(s);

  // Saudi phrasing fixes
  for (const { re, rep } of SAUDI_FIXES) s = s.replace(re, rep);

  // ensure AutoCAD casing
  s = s.replace(/\bAutocad\b/gi, "AutoCAD");

  // Make sure "QS" is uppercase when used as role
  s = s.replace(/\bQs\b/g, "QS");

  // Proper nouns & geography
  s = properNouns(s);

  // Title case with small-word rules & overrides
  s = titleCase(s);

  // If a title ends like "(civil" etc., try to capitalize inner content and close paren
  s = s.replace(/\(([^)]+)$/g, (m, inner) => `(${titleCase(inner)})`);
  s = balanceParens(s);

  // Trim trailing dangling punctuation like " –", ":"; keep if meaningful
  s = s.replace(/\s+[-–—:]$/g, "").trim();

  return s;
}

// Category normalization if needed later
const CATEGORY_ALIASES = new Map([
  ["HSE & Safety", "HSE & Safety"],
  ["Civil", "Civil Engineering"],
  ["Electrical", "Electrical Engineering"],
  ["Procurement", "Procurement"],
  ["Document Control", "Document Control & Admin"],
]);

export function cleanCategory(input) {
  if (!input) return "";
  let s = normalizeWhitespace(he.decode(String(input)));
  // Apply simple alias mapping
  const hit = CATEGORY_ALIASES.get(s) || CATEGORY_ALIASES.get(titleCase(s));
  return hit || titleCase(s);
}

export function cleanLocation(input) {
  if (!input) return "";
  let s = normalizeWhitespace(he.decode(String(input)));
  // Expand "Saudi" -> "Saudi Arabia"
  s = s.replace(/\bSaudi\b/g, "Saudi Arabia");
  // Canonicalize KSA
  s = s.replace(/\bKSA\b/g, "Saudi Arabia");
  return s;
}

// Convenience wrapper used by pipeline
export default {
  cleanTitle,
  cleanCategory,
  cleanLocation,
};
