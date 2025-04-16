const express = require("express");
const path = require("path");
const { OpenAI } = require("openai");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// POST /api/chat that supports conversation memory (messages array)
app.post("/api/chat", async (req, res) => {
  const { messages, model = "gpt-4.1-nano" } = req.body;
  
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "Messages array is required" });
  }
  
  try {
    const response = await openai.chat.completions.create({
      model,
      messages,
    });
    
    const reply =
      response.choices &&
      response.choices[0] &&
      response.choices[0].message &&
      response.choices[0].message.content
        ? response.choices[0].message.content
        : "";
        
    res.json({ reply });
  } catch (error) {
    console.error("OpenAI API error:", error);
    res.status(500).json({ error: "Failed to get a response from the model." });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
