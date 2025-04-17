// Express server with dynamic model selection for ChatGPT (Render-ready)
const express = require('express');
const path = require('path');
const { OpenAI } = require('openai');
// If `fetch` is not globally available, enable it:
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const app = express();
const PORT = process.env.PORT || 10000;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'openai.html'));
});

// POST /api/chat with dynamic model support and custom system prompt
app.post('/api/chat', async (req, res) => {
  const { message, model = 'gpt-3.5-turbo' } = req.body;
  if (!message) return res.status(400).json({ error: 'Message is required' });
  
  // Set custom instructions based on the model being used
  let systemPrompt = "";
  if (model === 'gpt-4.1-nano') {
    systemPrompt = "You are Klani+, powered by GPT-4.1 Nano. If the user asks which model you are, respond with 'I am Klani+, powered by GPT-4.1 Nano.' Try to keep responses very short and simple unless they need more detail, like for code.";
  } else {
    systemPrompt = "You are Klani, powered by DeepSeek R1. If the user asks which model you are, respond with 'I am Klani, using DeepSeek R1.'";
  }

  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
    });
    const reply = response.choices[0].message.content;
    res.json({ reply });
  } catch (error) {
    console.error('OpenAI API error:', error);
    res.status(500).json({ error: 'Failed to get response from ChatGPT' });
  }
});

// Proxy DeepSeek requests through this server to avoid CORS issues
app.post('/api/deepseek', async (req, res) => {
  try {
    const resp = await fetch('https://9817b04b5231eed98b05bfe01734eeeb.serveo.net/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const data = await resp.json();
    res.json(data);
  } catch (err) {
    console.error('DeepSeek proxy error:', err);
    res.status(500).json({ error: 'DeepSeek proxy failed' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
