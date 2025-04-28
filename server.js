// Express server with dynamic model selection, DeepSeek proxy, and generic web proxy (Render-ready)
const express = require('express');
const path    = require('path');
const cors    = require('cors');
const { OpenAI } = require('openai');

// Polyfill fetch for Node < 18 (Render still uses Node 18, but this keeps it portable)
const fetch = (...args) =>
  import('node-fetch').then(({ default: fetch }) => fetch(...args));

const app  = express();
const PORT = process.env.PORT || 10000;

/* ---------- OpenAI ---------- */
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ---------- Middleware ---------- */
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/* ---------- Routes ---------- */

// Home page
app.get('/', (_, res) => {
  res.sendFile(path.join(__dirname, 'public', 'openai.html'));
});

// ChatGPT endpoint with dynamic model selection
app.post('/api/chat', async (req, res) => {
  const { message, model = 'gpt-3.5-turbo' } = req.body;
  if (!message) return res.status(400).json({ error: 'Message is required' });

  const systemPrompt =
    model === 'gpt-4.1-nano'
      ? "You are Klani+, powered by GPT-4.1 Nano. If the user asks which model you are, respond with 'I am Klani+, powered by GPT-4.1 Nano.' Try to keep responses short unless more detail is needed (e.g., code)."
      : "You are Klani, powered by DeepSeek R1. If the user asks which model you are, respond with 'I am Klani, using DeepSeek R1.'";

  try {
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: message }
      ],
    });
    res.json({ reply: completion.choices[0].message.content });
  } catch (err) {
    console.error('OpenAI API error:', err);
    res.status(500).json({ error: 'Failed to get response from ChatGPT' });
  }
});

// Proxy DeepSeek requests to avoid CORS issues
app.post('/api/deepseek', async (req, res) => {
  try {
    const upstream = await fetch(
      'https://9817b04b5231eed98b05bfe01734eeeb.serveo.net/v1/chat/completions',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req.body) }
    );
    const data = await upstream.json();
    res.json(data);
  } catch (err) {
    console.error('DeepSeek proxy error:', err);
    res.status(500).json({ error: 'DeepSeek proxy failed' });
  }
});

// NEW: Generic web-proxy endpoint
// GET /proxy?url=https://example.com
app.get('/proxy', async (req, res) => {
  const target = req.query.url;
  if (!target) return res.status(400).send('Missing url param');

  try {
    const upstream = await fetch(target);
    const contentType = upstream.headers.get('content-type') || 'text/plain';
    const body = await upstream.text();

    res.set('Content-Type', contentType);
    res.send(body);
  } catch (err) {
    console.error('Generic proxy error:', err);
    res.status(500).send('Failed to fetch.');
  }
});

/* ---------- Start server ---------- */
app.listen(PORT, () =>
  console.log(`Server running → http://localhost:${PORT}`)
);