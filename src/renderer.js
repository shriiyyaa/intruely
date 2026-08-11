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
minimizeBtn?.addEventListener('click', () => window.electronAPI?.minimizeWindow());
closeBtn?.addEventListener('click', () => window.electronAPI?.closeWindow());

homeTitleBtn?.addEventListener('click', () => {
  fullviewOverlay?.classList.remove('active');
  profileDropdown?.classList.remove('active');
});

// Back button and sidebar close button both dismiss fullview overlay
document.getElementById('backBtn')?.addEventListener('click', () => {
  fullviewOverlay?.classList.remove('active');
});

// Close sidebar button (← inside the settings panel)
document.addEventListener('click', (e) => {
  if (e.target && e.target.id === 'closeSidebarBtn') {
    fullviewOverlay?.classList.remove('active');
  }
  if (e.target && e.target.id === 'quitAppBtn') {
    window.electronAPI?.closeWindow();
  }
});

refreshBtn?.addEventListener('click', () => {
  location.reload();
});

// Profile Dropdown Toggle
profileBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  profileDropdown?.classList.toggle('active');
});

document.addEventListener('click', () => {
  profileDropdown?.classList.remove('active');
});

document.getElementById('manageModesMenuItem')?.addEventListener('click', () => {
  openFullview('modes');
});

document.getElementById('settingsMenuItem')?.addEventListener('click', () => {
  openFullview('general');
});

