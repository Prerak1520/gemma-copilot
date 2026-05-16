'use client';
import { useState } from 'react';

export default function MemoryTab() {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const search = async () => {
    if (!q.trim()) return;
    setLoading(true);
    const r = await fetch(`/api/memory/search?q=${encodeURIComponent(q)}`).then(x => x.json());
    setRows(r.results || []);
    setLoading(false);
  };

  return (
    <div className="col" style={{ gap: 12 }}>
      <div className="panel row">
        <input
          style={{ flex: 1 }}
          placeholder="search career wiki (FTS5 BM25)…"
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
        />
        <button onClick={search}>{loading ? '…' : 'search'}</button>
      </div>

      <div className="col" style={{ gap: 8 }}>
        {!rows.length && <div className="muted panel">no results yet — try "remote", "go", "deal-breaker"…</div>}
        {rows.map((r, i) => (
          <div key={i} className="panel">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <b>{r.title}</b>
              <span className="muted">{r.source}</span>
            </div>
            <div style={{ marginTop: 6, fontSize: 13, whiteSpace: 'pre-wrap' }}>{r.chunk}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
