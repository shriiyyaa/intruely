// Render Production Backend API Endpoint
const BACKEND_URL = 'https://intruely.onrender.com';

// DOM & State Elements
let activePane = 'general';
let isStealthActive = false;
let isSessionActive = false;
let recognition = null;
let customPromptMode = localStorage.getItem('INTRUELY_MODE_PROMPT') || `description: >
Comprehensive interview-prep reference for Shriya Nayyar covering background, work experience, and every project in technical depth, with anticipated interview questions and answer angles.`;

let apiKey = localStorage.getItem('GEMINI_API_KEY') || '';

// Primary DOM Elements
const profileBtn = document.getElementById('profileBtn');
const profileDropdown = document.getElementById('profileDropdown');
const fullviewOverlay = document.getElementById('fullviewOverlay');
const fullviewContentPane = document.getElementById('fullviewContentPane');
const stealthToggle = document.getElementById('stealthToggle');
const stealthLabel = document.getElementById('stealthLabel');
const homeTitleBtn = document.getElementById('homeTitleBtn');
const dockPromptInput = document.getElementById('dockPromptInput');
const dockSnapBtn = document.getElementById('dockSnapBtn');
const listenSessionBtn = document.getElementById('listenSessionBtn');
const aiResponseFeed = document.getElementById('aiResponseFeed');
const minimizeBtn = document.getElementById('minimizeBtn');
const closeBtn = document.getElementById('closeBtn');
const heroStartBtn = document.getElementById('heroStartBtn');
const centerStartBtn = document.getElementById('centerStartBtn');
const refreshBtn = document.getElementById('refreshBtn');

// Floating Overlay Elements (Image 3)
const mainAppWindow = document.getElementById('mainAppWindow');
const floatingOverlay = document.getElementById('floatingOverlay');
const hideFloatingBtn = document.getElementById('hideFloatingBtn');
const stopFloatingBtn = document.getElementById('stopFloatingBtn');
const floatingPromptInput = document.getElementById('floatingPromptInput');
const floatingSendBtn = document.getElementById('floatingSendBtn');
const liveSpeechText = document.getElementById('liveSpeechText');

// Window Operation Handlers
minimizeBtn.addEventListener('click', () => window.electronAPI.minimizeWindow());
closeBtn.addEventListener('click', () => window.electronAPI.closeWindow());

homeTitleBtn.addEventListener('click', () => {
  fullviewOverlay.classList.remove('active');
  profileDropdown.classList.remove('active');
});

refreshBtn.addEventListener('click', () => {
  location.reload();
});

// Profile Dropdown Toggle
profileBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  profileDropdown.classList.toggle('active');
});

document.addEventListener('click', () => {
  profileDropdown.classList.remove('active');
});

document.getElementById('manageModesMenuItem').addEventListener('click', () => {
  openFullview('modes');
});

document.getElementById('settingsMenuItem').addEventListener('click', () => {
  openFullview('general');
});

// Stealth Switch Toggle
stealthToggle.addEventListener('click', () => {
  isStealthActive = !isStealthActive;
  stealthToggle.classList.toggle('off', !isStealthActive);
  stealthLabel.innerText = isStealthActive ? 'Stealth Active' : 'Detectable';
  window.electronAPI.toggleStealth(isStealthActive);
});

// Sidebar Navigation Pane Switcher
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    const pane = item.getAttribute('data-pane');
    if (pane) {
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      openFullview(pane);
    }
  });
});

function openFullview(paneName) {
  activePane = paneName;
  fullviewOverlay.classList.add('active');
  profileDropdown.classList.remove('active');
  renderPaneContent(paneName);
}

// Session Controller Logic — Transforms between Main Window and Floating Pill (Image 3)
heroStartBtn.addEventListener('click', toggleSession);
centerStartBtn.addEventListener('click', toggleSession);
listenSessionBtn.addEventListener('click', toggleSession);
stopFloatingBtn.addEventListener('click', toggleSession);

hideFloatingBtn.addEventListener('click', () => {
  floatingOverlay.style.display = 'none';
  mainAppWindow.style.display = 'flex';
});

