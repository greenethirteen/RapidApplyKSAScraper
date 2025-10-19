// src/firebase.js
import fs from "fs";
import path from "path";
import admin from "firebase-admin";

let db = null;
let initTried = false;

export async function initFirebase() {
  if (initTried) return db;
  initTried = true;

  // Allow opting out completely
  if (process.env.FIREBASE_DISABLED === "1") {
    console.log("[firebase] writing disabled via FIREBASE_DISABLED=1");
    return null;
  }

  // Try service account first (local dev)
  let credential = null;
  let projectId = process.env.PROJECT_ID || process.env.FIREBASE_PROJECT_ID || undefined;
  let databaseURL = process.env.DATABASE_URL || (projectId ? `https://${projectId}-default-rtdb.firebaseio.com` : undefined);

  const saPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.resolve(process.cwd(), "serviceAccount.json");
  if (fs.existsSync(saPath)) {
    try {
      const sa = JSON.parse(fs.readFileSync(saPath, "utf8"));
      credential = admin.credential.cert(sa);
      projectId = projectId || sa.project_id;
      databaseURL = databaseURL || `https://${projectId}-default-rtdb.firebaseio.com`;
    } catch (e) {
      console.warn("[firebase] could not read serviceAccount.json:", e.message);
    }
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.warn(`[firebase] GOOGLE_APPLICATION_CREDENTIALS set but file not found: ${saPath}`);
  }

  // Fallback to ADC (works on GCP/Cloud Run), but prints friendly errors locally
  if (!credential) {
    try {
      credential = admin.credential.applicationDefault();
    } catch (e) {
      console.warn("[firebase] applicationDefault() unavailable. Provide serviceAccount.json or set FIREBASE_DISABLED=1 for dry-run.");
      return null;
    }
  }

  if (!databaseURL) {
    console.warn("[firebase] DATABASE_URL not set and could not infer from PROJECT_ID. Skipping writes.");
    return null;
  }

  try {
    admin.initializeApp({ credential, databaseURL });
    db = admin.database();
    console.log("[firebase] initialized");
  } catch (e) {
    console.warn("[firebase] init failed:", e.message);
    db = null;
  }
  return db;
}

export function getDb() {
  return db;
}
