import express from "express";
import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const app = express();
app.use(express.json());

app.post("/api/chat", async (req, res) => {
  const { messages, model = 'gpt-4.1-nano' } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Messages array is required' });
  }

  try {
    const response = await openai.chat.completions.create({
      model,
      messages
    });

    const reply = response.choices?.[0]?.message?.content || "";
    res.json({ reply });
  } catch (error) {
    console.error("OpenAI API error:", error);
    res.status(500).json({ error: "Failed to get a response from the model." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
