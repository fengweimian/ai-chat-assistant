# Electron AI Chat Application Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an Electron desktop chat app for GPT-5.5 with image upload, file/PPT generation, Markdown rendering, and configurable model settings.

**Architecture:** Electron main process handles API streaming, PPT generation, and data persistence. Renderer process handles all UI (chat, sidebar, settings). IPC bridge connects them securely via preload script.

**Tech Stack:** Electron, vanilla HTML/CSS/JS, marked, highlight.js, pptxgenjs

---

## File Map

| File | Responsibility |
|------|---------------|
| `package.json` | Dependencies and scripts |
| `main.js` | Electron main process entry, window creation, IPC handlers |
| `preload.js` | Secure IPC bridge exposing `window.api` |
| `src/shared/constants.js` | Shared config (API URL, model names, thinking levels) |
| `src/main/api.js` | OpenAI streaming API calls |
| `src/main/store.js` | Conversation persistence (JSON file) |
| `src/main/pptGenerator.js` | PPT generation with pptxgenjs |
| `src/main/download.js` | File download/save manager |
| `src/renderer/index.html` | Main HTML page |
| `src/renderer/styles/main.css` | Dark theme styles |
| `src/renderer/js/app.js` | App entry, orchestration, IPC event wiring |
| `src/renderer/js/chat.js` | Chat logic (send, receive, stream display) |
| `src/renderer/js/sidebar.js` | Conversation list management |
| `src/renderer/js/settings.js` | Settings panel |
| `src/renderer/js/markdown.js` | Markdown rendering + code highlight |
| `src/renderer/js/fileUpload.js` | Image upload handling |
| `src/renderer/js/fileRender.js` | File attachment cards + download |

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `main.js`
- Create: `src/shared/constants.js`
- Create: `data/` directory

- [ ] **Step 1: Create package.json**

```json
{
  "name": "ai-chat-assistant",
  "version": "1.0.0",
  "description": "Electron AI Chat Application",
  "main": "main.js",
  "scripts": {
    "start": "electron .",
    "dev": "electron . --dev"
  },
  "dependencies": {
    "marked": "^15.0.0",
    "highlight.js": "^11.11.0",
    "pptxgenjs": "^3.12.0"
  },
  "devDependencies": {
    "electron": "^35.0.0"
  }
}
```

- [ ] **Step 2: Create shared constants**

Create `src/shared/constants.js`:

```javascript
const CONSTANTS = {
  DEFAULT_API_BASE: 'https://api.vectorengine.cn/v1',
  DEFAULT_API_KEY: 'sk-b7fvHZFbK7Bh1Gzy66qYhKZdjAT92k8IlXJA32aZ1c3MYbue',
  DEFAULT_MODEL: 'gpt-5.5',
  THINKING_LEVELS: ['low', 'medium', 'high', 'xhigh'],
  DEFAULT_THINKING: 'medium',
  DEFAULT_TEMPERATURE: 0.7,
  DEFAULT_MAX_TOKENS: 4096,
  MAX_IMAGE_SIZE: 10 * 1024 * 1024,
  SUPPORTED_IMAGE_TYPES: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
  SIDEBAR_WIDTH: 260,
  SYSTEM_PROMPT_BASE: '你是一个有用的AI助手。',
  SYSTEM_PROMPT_WEB_SEARCH: '请搜索互联网获取最新信息后回答。',
  SYSTEM_PROMPT_PPT: '当用户要求生成PPT时，请返回以下JSON格式（用```json包裹）：{"type":"pptx","title":"标题","slides":[{"title":"幻灯片标题","content":["要点1","要点2"]}]}。其他时候正常用Markdown回答。'
};

if (typeof module !== 'undefined') module.exports = CONSTANTS;
```

- [ ] **Step 3: Create data directory**

Run: `mkdir -p data`

- [ ] **Step 4: Install dependencies**

Run: `npm install`

Expected: `node_modules` and `package-lock.json` created.

- [ ] **Step 5: Create minimal main.js**

```javascript
const { app, BrowserWindow } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src/renderer/index.html'));
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
```

- [ ] **Step 6: Create placeholder preload.js**

```javascript
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Will be populated in Task 3
});
```

- [ ] **Step 7: Create placeholder index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Chat Assistant</title>
</head>
<body>
  <h1>Loading...</h1>
</body>
</html>
```

- [ ] **Step 8: Verify Electron launches**

Run: `npm start`

Expected: Electron window opens showing "Loading..." text. Close window to stop.

- [ ] **Step 9: Commit**

```bash
git init
git add package.json main.js preload.js src/shared/constants.js src/renderer/index.html .gitignore
git commit -m "feat: project scaffolding with Electron boilerplate"
```

---

### Task 2: Main Process - Store (Conversation Persistence)

**Files:**
- Create: `src/main/store.js`
- Modify: `main.js` (add IPC handlers)

- [ ] **Step 1: Create store.js**

```javascript
const fs = require('fs');
const path = require('path');

class Store {
  constructor() {
    this.dataDir = path.join(__dirname, '../../data');
    this.filePath = path.join(this.dataDir, 'conversations.json');
    this.conversations = [];
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        this.conversations = JSON.parse(raw);
      }
    } catch (e) {
      console.error('Failed to load conversations:', e);
      this.conversations = [];
    }
  }

  save() {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.conversations, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to save conversations:', e);
    }
  }

  getAll() {
    return this.conversations;
  }

  getById(id) {
    return this.conversations.find(c => c.id === id);
  }

  create(title = '新对话') {
    const conv = {
      id: 'conv_' + Date.now(),
      title,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      settings: {
        model: 'gpt-5.5',
        webSearch: true,
        thinkingLevel: 'medium',
        temperature: 0.7
      },
      messages: []
    };
    this.conversations.unshift(conv);
    this.save();
    return conv;
  }

  update(id, updates) {
    const conv = this.getById(id);
    if (conv) {
      Object.assign(conv, updates, { updatedAt: Date.now() });
      this.save();
    }
    return conv;
  }

  addMessage(convId, message) {
    const conv = this.getById(convId);
    if (conv) {
      conv.messages.push({
        id: 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        ...message,
        timestamp: Date.now()
      });
      conv.updatedAt = Date.now();
      this.save();
    }
  }

  delete(id) {
    this.conversations = this.conversations.filter(c => c.id !== id);
    this.save();
  }
}

module.exports = Store;
```

- [ ] **Step 2: Add store IPC handlers to main.js**

Replace `main.js` content:

```javascript
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Store = require('./src/main/store');

let mainWindow;
const store = new Store();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src/renderer/index.html'));
}

// IPC Handlers
ipcMain.handle('conversations:getAll', () => store.getAll());
ipcMain.handle('conversations:getById', (_, id) => store.getById(id));
ipcMain.handle('conversations:create', (_, title) => store.create(title));
ipcMain.handle('conversations:update', (_, id, updates) => store.update(id, updates));
ipcMain.handle('conversations:addMessage', (_, convId, message) => store.addMessage(convId, message));
ipcMain.handle('conversations:delete', (_, id) => store.delete(id));

// Window controls
ipcMain.on('window:minimize', () => mainWindow?.minimize());
ipcMain.on('window:maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.on('window:close', () => mainWindow?.close());

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
```

- [ ] **Step 3: Update preload.js with store APIs**

