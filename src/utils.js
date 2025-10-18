import crypto from 'crypto';

export const sha1   = (s) => crypto.createHash('sha1').update(String(s||'')).digest('hex');
export const nowIso = () => new Date().toISOString();
export const clampIso = (iso) => {
  try {
    if (!iso) return null;
    const d = new Date(iso);
    return isNaN(+d) ? null : d.toISOString();
  } catch {
    return null;
  }
}
