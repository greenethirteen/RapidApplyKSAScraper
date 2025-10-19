// src/pipeline.js
// Await async cleaners; expand multi-role posts first; preserve your guards & writes

import crypto from "crypto";
import { cleanTitle, cleanLocation, summarizeSnippet } from "./ai/cleaners.js";
import { chooseCategory } from "./category.js";
import { writeJob } from "./writer.js";
import { splitMultiRoles } from "./splitter.js";

function sha1(s){ return crypto.createHash("sha1").update(String(s||"")).digest("hex"); }

function coerceISODate(raw){
  if (!raw || typeof raw !== "string") return new Date().toISOString();
  let s = raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  s = s.replace(/\b(Apply Now|Report Ad|Share|Save)\b/gi, " ").trim();
  const t = Date.parse(s); if (!isNaN(t)) return new Date(t).toISOString();
  const m1 = s.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/);
  if (m1){ const [_,d,m,y]=m1; const yyyy = (y.length===2 ? "20"+y : y); const dt = new Date(Number(yyyy), Number(m)-1, Number(d)); if (!isNaN(+dt)) return dt.toISOString(); }
  const MONTHS={jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
  const m2 = s.match(/\b(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})\b/);
  if (m2){ const d=Number(m2[1]); const mon=MONTHS[m2[2].slice(0,3).toLowerCase()]; const y=Number(m2[3]); if (mon!=null) return new Date(y,mon,d).toISOString(); }
  const m3 = s.match(/\b([A-Za-z]{3,})\s+(\d{1,2}),\s*(\d{4})\b/);
  if (m3){ const mon=MONTHS[m3[1].slice(0,3).toLowerCase()]; const d=Number(m3[2]); const y=Number(m3[3]); if (mon!=null) return new Date(y,mon,d).toISOString(); }
  return new Date().toISOString();
}

async function processOne(raw){
  const base = await cleanTitle(
    raw.title,
    { pageUrl: raw.url || raw.apply_url || "", company: raw.company || "", location: raw.location || "", description: raw.description || raw.snippet || "" }
  );
  const title = base; // cleaner returns final validated title, or "" to signal multi-role
  const location = cleanLocation(raw.location);
  const description_snippet = await summarizeSnippet(raw.description || raw.snippet || "");

  const category = chooseCategory(title, description_snippet || raw.description || "");

  const posted_at = coerceISODate(raw.posted_at || raw.dateText || "");
  const id = sha1((raw.url || raw.apply_url || "") + "|" + title);

  // Your original guard
  const isSuspect = title === "Senior Data Analyst";
  const isDataCat = /(data|analyst|analytics|bi|business intelligence)/i.test(category);
  if (isSuspect && !isDataCat) {
    throw new Error("Guard: refusing to write suspicious generic title 'Senior Data Analyst' for non-data category");
  }

  const job = {
    id,
    url: raw.url || raw.apply_url || "",
    apply_url: raw.apply_url || raw.url || "",
    source: raw.source || "saudijobs.in",
    title,
    description: raw.description || "",
    description_snippet,
    category,
    company: raw.company || "",
    location: location || "Saudi Arabia",
    country: raw.country || "SA",
    salary: raw.salary || "",
    posted_at,
    scraped_at: raw.scraped_at || new Date().toISOString(),
    last_updated: new Date().toISOString(),
    multi_source_title: raw.multi_source_title || ""
  };

  if (process.env.DEBUG_TITLES === "1") {
    console.log("[WROTE]", { title: job.title, category: job.category, location: job.location, id: job.id });
  }

  return await writeJob(job);
}

export async function aiCleanupAndWrite(raw){
  // Split BEFORE cleaning individual items: the cleaner returns "" for multi-headings, but
  // we also detect via splitter on description/title keywords.
  const expanded = splitMultiRoles(raw);
  const results = [];
  for (const item of expanded){
    results.push(await processOne(item));
  }
  return results.length === 1 ? results[0] : results;
}

export default aiCleanupAndWrite;
