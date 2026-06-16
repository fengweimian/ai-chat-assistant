const FilePreview = (() => {
  let panel = null;

  function init() {
    panel = document.getElementById('file-preview-panel');
    panel.querySelector('.preview-close').addEventListener('click', close);
    panel.querySelector('.preview-overlay').addEventListener('click', close);
  }

  function close() {
    panel.style.display = 'none';
    panel.querySelector('.preview-body').innerHTML = '';
  }

  async function open(filePath) {
    panel.style.display = 'flex';
    const body = panel.querySelector('.preview-body');
    const title = panel.querySelector('.preview-title');
    body.innerHTML = '<div class="preview-loading">加载中...</div>';

    try {
      const data = await window.api.filePreview.preview(filePath);
      title.textContent = data.title || filePath.split(/[/\\]/).pop();

      if (data.type === 'html') {
        renderHtml(body, data.content);
      } else if (data.type === 'xlsx') {
        renderXlsx(body, data.sheets);
      } else if (data.type === 'pdf') {
        await renderPdf(body, data.path);
      } else if (data.type === 'pptx-text') {
        renderPptxText(body, data.slides);
      } else if (data.type === 'markdown') {
        renderMarkdown(body, data.content);
      } else if (data.type === 'text') {
        renderText(body, data.content);
      } else if (data.type === 'unsupported') {
        body.innerHTML = `<div class="preview-error">${data.error}</div>`;
      }
    } catch (e) {
      body.innerHTML = `<div class="preview-error">预览失败: ${e.message}</div>`;
    }
  }

  function renderHtml(container, html) {
    container.innerHTML = `<div class="preview-doc">${html}</div>`;
  }

  function renderXlsx(container, sheets) {
    let tabsHtml = '<div class="preview-tabs">';
    sheets.forEach((s, i) => {
      tabsHtml += `<button class="preview-tab ${i === 0 ? 'active' : ''}" data-index="${i}">${s.name}</button>`;
    });
    tabsHtml += '</div>';

    let sheetsHtml = '';
    sheets.forEach((s, i) => {
      let tableHtml = `<div class="preview-sheet" ${i > 0 ? 'style="display:none"' : ''} data-index="${i}"><table>`;
      s.data.forEach((row, ri) => {
        tableHtml += '<tr>';
        row.forEach(cell => {
          const tag = ri === 0 ? 'th' : 'td';
          tableHtml += `<${tag}>${cell ?? ''}</${tag}>`;
        });
        tableHtml += '</tr>';
      });
      tableHtml += '</table></div>';
      sheetsHtml += tableHtml;
    });

    container.innerHTML = tabsHtml + sheetsHtml;

    container.querySelectorAll('.preview-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        container.querySelectorAll('.preview-tab').forEach(t => t.classList.remove('active'));
        container.querySelectorAll('.preview-sheet').forEach(s => s.style.display = 'none');
        tab.classList.add('active');
        container.querySelector(`.preview-sheet[data-index="${tab.dataset.index}"]`).style.display = '';
      });
    });
  }

  function renderPdf(container, pdfPath) {
    const fileUrl = `file:///${pdfPath.replace(/\\/g, '/')}`;
    container.innerHTML = `<iframe class="preview-pdf-frame" src="${fileUrl}"></iframe>`;
  }

  function renderPptxText(container, slides) {
    let html = '<div class="preview-pptx-text">';
    slides.forEach(s => {
      html += `<div class="preview-slide"><div class="preview-slide-num">第 ${s.page} 页</div><div class="preview-slide-content">${s.text.replace(/\n/g, '<br>')}</div></div>`;
    });
    html += '</div>';
    container.innerHTML = html;
  }

  function renderMarkdown(container, content) {
    const html = MarkdownRenderer.render(content);
    container.innerHTML = `<div class="preview-doc preview-markdown">${html}</div>`;
    if (typeof mermaid !== 'undefined') {
      try { mermaid.run({ nodes: container.querySelectorAll('.mermaid:not([data-processed])') }); } catch (e) {}
    }
    if (typeof hljs !== 'undefined') {
      container.querySelectorAll('pre code').forEach(block => hljs.highlightElement(block));
    }
  }

  function renderText(container, content) {
    const escaped = content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    container.innerHTML = `<div class="preview-text"><pre>${escaped}</pre></div>`;
  }

  return { init, open, close };
})();
