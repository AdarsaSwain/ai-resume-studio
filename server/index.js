/* API server. Holds the Anthropic credentials and builds every prompt itself;
   in production it also serves the built front end from dist/. */
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import { buildPrompt, KINDS } from '../src/prompts.js';

try { process.loadEnvFile(); } catch { /* no .env file: AI features stay off */ }

const PORT = Number(process.env.PORT) || 8787;
const HOST = process.env.HOST || '127.0.0.1';
const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-5-5';
const hasCreds = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
const client = hasCreds ? new Anthropic() : null;
// Server-side refusal fallbacks exist only on these model families.
const useFallbacks = /^claude-(opus-5|fable-5|sonnet-5-5)/.test(MODEL);

const app = express();
app.use(express.json({ limit: '300kb' }));

app.get('/api/health', (req, res) => res.json({ ok: true, ai: hasCreds }));

// Small per-address limit so a stray loop cannot run up the bill.
const hits = new Map();
function limited(ip) {
  const now = Date.now(), recent = (hits.get(ip) || []).filter(t => now - t < 60000);
  recent.push(now); hits.set(ip, recent);
  return recent.length > 20;
}

app.post('/api/ai', async (req, res) => {
  if (!client) return res.status(503).json({ code: 'not_configured', error: 'No Anthropic credentials on the server.' });
  if (limited(req.ip)) return res.status(429).json({ code: 'rate_limited', error: 'Too many requests. Wait a minute.' });
  const { kind, payload } = req.body || {};
  if (!KINDS.includes(kind)) return res.status(400).json({ code: 'bad_kind', error: 'Unknown request kind.' });
  let prompt;
  try { prompt = buildPrompt(kind, payload); }
  catch (err) { return res.status(err.code === 'too_long' ? 413 : 400).json({ code: err.code || 'bad_payload', error: 'The request could not be used.' }); }

  try {
    const msg = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      output_config: { effort: 'low' },
      ...(useFallbacks ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } : {}),
      messages: [{ role: 'user', content: prompt }]
    });
    if (msg.stop_reason === 'refusal') return res.status(422).json({ code: 'refused', error: 'The model declined this request.' });
    if (msg.stop_reason === 'max_tokens') return res.status(502).json({ code: 'failed', error: 'The answer was cut off.' });
    const text = msg.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
    res.json({ text });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
      console.error('Anthropic credentials were rejected:', err.message);
      return res.status(503).json({ code: 'not_configured', error: 'The Anthropic credentials were rejected.' });
    }
    if (err instanceof Anthropic.RateLimitError) return res.status(429).json({ code: 'rate_limited', error: 'Rate limited.' });
    if (err instanceof Anthropic.APIError) {
      console.error('Anthropic API error', err.status, err.message);
      return res.status(502).json({ code: 'failed', error: 'The model request failed.' });
    }
    console.error(err);
    res.status(500).json({ code: 'failed', error: 'Server error.' });
  }
});

const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
if (fs.existsSync(dist)) app.use(express.static(dist));

app.listen(PORT, HOST, () => {
  console.log(`AI Resume Studio server on http://${HOST}:${PORT} · Claude ${hasCreds ? 'on (' + MODEL + ')' : 'off (no ANTHROPIC_API_KEY)'}`);
});
