# PyTutor 🐍

PyTutor is a desktop application designed to act as an interactive, AI-powered Python tutor for complete beginners. Built with Electron, it features an elegant user interface, automatic editor detection, and integration with powerful AI models to help users learn, understand, and write better Python code.

## 🌟 Key Features

*   **🔍 Active Editor Detection:** PyTutor automatically scans for open Python (`.py`) files across popular text editors and IDEs (VS Code, Cursor, PyCharm, Notepad++, IDLE wrappers). It reads the active file silently in the background, allowing the AI tutor to always have context on what you are working on.
*   **🤖 Intelligent AI Tutor:** It communicates in beginner-friendly language, breaking down complex programming concepts using real-world analogies, step-by-step explanations, and inline code comments, ensuring you learn instead of just copy-pasting.
*   **⚡ Code Quick Actions:**
    *   `💬 /comment`: Instructs the AI to add clear, line-by-line inline comments to your code so you understand what each line does.
    *   `⚡ /optimize`: Restructures your code to make it more Pythonic and efficient, complete with a detailed explanation of the changes.
    *   `✏️ /edit`: Suggest a custom textual change to your file. PyTutor will generate the code, backup your original, and apply it.
*   **💻 Integrated Terminal:** Run your Python scripts directly within the application. The integrated terminal captures `stdout` and `stderr` so you can instantly verify if your code works.
*   **🔌 Multi-AI Provider Support:** PyTutor is model-agnostic and gives you the flexibility to use the AI provider of your choice:
    *   **Copilot API** (via a local proxy server running on port `4141`)
    *   **Anthropic** (Claude 3 Opus/Sonnet/Haiku)
    *   **OpenAI** (GPT-4o, GPT-3.5)
    *   **Ollama** (Local inference for Llama 3, Mistral, etc.)

## 🛠️ Technology Stack

*   **Core:** [Electron.js](https://www.electronjs.org/) (Desktop framework)
*   **Backend (`main.js`):** Node.js IPC, child processes (`spawn` & `exec` for python subshells), file system backups, and cross-process window detection (via PowerShell tracking on Windows).
*   **Frontend (`index.html`):** Vanilla HTML/CSS/JS with a highly customized dark theme (`#080808`) utilizing the JetBrains Mono and Syne font suites, providing a premium IDE-like experience.

## 🚀 Getting Started

### Prerequisites
*   [Node.js](https://nodejs.org/en/) installed on your system.
*   Python (added to your system PATH).
*   For the Copilot proxy feature, ensure `copilot-api` is accessible in your environment.

### Installation

1.  **Clone or navigate** to the project directory.
2.  **Install dependencies:**
    ```cmd
    npm install
    ```

### Running the App

You can quickly get started using the provided batch script:
```cmd
start.bat
```

**Or manually via Terminal:**
1. Make sure your local Copilot API proxy is running (if using the primary Copilot setup):
   ```cmd
   copilot-api start
   ```
2. Start the Electron application:
   ```cmd
   npm start
   ```

## 📦 Building for Production

To package the application into a standalone `.exe` installer (via Electron Builder & NSIS):
```cmd
npm run pack
```
This generates your standalone application in the `/dist` directory.

## ⚙️ Configuration
Application settings are saved securely in your system's user data path (`%AppData%/pytutor/pytutor_settings.json`). 
You can switch providers, configure local API endpoint URLs (like Ollama's `localhost:11434`), and input raw API keys for Anthropic or OpenAI directly within the app's **Settings** menu.

## 📄 License
This project is for educational purposes out of the box. Modify and distribute at your own discretion.
# Py-Tutor
