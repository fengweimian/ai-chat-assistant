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

    window.api.updateSettings({
      baseUrl: settings.apiUrl,
      apiKey: settings.apiKey
    });
  }

  function bindEvents() {
    document.getElementById('btn-settings').addEventListener('click', () => {
      document.getElementById('settings-modal').style.display = 'flex';
    });

    document.getElementById('btn-close-settings').addEventListener('click', closeModal);
    document.querySelector('.modal-overlay').addEventListener('click', closeModal);

    document.getElementById('cfg-temperature').addEventListener('input', (e) => {
      document.getElementById('temp-value').textContent = e.target.value;
    });

    document.getElementById('btn-save-settings').addEventListener('click', saveSettings);

    document.getElementById('btn-test-connection').addEventListener('click', testConnection);

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
