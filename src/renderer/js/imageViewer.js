const ImageViewer = (() => {
  let overlay = null;
  let contextMenu = null;
  let contextTarget = null;

  function init() {
    overlay = document.getElementById('image-lightbox');
    contextMenu = document.getElementById('img-context-menu');

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay || e.target.classList.contains('lightbox-close')) {
        close();
      }
    });

    overlay.querySelector('.lightbox-img').addEventListener('contextmenu', (e) => {
      e.preventDefault();
      contextTarget = e.target.src;
      showContextMenu(e.clientX, e.clientY);
    });

    document.getElementById('ctx-download-img').addEventListener('click', () => {
      downloadImage();
      hideContextMenu();
    });

    document.addEventListener('click', () => hideContextMenu());
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (contextMenu.style.display !== 'none') {
          hideContextMenu();
        } else if (overlay.style.display !== 'none') {
          close();
        }
      }
    });
  }

  function open(src) {
    overlay.querySelector('.lightbox-img').src = src;
    overlay.style.display = 'flex';
  }

  function close() {
    overlay.style.display = 'none';
    overlay.querySelector('.lightbox-img').src = '';
  }

  function showContextMenu(x, y) {
    contextMenu.style.display = 'block';
    contextMenu.style.left = x + 'px';
    contextMenu.style.top = y + 'px';

    const rect = contextMenu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      contextMenu.style.left = (window.innerWidth - rect.width - 8) + 'px';
    }
    if (rect.bottom > window.innerHeight) {
      contextMenu.style.top = (window.innerHeight - rect.height - 8) + 'px';
    }
  }

  function hideContextMenu() {
    contextMenu.style.display = 'none';
  }

  async function downloadImage() {
    if (!contextTarget) return;
    if (contextTarget.startsWith('file:///')) {
      const filePath = decodeURIComponent(contextTarget.replace('file:///', '').replace(/\//g, '\\'));
      await window.api.file.save(filePath, `image_${Date.now()}.png`);
    } else if (contextTarget.startsWith('data:')) {
      const a = document.createElement('a');
      a.href = contextTarget;
      a.download = `image_${Date.now()}.png`;
      a.click();
    }
  }

  function createImageMessage(images) {
    const container = document.createElement('div');
    container.className = 'generated-images';

    for (const img of images) {
      const imgEl = document.createElement('img');
      imgEl.src = img.base64 || `file:///${img.path.replace(/\\/g, '/')}`;
      imgEl.className = 'gen-img';
      imgEl.addEventListener('click', () => open(imgEl.src));
      imgEl.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        contextTarget = imgEl.src;
        showContextMenu(e.clientX, e.clientY);
      });
      container.appendChild(imgEl);
    }

    return container;
  }

  return { init, open, close, createImageMessage };
})();
