const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path   = require('path');
const os     = require('os');
const fs     = require('fs');
const { execSync, exec, spawn } = require('child_process');

// ── Config & Settings ────────────────────────────────────────────────────────
const SETTINGS_FILE = path.join(app.getPath('userData'), 'pytutor_settings.json');

function loadSettings() {
  const defaults = {
    provider: 'copilot',
    ollamaUrl: 'http://localhost:11434',
    anthropicKey: '',
    openaiKey: ''
  };
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
      return { ...defaults, ...data };
    }
  } catch (e) {}
  return defaults;
}

function saveSettings(settings) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
}

// IPC Handlers for Settings
ipcMain.handle('get-settings', () => loadSettings());
ipcMain.handle('save-settings', (_, settings) => saveSettings(settings));

// Dynamic Model Fetching
ipcMain.handle('fetch-models', async (_, provider) => {
  const settings = loadSettings();
  try {
    if (provider === 'ollama') {
      // Use execSync or fetch for Ollama list. `ollama list` is a CLI tool,
      // but hitting the API directly is safer if ollama isn't in PATH.
      const res = await fetch(`${settings.ollamaUrl}/api/tags`);
      if (res.ok) {
        const data = await res.json();
        return data.models.map(m => m.name);
      }
      return ['llama3', 'llama3:8b', 'mistral']; // fallback if fetch fails but we want to show *something* or just throw
    }
    else if (provider === 'copilot') {
      try {
        const res = await fetch('http://localhost:4141/v1/models', {
          headers: { 'Authorization': 'Bearer copilot' },
          // Abort Signal isn't easily supported across all Node fetch versions without AbortController
        });
        if (res.ok) {
          const data = await res.json();
          if (data.data && Array.isArray(data.data)) {
            return data.data.map(m => m.id);
          }
        }
      } catch (e) {
        // Fallback
      }
      return [
        'claude-opus-4.6',
        'claude-sonnet-4.6',
        'gemini-3.1-pro-preview',
        'goldeneye-free-auto',
        'gpt-5.2-codex',
        'gpt-5.3-codex',
        'gpt-5.4-mini',
        'gpt-5.4',
        'minimax-m2.5',
        'gpt-5-mini',
        'gpt-4o-mini-2024-07-18',
        'gpt-4o-2024-11-20',
        'gpt-4o-2024-08-06',
        'grok-code-fast-1',
        'gpt-5.1',
        'claude-sonnet-4',
        'claude-sonnet-4.5',
        'claude-opus-4.5',
        'claude-haiku-4.5',
        'gemini-3-flash-preview',
        'gemini-2.5-pro',
        'gpt-4.1-2025-04-14',
        'oswe-vscode-prime',
        'oswe-vscode-secondary',
        'gpt-5.2',
        'gpt-41-copilot',
        'gpt-3.5-turbo-0613',
        'gpt-4-0613',
        'gpt-4-0125-preview',
        'gpt-4o-2024-05-13',
        'gpt-4-o-preview',
        'gpt-4.1',
        'gpt-3.5-turbo',
        'gpt-4o-mini',
        'gpt-4',
        'gpt-4o'
      ];
    }
    else if (provider === 'anthropic') {
      return ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'];
    }
    else if (provider === 'openai') {
      return ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'];
    }
  } catch (err) {
    console.error('Error fetching models:', err);
  }
  return ['default-model']; // fallback
});

// ── Window ────────────────────────────────────────────────────────────────────
let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 600,
    frame: false,
    backgroundColor: '#0a0a0a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile('index.html');
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

// Window controls
ipcMain.on('window-minimize', () => win.minimize());
ipcMain.on('window-maximize', () => win.isMaximized() ? win.unmaximize() : win.maximize());
ipcMain.on('window-close',    () => win.close());
ipcMain.handle('window-toggle-top', () => {
  const isTop = win.isAlwaysOnTop();
  win.setAlwaysOnTop(!isTop);
  return !isTop;
});