function toggleSession() {
  isSessionActive = !isSessionActive;
  if (isSessionActive) {
    mainAppWindow.style.display = 'none';
    floatingOverlay.style.display = 'flex';
    listenSessionBtn.innerText = '⏹ Stop Session';
    listenSessionBtn.style.background = '#ef4444';
    heroStartBtn.innerText = '⏹ Stop Session';
    heroStartBtn.style.background = '#ef4444';
    
    // Hide onboarding card once session begins
    const emptyCard = document.getElementById('emptyStateCard');
    if (emptyCard) emptyCard.style.display = 'none';

    startSpeechRecognition();
  } else {
    floatingOverlay.style.display = 'none';
    mainAppWindow.style.display = 'flex';
    listenSessionBtn.innerText = '▶ Start Session';
    listenSessionBtn.style.background = '#22c55e';
    heroStartBtn.innerText = '✈ Start Intruely';
    heroStartBtn.style.background = '#3b82f6';

    stopSpeechRecognition();
  }
}

// Live Speech Recognition Engine (Web Speech API)
function startSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    if (liveSpeechText) liveSpeechText.innerText = 'Listening (Microphone active)';
    return;
  }

  try {
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let currentSpeech = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        currentSpeech += event.results[i][0].transcript;
      }
      if (liveSpeechText && currentSpeech.trim()) {
        liveSpeechText.innerText = `Speech Stream: "${currentSpeech}"`;
        // Append live transcript to background feed
        appendResponseCard('SPEAKER (AUDIO STREAM)', currentSpeech, '#10b981');
      }
    };

    recognition.onerror = (err) => {
      console.warn('Speech recognition warning:', err.error);
      if (liveSpeechText) liveSpeechText.innerText = 'Audio capture active...';
    };

    recognition.start();
  } catch (e) {
    console.error('Speech init error:', e);
  }
}

function stopSpeechRecognition() {
  if (recognition) {
    try { recognition.stop(); } catch(e){}
    recognition = null;
  }
}

// Quick Chip Assistant Triggers (Image 3)
document.getElementById('chipAssist')?.addEventListener('click', () => sendFloatingPrompt("Provide an instant assist for the current screen question."));
document.getElementById('chipSay')?.addEventListener('click', () => sendFloatingPrompt("What optimal response should I say right now?"));
document.getElementById('chipFollowup')?.addEventListener('click', () => sendFloatingPrompt("Suggest 3 intelligent follow-up questions to ask."));
document.getElementById('chipRecap')?.addEventListener('click', () => sendFloatingPrompt("Provide a concise summary recap of the discussion so far."));

floatingSendBtn.addEventListener('click', () => {
  if (floatingPromptInput.value.trim()) {
    sendFloatingPrompt(floatingPromptInput.value.trim());
    floatingPromptInput.value = '';
  }
});

floatingPromptInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && floatingPromptInput.value.trim()) {
    sendFloatingPrompt(floatingPromptInput.value.trim());
    floatingPromptInput.value = '';
  }
});

async function sendFloatingPrompt(q) {
  mainAppWindow.style.display = 'flex';
  const emptyCard = document.getElementById('emptyStateCard');
  if (emptyCard) emptyCard.style.display = 'none';

  appendResponseCard('You', q, '#3b82f6');
  const aiCard = appendResponseCard('Intruely AI', 'Thinking...', '#22c55e');

  const res = await callAI(q);
  updateCardText(aiCard, res);
}

