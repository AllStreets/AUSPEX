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
//
// Cost guard: each visitor (by hashed IP) is capped at AI_DAILY_TOKEN_LIMIT
// tokens per UTC day (default 1,000,000), tracked in Supabase via the add-only
// ai_usage_add RPC. Over the cap → 429. If the usage store is unreachable the
// proxy fails OPEN (serves the request) so a transient Supabase blip can't take
// the AI tools down.
// ═══════════════════════════════════════════
import { createHash } from 'node:crypto';

const DEFAULT_MODEL = 'gpt-5.4-mini';
const DAILY_TOKEN_LIMIT = (() => {
  const n = Number(process.env.AI_DAILY_TOKEN_LIMIT);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1_000_000;
})();

const SUPA_URL = process.env.SUPABASE_URL || 'https://rdsmaktxefqtfxogoauq.supabase.co';
const SUPA_KEY = process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkc21ha3R4ZWZxdGZ4b2dvYXVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MzI4MDAsImV4cCI6MjA5NzMwODgwMH0.N5zfuFrVIMdrZ9adXmiUVaD2EhCu0j1Inqf2ru4bJc8';

// The real client IP as seen by Vercel's edge. x-real-ip is Vercel-set; the
// first x-forwarded-for entry is the client. Hash it (+ optional salt) so we
// never store raw visitor IPs.
function visitorKey(req) {
  const xff = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const ip = req.headers['x-real-ip'] || xff || 'unknown';
  return createHash('sha256').update(ip + ':' + (process.env.IP_HASH_SALT || 'auspex')).digest('hex').slice(0, 40);
}

// Add tokens to today's running total for this visitor and return the new total.
// p_tokens=0 is a pure read. Returns null on any failure (caller fails open).
async function usageAdd(ipHash, tokens) {
  try {
    const r = await fetch(`${SUPA_URL}/rest/v1/rpc/ai_usage_add`, {
      method: 'POST',
      signal: AbortSignal.timeout(5000),
      headers: {
        apikey: SUPA_KEY,
        Authorization: `Bearer ${SUPA_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_ip_hash: ipHash, p_tokens: tokens }),
    });
    if (!r.ok) return null;
    const total = await r.json();
    return typeof total === 'number' ? total : null;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  const allowOrigin = process.env.ALLOWED_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', allowOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Expose-Headers', 'X-AI-Tokens-Used, X-AI-Tokens-Limit');

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

  // ── Per-visitor daily token cap ───────────────────────────────────────────
  const ipHash = visitorKey(req);
  const usedBefore = await usageAdd(ipHash, 0); // pure read; null if store down
  res.setHeader('X-AI-Tokens-Limit', String(DAILY_TOKEN_LIMIT));
  if (usedBefore != null) {
    res.setHeader('X-AI-Tokens-Used', String(usedBefore));
    if (usedBefore >= DAILY_TOKEN_LIMIT) {
      res.setHeader('Retry-After', '86400');
      res.status(429).json({
        error: `Daily AI limit reached (${DAILY_TOKEN_LIMIT.toLocaleString('en-US')} tokens). It resets at 00:00 UTC.`,
        tokensUsed: usedBefore,
        tokensLimit: DAILY_TOKEN_LIMIT,
      });
      return;
    }
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

    // Record what this call actually cost against the visitor's daily budget.
    const spent = Number(data.usage?.total_tokens) ||
      Math.ceil((system.length + user.length) / 4) + maxTokens;
    const usedAfter = await usageAdd(ipHash, spent);
    if (usedAfter != null) res.setHeader('X-AI-Tokens-Used', String(usedAfter));

    res.status(200).json({ content });
  } catch (e) {
    res.status(502).json({ error: e?.message || 'AI request failed' });
  }
}
