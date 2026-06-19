// ═══════════════════════════════════════════
// AUSPEX · SERVERLESS AI PROXY (Vercel)
// Routes the Analyst + RELIEF tools' OpenAI calls through the server so the
// API key never reaches the browser. In production the client OPENAI_KEY is
// empty, so js/analyst.js callOpenAI() POSTs here instead of calling OpenAI
// directly. Mirrors the request shape callOpenAI used client-side:
// model, system+user messages, max_completion_tokens, temperature.
//
// Key resolution: AUSPEX_LLM_KEY (preferred) → OPENAI_KEY (fallback). If
// neither is set, the tools degrade exactly as keyless local dev does.
// ═══════════════════════════════════════════

const DEFAULT_MODEL = 'gpt-5.4-mini';

export default async function handler(req, res) {
  const allowOrigin = process.env.ALLOWED_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', allowOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // CORS preflight.
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const key = process.env.AUSPEX_LLM_KEY || process.env.OPENAI_KEY;
  if (!key) {
    res.status(503).json({ error: 'AI not configured' });
    return;
  }

  // On Vercel req.body may already be parsed, a string, a Buffer, or absent.
  let body = req.body;
  try {
    if (Buffer.isBuffer(body)) body = body.toString('utf8');
    if (typeof body === 'string') body = body ? JSON.parse(body) : {};
    if (!body || typeof body !== 'object') body = {};
  } catch {
    res.status(400).json({ error: 'Invalid JSON body' });
    return;
  }

  const system = typeof body.system === 'string' ? body.system : '';
  const user = typeof body.user === 'string' ? body.user : '';
  const model = typeof body.model === 'string' && body.model ? body.model : DEFAULT_MODEL;
  const maxTokens = Number.isFinite(+body.maxTokens) ? +body.maxTokens : 420;

  try {
    const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: AbortSignal.timeout(55000),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        max_completion_tokens: maxTokens,
        temperature: 0.7,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });

    const data = await upstream.json();
    if (data.error) {
      res.status(502).json({ error: data.error.message || 'Upstream AI error' });
      return;
    }
    const content = data.choices?.[0]?.message?.content || '';
    res.status(200).json({ content });
  } catch (e) {
    res.status(502).json({ error: e?.message || 'AI request failed' });
  }
}
