// Reflection loop: read recent runs + feedback for a skill, ask the deep model
// to rewrite the skill. Writes skills/<name>.v(n+1).md and logs a reflection row.

import { db } from '../api/db.mjs';
import { generate } from '../api/ollama.mjs';
import { loadLatest, writeCandidate, writeNext } from '../api/skills.mjs';

const DEEP_MODEL = process.env.DEEP_MODEL || 'gemma4:26b';
const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const positional = args.filter(arg => arg !== '--apply');
const SKILL = positional[0] || 'jd-analysis';
const N = parseInt(positional[1] || '10', 10);

const skill = loadLatest(SKILL);
const runs = db.prepare(`
  SELECT r.id, r.input, r.output_json, f.thumbs, f.note
  FROM runs r LEFT JOIN feedback f ON f.run_id = r.id
  WHERE r.skill_name = ? AND r.skill_version = ?
  ORDER BY r.id DESC LIMIT ?
`).all(SKILL, skill.version, N);

if (!runs.length) {
  console.log(`No runs found for ${SKILL} v${skill.version}. Use the extension first, then re-run.`);
  process.exit(0);
}

const evidence = runs.map((r, i) => {
  const thumbs = r.thumbs === 1 ? '👍' : r.thumbs === -1 ? '👎' : '—';
  return `### Run ${i + 1} [${thumbs}]${r.note ? ` note: ${r.note}` : ''}
INPUT (truncated): ${(r.input || '').slice(0, 600)}
OUTPUT: ${(r.output_json || '').slice(0, 800)}`;
}).join('\n\n');

const prompt = `You are improving a skill prompt used by a career copilot agent.

## CURRENT SKILL (v${skill.version})
${skill.body}

## RECENT RUNS WITH USER FEEDBACK
${evidence}

## YOUR TASK
1. Identify concrete patterns in the feedback (what failed, what worked).
2. Rewrite the skill prompt to address the failures while preserving what worked.
3. Keep the same input/output schema. Do not invent new output fields.
4. Keep the prompt under 600 words.

Return JSON only:
{
  "rationale": "what you changed and why, 2-4 sentences",
  "new_skill_markdown": "the full rewritten skill prompt"
}`;

console.log(`Reflecting on ${runs.length} runs of ${SKILL} v${skill.version} using ${DEEP_MODEL}...`);
const raw = await generate({ model: DEEP_MODEL, prompt, format: 'json', temperature: 0.3 });

let parsed;
try { parsed = JSON.parse(raw); }
catch (e) { console.error('Model returned invalid JSON:', raw.slice(0, 500)); process.exit(1); }

if (!parsed.new_skill_markdown || !parsed.rationale) {
  console.error('Missing required fields in reflection output.');
  process.exit(1);
}

if (!parsed.new_skill_markdown.includes('#')) {
  console.error('Candidate skill did not look like markdown with a heading; refusing to promote.');
  process.exit(1);
}

if (APPLY) {
  const { version, path } = writeNext(SKILL, parsed.new_skill_markdown, parsed.rationale);
  db.prepare(`
    INSERT INTO reflections (skill_name, from_version, to_version, rationale, status)
    VALUES (?, ?, ?, ?, ?)
  `).run(SKILL, skill.version, version, parsed.rationale, 'applied');
  console.log(`Applied ${path}`);
  console.log(`Rationale: ${parsed.rationale}`);
} else {
  const { path } = writeCandidate(SKILL, parsed.new_skill_markdown, parsed.rationale);
  db.prepare(`
    INSERT INTO reflections (skill_name, from_version, to_version, rationale, status, candidate_path)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(SKILL, skill.version, null, parsed.rationale, 'candidate', path);
  console.log(`Wrote candidate ${path}`);
  console.log('Review the diff, then re-run with --apply to promote a new skill version.');
  console.log(`Rationale: ${parsed.rationale}`);
}
