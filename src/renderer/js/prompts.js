const PromptsManager = (() => {
  const PRESETS = [
    { label: '翻译', prompt: '请将以下内容翻译为英文：\n' },
    { label: '总结', prompt: '请用简洁的语言总结以下内容：\n' },
    { label: '代码审查', prompt: '请审查以下代码，指出问题和改进建议：\n```\n' },
    { label: '解释', prompt: '请用通俗易懂的方式解释：\n' },
    { label: '重写', prompt: '请用更专业的语气重写以下内容：\n' },
    { label: '续写', prompt: '请根据以下内容继续写作：\n' },
    { label: '纠错', prompt: '请检查以下内容的语法和拼写错误并修正：\n' },
  ];

  const STORAGE_KEY = 'custom_prompts';

  function getCustomPrompts() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function saveCustomPrompts(prompts) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prompts));
  }

  function addCustom(label, prompt) {
    const customs = getCustomPrompts();
    customs.push({ label, prompt });
    saveCustomPrompts(customs);
  }

  function removeCustom(index) {
    const customs = getCustomPrompts();
    customs.splice(index, 1);
    saveCustomPrompts(customs);
  }

  function init() {
    const btn = document.getElementById('btn-prompts');
    const panel = document.getElementById('prompts-panel');
    const overlay = panel.querySelector('.prompts-overlay');
    const closeBtn = panel.querySelector('.prompts-close');

    btn.addEventListener('click', () => {
      renderPanel();
      panel.style.display = 'flex';
    });

    overlay.addEventListener('click', () => panel.style.display = 'none');
    closeBtn.addEventListener('click', () => panel.style.display = 'none');
  }

  function renderPanel() {
    const container = document.getElementById('prompts-list');
    container.innerHTML = '';

    const presetSection = document.createElement('div');
    presetSection.className = 'prompts-section';
    presetSection.innerHTML = '<h4>预设指令</h4>';
    const presetGrid = document.createElement('div');
    presetGrid.className = 'prompts-grid';
    PRESETS.forEach(p => {
      presetGrid.appendChild(createChip(p.label, p.prompt, false));
    });
    presetSection.appendChild(presetGrid);
    container.appendChild(presetSection);

    const customs = getCustomPrompts();
    const customSection = document.createElement('div');
    customSection.className = 'prompts-section';
    customSection.innerHTML = '<h4>自定义指令</h4>';
    const customGrid = document.createElement('div');
    customGrid.className = 'prompts-grid';
    customs.forEach((p, i) => {
      customGrid.appendChild(createChip(p.label, p.prompt, true, i));
    });
    customSection.appendChild(customGrid);

    const addBtn = document.createElement('button');
    addBtn.className = 'btn-add-prompt';
    addBtn.textContent = '+ 添加自定义指令';
    addBtn.addEventListener('click', showAddForm);
    customSection.appendChild(addBtn);

    container.appendChild(customSection);
  }

  function createChip(label, prompt, isCustom, index) {
    const chip = document.createElement('div');
    chip.className = 'prompt-chip';
    chip.textContent = label;
    chip.title = prompt;
    chip.addEventListener('click', () => {
      const input = document.getElementById('message-input');
      input.value += prompt;
      input.focus();
      input.dispatchEvent(new Event('input'));
      document.getElementById('prompts-panel').style.display = 'none';
    });

    if (isCustom) {
      const delBtn = document.createElement('span');
      delBtn.className = 'prompt-chip-del';
      delBtn.textContent = '×';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeCustom(index);
        renderPanel();
      });
      chip.appendChild(delBtn);
    }

    return chip;
  }

  function showAddForm() {
    const container = document.getElementById('prompts-list');
    const existing = container.querySelector('.prompt-add-form');
    if (existing) return;

    const form = document.createElement('div');
    form.className = 'prompt-add-form';
    form.innerHTML = `
      <input type="text" class="prompt-form-input" placeholder="指令名称" id="new-prompt-label">
      <textarea class="prompt-form-textarea" placeholder="指令内容（Prompt）" id="new-prompt-content" rows="3"></textarea>
      <div class="prompt-form-actions">
        <button class="btn-prompt-save">保存</button>
        <button class="btn-prompt-cancel">取消</button>
      </div>
    `;

    form.querySelector('.btn-prompt-save').addEventListener('click', () => {
      const label = document.getElementById('new-prompt-label').value.trim();
      const prompt = document.getElementById('new-prompt-content').value;
      if (label && prompt) {
        addCustom(label, prompt);
        renderPanel();
      }
    });

    form.querySelector('.btn-prompt-cancel').addEventListener('click', () => {
      form.remove();
    });

    container.appendChild(form);
  }

  return { init };
})();
