import { db } from './db.mjs';

// Sanitize free text into a safe FTS5 MATCH expression.
// We tokenize, drop short/noisy tokens, and OR them together with quoting.
function toMatchQuery(text, max = 12) {
  const tokens = (text.toLowerCase().match(/[a-z0-9]{3,}/g) || [])
    .filter(t => !STOPWORDS.has(t))
    .slice(0, max);
  if (!tokens.length) return null;
  return tokens.map(t => `"${t}"`).join(' OR ');
}

const STOPWORDS = new Set([
  'the','and','for','with','you','your','will','have','our','this','that','are','from','they','their',
  'has','had','was','were','but','not','can','any','all','who','what','where','when','how','why','its'
]);

export function search(text, limit = 6) {
  const q = toMatchQuery(text);
  if (!q) return [];
  try {
    return db.prepare(`
      SELECT m.id, m.source, m.title, m.chunk, bm25(memory_fts) AS rank
      FROM memory_fts
      JOIN memory m ON m.id = memory_fts.rowid
      WHERE memory_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `).all(q, limit);
  } catch {
    return [];
  }
}

export function formatContext(rows) {
  if (!rows.length) return '(no relevant memory found)';
  return rows.map(r => `### ${r.title} (${r.source})\n${r.chunk}`).join('\n\n');
}
