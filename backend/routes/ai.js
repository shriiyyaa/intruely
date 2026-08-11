const express = require('express');
const fetch = require('node-fetch');
const { pool } = require('../db');
const authMiddleware = require('../middleware/auth');
const router = express.Router();

// Keys are read lazily at request time so env changes (e.g. in tests) are picked up
let keyIndex = 0;
function getApiKey() {
  const keys = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_PRIMARY,
    process.env.GEMINI_API_KEY_BACKUP,
    process.env.GEMINI_API_KEY_BACKUP2
  ].filter(Boolean);
  if (keys.length === 0) return null;
  const key = keys[keyIndex % keys.length];
  keyIndex++;
  return key;
}

// POST /ai/ask — Proxy text & screen vision queries securely
router.post('/ask', async (req, res) => {
  try {
    const { prompt, imageBase64, modePrompt } = req.body;
    if (!prompt && !imageBase64) {
      return res.status(400).json({ error: 'Prompt or image is required.' });
    }

    const apiKey = getApiKey();
    if (!apiKey) {
      const availableEnvKeys = Object.keys(process.env).filter(k => k.includes('GEMINI'));
      console.error('No Gemini API key found in process.env. Found env keys:', availableEnvKeys);
      return res.status(500).json({ error: `Backend AI API Key is missing. Found env keys: [${availableEnvKeys.join(', ')}]` });
    }

    // Build systemic context prompt for hyper-intelligent, personalized, elite meeting/interview responses
    const systemContext = modePrompt || `You are Intruely AI, an elite real-time copilot for high-stakes interviews and executive meetings.
Your objective: Deliver immediate, high-impact, expert answers tailored with precision.
Formatting & Tone Rules:
1. Direct Impact: Give the exact answer or solution in the very first sentence. Zero filler, zero pleasantries.
2. Structured Clarity: Use bullet points, bold key technical concepts, or numbered steps for complex answers.
3. Personalized Voice: Speak with senior executive confidence and deep technical mastery.
4. Problem Solving: For code/math questions on screen, provide the optimal solution with brief time/space complexity notes.`;
    
    const fullPrompt = `${systemContext}\n\nUser Prompt/Question/Screen Intent: ${prompt || 'Analyze the attached image and provide the immediate, optimal answer.'}`;


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

      // Track usage in background DB asynchronously if authenticated
      if (req.user && req.user.id) {
        pool.query(
          'INSERT INTO ai_usage (user_id, request_type, tokens_used) VALUES ($1, $2, $3)',
          [req.user.id, imageBase64 ? 'vision' : 'text', aiResponseText.length]
        ).catch(e => console.error('Usage log error:', e));
      }

      return res.json({ response: aiResponseText });
    } else {
      console.error('Gemini error response:', data);
      const errMsg = data.error?.message || 'AI processing failed or rate-limited by upstream provider.';
      return res.status(500).json({ error: `Gemini API Error: ${errMsg}` });
    }
  } catch (err) {
    console.error('AI Proxy Route Error:', err);
    res.status(500).json({ error: `Failed to connect to AI engine: ${err.message}` });
  }
});


module.exports = router;
