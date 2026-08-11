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

2. Coding & Technical Algorithm Questions:
   • Primary Languages: Code MUST be written in C++ (or Python).
   • 3-Tier Multi-Approach Structure: Provide the complete progression that candidate should speak aloud to interviewer:
     1️⃣ Approach 1 — Brute Force:
        - Verbal Explanation: 1-2 sentences of intuition to speak out loud.
        - Code/Logic: Minimal code snippet or logic outline.
        - Complexity: Time: O(...) | Space: O(...)
     2️⃣ Approach 2 — Better / Intermediate:
        - Verbal Explanation: 1-2 sentences explaining optimization idea (e.g. Hash Map / Two Pointers / Sorting).
        - Complexity: Time: O(...) | Space: O(...)
     3️⃣ Approach 3 — Optimal Solution (FAANG Level):
        - Verbal Explanation: Concise intuition of the optimal pattern.
        - Production Code: Clean, production-grade C++ (or Python) code solution with edge-case handling.
        - Complexity: Time: O(...) | Space: O(...)

3. Spoken Interview Verbatim Script:
   • Include a short 🗣️ "What to Say to Interviewer:" section with exact natural phrases to speak out loud during the coding interview.

4. Tone & Delivery:
   • Speak in the first person ("I led", "I architected", "My approach is").
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

    // ── PROVIDER CHAIN ──────────────────────────────────────────────────────────
    // 1. Gemini cascade (gemini-1.5-flash → gemini-2.0-flash-exp → gemini-1.5-pro)
    // 2. Groq llama3-70b-8192 (OpenAI-compatible) if all Gemini models fail
    // ────────────────────────────────────────────────────────────────────────────
    const geminiModels = ['gemini-1.5-flash', 'gemini-2.0-flash-exp', 'gemini-1.5-pro'];
    let aiResponseText = null;
    let lastError = null;

    // ── Step 1: Try Gemini ────────────────────────────────────────────────────
    for (const model of geminiModels) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
        );
        const resData = await response.json();
        if (resData.candidates?.[0]?.content?.parts?.[0]?.text) {
          aiResponseText = resData.candidates[0].content.parts[0].text;
          console.log(`[AI] Gemini (${model}) responded OK`);
          break;
        } else if (resData.error) {
          lastError = resData.error.message;
          console.warn(`[AI] Gemini (${model}) error: ${lastError}`);
        }
      } catch (e) {
        lastError = e.message;
        console.warn(`[AI] Gemini (${model}) threw: ${lastError}`);
      }
    }

    // ── Step 2: Groq fallback (only if Gemini fully exhausted) ───────────────
    if (!aiResponseText) {
      const groqKey = process.env.GROQ_API_KEY;
      if (groqKey) {
        try {
          console.log('[AI] Falling back to Groq llama3-70b-8192...');
          const groqPayload = {
            model: 'llama3-70b-8192',
            messages: [
              { role: 'system', content: systemContext },
              { role: 'user',   content: prompt || 'Analyze the attached image and provide the immediate answer.' }
            ],
            temperature: 0.2,
            max_tokens: 2048
          };
          const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${groqKey}`
            },
            body: JSON.stringify(groqPayload)
          });
          const groqData = await groqRes.json();
          if (groqData.choices?.[0]?.message?.content) {
            aiResponseText = groqData.choices[0].message.content;
            console.log('[AI] Groq responded OK');
          } else {
            lastError = groqData.error?.message || 'Groq returned empty response';
            console.warn('[AI] Groq error:', lastError);
          }
        } catch (e) {
          lastError = e.message;
          console.warn('[AI] Groq threw:', lastError);
        }
      } else {
        console.warn('[AI] GROQ_API_KEY not set — skipping Groq fallback');
      }
    }

    // ── Return result or error ────────────────────────────────────────────────
    if (aiResponseText) {
      if (req.user?.id) {
        pool.query(
          'INSERT INTO ai_usage (user_id, request_type, tokens_used) VALUES ($1, $2, $3)',
          [req.user.id, imageBase64 ? 'vision' : 'text', aiResponseText.length]
        ).catch(e => console.error('Usage log error:', e));
      }
      return res.json({ response: aiResponseText });
    } else {
      const errMsg = lastError || 'All AI providers failed or rate-limited.';
      console.error('[AI] All providers exhausted. Last error:', errMsg);
      return res.status(500).json({ error: `AI Error: ${errMsg}` });
    }
  } catch (err) {
    console.error('AI Proxy Route Error:', err);
    res.status(500).json({ error: `Failed to connect to AI engine: ${err.message}` });
  }
});


module.exports = router;
