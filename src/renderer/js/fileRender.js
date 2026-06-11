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
