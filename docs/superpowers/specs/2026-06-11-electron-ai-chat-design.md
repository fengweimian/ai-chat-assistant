# Electron AI Chat Application Design

## Overview

An Electron-based desktop chat application for conversing with the GPT-5.5 AI model. Features include multi-conversation management, image upload, file generation (PPT/code/text), Markdown rendering, and configurable model settings (thinking level, web search, temperature).

## Tech Stack

- **Electron** - Desktop framework
- **Vanilla HTML/CSS/JS** - No build step, zero-config UI
- **OpenAI SDK** (or raw fetch) - API communication
- **marked** - Markdown parsing
- **highlight.js** - Code syntax highlighting
- **pptxgenjs** - PPT file generation

## Architecture

```
┌─────────────────────────────────────────────┐
│                Electron App                 │
├──────────────────┬──────────────────────────┤
│   Main Process   │     Renderer Process     │
│                  │                          │
│  - API streaming │  - Chat UI              │
│  - File system   │  - Markdown rendering   │
│  - PPT generation│  - Image upload         │
│  - Conversation  │  - Settings panel       │
│    persistence   │  - Conversation list    │
│  - File download │                          │
│                  │                          │
│  ←── IPC ───────→│                          │
└──────────────────┴──────────────────────────┘
```

- **Main process**: Handles all Node.js operations (API calls with streaming, file I/O, PPT generation, conversation storage). API key stays in main process for security.
- **Renderer process**: Pure UI layer. Sends user input via IPC, receives streamed responses via IPC.
- **Preload script**: Secure bridge exposing `window.api` with typed IPC methods.

## Directory Structure

```
gpt_demo/
├── package.json
├── main.js                  # Electron main process entry
├── preload.js               # Preload script (secure IPC bridge)
├── src/
│   ├── renderer/
│   │   ├── index.html        # Main page
│   │   ├── styles/
│   │   │   └── main.css      # Dark theme styles
│   │   ├── js/
│   │   │   ├── app.js        # App entry, orchestration
│   │   │   ├── chat.js       # Chat logic (send/receive/stream)
│   │   │   ├── sidebar.js    # Conversation list management
│   │   │   ├── settings.js   # Settings panel
│   │   │   ├── markdown.js   # Markdown rendering + code highlight
│   │   │   ├── fileUpload.js # Image upload handling
│   │   │   └── fileRender.js # File attachment rendering + download
│   │   └── assets/
│   │       └── icons/        # UI icons (SVG)
│   ├── main/
│   │   ├── api.js            # OpenAI API calls (streaming)
│   │   ├── pptGenerator.js   # PPT generation with pptxgenjs
│   │   ├── store.js          # Conversation persistence (JSON)
│   │   └── download.js       # File download manager
│   └── shared/
│       └── constants.js      # Shared constants
└── data/                     # Conversation data directory
    └── conversations.json
```

## UI Layout

```
┌──────────────────────────────────────────────────────────────┐
│  AI Chat Assistant                       Settings  [min][x]  │
├────────────┬─────────────────────────────────────────────────┤
│            │                                                 │
│ [+ New]    │  Model: [gpt-5.5 v]  Web: [x]  Think: [Med v]  │
│            │─────────────────────────────────────────────────│
│ ┌────────┐ │                                                 │
│ │ Conv 1 │ │  AI: Hello! How can I help you?                │
│ │ Conv 2 │ │                                                 │
│ │ Conv 3 │ │  User: Generate a PPT about AI                 │
│ │        │ │                                                 │
│ │        │ │  AI: Sure, generating...                       │
│ │        │ │  ┌────────────────────────────────────┐         │
│ │        │ │  │ AI_Intro.pptx                      │         │
│ │        │ │  │ [Preview] [Download]               │         │
│ │        │ │  └────────────────────────────────────┘         │
│ │        │ │                                                 │
│ │        │ │  User: [image] What's in this picture?          │
│ │        │ │                                                 │
│ │        │ │  AI: This image shows...                       │
│ │        │ │                                                 │
│ └────────┘ │  ┌────────────────────────────────────────┐     │
│            │  │ [Attach] Type a message...      [Send] │     │
│            │  └────────────────────────────────────────┘     │
└────────────┴─────────────────────────────────────────────────┘
```

### Key UI Elements

- **Sidebar** (240px): Conversation list with new/delete/rename. Active conversation highlighted.
- **Top bar**: Model selector, web search toggle, thinking level dropdown.
- **Chat area**: Scrollable message list. User messages right-aligned, AI messages left-aligned.
- **Input area**: Multi-line textarea + attach button + send button.
- **File cards**: Displayed inline in AI messages with preview/download actions.
- **Code blocks**: Syntax-highlighted with copy button in top-right corner.

## API Integration

### Model Configuration

