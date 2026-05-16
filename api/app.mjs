import express from 'express';
import cors from 'cors';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './db.mjs';
import { generate, getOllamaStatus } from './ollama.mjs';
import { loadLatest } from './skills.mjs';
import { search, formatContext } from './memory.mjs';
import { makePartialFailure, parseJsonObject, validateAnalysisResult } from './validation.mjs';
import { generateResume, getResume, listResumes, listTemplates } from './resume.mjs';
import { renderMarkdownPdf } from './pdf.mjs';

const SKILLS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills');

const EDGE_MODEL = process.env.EDGE_MODEL || 'gemma4:e2b';
const DEEP_MODEL = process.env.DEEP_MODEL || 'gemma4:26b';
const SCREENSHOT_MODEL = process.env.SCREENSHOT_MODEL || '';
const EXTRA_ALLOWED_ORIGINS = (process.env.API_ALLOWED_ORIGINS || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

function allowedOrigin(origin, callback) {
  if (!origin) return callback(null, true);
  if (origin.startsWith('chrome-extension://')) return callback(null, true);

  try {
    const { hostname } = new URL(origin);
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return callback(null, true);
    }
  } catch {
    return callback(new Error('Invalid CORS origin'));
  }

  if (EXTRA_ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
  return callback(new Error('CORS origin not allowed'));
}

function persistJob({ url, company, title, jd_text }) {
  if (!url) return null;
  const existing = db.prepare('SELECT id FROM jobs WHERE url = ?').get(url);
  if (existing) {
    db.prepare(`
      UPDATE jobs
      SET company = COALESCE(?, company),
          title = COALESCE(?, title),
          jd_text = CASE WHEN length(?) > length(COALESCE(jd_text, '')) THEN ? ELSE jd_text END
      WHERE id = ?
    `).run(company || null, title || null, jd_text || '', jd_text || '', existing.id);
    return existing.id;
  }
  return db.prepare('INSERT INTO jobs (url, company, title, jd_text) VALUES (?, ?, ?, ?)')
    .run(url, company || null, title || null, jd_text || null).lastInsertRowid;
}

async function extractTextFromScreenshot(screenshotDataUrl) {
  if (!SCREENSHOT_MODEL || !screenshotDataUrl) return '';
  const base64 = String(screenshotDataUrl).split(',')[1];
  if (!base64) return '';
  const prompt = 'Extract the visible job description text from this screenshot. Return plain text only.';
  try {
    return await generate({
      model: SCREENSHOT_MODEL,
      prompt,
      format: 'text',
      images: [base64],
      temperature: 0
    });
  } catch {
    return '';
  }
}

export function createApp() {
  const app = express();
  app.use(cors({ origin: allowedOrigin }));
  app.use(express.json({ limit: '8mb' }));

  app.get('/health', async (_req, res) => {
    const ollama = await getOllamaStatus([EDGE_MODEL, DEEP_MODEL, SCREENSHOT_MODEL].filter(Boolean));
    res.json({ ok: ollama.ok, edge: EDGE_MODEL, deep: DEEP_MODEL, screenshot: SCREENSHOT_MODEL || null, ollama });
  });

  app.post('/analyze', async (req, res) => {
    try {
      const { jd_text, url, title, company, screenshot_data_url } = req.body;
      let inputText = typeof jd_text === 'string' ? jd_text.trim() : '';
      if (inputText.length < 200 && screenshot_data_url) {
        const extracted = await extractTextFromScreenshot(screenshot_data_url);
        if (extracted.trim().length > inputText.length) inputText = extracted.trim();
      }
      if (!inputText) return res.status(400).json({ error: 'jd_text required' });
      if (inputText.length < 200) {
        return res.status(422).json({
          error: 'job_description_too_short',
          message: 'Could not extract enough job text. On LinkedIn, open the full job details panel or select the JD text before retrying.',
          text_length: inputText.length,
          captured_screenshot: Boolean(screenshot_data_url),
          screenshot_model_configured: Boolean(SCREENSHOT_MODEL)
        });
      }

      const skill = loadLatest('jd-analysis');
      const memoryRows = search(inputText);
      const context = formatContext(memoryRows);
      const prompt = `${skill.body}\n\n## USER_CONTEXT\n${context}\n\n## JD_TEXT\n${inputText}\n\nReturn JSON only.`;
      const raw = await generate({ model: EDGE_MODEL, prompt, format: 'json' });
      const parsed = parseJsonObject(raw);
      const validation = parsed.ok ? validateAnalysisResult(parsed.value) : { ok: false, errors: parsed.errors };
      const responseResult = validation.ok
        ? parsed.value
        : makePartialFailure({ skill, model: EDGE_MODEL, raw: parsed.raw || raw, errors: validation.errors, result: parsed.value });

      const jobId = persistJob({ url, company, title, jd_text: inputText });
      const runId = db.prepare(`
        INSERT INTO runs (skill_name, skill_version, model, input, output_json, job_id, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        'jd-analysis',
        skill.version,
        EDGE_MODEL,
        inputText.slice(0, 4000),
        JSON.stringify(responseResult),
        jobId,
        validation.ok ? 'ok' : 'partial_failure'
      ).lastInsertRowid;

      const payload = {
        status: validation.ok ? 'ok' : 'partial_failure',
        run_id: runId,
        job_id: jobId,
        skill_version: skill.version,
        memory_used: memoryRows.map(r => ({ title: r.title, source: r.source })),
        result: responseResult
      };
      res.status(validation.ok ? 200 : 206).json(payload);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/coach', async (req, res) => {
    try {
      const { question, answer } = req.body;
      if (!question || !answer) return res.status(400).json({ error: 'question and answer required' });

      const skill = loadLatest('star-coach');
      const memoryRows = search(`${question}\n${answer}`);
      const context = formatContext(memoryRows);
      const prompt = `${skill.body}\n\n## USER_CONTEXT\n${context}\n\n## QUESTION\n${question}\n\n## ANSWER\n${answer}\n\nReturn JSON only.`;
      const raw = await generate({ model: DEEP_MODEL, prompt, format: 'json', temperature: 0.3 });
      const parsed = parseJsonObject(raw);
      const result = parsed.ok ? parsed.value : makePartialFailure({ skill, model: DEEP_MODEL, raw, errors: parsed.errors });

      const runId = db.prepare(`
        INSERT INTO runs (skill_name, skill_version, model, input, output_json, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('star-coach', skill.version, DEEP_MODEL, `Q: ${question}\nA: ${answer}`, JSON.stringify(result), parsed.ok ? 'ok' : 'partial_failure').lastInsertRowid;

      res.status(parsed.ok ? 200 : 206).json({ status: parsed.ok ? 'ok' : 'partial_failure', run_id: runId, skill_version: skill.version, result });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/feedback', (req, res) => {
    const { run_id, thumbs, note } = req.body;
    if (!run_id || thumbs === undefined) return res.status(400).json({ error: 'run_id and thumbs required' });
    if (![1, -1].includes(Number(thumbs))) return res.status(400).json({ error: 'thumbs must be 1 or -1' });
    const run = db.prepare('SELECT id FROM runs WHERE id = ?').get(run_id);
    if (!run) return res.status(404).json({ error: 'run not found' });
    db.prepare('INSERT INTO feedback (run_id, thumbs, note) VALUES (?, ?, ?)').run(run_id, Number(thumbs), note || null);
    res.json({ ok: true });
  });

  app.get('/memory/search', (req, res) => {
    const q = req.query.q || '';
    res.json({ results: search(q, 10) });
  });

  app.get('/jobs', (req, res) => {
    const rows = db.prepare(`
      SELECT j.id, j.url, j.company, j.title, j.saved_at,
             (SELECT output_json FROM runs WHERE job_id = j.id ORDER BY id DESC LIMIT 1) AS latest_analysis,
             (SELECT count(*) FROM runs WHERE job_id = j.id) AS analysis_count
      FROM jobs j ORDER BY j.saved_at DESC LIMIT 100
    `).all();
    res.json({ jobs: rows });
  });

  app.get('/jobs/:id/runs', (req, res) => {
    const rows = db.prepare(`
      SELECT id, skill_name, skill_version, model, input, output_json, created_at, status
      FROM runs WHERE job_id = ? ORDER BY id DESC LIMIT 20
    `).all(req.params.id);
    res.json({ runs: rows });
  });

  app.get('/runs', (req, res) => {
    const skillName = req.query.skill || null;
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const sql = `
      SELECT r.id, r.skill_name, r.skill_version, r.model, r.input, r.output_json,
             r.job_id, r.created_at, r.status,
             (SELECT thumbs FROM feedback WHERE run_id = r.id ORDER BY created_at DESC LIMIT 1) AS thumbs,
             (SELECT note FROM feedback WHERE run_id = r.id ORDER BY created_at DESC LIMIT 1) AS note
      FROM runs r
      ${skillName ? 'WHERE r.skill_name = ?' : ''}
      ORDER BY r.id DESC LIMIT ?
    `;
    const rows = skillName
      ? db.prepare(sql).all(skillName, limit)
      : db.prepare(sql).all(limit);
    res.json({ runs: rows });
  });

  app.get('/skills', (_req, res) => {
    const files = readdirSync(SKILLS_DIR).filter(f => f.endsWith('.md'));
    const grouped = {};
    for (const f of files) {
      const m = f.match(/^(.+)\.v(\d+)\.md$/);
      if (!m) continue;
      const [, name, v] = m;
      grouped[name] = grouped[name] || [];
      grouped[name].push(parseInt(v, 10));
    }
    const skills = Object.entries(grouped).map(([name, versions]) => ({
      name,
      versions: versions.sort((a, b) => b - a)
    }));
    res.json({ skills });
  });

  app.get('/skills/:name/:version', (req, res) => {
    const { name, version } = req.params;
    const file = join(SKILLS_DIR, `${name}.v${version}.md`);
    try {
      const body = readFileSync(file, 'utf8');
      res.json({ name, version: parseInt(version, 10), body });
    } catch {
      res.status(404).json({ error: 'skill version not found' });
    }
  });

  app.get('/reflections', (_req, res) => {
    const rows = db.prepare(`
      SELECT id, skill_name, from_version, to_version, rationale, created_at, status, candidate_path
      FROM reflections ORDER BY id DESC LIMIT 100
    `).all();
    res.json({ reflections: rows });
  });

  app.get('/resume/templates', (_req, res) => {
    try {
      res.json({ templates: listTemplates() });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/resumes', (_req, res) => {
    res.json({ resumes: listResumes() });
  });

  app.post('/resume/generate', async (req, res) => {
    try {
      const { job_id, template_name } = req.body;
      if (!job_id || !template_name) return res.status(400).json({ error: 'job_id and template_name required' });
      const resume = await generateResume({ jobId: job_id, templateName: template_name, deepModel: DEEP_MODEL });
      res.json(resume);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/resume/:id', (req, res) => {
    const resume = getResume(req.params.id);
    if (!resume) return res.status(404).json({ error: 'resume not found' });
    res.json(resume);
  });

  app.get('/resume/:id/pdf', (req, res) => {
    const resume = getResume(req.params.id);
    if (!resume) return res.status(404).json({ error: 'resume not found' });
    const pdf = renderMarkdownPdf(resume.markdown);
    res.setHeader('content-type', 'application/pdf');
    res.setHeader('content-disposition', `attachment; filename="resume-${resume.id}.pdf"`);
    res.send(pdf);
  });

  return app;
}