let copilotServerProcess = null;

ipcMain.handle('toggle-server', async (event) => {
  if (copilotServerProcess) {
    copilotServerProcess.kill();
    copilotServerProcess = null;
    return false;
  } else {
    copilotServerProcess = spawn('copilot-api', ['start'], { shell: true });

    copilotServerProcess.on('close', () => {
      copilotServerProcess = null;
      try {
        event.sender.send('server-status-changed', false);
      } catch (e) {}
    });

    return true;
  }
});

// Clean up processes on exit
app.on('before-quit', () => {
  if (copilotServerProcess) copilotServerProcess.kill();
  if (activePythonProcess) activePythonProcess.kill();
});

// Helper to check if local server is running by attempting to connect to its port
ipcMain.handle('check-server', async () => {
  try {
    const res = await fetch('http://localhost:4141/v1/models', {
      signal: AbortSignal.timeout(1000)
    });
    return true; // Successfully connected and got a response
  } catch (e) {
    return false; // Connection refused or timeout
  }
});


// ── File helpers ──────────────────────────────────────────────────────────────
function backupFile(filepath) {
  const src  = path.resolve(filepath);
  const ts   = new Date().toTimeString().slice(0,8).replace(/:/g, '');
  const ext  = path.extname(src);
  const base = path.basename(src, ext);
  const dest = path.join(path.dirname(src), `${base}.bak_${ts}${ext}`);
  fs.copyFileSync(src, dest);
  return dest;
}

function writeFile(filepath, content) {
  fs.writeFileSync(path.resolve(filepath), content, 'utf8');
}


// ── Active file detection ─────────────────────────────────────────────────────

// Known editors and how to detect the open file from their window title
const EDITOR_PATTERNS = [
  // VS Code / Cursor / VSCodium: "filename.py — foldername — Editor"
  { re: /^(.+?)\s*[—\-]{1,2}\s*.+?\s*[—\-]{1,2}\s*(Visual Studio Code|Cursor|VSCodium)/i, name: (m) => m[1].trim(), editor: (m) => m[2] },
  // Notepad++: "filename.py - Notepad++"
  { re: /^(.+?)\s*[-—]\s*(Notepad\+\+)/i, name: (m) => m[1].trim(), editor: (m) => m[2] },
  // Notepad / WordPad
  { re: /^(.+?)\s*[-—]\s*(Notepad|WordPad)/i, name: (m) => m[1].trim(), editor: (m) => m[2] },
  // IDLE: "filename.py - IDLE Shell..."
  { re: /^(.+?\.py)\s*[-—]/i, name: (m) => m[1].trim(), editor: () => 'IDLE/Other' },
  // PyCharm: "filename.py - projectname - PyCharm"
  { re: /^(.+?)\s*[-—]\s*.+?\s*[-—]\s*(PyCharm|IntelliJ|Spyder|Thonny)/i, name: (m) => m[1].trim(), editor: (m) => m[2] },
];

