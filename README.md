# Intruely - 100% Free Stealth AI Meeting & Interview Copilot

**Intruely** is an open-source, 100% free, Windows-native desktop application designed as an undetectable real-time AI assistant for meetings and technical interviews (1:1 replica of Cluely).

![Intruely Stealth Assistant](https://img.shields.io/badge/Platform-Windows-blue) ![License-MIT](https://img.shields.io/badge/License-MIT-green) ![Cost-Free](https://img.shields.io/badge/Cost-100%25%20Free-brightgreen) ![Backend-Live](https://img.shields.io/badge/Backend-Render%20Online-success)

---

## 🌐 Quick Links

* 📥 **Download Windows Executable (`.exe`)**: [GitHub Release v1.0.0](https://github.com/shriiyyaa/intruely/releases/tag/v1.0.0)
* 🌐 **Official Landing Page**: [https://shriiyyaa.github.io/intruely](https://shriiyyaa.github.io/intruely)
* ⚡ **Production Backend API**: [https://intruely.onrender.com](https://intruely.onrender.com)
* 💻 **Source Code Repository**: [https://github.com/shriiyyaa/intruely](https://github.com/shriiyyaa/intruely)

---

## 🌟 Key Features

* **🛡️ Stealth / Window Protection (`WDA_EXCLUDEFROMCAPTURE`)**: Uses native Win32 API display affinity settings to ensure the overlay is **completely invisible to Zoom, Microsoft Teams, Google Meet, Discord, OBS Studio, and screen recorders** while remaining 100% visible to you.
* **📂 Manage Modes System**: Create and save real-time background context prompts (e.g. candidate details, resume context, behavioral targets, technical depth). Intruely incorporates your active mode into every live answer!
* **🎙️ Universal Audio Engine**: Select AirPods, Bluetooth headsets, external microphones, or system default inputs for real-time speech transcription & answers.
* **📷 Instant Vision Solver (`Ctrl + Enter`)**: Snapshot your screen/question to receive zero-latency answers powered by Gemini 2.0 Flash Vision via our Render production backend.
* **⚡ 100% Free & Unlimited**: Backend proxied to free Gemini 2.0 Flash API (1,500 requests/day for $0) or offline Ollama AI models—no subscription fees ever.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| **`Ctrl + \`** | Toggle Intruely Overlay Window Visibility |
| **`Ctrl + Enter`** | Ask Intruely about your screen/question (Vision Solve) |
| **`Ctrl + Shift + \`** | Start or Stop Live Audio Session |
| **`Ctrl + R`** | Clear conversation feed |

---

## 🚀 Quick Start & How to Use

### Option 1: Direct Download (No Setup Needed)
1. Download **[`Intruely 1.0.0.exe`](https://github.com/shriiyyaa/intruely/releases/tag/v1.0.0)** from the releases page.
2. Double-click to run — portable, no installer or admin rights required.
3. Use `Ctrl + Enter` for screen question solving or click **▶ Start Session** for live meeting assistance!

### Option 2: Run from Source
1. **Clone the repository:**
   ```bash
   git clone https://github.com/shriiyyaa/intruely.git
   cd intruely
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Launch Intruely:**
   ```bash
   npm start
   ```

---

## 🛠️ Architecture Overview

```
Intruely Desktop App (Electron / Win32 Stealth)
       │
       ▼
Intruely Production Backend (Render.com)
 [https://intruely.onrender.com]
       │
       ▼
Google Gemini 2.0 Flash Multimodal Vision AI
```

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/shriiyyaa/intruely/issues).

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
