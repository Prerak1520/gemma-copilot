import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILLS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills');
const CANDIDATES_DIR = join(SKILLS_DIR, '.candidates');

export function loadLatest(skillName) {
  const versions = readdirSync(SKILLS_DIR)
    .filter(f => f.startsWith(`${skillName}.v`) && f.endsWith('.md'))
    .map(f => ({ file: f, v: parseInt(f.match(/\.v(\d+)\.md$/)?.[1] || '0', 10) }))
    .sort((a, b) => b.v - a.v);
  if (!versions.length) throw new Error(`No skill found: ${skillName}`);
  const top = versions[0];
  return {
    name: skillName,
    version: top.v,
    body: readFileSync(join(SKILLS_DIR, top.file), 'utf8')
  };
}

export function writeNext(skillName, body, rationale) {
  const latest = loadLatest(skillName);
  const nextV = latest.version + 1;
  const path = join(SKILLS_DIR, `${skillName}.v${nextV}.md`);
  const header = `<!-- auto-generated v${nextV} from v${latest.version}\nRationale: ${rationale.replace(/-->/g, '--')} -->\n\n`;
  writeFileSync(path, header + body);
  return { version: nextV, path };
}

export function writeCandidate(skillName, body, rationale) {
  const latest = loadLatest(skillName);
  mkdirSync(CANDIDATES_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const path = join(CANDIDATES_DIR, `${skillName}.from-v${latest.version}.${stamp}.md`);
  const header = `<!-- candidate from v${latest.version}\nRationale: ${rationale.replace(/-->/g, '--')} -->\n\n`;
  writeFileSync(path, header + body);
  return { fromVersion: latest.version, path };
}
