const ChatManager = (() => {
  let currentConversationId = null;
  let isStreaming = false;
  let currentAssistantMessage = null;
  let accumulatedContent = '';

  function init() {
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

      window.api.conversations.addMessage(conversationId, {
        role: 'assistant',
        content: fullContent,
        files: []
      });

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

    addMessageToUI('user', content, images);

    await window.api.conversations.addMessage(currentConversationId, {
      role: 'user',
      content,
      images
    });

    document.getElementById('message-input').value = '';
    ChatManager.clearImagePreview();

    showThinkingIndicator();

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

    if (images && images.length > 0) {
      for (const img of images) {
        const imgEl = document.createElement('img');
        imgEl.src = img;
        imgEl.style.cssText = 'max-width: 200px; max-height: 200px; border-radius: 6px; margin-bottom: 8px; display: block;';
        bubble.appendChild(imgEl);
      }
    }

    if (role === 'assistant') {
      bubble.innerHTML += MarkdownRenderer.render(content);
    } else {
      const p = document.createElement('p');
      p.textContent = content;
      bubble.appendChild(p);
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
