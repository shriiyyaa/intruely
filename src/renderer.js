// Render Production Backend API Endpoint
const BACKEND_URL = 'https://intruely.onrender.com';

// DOM Elements
let activePane = 'general';
let isStealthActive = false;
let isSessionActive = false;
let recognition = null;
let customPromptMode = localStorage.getItem('INTRUELY_MODE_PROMPT') || `description: >
Comprehensive interview-prep reference for Shriya Nayyar covering background, work experience, and every project in technical depth, with anticipated interview questions and answer angles.`;

let apiKey = localStorage.getItem('GEMINI_API_KEY') || '';

// DOM Elements
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

// Window Handlers
minimizeBtn.addEventListener('click', () => window.electronAPI.minimizeWindow());
closeBtn.addEventListener('click', () => window.electronAPI.closeWindow());

homeTitleBtn.addEventListener('click', () => {
  fullviewOverlay.classList.remove('active');
  profileDropdown.classList.remove('active');
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

// Stealth Switch Toggle (Matches Image 1 & Image 4)
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

// Render Specific Pane UI (Exact Cluely Design Match)
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
            <div class="setting-title">Google Gemini API Key (Free)</div>
            <div class="setting-desc">Enter your free key for unlimited instant answers</div>
          </div>
        </div>
        <input type="password" id="geminiKeyField" class="dock-input" style="max-width:240px;" value="${apiKey}" placeholder="AIzaSy..." onchange="saveApiKey(this.value)" />
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
  } else if (pane === 'language') {
    fullviewContentPane.innerHTML = `
      <div class="pane-title">Language</div>
      <div class="pane-subtitle">Select the language you want to use for your meetings.</div>

      <div class="setting-card">
        <div>
          <div class="setting-title">Transcription language</div>
          <div class="setting-desc">Select the language you speak in meetings.</div>
        </div>
        <select class="setting-btn"><option>English (recommended)</option></select>
      </div>

      <div class="setting-card">
        <div>
          <div class="setting-title">Output language</div>
          <div class="setting-desc">Your preferred language for AI and meeting notes.</div>
        </div>
        <select class="setting-btn"><option>English</option></select>
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

// AI Engine Call (Tries Render Production Backend Proxy First, falls back to direct API key)
async function callAI(userPrompt, imageBase64 = null) {
  try {
    const res = await fetch(`${BACKEND_URL}/ai/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: userPrompt,
        imageBase64: imageBase64,
        modePrompt: customPromptMode
      })
    });
    
    if (res.ok) {
      const data = await res.json();
      if (data.response) return data.response;
    }
  } catch (backendErr) {
    console.log('Backend proxy unavailable, trying direct API key fallback...', backendErr);
  }

  // Fallback: Direct Gemini API Call if BYOK API key configured
  if (!apiKey) {
    return "⚠️ Please set your free Gemini API key in Profile -> Settings (or wait a moment for backend to warm up)!";
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

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
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

// Interactive Dock Inputs
dockPromptInput.addEventListener('keydown', async (e) => {
  if (e.key === 'Enter' && dockPromptInput.value.trim()) {
    const q = dockPromptInput.value.trim();
    dockPromptInput.value = '';
    
    appendResponseCard('You', q, '#3b82f6');
    const aiCard = appendResponseCard('Intruely AI', 'Thinking...', '#22c55e');

    const res = await callAI(q);
    updateCardText(aiCard, res);
  }
});

dockSnapBtn.addEventListener('click', triggerScreenSnap);
window.electronAPI.onTriggerScreenCapture(triggerScreenSnap);
window.electronAPI.onScrollWindow((deltaY) => {
  const container = document.getElementById('homePane') || document.getElementById('aiResponseFeed');
  if (container) {
    container.scrollBy({ top: deltaY, behavior: 'smooth' });
  }
});

async function triggerScreenSnap() {
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
  homePane.scrollTop = homePane.scrollHeight;
  return card;
}

function updateCardText(card, text) {
  const el = card.querySelector('.card-text');
  if (el) el.innerHTML = text.replace(/\n/g, '<br>');
}
