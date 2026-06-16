const FileRenderer = (() => {
  const FILE_ICON_IMAGES = {
    pptx: '../../static/images/ppt.png',
    ppt: '../../static/images/ppt.png',
    docx: '../../static/images/word.png',
    doc: '../../static/images/word.png',
    pdf: '../../static/images/pdf.webp',
    xlsx: '../../static/images/excel.webp',
    xls: '../../static/images/excel.webp',
    csv: '../../static/images/excel.webp',
  };

  const FILE_ICONS_EMOJI = {
    txt: '📃',
    md: '📝',
    js: '💻',
    py: '🐍',
    html: '🌐',
    css: '🎨',
    json: '📋',
    default: '📎'
  };

  function createIconElement(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const imgSrc = FILE_ICON_IMAGES[ext];
    if (imgSrc) {
      const img = document.createElement('img');
      img.src = imgSrc;
      img.className = 'file-icon-img';
      return img;
    }
    const span = document.createElement('span');
    span.className = 'file-icon-emoji';
    span.textContent = FILE_ICONS_EMOJI[ext] || FILE_ICONS_EMOJI.default;
    return span;
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
    icon.appendChild(createIconElement(file.name));

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
    downloadBtn.addEventListener('click', (e) => { e.stopPropagation(); downloadFile(file); });

    actions.appendChild(downloadBtn);

    card.appendChild(icon);
    card.appendChild(info);
    card.appendChild(actions);

    const previewExts = ['.docx', '.doc', '.xlsx', '.xls', '.csv', '.pptx', '.ppt', '.pdf', '.md', '.txt'];
    const fileExt = '.' + file.name.split('.').pop().toLowerCase();
    if (file.path && previewExts.includes(fileExt)) {
      card.style.cursor = 'pointer';
      card.addEventListener('click', () => FilePreview.open(file.path));
    }

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