```javascript
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Conversations
  conversations: {
    getAll: () => ipcRenderer.invoke('conversations:getAll'),
    getById: (id) => ipcRenderer.invoke('conversations:getById', id),
    create: (title) => ipcRenderer.invoke('conversations:create', title),
    update: (id, updates) => ipcRenderer.invoke('conversations:update', id, updates),
    addMessage: (convId, message) => ipcRenderer.invoke('conversations:addMessage', convId, message),
    delete: (id) => ipcRenderer.invoke('conversations:delete', id)
  },
  // Window controls
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close')
  }
});
```

- [ ] **Step 4: Commit**

```bash
git add src/main/store.js main.js preload.js
git commit -m "feat: add conversation persistence store with IPC handlers"
```

---

### Task 3: Main Process - API (Streaming)

**Files:**
- Create: `src/main/api.js`
- Modify: `main.js` (add chat IPC handler)
- Modify: `preload.js` (add chat API)

- [ ] **Step 1: Create api.js**

```javascript
const CONSTANTS = require('../shared/constants');

class ApiClient {
  constructor() {
    this.baseUrl = CONSTANTS.DEFAULT_API_BASE;
    this.apiKey = CONSTANTS.DEFAULT_API_KEY;
  }

  configure(baseUrl, apiKey) {
    if (baseUrl) this.baseUrl = baseUrl;
    if (apiKey) this.apiKey = apiKey;
  }

  buildModelName(baseModel, thinkingLevel) {
    if (thinkingLevel && thinkingLevel !== 'none') {
      return `${baseModel}-${thinkingLevel}`;
    }
    return baseModel;
  }

  buildSystemPrompt(settings) {
    let prompt = CONSTANTS.SYSTEM_PROMPT_BASE + '\n' + CONSTANTS.SYSTEM_PROMPT_PPT;
    if (settings.webSearch) {
      prompt += '\n' + CONSTANTS.SYSTEM_PROMPT_WEB_SEARCH;
    }
    return prompt;
  }

  buildMessages(conversation) {
    const messages = [];
    messages.push({
      role: 'system',
      content: this.buildSystemPrompt(conversation.settings)
    });

    for (const msg of conversation.messages) {
      if (msg.role === 'user') {
        if (msg.images && msg.images.length > 0) {
          const content = [{ type: 'text', text: msg.content }];
          for (const img of msg.images) {
            content.push({
              type: 'image_url',
              image_url: { url: img }
            });
          }
          messages.push({ role: 'user', content });
        } else {
          messages.push({ role: 'user', content: msg.content });
        }
      } else if (msg.role === 'assistant') {
        messages.push({ role: 'assistant', content: msg.content });
      }
    }

    return messages;
  }

  async streamChat(conversation, userContent, images, onChunk, onDone, onError) {
    const settings = conversation.settings;
    const model = this.buildModelName(settings.model || CONSTANTS.DEFAULT_MODEL, settings.thinkingLevel);

    // Build messages including the new user message
    const tempConv = {
      ...conversation,
      messages: [...conversation.messages, { role: 'user', content: userContent, images }]
    };
    const messages = this.buildMessages(tempConv);

    try {
      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages,
          stream: true,
          temperature: settings.temperature || CONSTANTS.DEFAULT_TEMPERATURE,
          max_tokens: settings.maxTokens || CONSTANTS.DEFAULT_MAX_TOKENS
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        onError(`API Error (${response.status}): ${errorText}`);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const data = trimmed.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta;
            if (delta?.content) {
              fullContent += delta.content;
              onChunk(delta.content);
            }
          } catch (e) {
            // Skip malformed JSON chunks
          }
        }
      }

      onDone(fullContent);
    } catch (e) {
      onError(`Network error: ${e.message}`);
    }
  }
}

module.exports = ApiClient;
```

- [ ] **Step 2: Add chat IPC handler to main.js**

Add after the existing IPC handlers in `main.js`:

```javascript
const ApiClient = require('./src/main/api');
const apiClient = new ApiClient();

// Chat streaming
ipcMain.on('chat:send', (event, { conversationId, content, images }) => {
  const conversation = store.getById(conversationId);
  if (!conversation) {
    event.sender.send('chat:error', 'Conversation not found');
    return;
  }

  apiClient.streamChat(
    conversation,
    content,
    images,
    (chunk) => event.sender.send('chat:chunk', { conversationId, chunk }),
    (fullContent) => event.sender.send('chat:done', { conversationId, fullContent }),
    (error) => event.sender.send('chat:error', { conversationId, error })
  );
});

// Settings update
ipcMain.on('settings:update', (_, settings) => {
  apiClient.configure(settings.baseUrl, settings.apiKey);
});
```

- [ ] **Step 3: Update preload.js with chat APIs**

Add to the `window.api` object in `preload.js`:

```javascript
  // Chat
  chat: {
    send: (data) => ipcRenderer.send('chat:send', data),
    onChunk: (callback) => {
      const handler = (_, data) => callback(data);
      ipcRenderer.on('chat:chunk', handler);
      return () => ipcRenderer.removeListener('chat:chunk', handler);
    },
    onDone: (callback) => {
      const handler = (_, data) => callback(data);
      ipcRenderer.on('chat:done', handler);
      return () => ipcRenderer.removeListener('chat:done', handler);
    },
    onError: (callback) => {
      const handler = (_, data) => callback(data);
      ipcRenderer.on('chat:error', handler);
      return () => ipcRenderer.removeListener('chat:error', handler);
    }
  },
  // Settings
  updateSettings: (settings) => ipcRenderer.send('settings:update', settings),
```

- [ ] **Step 4: Commit**

```bash
git add src/main/api.js main.js preload.js
git commit -m "feat: add streaming API client with IPC handlers"
```

---

### Task 4: Main Process - PPT Generator

**Files:**
- Create: `src/main/pptGenerator.js`
- Modify: `main.js` (add PPT IPC handler)
- Modify: `preload.js` (add PPT API)

- [ ] **Step 1: Create pptGenerator.js**

```javascript
const PptxGenJS = require('pptxgenjs');
const path = require('path');
const fs = require('fs');
const os = require('os');

class PptGenerator {
  constructor() {
    this.tempDir = path.join(os.tmpdir(), 'ai-chat-ppt');
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  async generate(pptData) {
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_16x9';
    pptx.author = 'AI Chat Assistant';
    pptx.title = pptData.title || 'Presentation';

    // Title slide
    const titleSlide = pptx.addSlide();
    titleSlide.background = { color: '1a1a2e' };
    titleSlide.addText(pptData.title || 'Untitled', {
      x: '10%', y: '35%', w: '80%', h: '30%',
      fontSize: 36, color: 'ffffff', bold: true,
      align: 'center', fontFace: 'Microsoft YaHei'
    });
    titleSlide.addText('Generated by AI Chat Assistant', {
      x: '10%', y: '65%', w: '80%', h: '10%',
      fontSize: 14, color: 'aaaaaa', align: 'center',
      fontFace: 'Microsoft YaHei'
    });

    // Content slides
    if (pptData.slides && Array.isArray(pptData.slides)) {
      for (const slide of pptData.slides) {
        const contentSlide = pptx.addSlide();
        contentSlide.background = { color: '16213e' };

        // Slide title
        contentSlide.addText(slide.title || '', {
          x: '8%', y: '5%', w: '84%', h: '12%',
          fontSize: 28, color: '00d4ff', bold: true,
          fontFace: 'Microsoft YaHei'
        });

        // Bullet points
        if (slide.content && Array.isArray(slide.content)) {
          const bulletText = slide.content.map(item => ({
            text: item,
            options: {
              fontSize: 18,
              color: 'e0e0e0',
              bullet: { type: 'bullet', color: '00d4ff' },
              fontFace: 'Microsoft YaHei',
              breakLine: true,
              paraSpaceAfter: 12
            }
          }));

          contentSlide.addText(bulletText, {
            x: '10%', y: '22%', w: '80%', h: '70%',
            valign: 'top'
          });
        }
      }
    }

    // Save to temp
    const filename = `${pptData.title || 'presentation'}_${Date.now()}.pptx`;
    const safeName = filename.replace(/[<>:"/\\|?*]/g, '_');
    const filePath = path.join(this.tempDir, safeName);
    await pptx.writeFile({ fileName: filePath });

    return { filePath, filename: safeName };
  }

  detectPptxRequest(text) {
    const jsonMatch = text.match(/```json\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1].trim());
        if (parsed.type === 'pptx' && parsed.slides) {
          return parsed;
        }
      } catch (e) {
        // Not valid JSON
      }
    }
    return null;
  }
}

