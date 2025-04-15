// Express server with dynamic model selection for ChatGPT
require('dotenv').config();
const express = require('express');
const path = require('path');
const { OpenAI } = require('openai');
const app = express();
const PORT = process.env.PORT || 10000;

const openai = new OpenAI({
  apiKey: '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'
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// POST /api/chat with dynamic model support
app.post('/api/chat', async (req, res) => {
  const { message, model = 'gpt-3.5-turbo' } = req.body;
  if (!message) return res.status(400).json({ error: 'Message is required' });

  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content: message }],
    });
    const reply = response.choices[0].message.content;
    res.json({ reply });
  } catch (error) {
    console.error('OpenAI API error:', error);
    res.status(500).json({ error: 'Failed to get response from ChatGPT' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
