const STOPWORDS = new Set([
  "de", "du", "des", "le", "la", "les", "et", "en", "au", "aux",
  "un", "une", "l", "d", "a", "avec", "sans", "sur", "pour",
]);

function normalize(s) {
  if (!s) return "";
  return s
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(s) {
  return normalize(s)
    .split(" ")
    .filter(t => t.length > 1 && !STOPWORDS.has(t));
}

function jaccard(a, b) {
  const sa = new Set(tokenize(a));
  const sb = new Set(tokenize(b));
  if (!sa.size || !sb.size) return 0;
  const inter = [...sa].filter(x => sb.has(x)).length;
  const union = new Set([...sa, ...sb]).size;
  return inter / union;
}

/**
 * Returns up to `top` best Flipp items sorted by similarity score.
 * @param {string} productName
 * @param {Array}  items        — raw Flipp flyer_items
 * @param {number} top
 * @returns {{ item, score }[]}
 */
export function findTopMatches(productName, items, top = 3) {
  return items
    .map(item => ({ item, score: jaccard(productName, item.name ?? "") }))
    .filter(m => m.score > 0.08)
    .sort((a, b) => b.score - a.score)
    .slice(0, top);
}
