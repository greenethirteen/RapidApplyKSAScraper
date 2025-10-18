// src/writer.js
import admin from "firebase-admin";

let appInited = false;
function ensureFirebase() {
  if (appInited) return;
  const svc = process.env.FIREBASE_SERVICE_ACCOUNT
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    : null;
  if (!svc) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT missing or invalid JSON");
  }
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(svc),
      databaseURL: process.env.DATABASE_URL,
    });
  }
  appInited = true;
}

export async function writeJob(job) {
  ensureFirebase();
  const db = admin.database();
  const JOBS_PATH = process.env.JOBS_PATH || "/jobs_sa";
  const ref = db.ref(`${JOBS_PATH}/${job.id}`);
  const payload = {
    id: job.id,
    source: job.source || "saudijobs.in",
    apply_url: job.apply_url || "",
    title: job.title || "",
    description_snippet: job.description_snippet || "",
    category: job.category || "Other",
    company: job.company || "",
    location: job.location || "Saudi Arabia",
    country: job.country || "SA",
    salary: job.salary || "",
    posted_at: job.posted_at || new Date().toISOString(),
    scraped_at: job.scraped_at || new Date().toISOString(),
    last_updated: new Date().toISOString(),
  };
  await ref.set(payload);
  return payload;
}

export default { writeJob };
