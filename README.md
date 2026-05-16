# Gemma Copilot

A **private, self-improving career copilot** that runs on-device using **Gemma 4** + **Ollama**. It analyzes job descriptions from the browser, compares them against a personal career wiki, learns from feedback, and can generate tailored resume drafts with PDF export.

Built for the Gemma 4 Challenge. Inspired by the [Hermes Agent](https://hermes-agent.nousresearch.com/docs/) concepts of episodic memory and skill self-improvement.

## What it does

- **Chrome extension:** scrape LinkedIn, Greenhouse, or selected page text and analyze the JD in one click.
- **Private JD scoring:** return ATS score, fit summary, matches, skill gaps, red flags, deal-breakers, salary signals, and recommendation.
- **Episodic memory:** retrieve relevant chunks from a local career wiki with SQLite FTS5 and inject them into the prompt.
- **Feedback loop:** collect useful/off feedback with optional notes and use it to improve skill prompts.
- **Reflection safety:** `npm run reflect` writes a candidate prompt; `npm run reflect:apply` promotes it after review.
- **Dashboard:** inspect jobs, runs, memory retrieval, skill diffs, saved resumes, and per-job analysis comparisons.
- **Resume tailoring:** generate tailored resume markdown from multiple templates and export it as PDF.
- **Validation:** model output is schema-checked; malformed output is saved as a clear `partial_failure`, not treated as success.

## Why these models

| Layer | Model | Why |
|---|---|---|
| Browser-edge JD analysis | **Gemma 4 4B (E4B)** | Sub-second inference, runs locally so JDs and personal career data never leave the device. Perfect for the "click extension → instant verdict" UX. |
| Reflection + interview coaching | **Gemma 4 26B MoE** | Sparse Mixture-of-Experts: only ~3.8B active params per token, so a deep model fits on a single workstation. Needed for rewriting prompts and scoring STAR answers — tasks where reasoning depth matters more than latency. |
| Optional screenshot fallback | vision-capable local Ollama model | If `SCREENSHOT_MODEL` is configured, the API can try extracting job text from a captured browser screenshot when DOM scraping is thin. |

Currently configured with `gemma4:e2b` as a stand-in for E4B (swap via `EDGE_MODEL` env var once `gemma4:e4b` is pulled).

## What's novel: the self-improvement loop

1. Every `/analyze` run logs `{input, output, skill_version}` to SQLite.
2. The user gives useful/off feedback with optional notes in the popup.
3. `npm run reflect` feeds recent runs + feedback to the 26B model and asks it to rewrite the skill prompt.
4. The new prompt is saved as a candidate under `skills/.candidates/`.
5. After review, `npm run reflect:apply` promotes it to `skills/jd-analysis.v(n+1).md`.
6. The reflection rationale is stored, so you can read *why* the agent changed its approach.

## Memory (Hermes-style episodic)

Your `career-wiki/` (profile, strengths, STAR stories, deal-breakers) is copied once into `data/wiki-snapshot/`, chunked, and indexed into a SQLite **FTS5** virtual table. On every analysis, the most relevant chunks are retrieved (BM25) and injected into the prompt — so the model "remembers" who you are.

## Setup

```bash
# 1. Install deps
npm install
npm run dashboard:install

# 2. Ensure Ollama models
ollama pull gemma4:e2b      # or gemma4:e4b when available
ollama pull gemma4:26b

# 3. Configure env
cp .env.example .env

# 4. Seed memory from your career-wiki
npm run init-wiki

# 5. Start the API
npm start                    # http://localhost:3939

# 6. Start the dashboard
npm run dashboard             # http://localhost:3940

# 7. Load the extension
#    Chrome → chrome://extensions → Developer mode → Load unpacked → select ./extension
```

## Use

1. Open any LinkedIn job page (`linkedin.com/jobs/...`) or Greenhouse posting.
2. Click the Gemma Copilot icon → **Analyze this JD**.
3. See ATS score, red flags, skills gap, and which memory chunks were cited.
4. If LinkedIn extraction is thin, open the details panel or select the JD text before retrying.
5. Click useful/off and add an optional note for reflection.
6. Generate a tailored resume from a template and download the PDF.
7. After ~5+ runs, `npm run reflect` to create a candidate skill update; use `npm run reflect:apply` after review.

## API surface

- `GET /health`
- `POST /analyze`
- `POST /coach`
- `POST /feedback`
- `GET /memory/search?q=`
- `GET /jobs`
- `GET /jobs/:id/runs`
- `GET /runs?skill=&limit=`
- `GET /skills`
- `GET /skills/:name/:version`
- `GET /reflections`
- `GET /resume/templates`
- `GET /resumes`
- `POST /resume/generate`
- `GET /resume/:id`
- `GET /resume/:id/pdf`

## Quality checks

```bash
npm test
npm --prefix dashboard run build
node --check api/app.mjs
node --check extension/popup.js
```

## Competition demo path

1. Start API + dashboard.
2. Open a LinkedIn or Greenhouse job.
3. Analyze the JD from the extension.
4. Show the run in the dashboard, including memory chunks and validation status.
5. Add feedback, run reflection to create a candidate skill prompt, and show the diff.
6. Generate a tailored resume from `base-ai-pm`, preview it, and export PDF.

## File map

See [INDEX.md](INDEX.md).

## Cost

**$0.** All inference is local via Ollama. SQLite file. No cloud services.
