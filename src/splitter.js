// Splits multi-role posts into individual role records when content lists roles
const ROLE_HINTS = /(positions?|roles?)\b.*:|following positions|we are hiring|openings?\b/i;

export function splitMultiRoles(raw) {
  const title = raw.title || '';
  const desc  = raw.description || '';
  const blob  = `${title}\n${desc}`;

  if (!ROLE_HINTS.test(blob)) return [raw];

  const lines   = desc.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  const bullets = lines.filter(l => /^[•\-\*\u2022]/.test(l) || /^\d+\./.test(l));

  const roles = bullets
    .map(l => l.replace(/^[•\-\*\u2022]\s*/, '').replace(/^\d+\.\s*/, ''))
    .filter(l => /engineer|officer|supervisor|manager|surveyor|controller/i.test(l))
    .slice(0, 12);

  if (!roles.length) return [raw];

  return roles.map(r => ({ ...raw, title: r }));
}
