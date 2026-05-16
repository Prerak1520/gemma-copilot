'use client';
import { Fragment, useEffect, useState } from 'react';

function parseAnalysis(raw) {
  try { return JSON.parse(raw); } catch { return null; }
}

export default function JobsTab() {
  const [jobs, setJobs] = useState([]);
  const [open, setOpen] = useState(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('saved_desc');
  const [compare, setCompare] = useState({});

  useEffect(() => {
    fetch('/api/jobs').then(r => r.json()).then(d => setJobs(d.jobs));
  }, []);

  const fmt = ts => new Date(ts * 1000).toLocaleString();
  const loadCompare = id => {
    if (compare[id]) {
      setCompare(c => ({ ...c, [id]: null }));
      return;
    }
    fetch(`/api/jobs/${id}/runs`).then(r => r.json()).then(d => {
      setCompare(c => ({ ...c, [id]: d.runs || [] }));
    });
  };

  const visibleJobs = jobs
    .filter(j => {
      const haystack = `${j.company || ''} ${j.title || ''} ${j.url || ''}`.toLowerCase();
      return haystack.includes(query.toLowerCase());
    })
    .map(j => {
      const v = parseAnalysis(j.latest_analysis);
      return { ...j, parsed: v, score: v?.ats_score ?? v?.score ?? null };
    })
    .sort((a, b) => {
      if (sort === 'score_desc') return (b.score ?? -1) - (a.score ?? -1);
      if (sort === 'score_asc') return (a.score ?? 101) - (b.score ?? 101);
      if (sort === 'company') return String(a.company || '').localeCompare(String(b.company || ''));
      return b.saved_at - a.saved_at;
    });

  const scores = visibleJobs.map(j => j.score).filter(v => typeof v === 'number');
  const avg = scores.length ? Math.round(scores.reduce((sum, n) => sum + n, 0) / scores.length) : null;

  return (
    <div className="col" style={{ gap: 12 }}>
      <div className="panel row">
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search jobs" style={{ minWidth: 240 }} />
        <select value={sort} onChange={e => setSort(e.target.value)}>
          <option value="saved_desc">newest</option>
          <option value="score_desc">score high to low</option>
          <option value="score_asc">score low to high</option>
          <option value="company">company</option>
        </select>
        <span className="muted">{visibleJobs.length} jobs{avg != null ? ` · avg score ${avg}` : ''}</span>
      </div>

      <div className="panel" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr><th>#</th><th>saved</th><th>company</th><th>title</th><th>verdict</th><th>analyses</th><th></th></tr>
          </thead>
          <tbody>
            {visibleJobs.map(j => {
              const v = j.parsed;
              const score = j.score;
              const rec = v?.recommendation ?? v?.verdict ?? null;
              return (
                <Fragment key={j.id}>
                  <tr>
                    <td>{j.id}</td>
                    <td className="muted">{fmt(j.saved_at)}</td>
                    <td>{j.company || <span className="muted">—</span>}</td>
                    <td>
                      {j.url ? <a href={j.url} target="_blank" rel="noreferrer">{j.title || j.url}</a> : (j.title || '—')}
                    </td>
                    <td>
                      {score != null && <span className="badge">{score}</span>}{' '}
                      {rec && <span className={String(rec).toLowerCase().includes('skip') ? 'down' : 'up'}>{rec}</span>}
                    </td>
                    <td className="muted">{j.analysis_count || 0}</td>
                    <td className="row" style={{ marginTop: 0 }}>
                      <button onClick={() => setOpen(open === j.id ? null : j.id)}>{open === j.id ? 'hide' : 'view'}</button>
                      <button onClick={() => loadCompare(j.id)}>{compare[j.id] ? 'hide compare' : 'compare'}</button>
                    </td>
                  </tr>
                  {open === j.id && (
                    <tr>
                      <td colSpan={7}>
                        <pre style={{ background: 'var(--panel-2)', padding: 10, borderRadius: 6, fontSize: 12, maxHeight: 320, overflow: 'auto', margin: 0 }}>
                          {v ? JSON.stringify(v, null, 2) : (j.latest_analysis || 'no analysis')}
                        </pre>
                      </td>
                    </tr>
                  )}
                  {compare[j.id] && (
                    <tr>
                      <td colSpan={7}>
                        <div className="diff">
                          {compare[j.id].slice(0, 2).map(run => {
                            const parsed = parseAnalysis(run.output_json);
                            return (
                              <pre key={run.id}>
                                {`Run #${run.id} · ${fmt(run.created_at)} · ${run.status || 'ok'}\n\n${JSON.stringify(parsed, null, 2)}`}
                              </pre>
                            );
                          })}
                        </div>
                        {compare[j.id].length < 2 && <div className="muted" style={{ marginTop: 8 }}>Need at least two analyses for a useful comparison.</div>}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {!visibleJobs.length && (
              <tr><td colSpan={7} className="muted" style={{ padding: 16 }}>No jobs yet — analyze something via the extension.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
