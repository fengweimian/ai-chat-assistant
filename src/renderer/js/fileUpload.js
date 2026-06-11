const FileUploader = (() => {
  let attachedImages = [];

  function init() {
    const fileInput = document.getElementById('file-input');
    const attachBtn = document.getElementById('btn-attach');
    const inputArea = document.getElementById('input-area');

    attachBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
      handleFiles(e.target.files);
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
      handleFiles(e.dataTransfer.files);
    });
  }

  function handleFiles(files) {
    for (const file of files) {
      if (!CONSTANTS.SUPPORTED_IMAGE_TYPES.includes(file.type)) {
        alert(`不支持的文件类型: ${file.name}`);
        continue;
      }

      if (file.size > CONSTANTS.MAX_IMAGE_SIZE) {
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

  function updatePreview() {
    const preview = document.getElementById('image-preview');
    preview.innerHTML = '';

    if (attachedImages.length === 0) {
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
  }

  function getImages() {
    return [...attachedImages];
  }

  function clear() {
    attachedImages = [];
    updatePreview();
  }

  return { init, getImages, clear };
})();