// Stealth Switch Toggle
stealthToggle?.addEventListener('click', () => {
  isStealthActive = !isStealthActive;
  stealthToggle.classList.toggle('off', !isStealthActive);
  if (stealthLabel) stealthLabel.innerText = isStealthActive ? 'Stealth Active' : 'Detectable';
  window.electronAPI?.toggleStealth(isStealthActive);
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
  fullviewOverlay?.classList.add('active');
  profileDropdown?.classList.remove('active');
  renderPaneContent(paneName);
}

// Session Controller Logic — Transforms between Main Window and Floating Pill (Image 3)
heroStartBtn?.addEventListener('click', toggleSession);
centerStartBtn?.addEventListener('click', toggleSession);
listenSessionBtn?.addEventListener('click', toggleSession);
stopFloatingBtn?.addEventListener('click', toggleSession);

// Wire Ctrl+Shift+\ global hotkey to toggle session
window.electronAPI?.onToggleSession(toggleSession);

hideFloatingBtn?.addEventListener('click', () => {
  if (floatingOverlay) floatingOverlay.style.display = 'none';
  if (mainAppWindow) mainAppWindow.style.display = 'flex';
});

function toggleSession() {
  isSessionActive = !isSessionActive;
  if (isSessionActive) {
    // 1:1 Cluely Behavior: Session starts -> main window hides into sleek top floating pill card!
    if (mainAppWindow) mainAppWindow.style.display = 'none';
    if (floatingOverlay) floatingOverlay.style.display = 'flex';

    if (listenSessionBtn) {
      listenSessionBtn.innerText = '⏹ Stop Session';
      listenSessionBtn.style.background = '#ef4444';
    }
    if (heroStartBtn) {
      heroStartBtn.innerText = '⏹ Stop';
      heroStartBtn.style.background = '#ef4444';
    }

    // Hide onboarding card once session begins
    const emptyCard = document.getElementById('emptyStateCard');
    if (emptyCard) emptyCard.style.display = 'none';

    startSpeechRecognition();
  } else {
    if (floatingOverlay) floatingOverlay.style.display = 'none';
    if (mainAppWindow) mainAppWindow.style.display = 'flex';

    if (listenSessionBtn) {
      listenSessionBtn.innerText = '▶ Start Session';
      listenSessionBtn.style.background = '#22c55e';
    }
    if (heroStartBtn) {
      heroStartBtn.innerText = '✈ Start Intruely';
      heroStartBtn.style.background = '#3b82f6';
    }

    stopSpeechRecognition();
  }
}

// Transcript Drawer Toggle Handler
const toggleTranscriptBtn = document.getElementById('toggleTranscriptBtn');
const transcriptDrawer = document.getElementById('transcriptDrawer');
const liveTranscriptIndicator = document.getElementById('liveTranscriptIndicator');
const transcriptLogContent = document.getElementById('transcriptLogContent');

toggleTranscriptBtn?.addEventListener('click', toggleTranscriptDrawer);
liveTranscriptIndicator?.addEventListener('click', toggleTranscriptDrawer);

function toggleTranscriptDrawer() {
  if (transcriptDrawer) {
    const isHidden = transcriptDrawer.style.display === 'none';
    transcriptDrawer.style.display = isHidden ? 'block' : 'none';
    if (toggleTranscriptBtn) {
      toggleTranscriptBtn.innerText = isHidden ? '🎙️ Hide Transcript' : '🎙️ View Transcript';
    }
  }
}

// ===================================================================
// DUAL-TRACK AUDIO ENGINE
// Track 1: System Audio Loopback via desktopCapturer (hears meetings)
// Track 2: Microphone via getUserMedia (hears user speech)
// Both feed into Web Speech API recognition on their own audio context
// ===================================================================

let micStream = null;
let systemAudioStream = null;
let micRecognition = null;
let systemRecognition = null;

function appendTranscriptEntry(text, source) {
  if (liveSpeechText) liveSpeechText.innerText = `${source}: "${text}"`;

  const splitBox = document.getElementById('splitTranscriptBox');
  const placeholder = document.getElementById('transcriptPlaceholder');
  if (placeholder) placeholder.style.display = 'none';

  if (splitBox) {
    const entry = document.createElement('div');
    entry.style.margin = '6px 0';
    entry.style.padding = '6px 8px';
    entry.style.background = 'rgba(255, 255, 255, 0.03)';
    entry.style.borderLeft = source === 'MIC' ? '3px solid #38bdf8' : '3px solid #10b981';
    entry.style.borderRadius = '4px';
    entry.style.fontSize = '12px';
    const color = source === 'MIC' ? '#38bdf8' : '#10b981';
    entry.innerHTML = `<span style="color:${color}; font-weight:700;">[${source}]</span> ${text}`;
    splitBox.appendChild(entry);
    splitBox.scrollTop = splitBox.scrollHeight;
  }

  if (transcriptLogContent) {
    const entry = document.createElement('div');
    entry.style.margin = '4px 0';
    entry.style.fontSize = '11px';
    const color = source === 'MIC' ? '#38bdf8' : '#10b981';
    entry.innerHTML = `<span style="color:${color}; font-weight:700;">[${source}]</span> ${text}`;
    transcriptLogContent.appendChild(entry);
    transcriptLogContent.scrollTop = transcriptLogContent.scrollHeight;
  }
}

function buildRecognition(stream, sourceLabel) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return null;

  const rec = new SpeechRecognition();
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = 'en-US';

  // Pipe the MediaStream audio into the recognition engine via AudioContext
  const audioCtx = new AudioContext();
  const source = audioCtx.createMediaStreamSource(stream);
  const dest = audioCtx.createMediaStreamDestination();
  source.connect(dest);

  // Override the recognition stream via MediaStreamConstraints hack
  // We attach to the hidden audio element approach:
  let hiddenAudio = document.createElement('audio');
  hiddenAudio.srcObject = stream;
  hiddenAudio.muted = true; // Don't play it back
  document.body.appendChild(hiddenAudio);

  rec.onresult = (event) => {
    let text = '';
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      text += event.results[i][0].transcript;
    }
    if (text.trim()) {
      appendTranscriptEntry(text.trim(), sourceLabel);
    }
  };

  rec.onerror = (err) => {
    if (err.error !== 'no-speech') {
      console.warn(`[${sourceLabel}] Recognition error:`, err.error);
    }
  };

  rec.onend = () => {
    // Auto-restart if session still active
    if (isSessionActive) {
      try { rec.start(); } catch(e) {}
    }
  };

  try { rec.start(); } catch(e) { console.warn('Rec start err:', e); }
  return rec;
}

