# Index — Gemma Copilot

Read first. Open other files only when needed.

## Submission docs
- `README.md` — Gemma 4 Challenge write-up + setup
- (later) `LESSONS_LEARNED.md`

## Core code
| File | Role |
|------|------|
| [api/app.mjs](api/app.mjs) | Testable Express app: analysis, coach, feedback, jobs, skills, resumes |
| [api/server.mjs](api/server.mjs) | API listener + startup health warnings |
| [api/ollama.mjs](api/ollama.mjs) | Ollama generate() wrapper + model availability checks |
| [api/db.mjs](api/db.mjs) | SQLite schema, migrations, indexes, FTS5 virtual table |
| [api/memory.mjs](api/memory.mjs) | FTS5 search + context formatter |
| [api/skills.mjs](api/skills.mjs) | loadLatest(), writeCandidate(), writeNext() for versioned skills |
| [api/validation.mjs](api/validation.mjs) | JSON parse + JD analysis schema validation |

## Scripts
| File | Role |
|------|------|
| [scripts/init-wiki.mjs](scripts/init-wiki.mjs) | One-time: copy career-wiki → data/wiki-snapshot, index into FTS5 |
| [scripts/reflect.mjs](scripts/reflect.mjs) | Read recent runs+feedback → 26B writes a candidate skill; `--apply` promotes |

## Skills (versioned procedural memory)
- `skills/jd-analysis.v1.md` — JD scoring + red flags (used by /analyze, edge 4B)
- `skills/star-coach.v1.md` — STAR+R interview scoring (used by /coach, deep 26B)
- `skills/resume-tailor.v1.md` — resume tailoring to a specific JD (used by /resume/generate, deep 26B)

## Resume templates
- `resumes/templates/base-pm.md` — PM-focused template (cross-functional, Agile-heavy)
- `resumes/templates/base-ai-pm.md` — AI/Technical PM template (RAG, LLMs, builder emphasis)
- `resumes/templates/base-analyst.md` — Business Analyst template (data, UAT, healthcare)
- Fill `[FILL: ...]` placeholders with your personal details; model fills the rest from wiki

## Resume modules
| File | Role |
|------|------|
| [api/resume.mjs](api/resume.mjs) | generateResume(), listTemplates(), listResumes() |
| [api/pdf.mjs](api/pdf.mjs) | built-in markdown-to-PDF renderer for resume downloads |

## Dashboard (Next.js, :3940)
| File | Role |
|------|------|
| [dashboard/package.json](dashboard/package.json) | Next 14 + react + diff |
| [dashboard/next.config.mjs](dashboard/next.config.mjs) | Rewrites `/api/*` → :3939 |
| [dashboard/app/layout.jsx](dashboard/app/layout.jsx) | Root layout |
| [dashboard/app/page.jsx](dashboard/app/page.jsx) | Tab shell |
| [dashboard/app/tabs/SkillsTab.jsx](dashboard/app/tabs/SkillsTab.jsx) | v_n vs v_n+1 skill diff + reflection rationale |
| [dashboard/app/tabs/RunsTab.jsx](dashboard/app/tabs/RunsTab.jsx) | Recent runs + status + thumbs feedback + output drilldown |
| [dashboard/app/tabs/MemoryTab.jsx](dashboard/app/tabs/MemoryTab.jsx) | FTS5 wiki search UI |
| [dashboard/app/tabs/JobsTab.jsx](dashboard/app/tabs/JobsTab.jsx) | Saved jobs + latest verdict + search/sort + per-job comparisons |
| [dashboard/app/tabs/ResumesTab.jsx](dashboard/app/tabs/ResumesTab.jsx) | Generate + preview + download tailored resumes |

## Extension
- `extension/manifest.json` — MV3, LinkedIn + Greenhouse content scripts
- `extension/content/linkedin.js`, `greenhouse.js` — scrape JD from page with selected-text fallback
- `extension/popup.html`, `popup.js` — verdict UI + feedback notes + retry + screenshot fallback attachment
- `extension/background.js` — placeholder service worker

## Data
- `data/copilot.db` — SQLite (jobs, runs, feedback, reflections, memory, memory_fts)
- `data/wiki-snapshot/` — copy of career-wiki at init time

## Run order
1. `npm install`
2. `npm run dashboard:install`
3. `cp .env.example .env`
4. `npm run init-wiki`
5. Ensure Ollama running with `gemma4:e2b` (or `e4b`) and `gemma4:26b`
6. `npm start` → API on :3939
7. `npm run dashboard` → dashboard on :3940
8. Load `extension/` unpacked in Chrome
9. Visit a LinkedIn job → click extension → Analyze
10. After ~5 thumbs, run `npm run reflect`; review candidate, then `npm run reflect:apply`

## API endpoints
- `GET /health`, `POST /analyze`, `POST /coach`, `POST /feedback`
- `GET /memory/search?q=`, `GET /jobs`, `GET /jobs/:id/runs`
- `GET /runs?skill=&limit=`, `GET /skills`, `GET /skills/:name/:version`, `GET /reflections`
- `GET /resume/templates`, `GET /resumes`, `POST /resume/generate`
- `GET /resume/:id`, `GET /resume/:id/pdf` (streams PDF download)
