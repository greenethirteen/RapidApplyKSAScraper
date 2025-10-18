import fs from 'fs';
import path from 'path';
import admin from 'firebase-admin';

const PROJECT_ID  = process.env.PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'sojoblessbh-d7b54';
const DATABASE_URL = process.env.DATABASE_URL || `https://${PROJECT_ID}-default-rtdb.firebaseio.com`;

function readLocalServiceAccount() {
  const p = path.join(process.cwd(), 'serviceAccount.json');
  if (fs.existsSync(p)) {
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch {}
  }
  return null;
}

function resolveCredential() {
  // 1) Full JSON in one env var
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const json = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      return admin.credential.cert(json);
    } catch (e) {
      console.warn('[firebase] Could not parse FIREBASE_SERVICE_ACCOUNT JSON:', e?.message || e);
    }
  }
  // 2) Split env vars (easy to paste)
  if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    const key = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
    return admin.credential.cert({
      project_id: PROJECT_ID,
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      private_key: key,
    });
  }
  // 3) Local file in repo root
  const local = readLocalServiceAccount();
  if (local) return admin.credential.cert(local);

  // 4) GOOGLE_APPLICATION_CREDENTIALS or GCP metadata
  return admin.credential.applicationDefault();
}

function initAdmin() {
  if (admin.apps.length) return admin;
  const cred = resolveCredential();
  admin.initializeApp({ credential: cred, databaseURL: DATABASE_URL });
  return admin;
}

export const adminApp = initAdmin();
export const db = admin.database();