// Render Specific Pane UI
function renderPaneContent(pane) {
  if (pane === 'general') {
    fullviewContentPane.innerHTML = `
      <div class="pane-title">General</div>
      <div class="pane-subtitle">Customize how Intruely works for you</div>

      <div class="setting-card">
        <div class="setting-info">
          <div class="setting-icon">📥</div>
          <div>
            <div class="setting-title">Intruely Version</div>
            <div class="setting-desc">You are currently using Intruely version 2.0.194 Free</div>
          </div>
        </div>
        <button class="setting-btn">Check for updates</button>
      </div>

      <div class="setting-card">
        <div class="setting-info">
          <div class="setting-icon">👁️</div>
          <div>
            <div class="setting-title">Detectable</div>
            <div class="setting-desc">Intruely is currently detectable by screen-sharing</div>
          </div>
        </div>
        <button class="setting-btn" onclick="document.getElementById('stealthToggle').click()">Toggle Protection</button>
      </div>

      <div class="setting-card">
        <div class="setting-info">
          <div class="setting-icon">🔑</div>
          <div>
            <div class="setting-title">Custom Gemini API Key (Optional)</div>
            <div class="setting-desc">Render Cloud Backend active! Leave empty to use free backend, or enter your key for private BYOK.</div>
          </div>
        </div>
        <input type="password" id="geminiKeyField" class="dock-input" style="max-width:240px;" value="${apiKey}" placeholder="Optional custom key..." onchange="saveApiKey(this.value)" />
      </div>

      <div style="margin-top:24px; font-weight:700; font-size:14px; margin-bottom:12px;">Audio Settings</div>
      <div class="setting-card">
        <div class="setting-info">
          <div class="setting-icon">🎙️</div>
          <div>
            <div class="setting-title">Microphone Source</div>
            <div class="setting-desc" id="micDeviceLabel">Default - Microphone Array (Realtek(R) Audio) / AirPods</div>
          </div>
        </div>
        <button class="setting-btn">Test Microphone</button>
      </div>
    `;
  } else if (pane === 'modes') {
    fullviewContentPane.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <div class="pane-title">Untitled Mode / Real-time Context Mode</div>
        <span style="background:rgba(34,197,94,0.15); color:#22c55e; padding:4px 10px; border-radius:12px; font-size:12px; font-weight:600;">✓ Active</span>
      </div>

      <div style="font-size:12px; font-weight:600; margin-bottom:8px;">Real-time prompt</div>
      <textarea id="promptModeArea" class="prompt-editor">${customPromptMode}</textarea>
      <div style="display:flex; justify-content:flex-end; margin-top:8px;">
        <button class="setting-btn" style="background:#22c55e; color:black;" onclick="saveModePrompt()">Save Mode Prompt</button>
      </div>

      <div style="font-size:12px; font-weight:600; margin-top:20px; margin-bottom:8px;">Reference files</div>
      <div style="background:var(--panel-dark); border:1px dashed var(--border-color); border-radius:10px; padding:30px; text-align:center;">
        <div style="font-size:12px; color:var(--text-secondary); margin-bottom:12px;">Add files as real-time context.</div>
        <button class="setting-btn">📎 Upload file</button>
      </div>
    `;
  } else if (pane === 'keybinds') {
    fullviewContentPane.innerHTML = `
      <div class="pane-title">Keyboard shortcuts</div>
      <div class="pane-subtitle">Intruely works with these easy to remember commands.</div>

      <div class="shortcut-row">
        <div>Toggle visibility of Intruely</div>
        <div class="key-badge">Ctrl + \\</div>
      </div>
      <div class="shortcut-row">
        <div>Ask Intruely about your screen or audio</div>
        <div class="key-badge">Ctrl + Enter</div>
      </div>
      <div class="shortcut-row">
        <div>Clear current conversation</div>
        <div class="key-badge">Ctrl + R</div>
      </div>
      <div class="shortcut-row">
        <div>Start or stop an Intruely session</div>
        <div class="key-badge">Ctrl + Shift + \\</div>
      </div>
    `;
  }
}

function saveApiKey(val) {
  apiKey = val.trim();
  localStorage.setItem('GEMINI_API_KEY', apiKey);
}

function saveModePrompt() {
  const el = document.getElementById('promptModeArea');
  if (el) {
    customPromptMode = el.value;
    localStorage.setItem('INTRUELY_MODE_PROMPT', customPromptMode);
    alert('Mode prompt context saved!');
  }
}

// AI Engine Call
async function callAI(userPrompt, imageBase64 = null) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const res = await fetch(`${BACKEND_URL}/ai/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        prompt: userPrompt,
        imageBase64: imageBase64,
        modePrompt: customPromptMode
      })
    });
    clearTimeout(timeoutId);
    
    if (res.ok) {
      const data = await res.json();
      if (data.response) return data.response;
    } else {
      const errData = await res.json().catch(() => ({}));
      if (errData.error) return `⚠️ Backend Error (${res.status}): ${errData.error}`;
    }
  } catch (backendErr) {
    console.log('Backend proxy network error or timeout:', backendErr);
  }

  if (!apiKey) {
    return "⚡ Free Cloud Backend is warming up on Render (free tier cold-start)! Please try again in 15 seconds, or add your free Gemini API key in Profile -> Settings for zero-wait responses.";
  }

  try {
    const fullPrompt = `System Context Mode:\n${customPromptMode}\n\nUser Question/Screen Request: ${userPrompt}\nGive a direct, optimal answer tailored to the mode instructions above.`;

    let payload = {
      contents: [{
        parts: [{ text: fullPrompt }]
      }]
    };

    if (imageBase64) {
      payload.contents[0].parts.push({
        inline_data: {
          mime_type: "image/png",
          data: imageBase64.replace(/^data:image\/\w+;base64,/, "")
        }
      });
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (data.candidates && data.candidates[0].content.parts[0].text) {
      return data.candidates[0].content.parts[0].text;
    }
    return "No response generated.";
  } catch (err) {
    return `Error connecting to AI: ${err.message}`;
  }
}

