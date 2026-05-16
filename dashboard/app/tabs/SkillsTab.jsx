'use client';
import { useEffect, useState } from 'react';
import { diffLines } from 'diff';

async function j(url) { const r = await fetch(url); return r.json(); }

export default function SkillsTab() {
  const [skills, setSkills] = useState([]);
  const [reflections, setReflections] = useState([]);
  const [skill, setSkill] = useState('');
  const [left, setLeft] = useState(null);
  const [right, setRight] = useState(null);
  const [leftBody, setLeftBody] = useState('');
  const [rightBody, setRightBody] = useState('');

  useEffect(() => {
    j('/api/skills').then(d => {
      setSkills(d.skills);
      if (d.skills[0]) setSkill(d.skills[0].name);
    });
    j('/api/reflections').then(d => setReflections(d.reflections));
  }, []);

  const versions = skills.find(s => s.name === skill)?.versions || [];

  useEffect(() => {
    if (!versions.length) return;
    const newest = versions[0];
    const prev = versions[1] ?? newest;
    setRight(newest);
    setLeft(prev);
  }, [skill, versions.join(',')]);

  useEffect(() => {
    if (skill && left != null) j(`/api/skills/${skill}/${left}`).then(d => setLeftBody(d.body || ''));
  }, [skill, left]);
  useEffect(() => {
    if (skill && right != null) j(`/api/skills/${skill}/${right}`).then(d => setRightBody(d.body || ''));
  }, [skill, right]);

  const rationale = reflections.find(r => r.skill_name === skill && r.to_version === right);
  const parts = diffLines(leftBody, rightBody);

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="panel">
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <label className="muted">Skill</label>
          <select value={skill} onChange={e => setSkill(e.target.value)}>
            {skills.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
          </select>
          <label className="muted">From</label>
          <select value={left ?? ''} onChange={e => setLeft(parseInt(e.target.value, 10))}>
            {versions.map(v => <option key={v} value={v}>v{v}</option>)}
          </select>
          <label className="muted">To</label>
          <select value={right ?? ''} onChange={e => setRight(parseInt(e.target.value, 10))}>
            {versions.map(v => <option key={v} value={v}>v{v}</option>)}
          </select>
          {versions.length === 1 && <span className="muted">only one version — run <span className="kbd">npm run reflect</span> to create v2</span>}
        </div>
      </div>

      {rationale && (
        <div className="rationale">
          <b>Reflection rationale</b> (v{rationale.from_version} → v{rationale.to_version}): {rationale.rationale}
        </div>
      )}

      <div className="diff">
        <div>
          <div className="muted" style={{ marginBottom: 6 }}>v{left} (before)</div>
          <pre>{parts.map((p, i) => (
            <span key={i} className={p.added ? 'add' : p.removed ? 'del' : 'eq'}>
              {p.added ? '' : p.value}
            </span>
          ))}</pre>
        </div>
        <div>
          <div className="muted" style={{ marginBottom: 6 }}>v{right} (after)</div>
          <pre>{parts.map((p, i) => (
            <span key={i} className={p.added ? 'add' : p.removed ? 'del' : 'eq'}>
              {p.removed ? '' : p.value}
            </span>
          ))}</pre>
        </div>
      </div>

      <div className="panel">
        <div className="muted" style={{ marginBottom: 8 }}>Reflection history</div>
        {!reflections.length && <div className="muted">No reflections yet.</div>}
        {reflections.map(r => (
          <div key={r.id} style={{ borderBottom: '1px solid var(--border)', padding: '8px 0' }}>
            <span className="badge">{r.skill_name}</span>{' '}
            <span className="muted">v{r.from_version} → v{r.to_version}</span>
            <div style={{ marginTop: 4 }}>{r.rationale}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
