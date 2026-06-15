// Constants for renderer (browser-compatible)
const CONSTANTS = {
  DEFAULT_API_BASE: '',
  DEFAULT_API_KEY: '',
  DEFAULT_MODEL: '',
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
  PromptsManager.init();
  ImageViewer.init();
  FilePreview.init();
  SettingsManager.init();

  // Notes panel
  document.getElementById('btn-notes').addEventListener('click', async () => {
    document.getElementById('notes-panel').style.display = 'flex';
    const notes = await window.api.notes.list();
    renderNotesList(notes);
  });

  document.getElementById('notes-search').addEventListener('input', async (e) => {
    const notes = await window.api.notes.search(e.target.value);
    renderNotesList(notes);
  });

  function renderNotesList(notes) {
    const list = document.getElementById('notes-list');
    list.innerHTML = notes.length === 0 ? '<p style="color:var(--text-muted);text-align:center;padding:20px;">暂无笔记</p>' : '';
    notes.forEach(n => {
      const item = document.createElement('div');
      item.className = 'note-item';
      item.innerHTML = `<div class="note-item-header"><strong>${n.title}</strong><button class="btn-note-del" data-id="${n.id}">&times;</button></div><p>${n.content.substring(0, 100)}${n.content.length > 100 ? '...' : ''}</p>${n.tags?.length ? '<div class="note-tags">' + n.tags.map(t => `<span>${t}</span>`).join('') + '</div>' : ''}`;
      item.querySelector('.btn-note-del').addEventListener('click', async () => {
        await window.api.notes.delete(n.id);
        const updated = await window.api.notes.list();
        renderNotesList(updated);
      });
      list.appendChild(item);
    });
  }



  // Load models into dropdown
  SettingsManager.refreshModelDropdown();

  // Load masks into dropdown
  async function loadMasks() {
    const masks = await window.api.masks.getAll();
    const select = document.getElementById('setting-mask');
    const current = select.value;
    select.innerHTML = '<option value="">无</option>';
    masks.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = `${m.icon || ''} ${m.name}`;
      select.appendChild(opt);
    });
    if (current) select.value = current;
  }
  loadMasks();

  document.getElementById('setting-mask').addEventListener('change', async (e) => {
    const convId = SidebarManager.getActiveId();
    if (!convId) return;
    const conv = await window.api.conversations.getById(convId);
    if (!conv) return;
    const maskId = e.target.value;
    let systemPrompt = '';
    if (maskId) {
      const masks = await window.api.masks.getAll();
      const mask = masks.find(m => m.id === maskId);
      if (mask) systemPrompt = mask.prompt;
    }
    const newSettings = { ...(conv.settings || {}), mask: maskId, customSystemPrompt: systemPrompt };
    await window.api.conversations.update(convId, { settings: newSettings });
  });

  // Developer mode toggle
  document.getElementById('setting-developer').disabled = false;
  document.getElementById('setting-developer').addEventListener('change', async (e) => {
    const convId = SidebarManager.getActiveId();
    if (!convId) return;
    const conv = await window.api.conversations.getById(convId);
    if (!conv) return;
    const newSettings = { ...(conv.settings || {}), developerMode: e.target.checked };
    await window.api.conversations.update(convId, { settings: newSettings });
  });

  // Model type switching
  document.getElementById('setting-model').addEventListener('change', async (e) => {
    const modelId = e.target.value;
    const models = await window.api.models.getAll();
    const model = models.find(m => m.id === modelId);
    const isImage = model && model.type === 'image';
    const inputEl = document.getElementById('message-input');
    const webSearchGroup = document.getElementById('setting-web-search').closest('.setting-group');
    const thinkingGroup = document.getElementById('setting-thinking').closest('.setting-group');

    inputEl.placeholder = isImage ? '描述你想生成的图片...' : '输入消息... (Enter 发送, Shift+Enter 换行)';
    if (webSearchGroup) webSearchGroup.style.display = isImage ? 'none' : '';
    if (thinkingGroup) thinkingGroup.style.display = isImage ? 'none' : '';
    const developerGroup = document.getElementById('setting-developer').closest('.setting-group');
    const maskGroup = document.getElementById('setting-mask').closest('.setting-group');
    if (developerGroup) developerGroup.style.display = isImage ? 'none' : '';
    if (maskGroup) maskGroup.style.display = isImage ? 'none' : '';
  });

  // Window controls
  document.getElementById('btn-minimize').addEventListener('click', () => window.api.window.minimize());
  document.getElementById('btn-maximize').addEventListener('click', () => window.api.window.maximize());
  document.getElementById('btn-close').addEventListener('click', () => window.api.window.close());

  // Theme toggle
  const themeBtn = document.getElementById('btn-theme');
  const savedTheme = localStorage.getItem('theme') || 'dark';
  applyTheme(savedTheme);

  themeBtn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem('theme', next);
  });

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    themeBtn.innerHTML = theme === 'dark' ? '&#9788;' : '&#9790;';
    themeBtn.title = theme === 'dark' ? '切换到亮色' : '切换到暗色';
  }

  // Export
  const exportBtn = document.getElementById('btn-export');
  const exportMenu = document.getElementById('export-menu');

  exportBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    exportMenu.style.display = exportMenu.style.display === 'none' ? 'block' : 'none';
  });

  document.addEventListener('click', () => {
    exportMenu.style.display = 'none';
  });

  exportMenu.addEventListener('click', async (e) => {
    const format = e.target.dataset.format;
    if (!format) return;
    exportMenu.style.display = 'none';

    const convId = SidebarManager.getActiveId();
    if (!convId) return;

    try {
      if (format === 'markdown') await window.api.export.markdown(convId);
      else if (format === 'pdf') await window.api.export.pdf(convId);
      else if (format === 'docx') await window.api.export.docx(convId);
    } catch (e) {
      alert('导出失败: ' + e.message);
    }
  });

  // Markdown preview toggle
  const previewBtn = document.getElementById('btn-preview');
  const mdPreview = document.getElementById('md-preview');
  const inputContainer = document.getElementById('input-container');
  let previewEnabled = false;

  previewBtn.addEventListener('click', () => {
    previewEnabled = !previewEnabled;
    inputContainer.classList.toggle('split-mode', previewEnabled);
    mdPreview.style.display = previewEnabled ? 'block' : 'none';
    previewBtn.style.color = previewEnabled ? 'var(--accent)' : '';
    if (!previewEnabled) {
      messageInput.style.width = '';
      messageInput.style.height = 'auto';
    }
    updateMdPreview();
  });

  function updateMdPreview() {
    if (!previewEnabled) return;
    const text = messageInput.value;
    mdPreview.innerHTML = text ? MarkdownRenderer.render(text) : '<span style="color:var(--text-muted)">Markdown 预览</span>';
    mdPreview.style.height = messageInput.style.height || 'auto';
  }

  // Message input
  const messageInput = document.getElementById('message-input');
  const sendBtn = document.getElementById('btn-send');

  // Auto-resize textarea
  messageInput.addEventListener('input', () => {
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 200) + 'px';
    updateMdPreview();
  });

  // Send on Enter (Shift+Enter for new line)
  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  sendBtn.addEventListener('click', () => {
    if (ChatManager.isStreaming) {
      window.api.chat.stop();
    } else {
      sendMessage();
    }
  });

  function sendMessage() {
    const content = messageInput.value;
    const images = FileUploader.getImages();
    const documents = FileUploader.getDocuments();
    ChatManager.sendMessage(content, images, documents);
    FileUploader.clear();
    messageInput.style.height = 'auto';
    if (previewEnabled) {
      mdPreview.innerHTML = '<span style="color:var(--text-muted)">Markdown 预览</span>';
    }
  }
});
