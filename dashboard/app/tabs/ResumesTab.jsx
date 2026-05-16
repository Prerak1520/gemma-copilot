'use client';
import { useState, useEffect } from 'react';

const API = 'http://localhost:3939';

function timeAgo(unixSecs) {
  const diff = Date.now() / 1000 - unixSecs;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function ResumesTab() {
  const [jobs, setJobs] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [resumes, setResumes] = useState([]);
  const [selectedJob, setSelectedJob] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState(null); // { id, markdown }
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API}/jobs`).then(r => r.json()).then(d => setJobs(d.jobs || []));
    fetch(`${API}/resume/templates`).then(r => r.json()).then(d => {
      setTemplates(d.templates || []);
      if (d.templates?.length) setSelectedTemplate(d.templates[0]);
    });
    loadResumes();
  }, []);

  function loadResumes() {
    fetch(`${API}/resumes`).then(r => r.json()).then(d => setResumes(d.resumes || []));
  }

  async function generate() {
    if (!selectedJob || !selectedTemplate) return;
    setGenerating(true);
    setError('');
    setPreview(null);
    try {
      const r = await fetch(`${API}/resume/generate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ job_id: parseInt(selectedJob, 10), template_name: selectedTemplate })
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      setPreview({ id: data.id, markdown: data.markdown });
      loadResumes();
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  }

  function downloadPdf(id) {
    window.open(`${API}/resume/${id}/pdf`, '_blank');
  }

  async function viewResume(id) {
    const r = await fetch(`${API}/resume/${id}`);
    const data = await r.json();
    setPreview({ id: data.id, markdown: data.markdown });
  }

  const templateLabel = t => t.replace('base-', '').replace('-', ' / ').toUpperCase();

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20, height: '100%' }}>

      {/* Left panel */}
      <div>
        <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Generate Resume</h2>

        <label style={{ display: 'block', fontSize: 12, marginBottom: 4, color: '#555' }}>Job</label>
        <select
          value={selectedJob}
          onChange={e => setSelectedJob(e.target.value)}
          style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #ccc', fontSize: 13, marginBottom: 10 }}
        >
          <option value="">— pick a job —</option>
          {jobs.map(j => (
            <option key={j.id} value={j.id}>
              {j.company || '?'} · {j.title || 'Untitled'}
            </option>
          ))}
        </select>

        <label style={{ display: 'block', fontSize: 12, marginBottom: 4, color: '#555' }}>Template</label>
        <select
          value={selectedTemplate}
          onChange={e => setSelectedTemplate(e.target.value)}
          style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #ccc', fontSize: 13, marginBottom: 12 }}
        >
          {templates.map(t => (
            <option key={t} value={t}>{templateLabel(t)}</option>
          ))}
        </select>

        <button
          onClick={generate}
          disabled={generating || !selectedJob || !selectedTemplate}
          style={{
            width: '100%', padding: '8px', borderRadius: 6, border: 'none',
            background: generating ? '#666' : '#111', color: '#fff',
            fontSize: 13, cursor: generating ? 'default' : 'pointer'
          }}
        >
          {generating ? 'Tailoring with 26B…' : 'Generate tailored resume'}
        </button>

        {error && <div style={{ color: '#c00', fontSize: 12, marginTop: 8 }}>{error}</div>}

        <hr style={{ margin: '16px 0', borderColor: '#eee' }} />

        <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Past Resumes</h2>
        {resumes.length === 0 && <div style={{ fontSize: 12, color: '#888' }}>None yet — generate your first one.</div>}
        {resumes.map(r => (
          <div
            key={r.id}
            style={{
              padding: '8px 10px', borderRadius: 6, border: '1px solid #eee',
              marginBottom: 8, cursor: 'pointer', background: preview?.id === r.id ? '#f5f5f5' : '#fff'
            }}
            onClick={() => viewResume(r.id)}
          >
            <div style={{ fontWeight: 600, fontSize: 13 }}>{r.company || '?'} · {r.title || 'Untitled'}</div>
            <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>
              {templateLabel(r.template_name)} · {timeAgo(r.created_at)}
            </div>
            <button
              onClick={e => { e.stopPropagation(); downloadPdf(r.id); }}
              style={{
                marginTop: 6, padding: '3px 8px', fontSize: 11, borderRadius: 4,
                border: '1px solid #ccc', background: '#fafafa', cursor: 'pointer'
              }}
            >
              Download PDF
            </button>
          </div>
        ))}
      </div>

      {/* Right panel — markdown preview */}
      <div style={{ borderLeft: '1px solid #eee', paddingLeft: 20 }}>
        {!preview && (
          <div style={{ color: '#aaa', fontSize: 13, paddingTop: 40, textAlign: 'center' }}>
            Generate or select a resume to preview it here.
          </div>
        )}
        {preview && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Resume #{preview.id}</span>
              <button
                onClick={() => downloadPdf(preview.id)}
                style={{
                  padding: '5px 12px', borderRadius: 6, border: '1px solid #111',
                  background: '#111', color: '#fff', fontSize: 12, cursor: 'pointer'
                }}
              >
                Download PDF
              </button>
            </div>
            <pre style={{
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              fontSize: 12, lineHeight: 1.6,
              background: '#fafafa', padding: 16, borderRadius: 6,
              maxHeight: 'calc(100vh - 160px)', overflowY: 'auto',
              border: '1px solid #eee'
            }}>
              {preview.markdown}
            </pre>
          </>
        )}
      </div>

    </div>
  );
}
