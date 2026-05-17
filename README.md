# Gemma Copilot

Gemma Copilot is a **private, local-first career copilot** for people trying to job hunt in a brutal market without burning money, time, or privacy on every application.

It uses **Gemma 4 through Ollama** to analyze job descriptions, compare them against a local career wiki, learn from feedback, and generate tailored resume drafts with PDF export. The idea is simple: if every serious application needs the latest, strongest, ATS-aware version of your resume, that workflow should be fast, repeatable, and affordable.

Built for the Gemma 4 Challenge. Inspired by the [Hermes Agent](https://hermes-agent.nousresearch.com/docs/) concepts of episodic memory and skill self-improvement.

## Why I Built This

I built Gemma Copilot because I am also trying to find a job in this market.

Every application asks for the same painful loop: read the posting, decode what the company really wants, compare it with your experience, rewrite the resume, tune the keywords for ATS, and still make the result sound like you. Doing that manually means endless copy-paste. Doing it with cloud agents can get expensive quickly, especially when you are using long job descriptions, career notes, resumes, and multiple revisions. That token budget is also the budget I want to use for building things.

The Gemma 4 Challenge made the product click for me. Local LLMs no longer feel like a compromise for this kind of work. A small local model can handle fast job-description analysis, and a larger local model can handle deeper reflection and resume tailoring. That means a job seeker can get a practical assistant without sending private career history to a cloud service and without paying per-token for every attempt.

Gemma Copilot is my answer to that problem: a local agent that helps you search smarter, spend less, and keep improving from every run.

## What It Does

- **Chrome extension:** scrape LinkedIn, Greenhouse, or selected page text and analyze the JD in one click.
- **Private JD scoring:** return ATS score, fit summary, matches, skill gaps, red flags, deal-breakers, salary signals, and recommendation.
- **Episodic memory:** retrieve relevant chunks from a local career wiki with SQLite FTS5 and inject them into the prompt.
- **Feedback loop:** collect useful/off feedback with optional notes and use it to improve skill prompts.
- **Reflection safety:** `npm run reflect` writes a candidate prompt; `npm run reflect:apply` promotes it after review.
- **Dashboard:** inspect jobs, runs, memory retrieval, skill diffs, saved resumes, and per-job analysis comparisons.
- **Resume tailoring:** generate tailored resume markdown from multiple templates and export it as PDF.
- **Validation:** model output is schema-checked; malformed output is saved as a clear `partial_failure`, not treated as success.

## Why Gemma 4

The app uses local Gemma models for different parts of the workflow:

| Layer | Model | Why |
|---|---|---|
| Browser-edge JD analysis | **Gemma 4 4B (E4B)** | Fast local inference for the "click extension, get verdict" workflow. Job descriptions and personal career data stay on the device. |
| Reflection + interview coaching | **Gemma 4 26B MoE** | Deeper reasoning for prompt improvement, resume tailoring, and STAR answer coaching, where latency matters less than quality. |
| Optional screenshot fallback | vision-capable local Ollama model | If `SCREENSHOT_MODEL` is configured, the API can try extracting job text from a captured browser screenshot when DOM scraping is thin. |

The project is currently configured with `gemma4:e2b` as a stand-in for E4B. Swap it through `EDGE_MODEL` once `gemma4:e4b` is available locally.

## Self-Improvement Loop

Gemma Copilot is not just a stateless resume bot. It keeps a local record of what happened and can propose better skill prompts from feedback.

1. Every `/analyze` run logs `{input, output, skill_version}` to SQLite.
2. The user gives useful/off feedback with optional notes in the popup.
3. `npm run reflect` feeds recent runs and feedback to the 26B model and asks it to rewrite the skill prompt.
4. The new prompt is saved as a candidate under `skills/.candidates/`.
5. After review, `npm run reflect:apply` promotes it to `skills/jd-analysis.v(n+1).md`.
6. The reflection rationale is stored, so you can read why the agent changed its approach.

## Local Memory

Your `career-wiki/` contains your profile, strengths, STAR stories, deal-breakers, target roles, and other job-search context. `npm run init-wiki` copies it into `data/wiki-snapshot/`, chunks it, and indexes it into a SQLite **FTS5** virtual table.

On every analysis, Gemma Copilot retrieves the most relevant chunks with BM25 and injects them into the prompt. That gives the model useful memory without sending your personal career history to an external service.

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
#    Chrome -> chrome://extensions -> Developer mode -> Load unpacked -> select ./extension
```

## Use

1. Open any LinkedIn job page (`linkedin.com/jobs/...`) or Greenhouse posting.
2. Click the Gemma Copilot icon and choose **Analyze this JD**.
3. Review ATS score, fit summary, red flags, skills gap, and cited memory chunks.
4. If LinkedIn extraction is thin, open the details panel or select the JD text before retrying.
5. Mark the result useful/off and add an optional note for reflection.
6. Generate a tailored resume from a template and download the PDF.
7. After several runs, use `npm run reflect` to create a candidate skill update; use `npm run reflect:apply` after review.

## API Surface

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

## Quality Checks

```bash
npm test
npm --prefix dashboard run build
node --check api/app.mjs
node --check extension/popup.js
```

## Competition Demo Path

1. Start API and dashboard.
2. Open a LinkedIn or Greenhouse job.
3. Analyze the JD from the extension.
4. Show the run in the dashboard, including memory chunks and validation status.
5. Add feedback, run reflection to create a candidate skill prompt, and show the diff.
6. Generate a tailored resume from `base-ai-pm`, preview it, and export PDF.

## File Map

See [INDEX.md](INDEX.md).

## Cost

**$0 for inference.** All model calls run locally through Ollama. Data lives in SQLite. No cloud LLM API is required.
