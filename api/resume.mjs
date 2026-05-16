import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './db.mjs';
import { generate } from './ollama.mjs';
import { search, formatContext } from './memory.mjs';
import { loadLatest } from './skills.mjs';

const TEMPLATES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'resumes', 'templates');

export function listTemplates() {
  return readdirSync(TEMPLATES_DIR)
    .filter(f => f.endsWith('.md'))
    .map(f => f.replace('.md', ''));
}

export function loadTemplate(name) {
  const file = join(TEMPLATES_DIR, `${name}.md`);
  return readFileSync(file, 'utf8');
}

export async function generateResume({ jobId, templateName, deepModel }) {
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId);
  if (!job) throw new Error(`Job ${jobId} not found`);

  const latestRun = db.prepare(
    'SELECT output_json FROM runs WHERE job_id = ? AND skill_name = ? ORDER BY id DESC LIMIT 1'
  ).get(jobId, 'jd-analysis');

  const template = loadTemplate(templateName);
  const searchQuery = [job.title, job.company, job.jd_text].filter(Boolean).join(' ').slice(0, 500);
  const memoryRows = search(searchQuery, 8);
  const context = formatContext(memoryRows);
  const skill = loadLatest('resume-tailor');

  const jdAnalysis = latestRun?.output_json || '{}';
  const jdText = job.jd_text || '';

  const prompt = [
    skill.body,
    '',
    '## USER_CONTEXT',
    context,
    '',
    '## JD_ANALYSIS',
    jdAnalysis,
    '',
    '## JD_TEXT',
    jdText.slice(0, 3000),
    '',
    '## BASE_RESUME',
    template,
    '',
    'Output the tailored resume in markdown only. No code fences, no commentary.'
  ].join('\n');

  const markdown = await generate({ model: deepModel, prompt, format: null, temperature: 0.3 });

  const id = db.prepare(
    'INSERT INTO resumes (job_id, template_name, markdown) VALUES (?, ?, ?)'
  ).run(jobId, templateName, markdown).lastInsertRowid;

  return { id, jobId, templateName, markdown };
}

export function getResume(id) {
  return db.prepare('SELECT * FROM resumes WHERE id = ?').get(id);
}

export function listResumes() {
  return db.prepare(`
    SELECT r.id, r.job_id, r.template_name, r.created_at,
           j.company, j.title, j.url
    FROM resumes r
    LEFT JOIN jobs j ON j.id = r.job_id
    ORDER BY r.id DESC LIMIT 100
  `).all();
}
