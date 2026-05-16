import { createApp } from './app.mjs';
import { getOllamaStatus } from './ollama.mjs';

const PORT = process.env.PORT || 3939;
const EDGE_MODEL = process.env.EDGE_MODEL || 'gemma4:e2b';
const DEEP_MODEL = process.env.DEEP_MODEL || 'gemma4:26b';
const SCREENSHOT_MODEL = process.env.SCREENSHOT_MODEL || '';

const app = createApp();

app.listen(PORT, async () => {
  console.log(`gemma-copilot api on :${PORT} (edge=${EDGE_MODEL}, deep=${DEEP_MODEL})`);
  const status = await getOllamaStatus([EDGE_MODEL, DEEP_MODEL, SCREENSHOT_MODEL].filter(Boolean));
  if (!status.ok) {
    console.warn(`Ollama check: ${status.error || 'some configured models are missing'}`);
    if (status.missing?.length) console.warn(`Missing models: ${status.missing.join(', ')}`);
    console.warn('Run `ollama pull <model>` or update EDGE_MODEL / DEEP_MODEL / SCREENSHOT_MODEL.');
  }
});