module.exports = PptGenerator;
```

- [ ] **Step 2: Add PPT IPC handler to main.js**

Add after the existing handlers:

```javascript
const PptGenerator = require('./src/main/pptGenerator');
const pptGenerator = new PptGenerator();

// PPT generation
ipcMain.handle('ppt:generate', async (_, pptData) => {
  try {
    return await pptGenerator.generate(pptData);
  } catch (e) {
    throw new Error(`PPT generation failed: ${e.message}`);
  }
});

ipcMain.handle('ppt:detect', (_, text) => {
  return pptGenerator.detectPptxRequest(text);
});
```

- [ ] **Step 3: Update preload.js with PPT APIs**

Add to `window.api`:

```javascript
  // PPT
  ppt: {
    generate: (data) => ipcRenderer.invoke('ppt:generate', data),
    detect: (text) => ipcRenderer.invoke('ppt:detect', text)
  },
```

- [ ] **Step 4: Commit**

```bash
git add src/main/pptGenerator.js main.js preload.js
git commit -m "feat: add PPT generation with pptxgenjs"
```

---

### Task 5: Main Process - Download Manager

**Files:**
- Create: `src/main/download.js`
- Modify: `main.js` (add download IPC handler)
- Modify: `preload.js` (add download API)

- [ ] **Step 1: Create download.js**

```javascript
const { dialog, shell } = require('electron');
const fs = require('fs');
const path = require('path');

