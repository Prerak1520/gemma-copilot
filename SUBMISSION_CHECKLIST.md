# Submission Checklist

Use this as the final pass before recording or submitting Gemma Copilot.

## Must work live

- API starts with `npm start` and `/health` shows the configured models.
- Dashboard starts with `npm run dashboard`.
- Chrome extension loads unpacked from `extension/`.
- LinkedIn or Greenhouse JD analysis returns a valid result.
- If LinkedIn scraping is thin, selecting the JD text and retrying works.
- Feedback note is saved and visible in the dashboard run.
- Resume generation works from at least one template.
- Resume PDF endpoint downloads a readable PDF.
- `npm test` passes.
- `npm --prefix dashboard run build` passes.

## Demo storyline

1. Show the private/local architecture: Chrome extension, local API, SQLite, Ollama.
2. Analyze a real job description.
3. Show retrieved memory chunks and explain that the comparison comes from the career wiki.
4. Open the dashboard Jobs/Runs tabs and show validation status.
5. Add feedback and run `npm run reflect` to create a candidate prompt.
6. Show the candidate/diff and explain that promotion is gated by `npm run reflect:apply`.
7. Generate a tailored resume and export PDF.

## Risks to fix before a polished submission

- Upgrade dashboard Next.js from `14.2.5`; npm reports a security advisory.
- Replace placeholder resume template fields with final personal details.
- Record a demo using a stable job page or selected JD text so LinkedIn layout changes do not derail the flow.
- Optional: set `SCREENSHOT_MODEL` to a vision-capable local Ollama model and demo screenshot fallback.
- Optional: improve PDF styling beyond the current simple built-in renderer.

## One-line pitch

Gemma Copilot is a private local agent that turns job-search context into compounding memory: it scores roles, learns from feedback, improves its own prompts, and generates tailored resume PDFs without sending personal career data to the cloud.
