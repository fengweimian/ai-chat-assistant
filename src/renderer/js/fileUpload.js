const FileUploader = (() => {
  let attachedImages = [];
  let attachedDocuments = [];

  const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
  const DOC_EXTENSIONS = ['.docx', '.doc', '.xlsx', '.xls', '.csv', '.pptx', '.ppt', '.pdf', '.txt', '.md', '.json'];

  function init() {
    const fileInput = document.getElementById('file-input');
    const attachBtn = document.getElementById('btn-attach');
    const inputArea = document.getElementById('input-area');

    attachBtn.addEventListener('click', async () => {
      const filePaths = await window.api.file.openDialog();
      if (filePaths && filePaths.length > 0) {
        handleFilePaths(filePaths);
      }
    });

    fileInput.addEventListener('change', (e) => {
      handleImageFiles(e.target.files);
      fileInput.value = '';
    });

    inputArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      inputArea.classList.add('drag-over');
    });

    inputArea.addEventListener('dragleave', () => {
      inputArea.classList.remove('drag-over');
    });

    inputArea.addEventListener('drop', (e) => {
      e.preventDefault();
      inputArea.classList.remove('drag-over');
      handleImageFiles(e.dataTransfer.files);
    });
  }

  function getExtension(filePath) {
    const dot = filePath.lastIndexOf('.');
    return dot >= 0 ? filePath.substring(dot).toLowerCase() : '';
  }

  function getFileName(filePath) {
    return filePath.replace(/\\/g, '/').split('/').pop();
  }

  function handleFilePaths(filePaths) {
    for (const filePath of filePaths) {
      const ext = getExtension(filePath);
      const name = getFileName(filePath);

      if (IMAGE_EXTENSIONS.includes(ext)) {
        window.api.file.readImage(filePath).then(dataUrl => {
          attachedImages.push(dataUrl);
          updatePreview();
        }).catch(() => {
          attachedDocuments.push({ name, path: filePath, ext });
          updatePreview();
        });
      } else if (DOC_EXTENSIONS.includes(ext)) {
        attachedDocuments.push({ name, path: filePath, ext });
        updatePreview();
      }
    }
  }

  function handleImageFiles(files) {
    for (const file of files) {
      const ext = getExtension(file.name);
      if (IMAGE_EXTENSIONS.includes(ext) || file.type.startsWith('image/')) {
        if (file.size > 10 * 1024 * 1024) {
          alert(`文件太大: ${file.name} (最大 10MB)`);
          continue;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
          attachedImages.push(e.target.result);
          updatePreview();
        };
        reader.readAsDataURL(file);
      }
    }
  }

  function updatePreview() {
    const preview = document.getElementById('image-preview');
    preview.innerHTML = '';

    if (attachedImages.length === 0 && attachedDocuments.length === 0) {
      preview.style.display = 'none';
      return;
    }

    preview.style.display = 'flex';

    attachedImages.forEach((imgData, index) => {
      const item = document.createElement('div');
      item.className = 'image-preview-item';

      const img = document.createElement('img');
      img.src = imgData;

      const removeBtn = document.createElement('button');
      removeBtn.className = 'remove-image';
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', () => {
        attachedImages.splice(index, 1);
        updatePreview();
      });

      item.appendChild(img);
      item.appendChild(removeBtn);
      preview.appendChild(item);
    });

    attachedDocuments.forEach((doc, index) => {
      const item = document.createElement('div');
      item.className = 'image-preview-item doc-preview-item';
      item.style.cursor = 'pointer';
      item.addEventListener('click', () => {
        if (typeof FilePreview !== 'undefined') FilePreview.open(doc.path);
      });

      const icon = document.createElement('div');
      icon.className = 'doc-icon';
      icon.appendChild(createDocIcon(doc.ext));

      const name = document.createElement('span');
      name.className = 'doc-name';
      name.textContent = doc.name;

      const removeBtn = document.createElement('button');
      removeBtn.className = 'remove-image';
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        attachedDocuments.splice(index, 1);
        updatePreview();
      });

      item.appendChild(icon);
      item.appendChild(name);
      item.appendChild(removeBtn);
      preview.appendChild(item);
    });
  }

  const DOC_ICON_MAP = {
    '.docx': '../../static/images/word.png',
    '.doc': '../../static/images/word.png',
    '.xlsx': '../../static/images/excel.webp',
    '.xls': '../../static/images/excel.webp',
    '.csv': '../../static/images/excel.webp',
    '.pptx': '../../static/images/ppt.png',
    '.ppt': '../../static/images/ppt.png',
    '.pdf': '../../static/images/pdf.webp',
  };

  function createDocIcon(ext) {
    const src = DOC_ICON_MAP[ext];
    if (src) {
      const img = document.createElement('img');
      img.src = src;
      img.className = 'doc-icon-img';
      return img;
    }
    const span = document.createElement('span');
    span.textContent = '📎';
    return span;
  }

  function getImages() {
    return [...attachedImages];
  }

  function getDocuments() {
    return [...attachedDocuments];
  }

  function clear() {
    attachedImages = [];
    attachedDocuments = [];
    updatePreview();
  }

  return { init, getImages, getDocuments, clear };
})();