// Get VS Code / Cursor active workspace folder from their storage.json
function getEditorWorkspaceFolder(editorName) {
  const appDataDir = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');

  const storagePaths = {
    'visual studio code': path.join(appDataDir, 'Code', 'storage.json'),
    'cursor':             path.join(appDataDir, 'Cursor', 'storage.json'),
    'vscodium':           path.join(appDataDir, 'VSCodium', 'storage.json'),
  };

  const key = editorName.toLowerCase();
  for (const [k, storagePath] of Object.entries(storagePaths)) {
    if (!key.includes(k.split(' ')[0])) continue;
    if (!fs.existsSync(storagePath)) continue;
    try {
      const data = JSON.parse(fs.readFileSync(storagePath, 'utf8'));
      const folderUri = data?.windowsState?.lastActiveWindow?.folderUri
                     || data?.windowsState?.openedWindows?.[0]?.folderUri;
      if (!folderUri) continue;

      // file:///d%3A/Python%20learning  →  D:\Python learning
      let folder = decodeURIComponent(folderUri.replace(/^file:\/\/\//, ''));
      if (process.platform === 'win32') {
        folder = folder.replace(/\//g, '\\');
        // fix drive letter: d: → D:
        folder = folder.replace(/^([a-z]):/, (_, l) => l.toUpperCase() + ':');
      }
      return folder;
    } catch (_) {}
  }
  return null;
}

// Run PowerShell to list all editor windows (Windows only)
function getEditorWindows() {
  if (process.platform !== 'win32') {
    // macOS / Linux fallback — just return empty, let user pick manually
    return [];
  }

  const script = `
$windows = Get-Process | Where-Object {
  $_.MainWindowHandle -ne 0 -and
  $_.MainWindowTitle -ne "" -and
  $_.Name -ne "electron"
} | ForEach-Object {
  [PSCustomObject]@{ ProcName = $_.Name; Title = $_.MainWindowTitle }
}
if ($windows) { $windows | ConvertTo-Json -Compress } else { "[]" }
`;

  const tmpScript = path.join(os.tmpdir(), '_pytutor_windows.ps1');
  fs.writeFileSync(tmpScript, script, 'utf8');

  try {
    const raw = execSync(
      `powershell -NoProfile -ExecutionPolicy Bypass -File "${tmpScript}"`,
      { encoding: 'utf8', timeout: 5000, windowsHide: true }
    ).trim();

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (_) {
    return [];
  }
}

// Recursive file search helper
function findFileInFolder(dir, targetName, maxDepth = 3, currentDepth = 0) {
  if (currentDepth > maxDepth) return null;
  try {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      if (item.name === 'node_modules' || item.name === '.git') continue; // Skip heavy folders
      const fullPath = path.join(dir, item.name);

      if (item.isDirectory()) {
        const found = findFileInFolder(fullPath, targetName, maxDepth, currentDepth + 1);
        if (found) return found;
      } else if (item.name === targetName) {
        return fullPath;
      }
    }
  } catch (err) {
    // Ignore permissions errors etc.
  }
  return null;
}

ipcMain.handle('detect-file', async () => {
  const windows = getEditorWindows();

  for (const w of windows) {
    const title = w.Title || '';

    // Check each editor pattern
    for (const pat of EDITOR_PATTERNS) {
      const m = title.match(pat.re);
      if (!m) continue;

      let filename = pat.name(m);
      // Clean filename (remove unsaved indicators like *, •)
      filename = filename.replace(/^[*\s]+|[*\s•]+$/g, '');
      const editorName = pat.editor(m);

      // Must be a Python file (or text file)
      if (!filename.match(/\.(py|txt|md|json|csv)$/i)) continue;

      // Try to get full path via VS Code/Cursor storage
      const folder = getEditorWorkspaceFolder(editorName);
      let fullPath = null;

      if (folder) {
        const candidate = path.join(folder, filename);
        if (fs.existsSync(candidate)) {
          fullPath = candidate;
        } else {
          // Try recursive deep search up to 4 levels deep
          fullPath = findFileInFolder(folder, filename, 4);
        }
      }

      // If we got a full path, read the file
      if (fullPath) {
        const content = fs.readFileSync(fullPath, 'utf8');
        return { path: fullPath, name: filename, content, editor: editorName, folder };
      }

      // Fallback: Check the current working directory recursively if we couldn't get it from the storage workspace
      const fallbackPath = findFileInFolder(process.cwd(), filename, 4);
      if (fallbackPath) {
        const content = fs.readFileSync(fallbackPath, 'utf8');
        return { path: fallbackPath, name: filename, content, editor: editorName, folder: process.cwd() };
      }

      // No full path — return what we know (user can pick manually)
      return { name: filename, editor: editorName, folder, path: null, content: null };
    }
  }

  return null;
});

ipcMain.handle('read-file', async (_, filePath) => {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (_) {
    return null;
  }
});

ipcMain.handle('open-file-dialog', async () => {
  const result = await dialog.showOpenDialog(win, {
    title: 'Open Python File',
    filters: [
      { name: 'Python Files', extensions: ['py'] },
      { name: 'All Files',    extensions: ['*'] },
    ],
    properties: ['openFile'],
  });
  if (result.canceled || result.filePaths.length === 0) return null;

  const filePath = result.filePaths[0];
  const content  = fs.readFileSync(filePath, 'utf8');
  return { path: filePath, name: path.basename(filePath), content, editor: 'Manual', folder: path.dirname(filePath) };
});


// ── API calls ─────────────────────────────────────────────────────────────────
const TUTOR_SYSTEM = `You are an expert Python tutor helping a complete beginner learn Python from scratch.
- Explain concepts in simple, everyday language — no jargon without explanation
- Use real-world analogies to make abstract ideas click
- Break every answer into clear numbered steps
- After every explanation, briefly recap the "why" behind it
- Walk through code line by line with inline comments
- End with a "Common Mistakes" note if relevant
- Use beginner-friendly variable names
- If the student's question is vague, ask one clarifying question
- Never make the student feel dumb — mistakes are part of learning
- Focused only on Python; redirect other topics back to Python learning.`;

async function callAPI(messages, model, systemPrompt = null) {
  const settings = loadSettings();
  let url = '';
  let options = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: null
  };

  const sys = systemPrompt || '';
  const openaiMsgs = sys ? [{ role: 'system', content: sys }, ...messages] : messages;

  if (settings.provider === 'copilot') {
    url = 'http://localhost:4141/v1/chat/completions';
    options.headers['Authorization'] = 'Bearer copilot';
    options.body = JSON.stringify({ model, messages: openaiMsgs, max_tokens: 4096 });
  }
  else if (settings.provider === 'ollama') {
    // Ollama supports OpenAI compatibility endpoint
    url = `${settings.ollamaUrl}/v1/chat/completions`;
    options.body = JSON.stringify({ model, messages: openaiMsgs });
  }
  else if (settings.provider === 'openai') {
    url = 'https://api.openai.com/v1/chat/completions';
    options.headers['Authorization'] = `Bearer ${settings.openaiKey}`;
    options.body = JSON.stringify({ model, messages: openaiMsgs, max_tokens: 4096 });
  }
  else if (settings.provider === 'anthropic') {
    url = 'https://api.anthropic.com/v1/messages';
    options.headers['x-api-key'] = settings.anthropicKey;
    options.headers['anthropic-version'] = '2023-06-01';
    // Anthropic API format:
    options.body = JSON.stringify({
      model,
      max_tokens: 4096,
      system: sys || undefined,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content
      }))
    });
  }

  const res = await fetch(url, options);

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`API ${res.status}: ${txt.slice(0, 200)}`);
  }

  const data = await res.json();

  // Anthropic uses `content[0].text`, OpenAI uses `choices[0].message.content`
  if (settings.provider === 'anthropic') {
    return data.content[0].text;
  }
  return data.choices[0].message.content;
}

