'use client';
import { Fragment, useEffect, useState } from 'react';

export default function RunsTab() {
  const [runs, setRuns] = useState([]);
  const [skill, setSkill] = useState('');
  const [open, setOpen] = useState(null);

  const load = () => {
    const url = skill ? `/api/runs?skill=${encodeURIComponent(skill)}` : '/api/runs';
    fetch(url).then(r => r.json()).then(d => setRuns(d.runs));
  };
  useEffect(load, [skill]);

  const fmt = ts => new Date(ts * 1000).toLocaleString();

  return (
    <div className="col" style={{ gap: 12 }}>
      <div className="panel row">
        <label className="muted">Filter skill</label>
        <select value={skill} onChange={e => setSkill(e.target.value)}>
          <option value="">all</option>
          <option value="jd-analysis">jd-analysis</option>
          <option value="star-coach">star-coach</option>
        </select>
        <button onClick={load}>refresh</button>
        <span className="muted">{runs.length} runs</span>
      </div>

      <div className="panel" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
          <th>#</th><th>when</th><th>skill</th><th>status</th><th>model</th><th>👍/👎</th><th>input (preview)</th><th></th>
            </tr>
          </thead>
          <tbody>
            {runs.map(r => (
              <Fragment key={r.id}>
                <tr>
                  <td>{r.id}</td>
                  <td className="muted">{fmt(r.created_at)}</td>
                  <td>{r.skill_name} v{r.skill_version}</td>
                  <td className={r.status === 'partial_failure' ? 'down' : 'muted'}>{r.status || 'ok'}</td>
                  <td className="muted">{r.model}</td>
                  <td className={r.thumbs === 1 ? 'up' : r.thumbs === -1 ? 'down' : 'muted'}>
                    {r.thumbs === 1 ? '👍' : r.thumbs === -1 ? '👎' : '—'}
                  </td>
                  <td style={{ maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {(r.input || '').slice(0, 120)}
                  </td>
                  <td><button onClick={() => setOpen(open === r.id ? null : r.id)}>{open === r.id ? 'hide' : 'view'}</button></td>
                </tr>
                {open === r.id && (
                  <tr>
                    <td colSpan={8}>
                      <div className="muted" style={{ marginBottom: 4 }}>output</div>
                      <pre style={{ background: 'var(--panel-2)', padding: 10, borderRadius: 6, fontSize: 12, maxHeight: 320, overflow: 'auto', margin: 0 }}>
                        {(() => { try { return JSON.stringify(JSON.parse(r.output_json), null, 2); } catch { return r.output_json; } })()}
                      </pre>
                      {r.note && <div className="muted" style={{ marginTop: 6 }}>note: {r.note}</div>}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