class DownloadManager {
  async saveFile(sourcePath, suggestedName) {
    const result = await dialog.showSaveDialog({
      defaultPath: suggestedName || path.basename(sourcePath),
      filters: [
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (!result.canceled && result.filePath) {
      fs.copyFileSync(sourcePath, result.filePath);
      return { success: true, path: result.filePath };
    }
    return { success: false };
  }

  openInExplorer(filePath) {
    shell.showItemInFolder(filePath);
  }
}

module.exports = DownloadManager;
```

- [ ] **Step 2: Add download IPC handler to main.js**

```javascript
const DownloadManager = require('./src/main/download');
const downloadManager = new DownloadManager();

ipcMain.handle('file:save', async (_, sourcePath, suggestedName) => {
  return await downloadManager.saveFile(sourcePath, suggestedName);
});

ipcMain.handle('file:openLocation', (_, filePath) => {
  downloadManager.openInExplorer(filePath);
});
```

- [ ] **Step 3: Update preload.js**

Add to `window.api`:

```javascript
  // File
  file: {
    save: (sourcePath, suggestedName) => ipcRenderer.invoke('file:save', sourcePath, suggestedName),
    openLocation: (filePath) => ipcRenderer.invoke('file:openLocation', filePath)
  },
```

- [ ] **Step 4: Commit**

```bash
git add src/main/download.js main.js preload.js
git commit -m "feat: add file download manager"
```

---

### Task 6: Renderer - HTML Structure

**Files:**
- Modify: `src/renderer/index.html`

- [ ] **Step 1: Create full index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Chat Assistant</title>
  <link rel="stylesheet" href="styles/main.css">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/github-dark.min.css">
</head>
<body>
  <!-- Title Bar -->
  <div id="titlebar">
    <div class="titlebar-drag">
      <span class="app-title">AI Chat Assistant</span>
    </div>
    <div class="titlebar-controls">
      <button id="btn-minimize" class="titlebar-btn" title="最小化">&#x2500;</button>
      <button id="btn-maximize" class="titlebar-btn" title="最大化">&#x25A1;</button>
      <button id="btn-close" class="titlebar-btn btn-close" title="关闭">&#x2715;</button>
    </div>
  </div>

  <div id="app">
    <!-- Sidebar -->
    <aside id="sidebar">
      <div class="sidebar-header">
        <button id="btn-new-chat" class="btn-new-chat">+ 新对话</button>
      </div>
      <div id="conversation-list" class="conversation-list"></div>
    </aside>

    <!-- Main Content -->
    <main id="main-content">
      <!-- Settings Bar -->
      <div id="settings-bar">
        <div class="setting-group">
          <label>模型</label>
          <select id="setting-model">
            <option value="gpt-5.5">GPT-5.5</option>
          </select>
        </div>
        <div class="setting-group">
          <label>联网</label>
          <label class="toggle">
            <input type="checkbox" id="setting-web-search" checked>
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div class="setting-group">
          <label>思考</label>
          <select id="setting-thinking">
            <option value="low">低</option>
            <option value="medium" selected>中</option>
            <option value="high">高</option>
            <option value="xhigh">极高</option>
          </select>
        </div>
        <div class="setting-group">
          <button id="btn-settings" class="btn-icon" title="详细设置">&#9881;</button>
        </div>
      </div>

      <!-- Chat Area -->
      <div id="chat-area">
        <div id="messages" class="messages">
          <div class="welcome-message">
            <h2>你好！有什么可以帮你的？</h2>
            <p>你可以问我任何问题，或者让我帮你生成PPT、分析图片等。</p>
          </div>
        </div>
      </div>

      <!-- Input Area -->
      <div id="input-area">
        <div id="image-preview" class="image-preview" style="display:none;"></div>
        <div class="input-row">
          <button id="btn-attach" class="btn-icon" title="上传图片">&#128206;</button>
          <textarea id="message-input" placeholder="输入消息... (Enter 发送, Shift+Enter 换行)" rows="1"></textarea>
          <button id="btn-send" class="btn-send" title="发送">&#9654;</button>
        </div>
      </div>
    </main>
  </div>

  <!-- Settings Modal -->
  <div id="settings-modal" class="modal" style="display:none;">
    <div class="modal-overlay"></div>
    <div class="modal-content">
      <div class="modal-header">
        <h3>设置</h3>
        <button id="btn-close-settings" class="btn-icon">&times;</button>
      </div>
      <div class="modal-body">
        <section class="settings-section">
          <h4>API 配置</h4>
          <div class="form-group">
            <label>API 地址</label>
            <input type="text" id="cfg-api-url" value="https://api.vectorengine.cn/v1">
          </div>
          <div class="form-group">
            <label>API Key</label>
            <input type="password" id="cfg-api-key" value="">
          </div>
          <button id="btn-test-connection" class="btn-secondary">测试连接</button>
        </section>
        <section class="settings-section">
          <h4>模型设置</h4>
          <div class="form-group">
            <label>Temperature: <span id="temp-value">0.7</span></label>
            <input type="range" id="cfg-temperature" min="0" max="2" step="0.1" value="0.7">
          </div>
          <div class="form-group">
            <label>Max Tokens</label>
            <input type="number" id="cfg-max-tokens" value="4096" min="1" max="128000">
          </div>
          <div class="form-group">
            <label>System Prompt</label>
            <textarea id="cfg-system-prompt" rows="4"></textarea>
          </div>
        </section>
      </div>
      <div class="modal-footer">
        <button id="btn-save-settings" class="btn-primary">保存</button>
      </div>
    </div>
  </div>

  <!-- Hidden file input -->
  <input type="file" id="file-input" accept="image/png,image/jpeg,image/gif,image/webp" multiple style="display:none;">

  <!-- Scripts -->
  <script src="js/markdown.js"></script>
  <script src="js/fileUpload.js"></script>
  <script src="js/fileRender.js"></script>
  <script src="js/chat.js"></script>
  <script src="js/sidebar.js"></script>
  <script src="js/settings.js"></script>
  <script src="js/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/index.html
git commit -m "feat: add complete HTML structure"
```

---

### Task 7: Renderer - Dark Theme CSS

**Files:**
- Create: `src/renderer/styles/main.css`

- [ ] **Step 1: Create main.css**

```css
/* ===== Reset & Base ===== */
* { margin: 0; padding: 0; box-sizing: border-box; }

:root {
  --bg-primary: #0d1117;
  --bg-secondary: #161b22;
  --bg-tertiary: #21262d;
  --bg-hover: #30363d;
  --text-primary: #e6edf3;
  --text-secondary: #8b949e;
  --text-muted: #484f58;
  --accent: #58a6ff;
  --accent-hover: #79c0ff;
  --border: #30363d;
  --success: #3fb950;
  --error: #f85149;
  --warning: #d29922;
  --user-bubble: #1f6feb;
  --ai-bubble: #1c2128;
  --sidebar-width: 260px;
  --titlebar-height: 36px;
  --settings-bar-height: 44px;
  --input-area-min-height: 60px;
  --font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', sans-serif;
  --font-mono: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
  --font-size: 14px;
}

body {
  font-family: var(--font-family);
  font-size: var(--font-size);
  background: var(--bg-primary);
  color: var(--text-primary);
  height: 100vh;
  overflow: hidden;
}

/* ===== Title Bar ===== */
#titlebar {
  height: var(--titlebar-height);
  background: var(--bg-secondary);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  -webkit-app-region: drag;
  border-bottom: 1px solid var(--border);
}

.app-title {
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 500;
}

.titlebar-controls {
  display: flex;
  gap: 2px;
  -webkit-app-region: no-drag;
}

.titlebar-btn {
  width: 36px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.titlebar-btn:hover { background: var(--bg-hover); }
.btn-close:hover { background: var(--error); color: white; }

/* ===== App Layout ===== */
#app {
  display: flex;
  height: calc(100vh - var(--titlebar-height));
}

/* ===== Sidebar ===== */
#sidebar {
  width: var(--sidebar-width);
  background: var(--bg-secondary);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.sidebar-header {
  padding: 12px;
  border-bottom: 1px solid var(--border);
}

.btn-new-chat {
  width: 100%;
  padding: 10px;
  background: var(--accent);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  font-family: var(--font-family);
}

.btn-new-chat:hover { background: var(--accent-hover); }

.conversation-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.conv-item {
  padding: 10px 12px;
  border-radius: 6px;
  cursor: pointer;
  margin-bottom: 2px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: background 0.15s;
}

.conv-item:hover { background: var(--bg-hover); }
.conv-item.active { background: var(--bg-tertiary); }

.conv-item .conv-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}

.conv-item .conv-delete {
  opacity: 0;
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 16px;
  padding: 0 4px;
}

.conv-item:hover .conv-delete { opacity: 1; }
.conv-item .conv-delete:hover { color: var(--error); }

/* ===== Main Content ===== */
#main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

/* ===== Settings Bar ===== */
#settings-bar {
  height: var(--settings-bar-height);
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  padding: 0 16px;
  gap: 16px;
}

.setting-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.setting-group label {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.setting-group select {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 12px;
  font-family: var(--font-family);
  cursor: pointer;
}

/* Toggle switch */
.toggle {
  position: relative;
  display: inline-block;
  width: 36px;
  height: 20px;
}

.toggle input { opacity: 0; width: 0; height: 0; }

.toggle-slider {
  position: absolute;
  cursor: pointer;
  inset: 0;
  background: var(--bg-tertiary);
  border-radius: 20px;
  transition: 0.2s;
}

.toggle-slider::before {
  content: '';
  position: absolute;
  height: 16px;
  width: 16px;
  left: 2px;
  bottom: 2px;
  background: var(--text-secondary);
  border-radius: 50%;
  transition: 0.2s;
}

.toggle input:checked + .toggle-slider { background: var(--accent); }
.toggle input:checked + .toggle-slider::before {
  transform: translateX(16px);
  background: white;
}

/* ===== Chat Area ===== */
#chat-area {
  flex: 1;
  overflow-y: auto;
  padding: 0;
}

.messages {
  max-width: 860px;
  margin: 0 auto;
  padding: 20px 24px;
}

.welcome-message {
  text-align: center;
  padding: 80px 20px;
  color: var(--text-secondary);
}

.welcome-message h2 {
  font-size: 24px;
  font-weight: 500;
  margin-bottom: 8px;
  color: var(--text-primary);
}

.welcome-message p {
  font-size: 14px;
}

/* Message bubbles */
.message {
  margin-bottom: 20px;
  display: flex;
  gap: 12px;
}

.message.user { flex-direction: row-reverse; }

.message-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
}

.message.user .message-avatar { background: var(--user-bubble); }
.message.assistant .message-avatar { background: var(--bg-tertiary); }

.message-bubble {
  max-width: 75%;
  padding: 10px 14px;
  border-radius: 12px;
  line-height: 1.6;
  font-size: var(--font-size);
  word-break: break-word;
}

.message.user .message-bubble {
  background: var(--user-bubble);
  color: white;
  border-bottom-right-radius: 4px;
}

.message.assistant .message-bubble {
  background: var(--ai-bubble);
  border: 1px solid var(--border);
  border-bottom-left-radius: 4px;
}

.message.error .message-bubble {
  background: rgba(248, 81, 73, 0.1);
  border-color: var(--error);
  color: var(--error);
}

/* Markdown content */
.message-bubble p { margin-bottom: 8px; }
.message-bubble p:last-child { margin-bottom: 0; }

.message-bubble pre {
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 12px;
  overflow-x: auto;
  margin: 8px 0;
  position: relative;
}

.message-bubble code {
  font-family: var(--font-mono);
  font-size: 13px;
}

.message-bubble p code,
.message-bubble li code {
  background: var(--bg-tertiary);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.9em;
}

.message-bubble pre .copy-btn {
  position: absolute;
  top: 6px;
  right: 6px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  color: var(--text-secondary);
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 11px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s;
}

.message-bubble pre:hover .copy-btn { opacity: 1; }
.message-bubble pre .copy-btn:hover { background: var(--bg-hover); color: var(--text-primary); }

/* Tables */
.message-bubble table {
  border-collapse: collapse;
  width: 100%;
  margin: 8px 0;
  font-size: 13px;
}

.message-bubble th, .message-bubble td {
  border: 1px solid var(--border);
  padding: 6px 10px;
  text-align: left;
}

.message-bubble th { background: var(--bg-tertiary); font-weight: 600; }
.message-bubble tr:hover td { background: rgba(88, 166, 255, 0.05); }

/* Links */
.message-bubble a {
  color: var(--accent);
  text-decoration: none;
}
.message-bubble a:hover { text-decoration: underline; }

/* Thinking indicator */
.thinking-indicator {
  display: flex;
  gap: 4px;
  padding: 4px 0;
}

.thinking-indicator span {
  width: 6px;
  height: 6px;
  background: var(--text-secondary);
  border-radius: 50%;
  animation: thinking 1.4s infinite ease-in-out;
}

.thinking-indicator span:nth-child(2) { animation-delay: 0.2s; }
.thinking-indicator span:nth-child(3) { animation-delay: 0.4s; }

@keyframes thinking {
  0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
  40% { opacity: 1; transform: scale(1); }
}

/* ===== Input Area ===== */
#input-area {
  border-top: 1px solid var(--border);
  background: var(--bg-secondary);
  padding: 12px 24px;
}

.image-preview {
  display: flex;
  gap: 8px;
  padding-bottom: 8px;
  flex-wrap: wrap;
}

.image-preview-item {
  position: relative;
  width: 60px;
  height: 60px;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid var(--border);
}

.image-preview-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-preview-item .remove-image {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 18px;
  height: 18px;
  background: rgba(0,0,0,0.7);
  color: white;
  border: none;
  border-radius: 50%;
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.input-row {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  max-width: 860px;
  margin: 0 auto;
}

#message-input {
  flex: 1;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 14px;
  color: var(--text-primary);
  font-family: var(--font-family);
  font-size: var(--font-size);
  resize: none;
  max-height: 200px;
  line-height: 1.5;
  outline: none;
}

#message-input:focus { border-color: var(--accent); }
#message-input::placeholder { color: var(--text-muted); }

.btn-icon {
  width: 36px;
  height: 36px;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-secondary);
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.btn-icon:hover { background: var(--bg-hover); color: var(--text-primary); }

.btn-send {
  width: 36px;
  height: 36px;
  background: var(--accent);
  border: none;
  border-radius: 8px;
  color: white;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.btn-send:hover { background: var(--accent-hover); }
.btn-send:disabled { opacity: 0.5; cursor: not-allowed; }

/* ===== File Cards ===== */
.file-card {
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
  margin: 8px 0;
  display: flex;
  align-items: center;
  gap: 12px;
}

.file-card-icon {
  font-size: 28px;
  flex-shrink: 0;
}

.file-card-info {
  flex: 1;
  min-width: 0;
}

.file-card-name {
  font-size: 13px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-card-size {
  font-size: 11px;
  color: var(--text-secondary);
  margin-top: 2px;
}

.file-card-actions {
  display: flex;
  gap: 6px;
}

.file-card-actions button {
  padding: 6px 12px;
  border-radius: 4px;
  border: 1px solid var(--border);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 12px;
  cursor: pointer;
  font-family: var(--font-family);
}

.file-card-actions button:hover { background: var(--bg-hover); }
.file-card-actions .btn-download { background: var(--accent); border-color: var(--accent); color: white; }
.file-card-actions .btn-download:hover { background: var(--accent-hover); }

/* ===== Modal ===== */
.modal {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
}

.modal-content {
  position: relative;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 12px;
  width: 500px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}

.modal-header h3 { font-size: 16px; font-weight: 600; }

.modal-body {
  padding: 20px;
  overflow-y: auto;
}

.settings-section {
  margin-bottom: 20px;
}

.settings-section h4 {
  font-size: 13px;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 12px;
}

.form-group {
  margin-bottom: 12px;
}

.form-group label {
  display: block;
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.form-group input[type="text"],
.form-group input[type="password"],
.form-group input[type="number"],
.form-group textarea {
  width: 100%;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px 12px;
  color: var(--text-primary);
  font-family: var(--font-family);
  font-size: 13px;
  outline: none;
}

.form-group input:focus,
.form-group textarea:focus { border-color: var(--accent); }

.form-group input[type="range"] {
  width: 100%;
  accent-color: var(--accent);
}

.btn-primary {
  padding: 8px 20px;
  background: var(--accent);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  font-family: var(--font-family);
}

.btn-primary:hover { background: var(--accent-hover); }

.btn-secondary {
  padding: 6px 14px;
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  font-family: var(--font-family);
}

.btn-secondary:hover { background: var(--bg-hover); }

.modal-footer {
  padding: 12px 20px;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: flex-end;
}

/* ===== Scrollbar ===== */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--bg-hover); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }

/* ===== Drag & Drop ===== */
.drag-over {
  background: rgba(88, 166, 255, 0.1) !important;
  border: 2px dashed var(--accent) !important;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/styles/main.css
git commit -m "feat: add dark theme CSS styles"
```

---

### Task 8: Renderer - Markdown Rendering

**Files:**
- Create: `src/renderer/js/markdown.js`

- [ ] **Step 1: Create markdown.js**

```javascript
const MarkdownRenderer = (() => {
  let markedInstance = null;
  let hljsInstance = null;

  function init() {
    if (typeof marked !== 'undefined') {
      markedInstance = marked;
      markedInstance.setOptions({
        breaks: true,
        gfm: true,
        highlight: function (code, lang) {
          if (hljsInstance && lang && hljsInstance.getLanguage(lang)) {
            return hljsInstance.highlight(code, { language: lang }).value;
          }
          return code;
        }
      });
    }
    if (typeof hljs !== 'undefined') {
      hljsInstance = hljs;
    }
  }

  function render(text) {
    if (!markedInstance) init();
    if (!markedInstance) return escapeHtml(text);

    let html = markedInstance.parse(text);

    // Add copy buttons to code blocks
    html = html.replace(/<pre><code class="language-(\w+)">/g,
      '<pre><button class="copy-btn" onclick="MarkdownRenderer.copyCode(this)">复制</button><code class="language-$1 hljs">');

    html = html.replace(/<pre><code>/g,
      '<pre><button class="copy-btn" onclick="MarkdownRenderer.copyCode(this)">复制</button><code>');

    return html;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function copyCode(btn) {
    const code = btn.parentElement.querySelector('code');
    if (code) {
      navigator.clipboard.writeText(code.textContent).then(() => {
        btn.textContent = '已复制';
        setTimeout(() => btn.textContent = '复制', 2000);
      });
    }
  }

  return { init, render, copyCode };
})();
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/js/markdown.js
git commit -m "feat: add Markdown rendering with syntax highlighting"
```

---

### Task 9: Renderer - Chat Logic

**Files:**
- Create: `src/renderer/js/chat.js`

- [ ] **Step 1: Create chat.js**

```javascript
const ChatManager = (() => {
  let currentConversationId = null;
  let isStreaming = false;
  let currentAssistantMessage = null;
  let accumulatedContent = '';

  function init() {
    // Listen for streaming events
    window.api.chat.onChunk(({ conversationId, chunk }) => {
      if (conversationId !== currentConversationId) return;
      accumulatedContent += chunk;
      updateAssistantMessage(accumulatedContent);
    });

    window.api.chat.onDone(({ conversationId, fullContent }) => {
      if (conversationId !== currentConversationId) return;
      isStreaming = false;
      accumulatedContent = '';
      enableInput(true);

      // Save assistant message
      window.api.conversations.addMessage(conversationId, {
        role: 'assistant',
        content: fullContent,
        files: []
      });

      // Check for PPT request
      window.api.ppt.detect(fullContent).then(pptData => {
        if (pptData) {
          generatePpt(pptData, conversationId);
        }
      });
    });

    window.api.chat.onError(({ conversationId, error }) => {
      if (conversationId !== currentConversationId) return;
      isStreaming = false;
      accumulatedContent = '';
      enableInput(true);
      showErrorMessage(error);
    });
  }

  function setConversation(id) {
    currentConversationId = id;
  }

  async function sendMessage(content, images = []) {
    if (!content.trim() && images.length === 0) return;
    if (isStreaming || !currentConversationId) return;

    isStreaming = true;
    enableInput(false);

    // Add user message to UI
    addMessageToUI('user', content, images);

    // Save user message
    await window.api.conversations.addMessage(currentConversationId, {
      role: 'user',
      content,
      images
    });

    // Clear input
    document.getElementById('message-input').value = '';
    clearImagePreview();

    // Show thinking indicator
    showThinkingIndicator();

    // Send to API
    window.api.chat.send({
      conversationId: currentConversationId,
      content,
      images
    });
  }

  function addMessageToUI(role, content, images = [], files = []) {
    const messagesDiv = document.getElementById('messages');
    const welcome = messagesDiv.querySelector('.welcome-message');
    if (welcome) welcome.remove();

    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${role}`;

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = role === 'user' ? '👤' : '🤖';

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';

    // Add images for user messages
    if (images && images.length > 0) {
      for (const img of images) {
        const imgEl = document.createElement('img');
        imgEl.src = img;
        imgEl.style.cssText = 'max-width: 200px; max-height: 200px; border-radius: 6px; margin-bottom: 8px; display: block;';
        bubble.appendChild(imgEl);
      }
    }

    // Render content
    if (role === 'assistant') {
      bubble.innerHTML += MarkdownRenderer.render(content);
    } else {
      const p = document.createElement('p');
      p.textContent = content;
      bubble.appendChild(p);
    }

    // Add file cards
    if (files && files.length > 0) {
      for (const file of files) {
        const card = FileRenderer.createCard(file);
        bubble.appendChild(card);
      }
    }

    msgDiv.appendChild(avatar);
    msgDiv.appendChild(bubble);
    messagesDiv.appendChild(msgDiv);
    scrollToBottom();

    return bubble;
  }

  function showThinkingIndicator() {
    const messagesDiv = document.getElementById('messages');
    const indicator = document.createElement('div');
    indicator.className = 'message assistant';
    indicator.id = 'thinking-indicator';

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = '🤖';

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.innerHTML = '<div class="thinking-indicator"><span></span><span></span><span></span></div>';

    indicator.appendChild(avatar);
    indicator.appendChild(bubble);
    messagesDiv.appendChild(indicator);
    scrollToBottom();
  }

  function removeThinkingIndicator() {
    const indicator = document.getElementById('thinking-indicator');
    if (indicator) indicator.remove();
  }

  function updateAssistantMessage(content) {
    removeThinkingIndicator();

    if (!currentAssistantMessage) {
      currentAssistantMessage = addMessageToUI('assistant', content);
    } else {
      currentAssistantMessage.innerHTML = MarkdownRenderer.render(content);
    }
    scrollToBottom();
  }

  function showErrorMessage(error) {
    removeThinkingIndicator();
    const messagesDiv = document.getElementById('messages');
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message error';

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = '⚠';

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.textContent = error;

    msgDiv.appendChild(avatar);
    msgDiv.appendChild(bubble);
    messagesDiv.appendChild(msgDiv);
    scrollToBottom();
  }

  async function generatePpt(pptData, conversationId) {
    try {
      addMessageToUI('assistant', '正在生成PPT文件...');
      const result = await window.api.ppt.generate(pptData);

      // Add file message
      await window.api.conversations.addMessage(conversationId, {
        role: 'assistant',
        content: `PPT已生成: ${result.filename}`,
        files: [{ name: result.filename, type: 'pptx', path: result.filePath }]
      });

      // Update UI with file card
      removeLastAssistantMessage();
      addMessageToUI('assistant', `PPT已生成: ${result.filename}`, [], [
        { name: result.filename, type: 'pptx', path: result.filePath }
      ]);
    } catch (e) {
      showErrorMessage(`PPT生成失败: ${e.message}`);
    }
  }

  function removeLastAssistantMessage() {
    const messages = document.querySelectorAll('.message.assistant');
    if (messages.length > 0) {
      messages[messages.length - 1].remove();
    }
  }

  function enableInput(enabled) {
    const input = document.getElementById('message-input');
    const sendBtn = document.getElementById('btn-send');
    input.disabled = !enabled;
    sendBtn.disabled = !enabled;
  }

  function clearMessages() {
    const messagesDiv = document.getElementById('messages');
    messagesDiv.innerHTML = '<div class="welcome-message"><h2>你好！有什么可以帮你的？</h2><p>你可以问我任何问题，或者让我帮你生成PPT、分析图片等。</p></div>';
    currentAssistantMessage = null;
  }

  function loadMessages(messages) {
    clearMessages();
    if (!messages || messages.length === 0) return;

    for (const msg of messages) {
      addMessageToUI(msg.role, msg.content, msg.images || [], msg.files || []);
    }
  }

  function scrollToBottom() {
    const chatArea = document.getElementById('chat-area');
    chatArea.scrollTop = chatArea.scrollHeight;
  }

  function clearImagePreview() {
    const preview = document.getElementById('image-preview');
    preview.style.display = 'none';
    preview.innerHTML = '';
  }

  return {
    init, setConversation, sendMessage, clearMessages, loadMessages,
    addMessageToUI, clearImagePreview, scrollToBottom
  };
})();
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/js/chat.js
git commit -m "feat: add chat manager with streaming display"
```

---

### Task 10: Renderer - Sidebar

**Files:**
- Create: `src/renderer/js/sidebar.js`

- [ ] **Step 1: Create sidebar.js**

```javascript
const SidebarManager = (() => {
  let activeConversationId = null;

  function init() {
    document.getElementById('btn-new-chat').addEventListener('click', createNewChat);
    loadConversations();
  }

  async function loadConversations() {
    const conversations = await window.api.conversations.getAll();
    renderList(conversations);

    // Auto-select first conversation
    if (conversations.length > 0 && !activeConversationId) {
      selectConversation(conversations[0].id);
    }
  }

  function renderList(conversations) {
    const list = document.getElementById('conversation-list');
    list.innerHTML = '';

    for (const conv of conversations) {
      const item = document.createElement('div');
      item.className = `conv-item ${conv.id === activeConversationId ? 'active' : ''}`;
      item.dataset.id = conv.id;

      const title = document.createElement('span');
      title.className = 'conv-title';
      title.textContent = conv.title || '新对话';

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'conv-delete';
      deleteBtn.textContent = '×';
      deleteBtn.title = '删除';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteConversation(conv.id);
      });

      item.appendChild(title);
      item.appendChild(deleteBtn);
      item.addEventListener('click', () => selectConversation(conv.id));
      list.appendChild(item);
    }
  }

  async function createNewChat() {
    const conv = await window.api.conversations.create('新对话');
    await loadConversations();
    selectConversation(conv.id);
  }

  async function selectConversation(id) {
    activeConversationId = id;
    const conv = await window.api.conversations.getById(id);
    if (!conv) return;

    ChatManager.setConversation(id);
    ChatManager.loadMessages(conv.messages);

    // Update settings bar from conversation settings
    if (conv.settings) {
      const modelSelect = document.getElementById('setting-model');
      const webSearch = document.getElementById('setting-web-search');
      const thinkingSelect = document.getElementById('setting-thinking');

      if (modelSelect) modelSelect.value = conv.settings.model || 'gpt-5.5';
      if (webSearch) webSearch.checked = conv.settings.webSearch !== false;
      if (thinkingSelect) thinkingSelect.value = conv.settings.thinkingLevel || 'medium';
    }

    // Update active state in list
    document.querySelectorAll('.conv-item').forEach(item => {
      item.classList.toggle('active', item.dataset.id === id);
    });
  }

  async function deleteConversation(id) {
    await window.api.conversations.delete(id);

    if (id === activeConversationId) {
      activeConversationId = null;
      ChatManager.clearMessages();
    }

    await loadConversations();

    // Select first available conversation
    if (!activeConversationId) {
      const conversations = await window.api.conversations.getAll();
      if (conversations.length > 0) {
        selectConversation(conversations[0].id);
      }
    }
  }

  function getActiveId() {
    return activeConversationId;
  }

  return { init, loadConversations, selectConversation, getActiveId, createNewChat };
})();
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/js/sidebar.js
git commit -m "feat: add sidebar conversation management"
```

---

### Task 11: Renderer - File Upload

**Files:**
- Create: `src/renderer/js/fileUpload.js`

- [ ] **Step 1: Create fileUpload.js**

```javascript
const FileUploader = (() => {
  let attachedImages = [];

  function init() {
    const fileInput = document.getElementById('file-input');
    const attachBtn = document.getElementById('btn-attach');
    const inputArea = document.getElementById('input-area');

    attachBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
      handleFiles(e.target.files);
      fileInput.value = '';
    });

    // Drag and drop
    inputArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      inputArea.classList.add('drag-over');
    });

    inputArea.addEventListener('dragleave', () => {
      inputArea.classList.remove('drag-over');
    });

    inputArea.addEventListener('drop', (e) => {
      e.preventDefault();
      inputArea.classList.remove('drag-over');
      handleFiles(e.dataTransfer.files);
    });
  }

  function handleFiles(files) {
    for (const file of files) {
      if (!CONSTANTS.SUPPORTED_IMAGE_TYPES.includes(file.type)) {
        alert(`不支持的文件类型: ${file.name}`);
        continue;
      }

      if (file.size > CONSTANTS.MAX_IMAGE_SIZE) {
        alert(`文件太大: ${file.name} (最大 10MB)`);
        continue;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        attachedImages.push(e.target.result);
        updatePreview();
      };
      reader.readAsDataURL(file);
    }
  }

  function updatePreview() {
    const preview = document.getElementById('image-preview');
    preview.innerHTML = '';

    if (attachedImages.length === 0) {
      preview.style.display = 'none';
      return;
    }

    preview.style.display = 'flex';

    attachedImages.forEach((imgData, index) => {
      const item = document.createElement('div');
      item.className = 'image-preview-item';

      const img = document.createElement('img');
      img.src = imgData;

      const removeBtn = document.createElement('button');
      removeBtn.className = 'remove-image';
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', () => {
        attachedImages.splice(index, 1);
        updatePreview();
      });

      item.appendChild(img);
      item.appendChild(removeBtn);
      preview.appendChild(item);
    });
  }

  function getImages() {
    return [...attachedImages];
  }

  function clear() {
    attachedImages = [];
    updatePreview();
  }

  return { init, getImages, clear };
})();
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/js/fileUpload.js
git commit -m "feat: add image upload with preview and drag-drop"
```

---

### Task 12: Renderer - File Render & Download

**Files:**
- Create: `src/renderer/js/fileRender.js`

- [ ] **Step 1: Create fileRender.js**

```javascript
const FileRenderer = (() => {
  const FILE_ICONS = {
    pptx: '📊',
    ppt: '📊',
    docx: '📝',
    doc: '📝',
    pdf: '📄',
    xlsx: '📈',
    csv: '📈',
    txt: '📃',
    js: '💻',
    py: '🐍',
    html: '🌐',
    css: '🎨',
    json: '📋',
    default: '📎'
  };

  function getIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    return FILE_ICONS[ext] || FILE_ICONS.default;
  }

  function formatSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function createCard(file) {
    const card = document.createElement('div');
    card.className = 'file-card';

    const icon = document.createElement('div');
    icon.className = 'file-card-icon';
    icon.textContent = getIcon(file.name);

    const info = document.createElement('div');
    info.className = 'file-card-info';

    const name = document.createElement('div');
    name.className = 'file-card-name';
    name.textContent = file.name;

    const size = document.createElement('div');
    size.className = 'file-card-size';
    size.textContent = formatSize(file.size);

    info.appendChild(name);
    info.appendChild(size);

    const actions = document.createElement('div');
    actions.className = 'file-card-actions';

    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'btn-download';
    downloadBtn.textContent = '下载';
    downloadBtn.addEventListener('click', () => downloadFile(file));

    actions.appendChild(downloadBtn);

    card.appendChild(icon);
    card.appendChild(info);
    card.appendChild(actions);

    return card;
  }

  async function downloadFile(file) {
    if (file.path) {
      await window.api.file.save(file.path, file.name);
    } else if (file.data) {
      // For base64 data, create a blob and trigger download
      const blob = base64ToBlob(file.data, file.type);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  function base64ToBlob(base64, mimeType) {
    const byteChars = atob(base64);
    const byteArrays = [];
    for (let i = 0; i < byteChars.length; i += 512) {
      const slice = byteChars.slice(i, i + 512);
      const byteNumbers = new Array(slice.length);
      for (let j = 0; j < slice.length; j++) {
        byteNumbers[j] = slice.charCodeAt(j);
      }
      byteArrays.push(new Uint8Array(byteNumbers));
    }
    return new Blob(byteArrays, { type: mimeType || 'application/octet-stream' });
  }

  return { createCard, downloadFile };
})();
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/js/fileRender.js
git commit -m "feat: add file card rendering and download"
```

---

### Task 13: Renderer - Settings Panel

**Files:**
- Create: `src/renderer/js/settings.js`

- [ ] **Step 1: Create settings.js**

```javascript
const SettingsManager = (() => {
  const STORAGE_KEY = 'ai-chat-settings';

  function init() {
    loadSettings();
    bindEvents();
  }

  function loadSettings() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const settings = JSON.parse(saved);
        applySettings(settings);
      } catch (e) {
        console.error('Failed to load settings:', e);
      }
    }
  }

  function applySettings(settings) {
    if (settings.apiUrl) document.getElementById('cfg-api-url').value = settings.apiUrl;
    if (settings.apiKey) document.getElementById('cfg-api-key').value = settings.apiKey;
    if (settings.temperature !== undefined) {
      document.getElementById('cfg-temperature').value = settings.temperature;
      document.getElementById('temp-value').textContent = settings.temperature;
    }
    if (settings.maxTokens) document.getElementById('cfg-max-tokens').value = settings.maxTokens;
    if (settings.systemPrompt) document.getElementById('cfg-system-prompt').value = settings.systemPrompt;

    // Update API client
    window.api.updateSettings({
      baseUrl: settings.apiUrl,
      apiKey: settings.apiKey
    });
  }

  function bindEvents() {
    // Open settings modal
    document.getElementById('btn-settings').addEventListener('click', () => {
      document.getElementById('settings-modal').style.display = 'flex';
    });

    // Close settings modal
    document.getElementById('btn-close-settings').addEventListener('click', closeModal);
    document.querySelector('.modal-overlay').addEventListener('click', closeModal);

    // Temperature slider
    document.getElementById('cfg-temperature').addEventListener('input', (e) => {
      document.getElementById('temp-value').textContent = e.target.value;
    });

    // Save settings
    document.getElementById('btn-save-settings').addEventListener('click', saveSettings);

    // Test connection
    document.getElementById('btn-test-connection').addEventListener('click', testConnection);

    // Settings bar quick controls
    document.getElementById('setting-model').addEventListener('change', updateConversationSettings);
    document.getElementById('setting-web-search').addEventListener('change', updateConversationSettings);
    document.getElementById('setting-thinking').addEventListener('change', updateConversationSettings);
  }

  function closeModal() {
    document.getElementById('settings-modal').style.display = 'none';
  }

  function saveSettings() {
    const settings = {
      apiUrl: document.getElementById('cfg-api-url').value,
      apiKey: document.getElementById('cfg-api-key').value,
      temperature: parseFloat(document.getElementById('cfg-temperature').value),
      maxTokens: parseInt(document.getElementById('cfg-max-tokens').value),
      systemPrompt: document.getElementById('cfg-system-prompt').value
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    applySettings(settings);
    closeModal();
  }

  async function testConnection() {
    const btn = document.getElementById('btn-test-connection');
    btn.textContent = '测试中...';
    btn.disabled = true;

    try {
      const response = await fetch(document.getElementById('cfg-api-url').value + '/v1/models', {
        headers: {
          'Authorization': `Bearer ${document.getElementById('cfg-api-key').value}`
        }
      });

      if (response.ok) {
        btn.textContent = '连接成功 ✓';
        btn.style.color = 'var(--success)';
      } else {
        btn.textContent = `失败 (${response.status})`;
        btn.style.color = 'var(--error)';
      }
    } catch (e) {
      btn.textContent = '连接失败';
      btn.style.color = 'var(--error)';
    }

    setTimeout(() => {
      btn.textContent = '测试连接';
      btn.style.color = '';
      btn.disabled = false;
    }, 3000);
  }

  async function updateConversationSettings() {
    const convId = SidebarManager.getActiveId();
    if (!convId) return;

    const settings = {
      model: document.getElementById('setting-model').value,
      webSearch: document.getElementById('setting-web-search').checked,
      thinkingLevel: document.getElementById('setting-thinking').value
    };

    await window.api.conversations.update(convId, { settings });
  }

  return { init };
})();
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/js/settings.js
git commit -m "feat: add settings panel with persistence"
```

---

### Task 14: Renderer - App Entry (Orchestration)

**Files:**
- Create: `src/renderer/js/app.js`

- [ ] **Step 1: Create app.js**

```javascript
// Load constants for renderer
const CONSTANTS = {
  DEFAULT_API_BASE: 'https://api.vectorengine.cn/v1',
  DEFAULT_API_KEY: 'sk-b7fvHZFbK7Bh1Gzy66qYhKZdjAT92k8IlXJA32aZ1c3MYbue',
  DEFAULT_MODEL: 'gpt-5.5',
  THINKING_LEVELS: ['low', 'medium', 'high', 'xhigh'],
  DEFAULT_THINKING: 'medium',
  DEFAULT_TEMPERATURE: 0.7,
  DEFAULT_MAX_TOKENS: 4096,
  MAX_IMAGE_SIZE: 10 * 1024 * 1024,
  SUPPORTED_IMAGE_TYPES: ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
};