async function callAPIforJSON(prompt, model) {
  const systemPrompt = 
    'You are a Python expert. Respond ONLY with raw valid JSON — no markdown fences, ' +
    'no backticks, no preamble. Output starts with { and ends with }.';

  const raw = await callAPI([{ role: 'user', content: prompt }], model, systemPrompt);

  // Strip any accidental fences
  let clean = raw.trim();
  if (clean.startsWith('```')) {
    const parts = clean.split('```');
    clean = parts[1].replace(/^json\s*/, '').trim();
  }
  return JSON.parse(clean);
}

ipcMain.handle('chat', async (_, history, model) => {
  return await callAPI(history, model, TUTOR_SYSTEM);
});

let activePythonProcess = null;

ipcMain.handle('start-python', async (event, filePath) => {
  if (activePythonProcess) {
    activePythonProcess.kill();
  }

  return new Promise((resolve) => {
    try {
          activePythonProcess = spawn(process.platform === 'win32' ? 'cmd.exe' : 'bash', [], {
            shell: true,
            cwd: path.dirname(filePath) || process.cwd()
          });

          // Optional: we can run the python file immediately, or just give them a shell.
          // Since the original was running the file, let's run it in the shell:
          if (process.platform === 'win32') {
             activePythonProcess.stdin.write(`python -u "${filePath}"\r\n`);
          } else {
             activePythonProcess.stdin.write(`python3 -u "${filePath}"\n`);
          }


      activePythonProcess.stdout.on('data', (data) => {
        event.sender.send('python-output', data.toString());
      });

      activePythonProcess.stderr.on('data', (data) => {
        event.sender.send('python-output', data.toString());
      });

      activePythonProcess.on('close', (code) => {
        event.sender.send('python-exit', code);
        activePythonProcess = null;
      });
      resolve(true);
    } catch(e) {
      resolve(false);
    }
  });
});

