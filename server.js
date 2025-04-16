// Express server with dynamic model selection for ChatGPT (Render-ready)
const express = require('express');
const path = require('path');
const { OpenAI } = require('openai');
const app = express();
const PORT = process.env.PORT || 10000;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// POST /api/chat with dynamic model support and custom system prompt
app.post('/api/chat', async (req, res) => {
  const { message, model = 'gpt-3.5-turbo' } = req.body;
  if (!message) return res.status(400).json({ error: 'Message is required' });
  
  // Set custom instructions based on the model being used
  let systemPrompt = "";
  if (model === 'gpt-4.1-nano') {
    systemPrompt = "You are Klani+. You are based off Klani 4.1 Nano by graxAI. Answer all questions accordingly. Try to keep responses very short and simple unless they need more detail, like for code.";
  } else {
    systemPrompt = "You are a helpful assistant.";
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

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
