const SidebarManager = (() => {
  let activeConversationId = null;
  let allConversations = [];
  let searchTimer = null;

  function init() {
    document.getElementById('btn-new-chat').addEventListener('click', createNewChat);
    document.getElementById('btn-new-window').addEventListener('click', () => window.api.window.newWindow());

    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => filterConversations(searchInput.value.trim()), 200);
    });

    loadConversations();
  }

  function filterConversations(keyword) {
    if (!keyword) {
      renderList(allConversations);
      return;
    }
    const lower = keyword.toLowerCase();
    const filtered = allConversations.filter(conv => {
      if ((conv.title || '').toLowerCase().includes(lower)) return true;
      if (conv.messages && conv.messages.some(m => (m.content || '').toLowerCase().includes(lower))) return true;
      return false;
    });
    renderList(filtered);
  }

  async function loadConversations() {
    allConversations = await window.api.conversations.getAll();
    renderList(allConversations);

    if (allConversations.length > 0 && !activeConversationId) {
      selectConversation(allConversations[0].id);
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

    if (conv.settings) {
      const modelSelect = document.getElementById('setting-model');
      const webSearch = document.getElementById('setting-web-search');
      const thinkingSelect = document.getElementById('setting-thinking');

      if (modelSelect && conv.settings.model) {
        modelSelect.value = conv.settings.model;
        if (!modelSelect.value) {
          const firstOpt = modelSelect.querySelector('option');
          if (firstOpt) modelSelect.value = firstOpt.value;
        }
        modelSelect.dispatchEvent(new Event('change'));
      }
      if (webSearch) webSearch.checked = conv.settings.webSearch !== false;
      if (thinkingSelect) thinkingSelect.value = conv.settings.thinkingLevel || 'medium';
      const developerToggle = document.getElementById('setting-developer');
      if (developerToggle) developerToggle.checked = conv.settings.developerMode === true;
    }

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
