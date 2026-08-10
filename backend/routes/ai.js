const express = require('express');
const fetch = require('node-fetch');
const { pool } = require('../db');
const authMiddleware = require('../middleware/auth');
const router = express.Router();

// Primary & Backup API Keys for Gemini
const GEMINI_API_KEYS = [
  process.env.GEMINI_API_KEY_PRIMARY || process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_BACKUP,
  process.env.GEMINI_API_KEY_BACKUP2
].filter(Boolean);

let keyIndex = 0;
function getApiKey() {
  if (GEMINI_API_KEYS.length === 0) return null;
  const key = GEMINI_API_KEYS[keyIndex % GEMINI_API_KEYS.length];
  keyIndex++;
  return key;
}

// POST /ai/ask — Proxy text & screen vision queries securely
router.post('/ask', authMiddleware, async (req, res) => {
  try {
    const { prompt, imageBase64, modePrompt } = req.body;
    if (!prompt && !imageBase64) {
      return res.status(400).json({ error: 'Prompt or image is required.' });
    }

    const apiKey = getApiKey();
    if (!apiKey) {
      return res.status(500).json({ error: 'Backend AI API Key is not configured.' });
    }

    // Build systemic context prompt
    const systemContext = modePrompt || 'You are Intruely, an ultra-smart, concise real-time interview and meeting assistant. Provide a direct, crystal-clear answer. If it\'s a question or problem, give the exact optimal answer immediately without conversational fluff.';
    
    const fullPrompt = `${systemContext}\n\nUser Prompt/Question: ${prompt || 'Solve the question shown in the attached image.'}`;

    let payload = {
      contents: [{
        parts: [{ text: fullPrompt }]
      }]
    };

    if (imageBase64) {
      payload.contents[0].parts.push({
        inline_data: {
          mime_type: 'image/png',
          data: imageBase64.replace(/^data:image\/\w+;base64,/, '')
        }
      });
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
      const aiResponseText = data.candidates[0].content.parts[0].text;

      // Track usage in background DB asynchronously
      pool.query(
        'INSERT INTO ai_usage (user_id, request_type, tokens_used) VALUES ($1, $2, $3)',
        [req.user.id, imageBase64 ? 'vision' : 'text', aiResponseText.length]
      ).catch(e => console.error('Usage log error:', e));

      return res.json({ response: aiResponseText });
    } else {
      console.error('Gemini error response:', data);
      return res.status(500).json({ error: 'AI processing failed or rate-limited by upstream provider.' });
    }
  } catch (err) {
    console.error('AI Proxy Route Error:', err);
    res.status(500).json({ error: 'Failed to connect to AI engine.' });
  }
});

module.exports = router;
