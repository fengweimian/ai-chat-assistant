const SettingsManager = (() => {
  const STORAGE_KEY = 'ai-chat-settings';
  let editingModelId = null;

  function init() {
    loadSettings();
    bindEvents();
    loadModels();
  }

  function loadSettings() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const settings = JSON.parse(saved);
        if (settings.temperature !== undefined) {
          document.getElementById('cfg-temperature').value = settings.temperature;
          document.getElementById('temp-value').textContent = settings.temperature;
        }
        if (settings.maxTokens) document.getElementById('cfg-max-tokens').value = settings.maxTokens;
        if (settings.systemPrompt) document.getElementById('cfg-system-prompt').value = settings.systemPrompt;
      } catch (e) {}
    }
    window.api.config.get().then(config => {
      if (config.tavilyApiKey) document.getElementById('cfg-tavily-key').value = config.tavilyApiKey;
      if (config.emailConfig) {
        const ec = config.emailConfig;
        if (ec.email) document.getElementById('cfg-email').value = ec.email;
        if (ec.password) document.getElementById('cfg-email-pass').value = ec.password;
        if (ec.smtpHost) document.getElementById('cfg-smtp-host').value = ec.smtpHost;
        if (ec.smtpPort) document.getElementById('cfg-smtp-port').value = ec.smtpPort;
        if (ec.imapHost) document.getElementById('cfg-imap-host').value = ec.imapHost;
        if (ec.imapPort) document.getElementById('cfg-imap-port').value = ec.imapPort;
      }
      if (config.libreOfficePath) document.getElementById('cfg-lo-path').value = config.libreOfficePath;
    });
    loadLoStatus();
  }

  async function loadLoStatus() {
    const status = await window.api.libreoffice.status();
    const dot = document.getElementById('lo-status-dot');
    const text = document.getElementById('lo-status-text');
    if (status.detected) {
      dot.className = 'status-dot on';
      dot.textContent = '●';
      text.textContent = '已检测到 LibreOffice';
      document.getElementById('cfg-lo-path').value = status.path;
      document.getElementById('btn-install-lo').style.display = 'none';
    } else {
      dot.className = 'status-dot off';
      dot.textContent = '●';
      text.textContent = '未检测到 LibreOffice';
    }
  }

  function bindEvents() {
    document.getElementById('btn-settings').addEventListener('click', () => {
      loadModels();
      loadDataPath();
      document.getElementById('settings-modal').style.display = 'flex';
    });

    document.getElementById('btn-close-settings').addEventListener('click', closeModal);
    document.querySelector('#settings-modal .modal-overlay').addEventListener('click', closeModal);

    document.getElementById('cfg-temperature').addEventListener('input', (e) => {
      document.getElementById('temp-value').textContent = e.target.value;
    });

    document.getElementById('btn-save-settings').addEventListener('click', saveSettings);

    document.getElementById('btn-change-avatar').addEventListener('click', changeAvatar);
    loadAvatar();

    document.getElementById('btn-add-model').addEventListener('click', () => showModelForm(null));
    document.getElementById('mf-cancel').addEventListener('click', hideModelForm);
    document.getElementById('mf-save').addEventListener('click', saveModel);
    document.getElementById('mf-test').addEventListener('click', testModelConnection);

    document.getElementById('mf-type').addEventListener('change', (e) => {
      document.getElementById('mf-image-options').style.display = e.target.value === 'image' ? 'block' : 'none';
    });

    document.getElementById('mf-sample-count').addEventListener('input', (e) => {
      document.getElementById('mf-sample-value').textContent = e.target.value;
    });

    document.getElementById('setting-model').addEventListener('change', updateConversationSettings);
    document.getElementById('setting-web-search').addEventListener('change', updateConversationSettings);
    document.getElementById('setting-thinking').addEventListener('change', updateConversationSettings);

    document.getElementById('btn-install-lo').addEventListener('click', async () => {
      const result = await window.api.libreoffice.install();
      if (result.success) {
        await loadLoStatus();
        window.api.libreoffice.cleanInstaller();
        document.getElementById('btn-install-lo').style.display = 'none';
      }
    });

    document.getElementById('btn-browse-lo').addEventListener('click', async () => {
      const filePaths = await window.api.file.openDialog();
      if (filePaths && filePaths.length > 0) {
        await window.api.libreoffice.setPath(filePaths[0]);
        await loadLoStatus();
      }
    });

    document.getElementById('btn-open-data-dir').addEventListener('click', () => {
      const dataPath = document.getElementById('cfg-data-dir').value;
      if (dataPath) window.api.file.openLocation(dataPath);
    });
  }

  function closeModal() {
    document.getElementById('settings-modal').style.display = 'none';
  }

  function saveSettings() {
    const settings = {
      temperature: parseFloat(document.getElementById('cfg-temperature').value),
      maxTokens: parseInt(document.getElementById('cfg-max-tokens').value),
      systemPrompt: document.getElementById('cfg-system-prompt').value
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));

    const tavilyKey = document.getElementById('cfg-tavily-key').value.trim();
    window.api.config.set('tavilyApiKey', tavilyKey);

    const emailConfig = {
      email: document.getElementById('cfg-email').value.trim(),
      password: document.getElementById('cfg-email-pass').value,
      smtpHost: document.getElementById('cfg-smtp-host').value.trim(),
      smtpPort: parseInt(document.getElementById('cfg-smtp-port').value) || 465,
      imapHost: document.getElementById('cfg-imap-host').value.trim(),
      imapPort: parseInt(document.getElementById('cfg-imap-port').value) || 993
    };
    if (emailConfig.email) {
      window.api.config.set('emailConfig', emailConfig);
      window.api.email.configure(emailConfig);
    }

    closeModal();
  }

  async function loadModels() {
    const models = await window.api.models.getAll();
    const list = document.getElementById('model-list');
    list.innerHTML = '';

    for (const model of models) {
      const item = document.createElement('div');
      item.className = 'model-item';

      const info = document.createElement('div');
      info.className = 'model-item-info';
      info.innerHTML = `<span class="model-item-name">${model.name}</span><span class="model-item-type">${model.type === 'chat' ? '对话' : '生图'}</span>`;

      const actions = document.createElement('div');
      actions.className = 'model-item-actions';

      const editBtn = document.createElement('button');
      editBtn.textContent = '编辑';
      editBtn.addEventListener('click', () => showModelForm(model));

      const delBtn = document.createElement('button');
      delBtn.textContent = '×';
      delBtn.className = 'btn-danger';
      delBtn.addEventListener('click', async () => {
        await window.api.models.remove(model.id);
        loadModels();
        refreshModelDropdown();
      });

      actions.appendChild(editBtn);
      actions.appendChild(delBtn);
      item.appendChild(info);
      item.appendChild(actions);
      list.appendChild(item);
    }
  }

  function showModelForm(model) {
    editingModelId = model ? model.id : null;
    const form = document.getElementById('model-form');
    form.style.display = 'block';

    document.getElementById('mf-name').value = model ? model.name : '';
    document.getElementById('mf-model-id').value = model ? model.modelId : '';
    document.getElementById('mf-type').value = model ? model.type : 'chat';
    document.getElementById('mf-api-format').value = model ? model.apiFormat : 'openai';
    document.getElementById('mf-base-url').value = model ? model.baseUrl : '';
    document.getElementById('mf-api-key').value = model ? model.apiKey : '';
    const thinkingMode = model ? (model.thinkingMode || (model.thinkingSuffix ? 'suffix' : 'none')) : 'none';
    document.getElementById('mf-thinking-mode').value = thinkingMode;
    document.getElementById('mf-aspect-ratio').value = model ? (model.aspectRatio || '1:1') : '1:1';
    document.getElementById('mf-image-size').value = model ? (model.imageSize || '1K') : '1K';
    document.getElementById('mf-sample-count').value = model ? (model.sampleCount || 1) : 1;
    document.getElementById('mf-sample-value').textContent = model ? (model.sampleCount || 1) : 1;

    document.getElementById('mf-image-options').style.display =
      (model && model.type === 'image') ? 'block' : 'none';
  }

  function hideModelForm() {
    document.getElementById('model-form').style.display = 'none';
    editingModelId = null;
  }

  async function saveModel() {
    const data = {
      name: document.getElementById('mf-name').value.trim(),
      modelId: document.getElementById('mf-model-id').value.trim(),
      type: document.getElementById('mf-type').value,
      apiFormat: document.getElementById('mf-api-format').value,
      baseUrl: document.getElementById('mf-base-url').value.trim(),
      apiKey: document.getElementById('mf-api-key').value.trim()
    };

    data.thinkingMode = document.getElementById('mf-thinking-mode').value;

    if (!data.name || !data.modelId || !data.baseUrl) {
      alert('请填写必填字段');
      return;
    }

    if (data.type === 'image') {
      data.aspectRatio = document.getElementById('mf-aspect-ratio').value;
      data.imageSize = document.getElementById('mf-image-size').value;
      data.sampleCount = parseInt(document.getElementById('mf-sample-count').value);
    }

    if (editingModelId) {
      await window.api.models.update(editingModelId, data);
    } else {
      await window.api.models.add(data);
    }

    hideModelForm();
    loadModels();
    refreshModelDropdown();
  }

  async function testModelConnection() {
    const btn = document.getElementById('mf-test');
    btn.textContent = '测试中...';
    btn.disabled = true;

    try {
      let base = document.getElementById('mf-base-url').value.replace(/\/+$/, '');
      if (!base.endsWith('/v1')) base += '/v1';
      const response = await fetch(base + '/models', {
        headers: { 'Authorization': `Bearer ${document.getElementById('mf-api-key').value}` }
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

  async function refreshModelDropdown() {
    const models = await window.api.models.getAll();
    const select = document.getElementById('setting-model');
    const current = select.value;
    select.innerHTML = '';

    const chatModels = models.filter(m => m.type === 'chat');
    const imageModels = models.filter(m => m.type === 'image');

    if (chatModels.length > 0) {
      const group = document.createElement('optgroup');
      group.label = '对话模型';
      chatModels.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = m.name;
        group.appendChild(opt);
      });
      select.appendChild(group);
    }

    if (imageModels.length > 0) {
      const group = document.createElement('optgroup');
      group.label = '生图模型';
      imageModels.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = m.name;
        group.appendChild(opt);
      });
      select.appendChild(group);
    }

    if (current && select.querySelector(`option[value="${current}"]`)) {
      select.value = current;
    }
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

  async function loadAvatar() {
    const avatarPath = await window.api.avatar.get();
    const preview = document.getElementById('avatar-preview');
    if (avatarPath) {
      preview.innerHTML = '';
      const img = document.createElement('img');
      img.src = `file:///${avatarPath.replace(/\\/g, '/')}`;
      preview.appendChild(img);
      document.dispatchEvent(new CustomEvent('avatar:updated', { detail: img.src }));
    }
  }

  async function changeAvatar() {
    const filePaths = await window.api.file.openDialog();
    if (!filePaths || filePaths.length === 0) return;
    const ext = filePaths[0].split('.').pop().toLowerCase();
    if (!['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) {
      alert('请选择图片文件');
      return;
    }
    await window.api.avatar.set(filePaths[0]);
    await loadAvatar();
  }

  async function loadDataPath() {
    const dataPath = await window.api.app.getDataPath();
    document.getElementById('cfg-data-dir').value = dataPath;
  }

  return { init, refreshModelDropdown };
})();
