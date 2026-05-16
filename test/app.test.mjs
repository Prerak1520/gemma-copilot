import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Readable, Writable } from 'node:stream';

process.env.DB_PATH = join(tmpdir(), `gemma-copilot-test-${Date.now()}-${Math.random()}.db`);

const { createApp } = await import('../api/app.mjs');
const { db } = await import('../api/db.mjs');
const { search } = await import('../api/memory.mjs');
const { loadLatest } = await import('../api/skills.mjs');
const { parseJsonObject, validateAnalysisResult } = await import('../api/validation.mjs');

function injectJson(app, method, url, body) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? '' : JSON.stringify(body);
    const req = new Readable({
      read() {
        this.push(payload);
        this.push(null);
      }
    });
    req.method = method;
    req.url = url;
    req.headers = {
      host: '127.0.0.1',
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(payload)
    };

    const chunks = [];
    const res = new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(Buffer.from(chunk));
        callback();
      }
    });
    res.statusCode = 200;
    res.headers = {};
    res.setHeader = (key, value) => { res.headers[key.toLowerCase()] = value; };
    res.getHeader = key => res.headers[key.toLowerCase()];
    res.removeHeader = key => { delete res.headers[key.toLowerCase()]; };
    res.end = chunk => {
      if (chunk) chunks.push(Buffer.from(chunk));
      resolve({
        status: res.statusCode,
        text: Buffer.concat(chunks).toString('utf8'),
        json() { return JSON.parse(this.text || '{}'); }
      });
    };

    app.handle(req, res, reject);
  });
}

test('skill loader returns latest jd-analysis skill', () => {
  const skill = loadLatest('jd-analysis');
  assert.equal(skill.name, 'jd-analysis');
  assert.equal(typeof skill.version, 'number');
  assert.match(skill.body, /JD Analysis/);
});

test('memory search returns empty array for noisy query', () => {
  assert.deepEqual(search('the and for with you'), []);
});

test('parseJsonObject reports invalid JSON', () => {
  const parsed = parseJsonObject('{nope');
  assert.equal(parsed.ok, false);
  assert.deepEqual(parsed.errors, ['model returned invalid JSON']);
});

test('analysis validation rejects malformed model objects', () => {
  const result = validateAnalysisResult({
    ats_score: 130,
    fit_summary: '',
    matches: ['AI'],
    skills_gap: ['Kubernetes'],
    red_flags: [{ signal: 'vague', severity: 'urgent', evidence: '' }],
    salary_transparency: 'missing',
    salary_range: null,
    deal_breaker_hit: [],
    recommendation: 'maybe',
    rationale: 'weak'
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('ats_score must be between 0 and 100'));
  assert.ok(result.errors.includes('recommendation must be one of apply, tailor_first, skip'));
});

test('POST /analyze validates required and too-short job text', async () => {
  const app = createApp();

  const missing = await injectJson(app, 'POST', '/analyze', {});
  assert.equal(missing.status, 400);

  const short = await injectJson(app, 'POST', '/analyze', { jd_text: 'short' });
  assert.equal(short.status, 422);
  assert.equal(short.json().error, 'job_description_too_short');
});

test('POST /feedback validates run existence and saves notes', async () => {
  const app = createApp();

  const missing = await injectJson(app, 'POST', '/feedback', { run_id: 999999, thumbs: 1 });
  assert.equal(missing.status, 404);

  const runId = db.prepare(`
    INSERT INTO runs (skill_name, skill_version, model, input, output_json)
    VALUES (?, ?, ?, ?, ?)
  `).run('jd-analysis', 1, 'test-model', 'input', '{}').lastInsertRowid;

  const ok = await injectJson(app, 'POST', '/feedback', { run_id: runId, thumbs: -1, note: 'missed seniority mismatch' });
  assert.equal(ok.status, 200);

  const row = db.prepare('SELECT thumbs, note FROM feedback WHERE run_id = ?').get(runId);
  assert.equal(row.thumbs, -1);
  assert.equal(row.note, 'missed seniority mismatch');
});
