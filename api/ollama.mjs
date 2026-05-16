const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

export async function generate({ model, prompt, format = 'json', temperature = 0.2, images }) {
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      format: format === 'json' ? 'json' : undefined,
      images,
      options: { temperature }
    })
  });
  if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.response;
}

export async function getOllamaStatus(requiredModels = []) {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`);
    if (!res.ok) return { ok: false, error: `Ollama ${res.status}: ${await res.text()}` };
    const data = await res.json();
    const names = new Set((data.models || []).flatMap(model => [model.name, model.model].filter(Boolean)));
    const missing = requiredModels.filter(model => !names.has(model));
    return { ok: missing.length === 0, models: [...names], missing };
  } catch (e) {
    return { ok: false, error: e.message, models: [], missing: requiredModels };
  }
}