// Dock Handlers
dockPromptInput?.addEventListener('keydown', async (e) => {
  if (e.key === 'Enter' && dockPromptInput.value.trim()) {
    const q = dockPromptInput.value.trim();
    dockPromptInput.value = '';
    
    const emptyCard = document.getElementById('emptyStateCard');
    if (emptyCard) emptyCard.style.display = 'none';

    appendResponseCard('You', q, '#3b82f6');
    const aiCard = appendResponseCard('Intruely AI', 'Thinking...', '#22c55e');

    const res = await callAI(q);
    updateCardText(aiCard, res);
  }
});

dockSnapBtn?.addEventListener('click', triggerScreenSnap);
window.electronAPI?.onTriggerScreenCapture(triggerScreenSnap);
window.electronAPI?.onScrollWindow((deltaY) => {
  const container = document.getElementById('homePane') || document.getElementById('aiResponseFeed');
  if (container) {
    container.scrollBy({ top: deltaY, behavior: 'smooth' });
  }
});

async function triggerScreenSnap() {
  const emptyCard = document.getElementById('emptyStateCard');
  if (emptyCard) emptyCard.style.display = 'none';

  const aiCard = appendResponseCard('Intruely Vision', 'Analyzing screen snippet...', '#a855f7');
  try {
    const sources = await window.electronAPI.getScreenSources();
    if (sources && sources.length > 0) {
      const res = await callAI("Solve question shown on screen", sources[0].dataUrl);
      updateCardText(aiCard, res);
    }
  } catch (e) {
    updateCardText(aiCard, `Screen error: ${e.message}`);
  }
}

function appendResponseCard(author, text, color = '#22c55e') {
  const card = document.createElement('div');
  card.style.background = 'var(--panel-dark)';
  card.style.border = '1px solid var(--border-color)';
  card.style.borderRadius = '10px';
  card.style.padding = '12px';

  card.innerHTML = `
    <div style="font-size:11px; color:${color}; font-weight:700; margin-bottom:6px;">${author.toUpperCase()}</div>
    <div class="card-text" style="font-size:13px; line-height:1.5;">${text.replace(/\n/g, '<br>')}</div>
  `;
  aiResponseFeed.appendChild(card);
  const homePane = document.getElementById('homePane');
  if (homePane) homePane.scrollTop = homePane.scrollHeight;
  return card;
}

function updateCardText(card, text) {
  const el = card.querySelector('.card-text');
  if (el) el.innerHTML = text.replace(/\n/g, '<br>');
}
