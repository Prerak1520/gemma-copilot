// Copy career-wiki markdown into data/wiki-snapshot/ and index into FTS5.
// Run once. Re-running is safe (uses INSERT OR REPLACE semantics via clear+reinsert).

import { readdirSync, readFileSync, mkdirSync, cpSync, rmSync, existsSync } from 'node:fs';
import { join, relative, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from '../api/db.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const WIKI_SRC = process.env.WIKI_SOURCE || '/Users/prerak/claude /career-wiki';
const SNAPSHOT = join(ROOT, 'data', 'wiki-snapshot');

if (!existsSync(WIKI_SRC)) {
  console.error(`Wiki source not found: ${WIKI_SRC}`);
  process.exit(1);
}

console.log(`Copying ${WIKI_SRC} -> ${SNAPSHOT}`);
rmSync(SNAPSHOT, { recursive: true, force: true });
mkdirSync(SNAPSHOT, { recursive: true });
cpSync(WIKI_SRC, SNAPSHOT, { recursive: true });

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    if (entry.name === 'node_modules') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile() && extname(entry.name) === '.md') yield full;
  }
}

// Chunk markdown by H2/H3 headings, fall back to 1500-char windows.
function chunk(text) {
  const sections = text.split(/\n(?=##\s)/g);
  const out = [];
  for (const sec of sections) {
    if (sec.length <= 1800) { out.push(sec.trim()); continue; }
    for (let i = 0; i < sec.length; i += 1500) out.push(sec.slice(i, i + 1500).trim());
  }
  return out.filter(c => c.length > 50);
}

db.exec('DELETE FROM memory; INSERT INTO memory_fts(memory_fts) VALUES (\'rebuild\');');

const insert = db.prepare('INSERT INTO memory (source, title, chunk) VALUES (?, ?, ?)');
let count = 0;
for (const file of walk(SNAPSHOT)) {
  const rel = relative(SNAPSHOT, file);
  const content = readFileSync(file, 'utf8');
  const firstHeading = content.match(/^#\s+(.+)$/m)?.[1] || rel;
  for (const c of chunk(content)) {
    insert.run(rel, firstHeading, c);
    count++;
  }
}

console.log(`Indexed ${count} chunks from career-wiki into memory_fts.`);