ipcMain.on('python-input', (event, data) => {
  if (activePythonProcess) {
    activePythonProcess.stdin.write(data + '\n');
  }
});

ipcMain.on('stop-python', () => {
  if (activePythonProcess) {
    activePythonProcess.kill();
    activePythonProcess = null;
  }
});

ipcMain.handle('run-python', async (_, filePath) => {
  return new Promise((resolve) => {
    // Escape the file path properly
    const safePath = `"${filePath}"`;
    exec(`python ${safePath}`, { timeout: 10000 }, (error, stdout, stderr) => {
      resolve({
        stdout: stdout || '',
        stderr: stderr || '',
        error: error ? error.message : null
      });
    });
  });
});

ipcMain.handle('ai-edit', async (_, { type, instruction, filename, content, filepath, model }) => {
  let prompt = '';

  if (type === 'comment') {
    prompt = `
Here is a Python file called "${filename}". Add clear beginner-friendly inline comments
to EVERY non-trivial line. Do NOT change any actual code — only add # comments.
Use plain everyday language.

Return JSON with exactly two keys:
{
  "new_code": "<full file content with comments added>",
  "explanation": "<2-3 sentence markdown summary of what this file does, for a beginner>"
}

File:
\`\`\`python
${content}
\`\`\``;

  } else if (type === 'optimize') {
    prompt = `
Here is a Python file called "${filename}" written by a beginner. Write a more efficient,
Pythonic version of this code.

Return JSON with exactly three keys:
{
  "new_code": "<the optimized Python code only — no commented originals inside this field>",
  "explanation": "<markdown numbered list of every change made and why, in beginner-friendly language>",
  "summary": "<one sentence summary of the overall improvement>"
}

Original file:
\`\`\`python
${content}
\`\`\``;

  } else if (type === 'edit') {
    prompt = `
Here is a Python file called "${filename}". Apply this change: ${instruction}

Return JSON with exactly three keys:
{
  "new_code": "<the full file after applying the edit>",
  "explanation": "<markdown numbered list of what changed and why, in beginner-friendly language>",
  "summary": "<one sentence summary of what was done>"
}

File:
\`\`\`python
${content}
\`\`\``;
  }

  const result = await callAPIforJSON(prompt, model);
  const newCode    = result.new_code || result.edited_code || result.optimized_code || '';
  const explanation = result.explanation || '';
  const summary     = result.summary || '';

  if (!newCode) throw new Error('AI returned empty code');

  // Backup + write
  if (filepath && fs.existsSync(filepath)) {
    backupFile(filepath);
    writeFile(filepath, newCode);
  }

  return { newContent: newCode, explanation };
});
