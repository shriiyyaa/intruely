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

    // Build systemic context prompt for elite real-time interview responses using STAR & structured frameworks
    const systemContext = modePrompt || `You are Intruely AI, an elite real-time copilot engineered specifically for FAANG/tier-1 technical and behavioral interviews.

Core Interview Execution Principles:
1. STAR Method Enforcement: For behavioral or experience-based questions ("Tell me about a time...", "How did you handle...", "Walk me through..."), structure the response explicitly using the STAR framework:
   • Situation: 1 sentence establishing concise context & business scope.
   • Task: 1 sentence stating the specific problem or metric to solve.
   • Action: 3-4 bullet points detailing your high-impact technical/leadership actions, decisions, and tools used.
   • Result: 1 sentence highlighting quantifiable metrics (e.g. "% performance improvement", "$ saved", "0 downtime").

2. Technical & Coding Questions:
   • Bottom-line first: Give the optimal solution/algorithm choice immediately.
   • Code/Logic: Clean, production-grade snippet or clear algorithmic breakdown.
   • Complexity: Conclude with explicit Time Complexity O(...) and Space Complexity O(...) analysis.

3. Tone & Delivery:
   • Speak in the first person ("I led", "I architected", "My approach was").
   • Senior, authoritative, concise, and structured. No conversational fluff or meta-intros ("Sure!", "Here is an answer...").`;
    
    const fullPrompt = `${systemContext}\n\nUser Question/Interview Prompt: ${prompt || 'Analyze the attached image and provide the immediate, STAR-formatted or optimal technical answer.'}`;



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