document.addEventListener('DOMContentLoaded', () => {
  // Initialize modules
  MarkdownRenderer.init();
  ChatManager.init();
  SidebarManager.init();
  FileUploader.init();
  SettingsManager.init();

  // Window controls
  document.getElementById('btn-minimize').addEventListener('click', () => window.api.window.minimize());
  document.getElementById('btn-maximize').addEventListener('click', () => window.api.window.maximize());
  document.getElementById('btn-close').addEventListener('click', () => window.api.window.close());

  // Message input
  const messageInput = document.getElementById('message-input');
  const sendBtn = document.getElementById('btn-send');

  // Auto-resize textarea
  messageInput.addEventListener('input', () => {
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 200) + 'px';
  });

  // Send on Enter (Shift+Enter for new line)
  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  sendBtn.addEventListener('click', sendMessage);

  function sendMessage() {
    const content = messageInput.value;
    const images = FileUploader.getImages();
    ChatManager.sendMessage(content, images);
    FileUploader.clear();
    messageInput.style.height = 'auto';
  }
});
```

- [ ] **Step 2: Add script tags to index.html**

The script tags are already in the index.html from Task 6. Verify the order is correct:
1. `markdown.js` (no dependencies)
2. `fileUpload.js` (depends on CONSTANTS)
3. `fileRender.js` (no dependencies)
4. `chat.js` (depends on MarkdownRenderer, FileRenderer)
5. `sidebar.js` (depends on ChatManager)
6. `settings.js` (depends on SidebarManager)
7. `app.js` (orchestrates everything)

- [ ] **Step 3: Commit**

```bash
git add src/renderer/js/app.js
git commit -m "feat: add app entry point with event wiring"
```

---

### Task 15: Integration Test

**Files:**
- No new files

- [ ] **Step 1: Launch the application**

Run: `npm start`

Expected: Electron window opens with dark theme, sidebar, chat area, and input box.

- [ ] **Step 2: Test conversation creation**

Click "+ 新对话" button. Verify new conversation appears in sidebar.

- [ ] **Step 3: Test sending a message**

Type "你好" in the input box and press Enter. Verify:
- User message appears right-aligned
- AI response streams in left-aligned
- Markdown renders correctly

- [ ] **Step 4: Test image upload**

Click the attach button (📎). Select an image file. Verify:
- Image preview appears below input
- Image is included in the message

- [ ] **Step 5: Test settings**

Click the gear icon (⚙). Change temperature. Click save. Verify settings persist.

- [ ] **Step 6: Test conversation switching**

Create multiple conversations. Switch between them. Verify messages load correctly.

- [ ] **Step 7: Test PPT generation**

Send "帮我生成一个关于人工智能的PPT". Verify:
- AI returns PPT JSON
- PPT file is generated
- File card with download button appears

- [ ] **Step 8: Commit final state**

```bash
git add -A
git commit -m "feat: complete Electron AI chat application"
```
