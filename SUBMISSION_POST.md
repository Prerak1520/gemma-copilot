---
title: Gemma Copilot: a local career agent for a hard job market
description: A private Gemma 4 career copilot that scores job descriptions, learns from feedback, and generates tailored resume PDFs locally so job seekers can move faster without burning tokens or exposing personal career data.
published: false
tags: devchallenge, gemmachallenge, gemma
---

*This is a submission for the [Gemma 4 Challenge: Build with Gemma 4](https://dev.to/challenges/google-gemma-2026-05-06).*

## What I Built

Gemma Copilot is a private, local-first career copilot for job seekers who need to move faster without turning every application into a copy-paste marathon or a cloud-token bill.

It analyzes job descriptions from the browser, compares them against a local career wiki, explains the fit, flags gaps and red flags, learns from feedback, and generates tailored resume drafts with PDF export.

The core loop is:

1. Open a LinkedIn or Greenhouse job post.
2. Click the Chrome extension.
3. Gemma analyzes the role against your local career context.
4. The dashboard shows the ATS score, matches, gaps, red flags, retrieved memory, and validation status.
5. You give feedback when the result is useful or off.
6. A reflection step proposes a better skill prompt from recent runs.
7. The app can generate a tailored resume draft and export it as a PDF.

The goal was not to build another resume chatbot. I wanted a local career agent that can sit next to private personal context and get better with use.

## Why I Built It

I built Gemma Copilot because I am trying to find a job in this market too.

The market is tough, and every serious application asks for a resume that is current, specific, and ATS-aware. That means reading the job description carefully, finding the right keywords, matching the role to your actual experience, rewriting bullets, and still making the final version sound human.

I was tired of two bad options:

- doing the whole thing with manual copy-paste, which takes too much time and makes every application feel heavy;
- using bigger cloud-agent workflows for every job, which can burn a lot of tokens when you include job descriptions, resume drafts, career notes, and revisions.

That cost matters. I want to spend my budget building and learning, not paying for every small resume iteration.

The Gemma 4 Challenge made me look at the problem differently. Local models are now strong enough for this workflow. We are no longer in a place where "local LLM" automatically means "too slow or too weak to be useful." A smaller Gemma model can give fast job-description analysis, while a larger Gemma model can handle deeper reflection and tailoring.

That is the product bet behind Gemma Copilot: local models can make job search more private, more affordable, and more repeatable.

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

Gemma is the center of the product, not a thin wrapper around it.

I split the work by model shape:

- **Gemma 4 E4B** is the intended edge model for fast job-description analysis. This is the click-the-extension path, where latency and privacy matter most.
- **Gemma 4 26B MoE** is used for deeper reflective tasks, such as improving the analysis prompt from recent feedback, tailoring resumes, and coaching structured interview answers.
- The app is currently configured with `gemma4:e2b` as a local stand-in until `gemma4:e4b` is available, so the model can be swapped with `EDGE_MODEL` without changing the app.

The most interesting part is the feedback loop. Each analysis stores the input, output, skill version, retrieved memory, and user feedback. A reflection command then asks the larger Gemma model to propose a candidate prompt update.

That candidate is not applied automatically. It lands under `skills/.candidates/` with a rationale, and the user can review it before promotion.

That makes the system feel less like a stateless chatbot and more like a local tool that compounds with every job search.

## What Makes It Useful

Job searching creates a privacy problem: the most useful context is also the context you least want to send everywhere.

A good career agent needs work history, target roles, strengths, deal-breakers, salary signals, weak spots, resume drafts, and story banks. That is exactly the kind of context I would rather keep local.

Gemma Copilot keeps the workflow on-device:

- Job descriptions are analyzed locally.
- Personal memory is indexed locally with SQLite FTS5.
- Feedback and run history stay in a local database.
- Resume drafts are generated locally.
- Skill prompt improvements are proposed locally and gated by review.

The result is a practical workflow: score the role, explain the fit, cite the memory used, learn from corrections, and turn the result into a resume artifact.

## What I Learned

The biggest lesson was that model choice should match the moment in the product.

For the browser extension, speed matters. You want to click once and get a useful verdict quickly. For reflection and resume tailoring, depth matters more because the output has more leverage and can take longer.

I also learned that validation matters a lot when LLM output drives UI. Gemma Copilot schema-checks model responses and records malformed output as a `partial_failure` instead of pretending the run succeeded. That made the dashboard much easier to trust during development.

## What's Next

The next steps are:

- Add a stable hosted demo video.
- Improve the generated PDF styling.
- Add a vision-capable screenshot fallback for job pages where DOM scraping is thin.
- Replace the sample resume templates with polished competition-safe examples.
- Tune the reflection prompt after more real runs.

Gemma Copilot is built around one belief: when local models are good enough, private context becomes usable. For job search, that changes everything.
