---
title: Gemma Copilot: a private local career agent that learns from every job search
published: false
tags: devchallenge, gemmachallenge, gemma
---

*This is a submission for the [Gemma 4 Challenge: Build with Gemma 4](https://dev.to/challenges/google-gemma-2026-05-06).*

## What I Built

Gemma Copilot is a private, local-first career copilot for the messy middle of job searching: reading job descriptions, deciding whether a role is worth applying to, remembering what matters to you, and turning that context into a tailored resume.

The core loop is simple:

1. Open a LinkedIn or Greenhouse job post.
2. Click the Chrome extension.
3. Gemma analyzes the role against a local career wiki.
4. The dashboard shows the score, matches, gaps, red flags, retrieved memory, and validation status.
5. You give feedback.
6. A reflection step uses that feedback to propose a better skill prompt.
7. The app can generate a tailored resume draft and export it as a PDF.

The goal was not to make another cloud resume bot. The goal was to make a career agent that can sit next to private personal context without sending that context away.

## Demo

Demo link: `[add video or demo URL here]`

Repo: `[add GitHub repo URL here]`

Suggested walkthrough:

1. Start the API and dashboard.
2. Analyze a real job description from the extension.
3. Open the run in the dashboard and show retrieved memory chunks.
4. Mark the result useful or off and add a note.
5. Run reflection to generate a candidate skill update.
6. Generate a tailored resume from the `base-ai-pm` template and export the PDF.

## Code

The project is a small local stack:

- Node/Express API for analysis, feedback, resume generation, and PDF export.
- SQLite with FTS5 for local episodic memory retrieval.
- Chrome extension for job page extraction.
- Next.js dashboard for inspecting jobs, runs, skills, reflections, and generated resumes.
- Ollama for local Gemma inference.

The repo includes validation tests and a submission checklist:

```bash
npm test
npm --prefix dashboard run build
node --check api/app.mjs
node --check extension/popup.js
```

## How I Used Gemma 4

Gemma is the center of the product, not a wrapper around it.

I split the work by model shape:

- Gemma 4 E4B is the intended edge model for fast job-description analysis. This is the click-the-extension path, where latency and privacy matter most.
- Gemma 4 26B MoE is used for deeper reflective tasks, such as improving the analysis prompt from recent feedback and coaching structured interview answers.
- The app is currently configured with `gemma4:e2b` as a local stand-in until `gemma4:e4b` is pulled, so the model can be swapped with `EDGE_MODEL` without changing the app.

The interesting part is the feedback loop. Each analysis stores the input, output, skill version, retrieved memory, and user feedback. A reflection command then asks the larger Gemma model to propose a candidate prompt update. That candidate is not applied automatically; it lands under `skills/.candidates/` so the user can review the rationale before promotion.

That makes the system feel less like a stateless chatbot and more like a local tool that compounds with use.

## What Makes It Useful

Job searching creates a weird privacy problem: the most useful context is also the context you least want to spray into random services. Your work history, deal-breakers, salary notes, target roles, weaknesses, and story bank are exactly what a good agent needs.

Gemma Copilot keeps that context local:

- Job descriptions are analyzed on-device.
- Personal memory is indexed locally with SQLite FTS5.
- Feedback and run history stay in a local database.
- Resume drafts are generated locally.

The result is a practical agent workflow: score the role, explain the fit, cite the memory it used, learn from corrections, and turn the result into a resume artifact.

## What I Learned

The most important design choice was making model selection intentional. A small model is the right fit for fast, repeated extension actions. A larger MoE model is better for reflective prompt improvement, where the output has more leverage and can take longer.

I also learned that validation matters a lot when LLM output drives UI. Gemma Copilot schema-checks model responses and records malformed output as a `partial_failure` instead of pretending the run succeeded. That made the dashboard much easier to trust during development.

## What's Next

The next steps are:

- Add a stable hosted demo video.
- Improve the generated PDF styling.
- Add a vision-capable screenshot fallback for job pages where DOM scraping is thin.
- Replace the sample resume templates with polished competition-safe examples.
- Tune the reflection prompt after more real runs.

Gemma Copilot is built around one bet: local models make personal agents more useful because they make private context usable. For job search, that changes the shape of the product completely.
