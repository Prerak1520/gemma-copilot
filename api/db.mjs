import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const DB_PATH = process.env.DB_PATH || new URL('../data/copilot.db', import.meta.url).pathname;
mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');

db.exec(`
  CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY,
    url TEXT UNIQUE,
    company TEXT,
    title TEXT,
    jd_text TEXT,
    saved_at INTEGER DEFAULT (unixepoch())
  );
  CREATE TABLE IF NOT EXISTS runs (
    id INTEGER PRIMARY KEY,
    skill_name TEXT,
    skill_version INTEGER,
    model TEXT,
    input TEXT,
    output_json TEXT,
    job_id INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'ok',
    created_at INTEGER DEFAULT (unixepoch())
  );
  CREATE TABLE IF NOT EXISTS feedback (
    run_id INTEGER REFERENCES runs(id) ON DELETE CASCADE,
    thumbs INTEGER,
    note TEXT,
    created_at INTEGER DEFAULT (unixepoch())
  );
  CREATE TABLE IF NOT EXISTS reflections (
    id INTEGER PRIMARY KEY,
    skill_name TEXT,
    from_version INTEGER,
    to_version INTEGER,
    rationale TEXT,
    status TEXT DEFAULT 'applied',
    candidate_path TEXT,
    created_at INTEGER DEFAULT (unixepoch())
  );
  CREATE TABLE IF NOT EXISTS memory (
    id INTEGER PRIMARY KEY,
    source TEXT,
    title TEXT,
    chunk TEXT,
    created_at INTEGER DEFAULT (unixepoch())
  );
  CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(
    title, chunk, content='memory', content_rowid='id'
  );
  CREATE TRIGGER IF NOT EXISTS memory_ai AFTER INSERT ON memory BEGIN
    INSERT INTO memory_fts(rowid, title, chunk) VALUES (new.id, new.title, new.chunk);
  END;
  CREATE TRIGGER IF NOT EXISTS memory_ad AFTER DELETE ON memory BEGIN
    INSERT INTO memory_fts(memory_fts, rowid, title, chunk) VALUES('delete', old.id, old.title, old.chunk);
  END;
  CREATE TABLE IF NOT EXISTS resumes (
    id INTEGER PRIMARY KEY,
    job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
    template_name TEXT NOT NULL,
    markdown TEXT NOT NULL,
    created_at INTEGER DEFAULT (unixepoch())
  );
`);

function addColumnIfMissing(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all().map(row => row.name);
  if (!columns.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
}

addColumnIfMissing('runs', 'status', "TEXT DEFAULT 'ok'");
addColumnIfMissing('reflections', 'status', "TEXT DEFAULT 'applied'");
addColumnIfMissing('reflections', 'candidate_path', 'TEXT');

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_runs_skill_name ON runs(skill_name);
  CREATE INDEX IF NOT EXISTS idx_runs_job_id ON runs(job_id);
  CREATE INDEX IF NOT EXISTS idx_runs_created_at ON runs(created_at);
  CREATE INDEX IF NOT EXISTS idx_feedback_run_id ON feedback(run_id);
  CREATE INDEX IF NOT EXISTS idx_jobs_saved_at ON jobs(saved_at);
`);