| Setting | API Mapping | Default |
|---------|-------------|---------|
| Model | `model` field | `gpt-5.5` |
| Web Search | Built into GPT-5.5; when enabled, append "请搜索互联网获取最新信息后回答" to system prompt | On |
| Thinking Level | Model name suffix: `-low`, `-medium`, `-high`, `-xhigh` | `medium` |
| Temperature | `temperature` field (0-2) | 0.7 |
| Max Tokens | `max_tokens` field | 4096 |

### Request Flow

1. User types message (optionally attaches image) → clicks Send
2. Renderer sends `{ content, images?, conversationId }` via IPC to main process
3. Main process builds OpenAI messages array:
   - System prompt (with web search instruction if enabled)
   - Full conversation history
   - Current message with image attachments (base64 data URLs in content array)
4. Main process calls `fetch()` with streaming to `/v1/chat/completions`
5. Each chunk is parsed and forwarded to renderer via IPC (`chat:chunk`)
6. Renderer appends text to current AI message in real-time
7. On completion, main process sends `chat:done` with full response
8. If response contains PPT request, main process generates .pptx and sends `chat:file` event

### Streaming Implementation

```javascript
// Main process (api.js)
const response = await fetch(`${baseURL}/v1/chat/completions`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ model, messages, stream: true, temperature })
});

const reader = response.body.getReader();
// Parse SSE chunks, forward to renderer via IPC
```

### Message Format (OpenAI Vision)

```json
{
  "role": "user",
  "content": [
    { "type": "text", "text": "What's in this image?" },
    { "type": "image_url", "image_url": { "url": "data:image/png;base64,..." } }
  ]
}
```

## Conversation Data Model

```json
{
  "id": "conv_1718123456789",
  "title": "First message or auto-generated title",
  "createdAt": 1718123456789,
  "updatedAt": 1718123456789,
  "settings": {
    "model": "gpt-5.5",
    "webSearch": true,
    "thinkingLevel": "medium",
    "temperature": 0.7
  },
  "messages": [
    {
      "id": "msg_1",
      "role": "user",
      "content": "Hello",
      "images": [],
      "timestamp": 1718123456789
    },
    {
      "id": "msg_2",
      "role": "assistant",
      "content": "Hi! How can I help?",
      "files": [],
      "timestamp": 1718123456790
    }
  ]
}
```

Conversations stored as a single `data/conversations.json` file, loaded on startup, saved after each message.

## Features

### Image Upload

- Click attach button or drag-and-drop onto input area
- Show thumbnail preview below input, with remove button
- Convert to base64 before sending
- Support formats: PNG, JPG, GIF, WebP
- Max size: 10MB per image

### Markdown Rendering

- Use `marked` library for parsing
- `highlight.js` for code block syntax highlighting
- Code blocks get a "Copy" button in top-right corner
- Tables rendered with horizontal scroll for overflow
- Links open in external browser
- Inline code styled with background color

### File Display and Download

- AI-generated files shown as cards in message bubble
- Card shows: file icon, filename, file size
- Actions: Download button (triggers native save dialog)
- PPT files: Optional inline preview (thumbnail of first slide)
- Code files: Show language tag, copy button

### PPT Generation

The system prompt instructs the AI: "当用户要求生成PPT时，请返回以下JSON格式（用```json包裹）：{type:'pptx', title:'...', slides:[{title:'...', content:['...']}]}。其他时候正常用Markdown回答。"

When the AI response contains a JSON block with `"type": "pptx"`, the main process detects it via regex and triggers PPT generation:

1. AI returns structured JSON:
```json
{
  "type": "pptx",
  "title": "AI Technology Overview",
  "slides": [
    { "title": "Introduction", "content": ["Point 1", "Point 2"] },
    { "title": "Key Concepts", "content": ["...", "..."] }
  ]
}
```

2. Main process generates .pptx using pptxgenjs:
   - Title slide with custom title
   - Content slides with bullet points
   - Dark theme colors matching app theme

3. File saved to temp directory, path sent to renderer
4. Renderer shows file card with download button

### Settings Panel

Accessed via gear icon. Sections:

1. **API Configuration**
   - API Base URL (default: `https://api.vectorengine.cn/v1`)
   - API Key (default: pre-configured, editable)
   - Test connection button

2. **Model Settings**
   - Model selector dropdown
   - Temperature slider (0-2, step 0.1)
   - Max tokens input
   - System prompt textarea

3. **Appearance**
   - Font size slider (12-20px)

4. **Data Management**
   - Export all conversations
   - Import conversations
   - Clear all data

## Error Handling

- API errors: Show error message in red bubble in chat
- Network errors: Show retry button
- Invalid API key: Prompt to update in settings
- File too large: Show size limit warning before upload
- PPT generation failure: Show error, suggest retry

## Dependencies

```json
{
  "electron": "^35.0.0",
  "marked": "^15.0.0",
  "highlight.js": "^11.11.0",
  "pptxgenjs": "^3.12.0"
}
```
