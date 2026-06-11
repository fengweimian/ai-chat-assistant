// Constants for renderer (browser-compatible)
const CONSTANTS = {
  DEFAULT_API_BASE: 'https://REDACTED',
  DEFAULT_API_KEY: 'sk-REDACTED',
  DEFAULT_MODEL: 'gpt-5.5',
  THINKING_LEVELS: ['low', 'medium', 'high', 'xhigh'],
  DEFAULT_THINKING: 'medium',
  DEFAULT_TEMPERATURE: 0.7,
  DEFAULT_MAX_TOKENS: 4096,
  MAX_IMAGE_SIZE: 10 * 1024 * 1024,
  SUPPORTED_IMAGE_TYPES: ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
};

document.addEventListener('DOMContentLoaded', () => {
  // Initialize all modules
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
