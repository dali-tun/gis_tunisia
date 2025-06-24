/* utils.js — fonctions utilitaires génériques */
export const female = v => Number(v?.['Féminin'] ?? v?.Feminin ?? v?.Female ?? v?.F ?? 0);
export const male   = v => Number(v?.Masculin ?? v?.Male ?? v?.M ?? 0);
export const safe   = (v, n = 1) => Number.isFinite(v) ? (+v).toFixed(n) : 'n/a';

/* Éclaircit une couleur hexadécimale */
export const lighten = (h, a = 40) => {
  const n = parseInt(h.slice(1), 16),
        clamp = t => Math.max(0, Math.min(255, t));
  const r = clamp((n >> 16) + a),
        g = clamp(((n >> 8) & 255) + a),
        b = clamp((n & 255) + a);
  return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}`;
};

/* Milieu d'une tranche d'âge */
export const ageMid = b => {
  if (!b) return null;
  return b.includes('+')
    ? +b.replace('+', '')
    : (+b.split(/[^0-9]/)[0] + +b.split(/[^0-9]/)[1]) / 2;
};