async function startSpeechRecognition() {
  const splitLiveStatus = document.getElementById('splitLiveStatus');
  if (splitLiveStatus) splitLiveStatus.classList.add('active');

  // Step 1: Explicitly request mic access — this unlocks Web Speech API in Electron
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    console.log('[Mic] getUserMedia granted — tracks:', micStream.getAudioTracks().length);
    if (liveSpeechText) liveSpeechText.innerText = '🎙️ Microphone access granted. Starting recognition...';
  } catch (micErr) {
    console.error('[Mic] getUserMedia denied:', micErr);
    if (liveSpeechText) liveSpeechText.innerText = `❌ Microphone denied: ${micErr.message}. Grant mic permission in Windows Settings > Privacy > Microphone.`;
    appendTranscriptEntry(`Microphone access denied: ${micErr.message}`, 'ERROR');
    return;
  }

  // Step 2: Start Web Speech Recognition
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    if (liveSpeechText) liveSpeechText.innerText = '❌ SpeechRecognition API not available in this Electron build.';
    appendTranscriptEntry('SpeechRecognition not supported.', 'ERROR');
    return;
  }

  try {
    micRecognition = new SpeechRecognition();
    micRecognition.continuous = true;
    micRecognition.interimResults = true;
    micRecognition.lang = 'en-US';
    micRecognition.maxAlternatives = 1;

    micRecognition.onstart = () => {
      console.log('[Speech] Recognition started');
      if (liveSpeechText) liveSpeechText.innerText = '🟢 Listening... speak or play audio.';
    };

    micRecognition.onaudiostart = () => {
      console.log('[Speech] Audio detected');
      if (liveSpeechText) liveSpeechText.innerText = '🟢 Microphone active — detecting speech...';
    };

    micRecognition.onsoundstart = () => {
      if (liveSpeechText) liveSpeechText.innerText = '🔊 Sound detected — transcribing...';
    };

    micRecognition.onresult = (event) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += t;
        else interim += t;
      }
      const text = (final || interim).trim();
      if (text) {
        if (liveSpeechText) liveSpeechText.innerText = `🎙️ "${text}"`;
        appendTranscriptEntry(text, final ? 'MIC' : '...');
      }
    };

    micRecognition.onerror = (err) => {
      console.warn('[Speech] Error:', err.error, err.message);
      if (err.error === 'not-allowed') {
        if (liveSpeechText) liveSpeechText.innerText = '❌ Microphone blocked. Allow mic in Windows Privacy Settings.';
        appendTranscriptEntry('Mic blocked by OS. Go to Windows Settings > Privacy > Microphone > Allow desktop apps.', 'ERROR');
      } else if (err.error === 'network') {
        if (liveSpeechText) liveSpeechText.innerText = '⚠️ Speech network error — check internet connection.';
      } else if (err.error !== 'no-speech') {
        if (liveSpeechText) liveSpeechText.innerText = `⚠️ Speech error: ${err.error}`;
      }
    };

    micRecognition.onend = () => {
      console.log('[Speech] Recognition ended. isSessionActive:', isSessionActive);
      if (isSessionActive) {
        // Auto-restart after 300ms to avoid rapid restart loops
        setTimeout(() => {
          if (isSessionActive && micRecognition) {
            try { micRecognition.start(); } catch(e) { console.warn('[Speech] Restart error:', e.message); }
          }
        }, 300);
      } else {
        if (splitLiveStatus) splitLiveStatus.classList.remove('active');
        if (liveSpeechText) liveSpeechText.innerText = 'Session stopped.';
      }
    };

    micRecognition.start();
  } catch (e) {
    console.error('[Speech] Initialization error:', e);
    if (liveSpeechText) liveSpeechText.innerText = `❌ Speech init failed: ${e.message}`;
    appendTranscriptEntry(`Speech init failed: ${e.message}`, 'ERROR');
  }
}

function stopSpeechRecognition() {
  try { micRecognition?.stop(); } catch(e) {}
  try { micStream?.getTracks().forEach(t => t.stop()); } catch(e) {}
  micRecognition = null;
  micStream = null;
  systemRecognition = null;
  systemAudioStream = null;
  if (liveSpeechText) liveSpeechText.innerText = 'Session stopped.';
}


// Quick Chip Assistant Triggers (Image 3)
document.getElementById('chipAssist')?.addEventListener('click', () => sendFloatingPrompt("Provide an instant assist for the current screen question."));
document.getElementById('chipSay')?.addEventListener('click', () => sendFloatingPrompt("What optimal response should I say right now?"));
document.getElementById('chipFollowup')?.addEventListener('click', () => sendFloatingPrompt("Suggest 3 intelligent follow-up questions to ask."));
document.getElementById('chipRecap')?.addEventListener('click', () => sendFloatingPrompt("Provide a concise summary recap of the discussion so far."));

floatingSendBtn?.addEventListener('click', () => {
  if (floatingPromptInput && floatingPromptInput.value.trim()) {
    sendFloatingPrompt(floatingPromptInput.value.trim());
    floatingPromptInput.value = '';
  }
});

floatingPromptInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && floatingPromptInput && floatingPromptInput.value.trim()) {
    sendFloatingPrompt(floatingPromptInput.value.trim());
    floatingPromptInput.value = '';
  }
});

async function sendFloatingPrompt(q) {
  const emptyCard = document.getElementById('emptyStateCard');
  if (emptyCard) emptyCard.style.display = 'none';

  appendResponseCard('You', q, '#3b82f6');
  const aiCard = appendResponseCard('Intruely AI', 'Thinking...', '#22c55e');

  // Also append to floating drawer content if active
  if (transcriptLogContent) {
    const promptEntry = document.createElement('div');
    promptEntry.style.margin = '6px 0';
    promptEntry.style.color = '#3b82f6';
    promptEntry.style.fontWeight = '700';
    promptEntry.innerHTML = `[YOU]: ${q}`;
    transcriptLogContent.appendChild(promptEntry);
  }

  const res = await callAI(q);
  updateCardText(aiCard, res);

  if (transcriptLogContent) {
    const aiEntry = document.createElement('div');
    aiEntry.style.margin = '6px 0';
    aiEntry.style.color = '#22c55e';
    aiEntry.style.fontSize = '12px';
    aiEntry.style.lineHeight = '1.4';
    aiEntry.innerHTML = `<span style="font-weight:700;">[INTRUELY AI]:</span><br>${res.replace(/\n/g, '<br>')}`;
    transcriptLogContent.appendChild(aiEntry);
    transcriptLogContent.scrollTop = transcriptLogContent.scrollHeight;
  }
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
  } else if (pane === 'calendar') {
    fullviewContentPane.innerHTML = `
      <div class="pane-title">Calendar</div>
      <div class="pane-subtitle">Connect your calendar to get meeting notifications.</div>
      <div class="setting-card" style="margin-top:20px;">
        <div class="setting-info">
          <div class="setting-icon">📅</div>
          <div>
            <div class="setting-title">Google Calendar</div>
            <div class="setting-desc">Connect to get AI prep before your meetings start.</div>
          </div>
        </div>
        <button class="setting-btn">Connect</button>
      </div>
      <div class="setting-card">
        <div class="setting-info">
          <div class="setting-icon">🗓️</div>
          <div>
            <div class="setting-title">Outlook / Microsoft 365</div>
            <div class="setting-desc">Connect your Outlook calendar for meeting sync.</div>
          </div>
        </div>
        <button class="setting-btn">Connect</button>
      </div>
    `;
  } else if (pane === 'profile') {
    fullviewContentPane.innerHTML = `
      <div class="pane-title">Profile</div>
      <div class="pane-subtitle">Your Intruely account details.</div>
      <div class="setting-card" style="margin-top:20px;">
        <div class="setting-info">
          <div class="setting-icon" style="font-size:28px; width:44px; height:44px; background:#3b82f6; border-radius:50%; display:flex; align-items:center; justify-content:center; color:white; font-weight:700;">S</div>
          <div>
            <div class="setting-title">Shriya Nayyar</div>
            <div class="setting-desc">snayya526@gmail.com &nbsp;·&nbsp; Free Plan</div>
          </div>
        </div>
      </div>
      <div class="setting-card">
        <div class="setting-info">
          <div class="setting-icon">🔑</div>
          <div>
            <div class="setting-title">Gemini API Key</div>
            <div class="setting-desc">Using cloud backend. Enter your key for private BYOK mode.</div>
          </div>
        </div>
        <input type="password" class="dock-input" style="max-width:220px;" value="${apiKey}" placeholder="Enter Gemini API key..." onchange="saveApiKey(this.value)" />
      </div>
    `;
  } else if (pane === 'language') {
    fullviewContentPane.innerHTML = `
      <div class="pane-title">Language</div>
      <div class="pane-subtitle">Set the language Intruely listens and responds in.</div>
      <div class="setting-card" style="margin-top:20px;">
        <div class="setting-info">
          <div class="setting-icon">🌐</div>
          <div>
            <div class="setting-title">Recognition Language</div>
            <div class="setting-desc">Language used for live speech recognition.</div>
          </div>
        </div>
        <select class="setting-btn" style="cursor:pointer;" onchange="localStorage.setItem('INTRUELY_LANG', this.value)">
          <option value="en-US" ${localStorage.getItem('INTRUELY_LANG') === 'en-US' || !localStorage.getItem('INTRUELY_LANG') ? 'selected' : ''}>English (US)</option>
          <option value="en-GB" ${localStorage.getItem('INTRUELY_LANG') === 'en-GB' ? 'selected' : ''}>English (UK)</option>
          <option value="hi-IN" ${localStorage.getItem('INTRUELY_LANG') === 'hi-IN' ? 'selected' : ''}>Hindi</option>
          <option value="fr-FR" ${localStorage.getItem('INTRUELY_LANG') === 'fr-FR' ? 'selected' : ''}>French</option>
          <option value="de-DE" ${localStorage.getItem('INTRUELY_LANG') === 'de-DE' ? 'selected' : ''}>German</option>
        </select>
      </div>
    `;
  } else if (pane === 'billing') {
    fullviewContentPane.innerHTML = `
      <div class="pane-title">Billing</div>
      <div class="pane-subtitle">Manage your Intruely subscription.</div>
      <div class="setting-card" style="margin-top:20px; border-color: rgba(34,197,94,0.3);">
        <div class="setting-info">
          <div class="setting-icon">✅</div>
          <div>
            <div class="setting-title">Free Plan — Active</div>
            <div class="setting-desc">You are on the Intruely Free tier. Powered by Gemini 1.5 Flash cloud backend.</div>
          </div>
        </div>
      </div>
      <div class="setting-card">
        <div class="setting-info">
          <div class="setting-icon">⚡</div>
          <div>
            <div class="setting-title">Upgrade to Pro</div>
            <div class="setting-desc">Unlimited AI responses, priority processing, and advanced context modes.</div>
          </div>
        </div>
        <button class="setting-btn" style="background:#3b82f6; color:white;">Upgrade</button>
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
// Provider waterfall: Cloud Backend → Direct Gemini BYOK → Groq BYOK
async function callAI(userPrompt, imageBase64 = null) {
  const systemPrompt = customPromptMode || `You are Intruely AI, an elite real-time interview copilot. For behavioral questions use STAR framework. For coding questions give 3-tier approach (brute force → optimized → optimal) in C++/Python. Be concise, authoritative, first-person.`;

  // ── 1. Try cloud backend (fast path, handles key rotation server-side) ──────
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${BACKEND_URL}/ai/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ prompt: userPrompt, imageBase64, modePrompt: systemPrompt })
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      if (data.response) return data.response;
    }
  } catch (e) {
    console.log('[AI] Cloud backend unavailable, trying direct BYOK:', e.message);
  }

  // ── 2. Direct Gemini BYOK (no cold-start, instant) ─────────────────────────
  if (apiKey) {
    try {
      const fullPrompt = `${systemPrompt}\n\nUser Question: ${userPrompt}`;
      let payload = { contents: [{ parts: [{ text: fullPrompt }] }] };
      if (imageBase64) {
        payload.contents[0].parts.push({
          inline_data: { mime_type: 'image/png', data: imageBase64.replace(/^data:image\/\w+;base64,/, '') }
        });
      }
      const geminiModels = ['gemini-1.5-flash', 'gemini-2.0-flash-exp'];
      for (const model of geminiModels) {
        const resp = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
        );
        const data = await resp.json();
        if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
          return data.candidates[0].content.parts[0].text;
        }
      }
    } catch (e) {
      console.log('[AI] Direct Gemini BYOK failed:', e.message);
    }
  }

  // ── 3. Groq BYOK fallback (llama-3.3-70b-versatile) ───────────────────────
  const groqKey = localStorage.getItem('GROQ_API_KEY');
  if (groqKey) {
    try {
      const groqResp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqKey}` },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.2,
          max_tokens: 2048
        })
      });
      const groqData = await groqResp.json();
      if (groqData.choices?.[0]?.message?.content) return groqData.choices[0].message.content;
    } catch (e) {
      console.log('[AI] Groq BYOK failed:', e.message);
    }
  }

  return '⚠️ All AI providers unavailable. Check your internet connection or add a Gemini API key in Settings.';
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
  if (aiResponseFeed) {
    aiResponseFeed.appendChild(card);
    aiResponseFeed.scrollTop = aiResponseFeed.scrollHeight;
  }
  return card;
}

function updateCardText(card, text) {
  const el = card.querySelector('.card-text');
  if (el) el.innerHTML = text.replace(/\n/g, '<br>');
}
