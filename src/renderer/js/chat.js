const ChatManager = (() => {
  let currentConversationId = null;
  let isStreaming = false;
  let currentAssistantMessage = null;
  let accumulatedContent = '';
  let userAvatarSrc = null;
  let currentThinkingBlock = null;
  let accumulatedThinking = '';

  function init() {
    window.api.avatar.get().then(p => {
      if (p) userAvatarSrc = `file:///${p.replace(/\\/g, '/')}`;
    });
    document.addEventListener('avatar:updated', (e) => {
      userAvatarSrc = e.detail;
    });

    initConsole();

    window.api.chat.onThinking(({ conversationId, thinkingChunk }) => {
      if (conversationId !== currentConversationId) return;
      accumulatedThinking += thinkingChunk;
      updateThinkingBlock(accumulatedThinking);
    });

    window.api.chat.onSearching(({ conversationId, query }) => {
      if (conversationId !== currentConversationId) return;
      showSearchingIndicator(query);
    });

    window.api.chat.onUsage(({ conversationId, usage }) => {
      if (conversationId !== currentConversationId) return;
      updateTokenStats(usage);
    });

    window.api.chat.onFileCreated(({ conversationId, file }) => {
      if (conversationId !== currentConversationId) return;
      const lastBubble = document.querySelector('.message.assistant:last-child .message-bubble');
      if (lastBubble) {
        const card = FileRenderer.createCard(file);
        lastBubble.appendChild(card);
        scrollToBottom();
      }
    });
    window.api.chat.onChunk(({ conversationId, chunk }) => {
      if (conversationId !== currentConversationId) return;
      accumulatedContent += chunk;
      updateAssistantMessage(sanitizeContent(accumulatedContent));
    });

    window.api.chat.onDone(({ conversationId, fullContent, fullThinking }) => {
      if (conversationId !== currentConversationId) return;
      isStreaming = false;
      accumulatedContent = '';

      if (currentThinkingBlock) {
        const summary = currentThinkingBlock.querySelector('summary');
        if (summary) summary.textContent = '💭 思考过程';
      }

      currentAssistantMessage = null;
      currentThinkingBlock = null;
      accumulatedThinking = '';
      enableInput(true);
      attachRegenerateButton();
      postRender();

      if (!document.hasFocus()) {
        window.api.notify('AI 回复完成', fullContent.substring(0, 100) + (fullContent.length > 100 ? '...' : ''));
      }

      window.api.conversations.addMessage(conversationId, {
        role: 'assistant',
        content: fullContent,
        thinking: fullThinking || undefined,
        files: []
      });

      window.api.ppt.detect(fullContent).then(pptData => {
        if (pptData) {
          generatePpt(pptData, conversationId);
        }
      });

      detectAndRenderChart(fullContent);
    });

    window.api.chat.onError(({ conversationId, error }) => {
      if (conversationId !== currentConversationId) return;
      isStreaming = false;
      accumulatedContent = '';
      currentAssistantMessage = null;
      enableInput(true);
      showErrorMessage(error);
    });
  }

  function setConversation(id) {
    currentConversationId = id;
  }

  async function sendMessage(content, images = [], documents = []) {
    if (!content.trim() && images.length === 0 && documents.length === 0) return;
    if (isStreaming || !currentConversationId) return;

    isStreaming = true;
    enableInput(false);

    const docNames = documents.map(d => d.name);
    const docPaths = [];
    for (const doc of documents) {
      try {
        const copiedPath = await window.api.file.copyToData(doc.path);
        docPaths.push(copiedPath);
      } catch (e) {
        docPaths.push(doc.path);
      }
    }
    const imageUrls = images.map(img => img.dataUrl || img);
    const imagePaths = images.map(img => img.path).filter(Boolean);
    addMessageToUI('user', content, imageUrls, [], docNames, docPaths);

    document.getElementById('message-input').value = '';
    ChatManager.clearImagePreview();

    let fullContent = content;

    const urlRegex = /https?:\/\/[^\s<>"']+/g;
    const urls = content.match(urlRegex);
    if (urls && urls.length > 0) {
      try {
        for (const url of urls.slice(0, 3)) {
          const webContent = await window.api.web.read(url);
          if (webContent) {
            fullContent += `\n\n[网页内容: ${url}]\n${webContent}`;
          }
        }
      } catch (e) {}
    }

    const selectedModelId = document.getElementById('setting-model').value;
    const models = await window.api.models.getAll();
    const currentModel = models.find(m => m.id === selectedModelId);

    if (currentModel && currentModel.type === 'image') {
      await window.api.conversations.addMessage(currentConversationId, {
        role: 'user',
        content,
        fullContent: fullContent !== content ? fullContent : undefined,
        images: imageUrls,
        imagePaths: imagePaths.length > 0 ? imagePaths : undefined,
        docNames: docNames.length > 0 ? docNames : undefined,
        docPaths: docPaths.length > 0 ? docPaths : undefined
      });
      showThinkingIndicator();
      try {
        const result = await window.api.image.generate(selectedModelId, content, images);
        removeThinkingIndicator();
        isStreaming = false;
        enableInput(true);

        addImageMessageToUI(result);

        const imagePaths = result.map(r => r.path);
        await window.api.conversations.addMessage(currentConversationId, {
          role: 'assistant',
          content: '[图片已生成]',
          generatedImages: imagePaths
        });
        attachRegenerateButton();
        scrollToBottom();
      } catch (e) {
        removeThinkingIndicator();
        isStreaming = false;
        enableInput(true);
        showErrorMessage(e.message || '生图失败');
      }
      return;
    }

    showThinkingIndicator();

    window.api.chat.send({
      conversationId: currentConversationId,
      content: fullContent,
      images: imageUrls,
      docNames: docNames.length > 0 ? docNames : undefined,
      docPaths: docPaths.length > 0 ? docPaths : undefined,
      imagePaths: imagePaths.length > 0 ? imagePaths : undefined
    });

    await window.api.conversations.addMessage(currentConversationId, {
      role: 'user',
      content,
      fullContent: fullContent !== content ? fullContent : undefined,
      images,
      docNames: docNames.length > 0 ? docNames : undefined,
      docPaths: docPaths.length > 0 ? docPaths : undefined
    });
  }

  const DOC_ICON_MAP_CHAT = {
    '.docx': '../../static/images/word.png',
    '.doc': '../../static/images/word.png',
    '.xlsx': '../../static/images/excel.webp',
    '.xls': '../../static/images/excel.webp',
    '.csv': '../../static/images/excel.webp',
    '.pptx': '../../static/images/ppt.png',
    '.ppt': '../../static/images/ppt.png',
    '.pdf': '../../static/images/pdf.webp',
  };

  function getFileIconElement(filename) {
    const ext = '.' + filename.split('.').pop().toLowerCase();
    const src = DOC_ICON_MAP_CHAT[ext];
    if (src) {
      const img = document.createElement('img');
      img.src = src;
      img.className = 'doc-tag-icon-img';
      return img;
    }
    const span = document.createElement('span');
    span.className = 'doc-tag-icon';
    span.textContent = '📎';
    return span;
  }

  function addMessageToUI(role, content, images = [], files = [], docNames = [], docPaths = []) {
    const messagesDiv = document.getElementById('messages');
    const welcome = messagesDiv.querySelector('.welcome-message');
    if (welcome) welcome.remove();

    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${role}`;

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    if (role === 'user' && userAvatarSrc) {
      const avatarImg = document.createElement('img');
      avatarImg.src = userAvatarSrc;
      avatar.appendChild(avatarImg);
    } else {
      avatar.textContent = role === 'user' ? '👤' : '🤖';
    }

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';

    if (docNames && docNames.length > 0) {
      const tagsDiv = document.createElement('div');
      tagsDiv.className = 'doc-tags';
      docNames.forEach((name, i) => {
        const tag = document.createElement('div');
        tag.className = 'doc-tag';
        tag.appendChild(getFileIconElement(name));
        const label = document.createElement('span');
        label.className = 'doc-tag-name';
        label.textContent = name;
        tag.appendChild(label);
        if (docPaths && docPaths[i]) {
          tag.classList.add('doc-tag-clickable');
          tag.addEventListener('click', () => FilePreview.open(docPaths[i]));
        }
        tagsDiv.appendChild(tag);
      });
      bubble.appendChild(tagsDiv);
    }

    if (images && images.length > 0) {
      const imgGrid = document.createElement('div');
      imgGrid.className = 'message-images';
      for (const img of images) {
        const wrapper = document.createElement('div');
        wrapper.className = 'message-img-wrapper';
        const imgEl = document.createElement('img');
        imgEl.src = img;
        imgEl.className = 'message-img';
        imgEl.addEventListener('click', () => ImageViewer.open(img));
        wrapper.appendChild(imgEl);
        imgGrid.appendChild(wrapper);
      }
      bubble.appendChild(imgGrid);
    }

    if (content) {
      const contentDiv = document.createElement('div');
      contentDiv.className = 'message-content';
      contentDiv.innerHTML = MarkdownRenderer.render(content);
      bubble.appendChild(contentDiv);
    }

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

  async function regenerateMessage(msgElement) {
    if (isStreaming || !currentConversationId) return;

    await window.api.conversations.removeLastMessage(currentConversationId);
    msgElement.remove();

    const conv = await window.api.conversations.getById(currentConversationId);
    if (!conv || conv.messages.length === 0) return;

    const lastUserMsg = [...conv.messages].reverse().find(m => m.role === 'user');
    if (!lastUserMsg) return;

    isStreaming = true;
    enableInput(false);
    showThinkingIndicator();

    window.api.chat.send({
      conversationId: currentConversationId,
      content: lastUserMsg.fullContent || lastUserMsg.content,
      images: lastUserMsg.images || [],
      docNames: lastUserMsg.docNames,
      docPaths: lastUserMsg.docPaths,
      imagePaths: lastUserMsg.imagePaths
    });
  }

  function addImageMessageToUI(images) {
    const messagesDiv = document.getElementById('messages');
    const welcome = messagesDiv.querySelector('.welcome-message');
    if (welcome) welcome.remove();

    const msgDiv = document.createElement('div');
    msgDiv.className = 'message assistant';

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = '🤖';

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble image-bubble';

    const imgContainer = ImageViewer.createImageMessage(images);
    bubble.appendChild(imgContainer);

    msgDiv.appendChild(avatar);
    msgDiv.appendChild(bubble);
    messagesDiv.appendChild(msgDiv);
    scrollToBottom();
  }

  function attachRegenerateButton() {
    document.querySelectorAll('.message-actions').forEach(el => el.remove());
    const allAssistant = document.querySelectorAll('.message.assistant');
    if (allAssistant.length === 0) return;
    const lastMsg = allAssistant[allAssistant.length - 1];
    const bubble = lastMsg.querySelector('.message-bubble');
    if (!bubble) return;

    const actions = document.createElement('div');
    actions.className = 'message-actions';
    const regenBtn = document.createElement('button');
    regenBtn.className = 'btn-regenerate';
    regenBtn.textContent = '🔄';
    regenBtn.title = '重新生成';
    regenBtn.addEventListener('click', () => regenerateMessage(lastMsg));
    actions.appendChild(regenBtn);

    lastMsg.appendChild(actions);
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

  function showSearchingIndicator(query) {
    removeThinkingIndicator();
    if (!currentAssistantMessage) {
      currentAssistantMessage = addMessageToUI('assistant', '');
    }
    let searchEl = currentAssistantMessage.querySelector('.searching-indicator');
    if (!searchEl) {
      searchEl = document.createElement('div');
      searchEl.className = 'searching-indicator';
      currentAssistantMessage.appendChild(searchEl);
    }
    searchEl.textContent = query;
    scrollToBottom();
  }

  function updateThinkingBlock(thinking) {
    removeThinkingIndicator();

    if (!currentAssistantMessage) {
      currentAssistantMessage = addMessageToUI('assistant', '');
    }

    if (!currentThinkingBlock) {
      currentThinkingBlock = document.createElement('details');
      currentThinkingBlock.className = 'thinking-block';
      currentThinkingBlock.innerHTML = '<summary>💭 思考中...</summary><div class="thinking-content"></div>';
      currentAssistantMessage.insertBefore(currentThinkingBlock, currentAssistantMessage.firstChild);
    }

    const contentDiv = currentThinkingBlock.querySelector('.thinking-content');
    contentDiv.textContent = thinking;
    scrollToBottom();
  }

  function updateAssistantMessage(content) {
    removeThinkingIndicator();

    if (!currentAssistantMessage) {
      currentAssistantMessage = addMessageToUI('assistant', content);
    } else {
      const thinkingEl = currentAssistantMessage.querySelector('.thinking-block');
      const searchEl = currentAssistantMessage.querySelector('.searching-indicator');
      const fileCards = [...currentAssistantMessage.querySelectorAll('.file-card')];
      if (searchEl) searchEl.remove();
      currentAssistantMessage.innerHTML = MarkdownRenderer.render(content);
      if (thinkingEl) {
        currentAssistantMessage.insertBefore(thinkingEl, currentAssistantMessage.firstChild);
      }
      fileCards.forEach(card => currentAssistantMessage.appendChild(card));
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

      await window.api.conversations.addMessage(conversationId, {
        role: 'assistant',
        content: `PPT已生成: ${result.filename}`,
        files: [{ name: result.filename, type: 'pptx', path: result.filePath }]
      });

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
    if (enabled) {
      sendBtn.innerHTML = '&#9654;';
      sendBtn.className = 'btn-send';
      sendBtn.title = '发送';
    } else {
      sendBtn.innerHTML = '&#9632;';
      sendBtn.className = 'btn-send btn-stop';
      sendBtn.title = '停止生成';
    }
    sendBtn.disabled = false;
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
      if (msg.generatedImages && msg.generatedImages.length > 0) {
        const imgData = msg.generatedImages.map(p => ({ path: p, base64: `file:///${p.replace(/\\/g, '/')}` }));
        addImageMessageToUI(imgData);
      } else {
        const bubble =         addMessageToUI(msg.role, msg.content, msg.images || [], msg.files || [], msg.docNames || [], msg.docPaths || []);
        if (msg.thinking && bubble) {
          const block = document.createElement('details');
          block.className = 'thinking-block';
          const summary = document.createElement('summary');
          summary.textContent = '💭 思考过程';
          const content = document.createElement('div');
          content.className = 'thinking-content';
          content.textContent = msg.thinking;
          block.appendChild(summary);
          block.appendChild(content);
          bubble.insertBefore(block, bubble.firstChild);
        }
      }
    }
    attachRegenerateButton();
    postRender();
  }

  function sanitizeContent(text) {
    return text
      .replace(/<\uff5c\uff5cDSML\uff5c\uff5ctool_calls>[\s\S]*?<\/\uff5c\uff5cDSML\uff5c\uff5ctool_calls>/g, '')
      .replace(/<\uff5c\uff5cDSML\uff5c\uff5c[^>]*>/g, '')
      .replace(/<\/\uff5c\uff5cDSML\uff5c\uff5c[^>]*>/g, '')
      .replace(/\uff5c\uff5cDSML\uff5c\uff5c\w+>/g, '')
      .trim();
  }

  function detectAndRenderChart(text) {
    const jsonMatch = text.match(/```json\s*([\s\S]*?)```/);
    if (!jsonMatch) return;
    try {
      const data = JSON.parse(jsonMatch[1].trim());
      if (data.type !== 'chart' || !data.chartType) return;

      const lastBubble = document.querySelector('.message.assistant:last-child .message-bubble');
      if (!lastBubble) return;

      const container = document.createElement('div');
      container.className = 'chart-container';
      const canvas = document.createElement('canvas');
      container.appendChild(canvas);
      lastBubble.appendChild(container);

      const datasets = (data.datasets || []).map((ds, i) => ({
        label: ds.label || `系列${i + 1}`,
        data: ds.data || [],
        backgroundColor: ds.color || ['#58a6ff', '#3fb950', '#f85149', '#d29922', '#bc8cff'][i % 5],
        borderColor: ds.color || ['#58a6ff', '#3fb950', '#f85149', '#d29922', '#bc8cff'][i % 5],
        borderWidth: data.chartType === 'line' ? 2 : 1,
        fill: false
      }));

      new Chart(canvas, {
        type: data.chartType,
        data: { labels: data.labels || [], datasets },
        options: {
          responsive: true,
          plugins: { title: { display: !!data.title, text: data.title || '' } }
        }
      });
    } catch (e) {}
  }

  function updateTokenStats(usage) {
    const el = document.getElementById('token-stats');
    if (el && usage) {
      el.textContent = `Token: 入 ${usage.prompt_tokens || 0} | 出 ${usage.completion_tokens || 0} | 总计 ${usage.total_tokens || 0}`;
    }
  }

  function processLinkPreviews(container) {
    if (!container) return;
    const links = container.querySelectorAll('a[href^="http"]');
    links.forEach(async (link) => {
      if (link.dataset.previewed) return;
      link.dataset.previewed = 'true';
      try {
        const preview = await window.api.link.preview(link.href);
        if (preview) {
          const card = document.createElement('div');
          card.className = 'link-preview-card';
          card.innerHTML = `<div class="link-preview-title">${preview.title || ''}</div><div class="link-preview-desc">${preview.description || ''}</div><div class="link-preview-domain">${preview.domain || ''}</div>`;
          link.parentElement.insertBefore(card, link.nextSibling);
        }
      } catch (e) {}
    });
  }

  function postRender() {
    MarkdownRenderer.renderMermaidBlocks();
    const messagesDiv = document.getElementById('messages');
    const lastMsg = messagesDiv.querySelector('.message:last-child .message-bubble');
    if (lastMsg) processLinkPreviews(lastMsg);
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
  let currentStreamId = null;
  let replSessionId = null;
  let replActive = false;

  function initConsole() {
    const panel = document.getElementById('console-panel');
    const output = document.getElementById('console-output');
    const btn = document.getElementById('btn-console');
    const handle = document.getElementById('console-resize-handle');
    let panelHeight = 200;
    let isResizing = false;

    btn.addEventListener('click', () => {
      if (panel.style.display === 'none') {
        panel.style.display = 'flex';
        panel.style.height = panelHeight + 'px';
        btn.style.color = 'var(--accent)';
        if (!replSessionId) startRepl();
      } else {
        panel.style.display = 'none';
        btn.style.color = '';
      }
    });

    document.getElementById('btn-console-close').addEventListener('click', () => {
      panel.style.display = 'none';
      btn.style.color = '';
      replActive = false;
    });

    document.getElementById('btn-console-clear').addEventListener('click', () => {
      output.innerHTML = '';
    });

    document.getElementById('btn-console-restart').addEventListener('click', () => {
      if (replSessionId) { window.api.repl.kill(replSessionId); replSessionId = null; }
      startRepl();
    });

    document.getElementById('btn-console-interrupt').addEventListener('click', () => {
      if (replSessionId) window.api.repl.interrupt(replSessionId);
    });

    document.getElementById('console-lang').addEventListener('change', () => {
      if (replSessionId) { window.api.repl.kill(replSessionId); replSessionId = null; }
      startRepl();
    });

    const inputEl = document.getElementById('console-input');
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const data = inputEl.value;
        if (data && replSessionId) {
          window.api.repl.write(replSessionId, data);
        }
        inputEl.value = '';
      }
    });

    document.getElementById('btn-console-send').addEventListener('click', () => {
      const data = inputEl.value;
      if (data && replSessionId) {
        window.api.repl.write(replSessionId, data);
      }
      inputEl.value = '';
    });

    handle.addEventListener('mousedown', (e) => {
      isResizing = true;
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });

    function onMouseMove(e) {
      if (!isResizing) return;
      const rect = panel.parentElement.getBoundingClientRect();
      panelHeight = Math.max(150, Math.min(400, rect.bottom - e.clientY - 80));
      panel.style.height = panelHeight + 'px';
    }

    function onMouseUp() {
      isResizing = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }

    window.api.code.onStreamChunk(({ streamId, type, data }) => {
      if (streamId !== currentStreamId) return;
      if (type === 'done') {
        const div = document.createElement('div');
        div.style.color = 'var(--text-muted)';
        div.textContent = `进程退出，代码: ${data}`;
        output.appendChild(div);
        currentStreamId = null;
      } else {
        const div = document.createElement('div');
        div.className = type === 'stderr' ? 'console-stderr' : 'console-stdout';
        div.textContent = data;
        output.appendChild(div);
      }
      output.scrollTop = output.scrollHeight;
    });

    window.api.repl.onData(({ sessionId, data }) => {
      if (!replActive) return;
      const div = document.createElement('span');
      div.textContent = data;
      div.style.whiteSpace = 'pre-wrap';
      output.appendChild(div);
      output.scrollTop = output.scrollHeight;
    });
  }

  async function startRepl() {
    const lang = document.getElementById('console-lang').value;
    const output = document.getElementById('console-output');
    const panel = document.getElementById('console-panel');
    const btn = document.getElementById('btn-console');

    if (panel.style.display === 'none') {
      panel.style.display = 'flex';
      panel.style.height = '200px';
      btn.style.color = 'var(--accent)';
    }

    const startMsg = document.createElement('div');
    startMsg.className = 'console-command';
    startMsg.textContent = `// 启动 ${lang} REPL...`;
    output.appendChild(startMsg);

    try {
      const id = await window.api.repl.spawn(lang);
      replSessionId = id;
      replActive = true;
    } catch (e) {
      const err = document.createElement('div');
      err.className = 'console-stderr';
      err.textContent = 'REPL 启动失败: ' + e.message;
      output.appendChild(err);
    }
  }

  function showConsole(lang, code) {
    const panel = document.getElementById('console-panel');
    const output = document.getElementById('console-output');
    const btn = document.getElementById('btn-console');

    const separator = document.createElement('div');
    separator.className = 'console-separator';
    separator.textContent = `─── 代码块运行: ${lang} ───`;
    output.appendChild(separator);

    if (panel.style.display === 'none') {
      panel.style.display = 'flex';
      panel.style.height = '200px';
      btn.style.color = 'var(--accent)';
      if (!replSessionId) startRepl();
    }

    currentStreamId = Date.now().toString();
    window.api.code.runStream(lang, code, currentStreamId);

    output.scrollTop = output.scrollHeight;
  }

  return {
    init, setConversation, sendMessage, clearMessages, loadMessages,
    addMessageToUI, clearImagePreview, scrollToBottom, showConsole,
    get isStreaming() { return isStreaming; }
  };
})();
