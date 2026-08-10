# Intruely - 100% Free Stealth AI Meeting & Interview Copilot

**Intruely** is an open-source, 100% free, Windows-native desktop application designed as an undetectable real-time AI assistant for meetings and technical interviews (1:1 replica of Cluely).

![Intruely Stealth Assistant](https://img.shields.io/badge/Platform-Windows-blue) ![License-MIT](https://img.shields.io/badge/License-MIT-green) ![Status-Free](https://img.shields.io/badge/Cost-100%25%20Free-brightgreen)

---

## 🌟 Key Features

* **🛡️ Stealth / Window Protection (`WDA_EXCLUDEFROMCAPTURE`)**: Uses native Win32 API display affinity settings to ensure the overlay is **completely invisible to Zoom, Microsoft Teams, Google Meet, Discord, OBS Studio, and screen recorders** while remaining 100% visible to you.
* **📂 Manage Modes System**: Create and save real-time background context prompts (e.g. candidate details, resume context, behavioral targets, technical depth). Intruely incorporates your active mode into every live answer!
* **🎙️ Universal Audio Engine**: Select AirPods, Bluetooth headsets, external microphones, or system default inputs for real-time speech transcription & answers.
* **📷 Instant Vision Solver (`Ctrl + Enter`)**: Snapshot your screen/question to receive zero-latency answers powered by Gemini 2.0 Flash Vision.
* **⚡ 100% Free & Unlimited**: Works with a free Google Gemini API Key (1,500 requests/day for $0) or offline Ollama AI models—no subscription fees ever.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| **`Ctrl + \`** | Toggle Intruely Overlay Window Visibility |
| **`Ctrl + Enter`** | Ask Intruely about your screen/question (Vision Solve) |
| **`Ctrl + Shift + \`** | Start or Stop Live Audio Session |
| **`Ctrl + R`** | Clear conversation feed |

---

## 🚀 Quick Start & Installation

### Prerequisites
* [Node.js](https://nodejs.org/) (v16 or higher)
* [Git](https://git-scm.com/)

### Setup Instructions

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

4. **Configure your Free API Key:**
   * Click **S** (Profile Avatar) -> **Settings**.
   * Enter your free **Google Gemini API Key** (get one in 10 seconds at [aistudio.google.com](https://aistudio.google.com/)).
   * Click **Save**.

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/shriiyyaa/intruely/issues).

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
