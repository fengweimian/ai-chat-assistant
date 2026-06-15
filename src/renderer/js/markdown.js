const MarkdownRenderer = (() => {
  let configured = false;
  const RUNNABLE_LANGS = ['javascript', 'js', 'python', 'py', 'java'];

  function init() {
    if (configured) return;
    if (typeof marked === 'undefined') return;

    if (typeof mermaid !== 'undefined') {
      mermaid.initialize({ startOnLoad: false, theme: 'dark' });
    }

    const renderer = {
      code({ text, lang }) {
        if (lang === 'mermaid') {
          const id = 'mermaid-' + Math.random().toString(36).slice(2, 10);
          return `<div class="mermaid-container" data-zoom="1"><div class="mermaid" id="${id}">${escapeHtml(text)}</div><div class="mermaid-controls"><button onclick="MarkdownRenderer.zoomMermaid(this.parentElement.parentElement, 0.2)">+</button><button onclick="MarkdownRenderer.zoomMermaid(this.parentElement.parentElement, -0.2)">-</button><button onclick="MarkdownRenderer.exportMermaid('${id}')">导出</button></div></div>`;
        }

        let highlighted = text;
        if (typeof hljs !== 'undefined' && lang && hljs.getLanguage(lang)) {
          highlighted = hljs.highlight(text, { language: lang }).value;
        } else if (typeof hljs !== 'undefined') {
          highlighted = hljs.highlightAuto(text).value;
        }

        const runBtn = RUNNABLE_LANGS.includes(lang)
          ? `<button class="run-btn" onclick="MarkdownRenderer.runCode(this, '${lang}')">▶ 运行</button>`
          : '';

        return `<pre><button class="copy-btn" onclick="MarkdownRenderer.copyCode(this)">复制</button>${runBtn}<code class="language-${lang || ''}">${highlighted}</code></pre>`;
      }
    };

    marked.use({ renderer, breaks: true, gfm: true });
    configured = true;
  }

  function render(text) {
    if (!configured) init();
    if (typeof marked === 'undefined') return escapeHtml(text);

    const mathBlocks = [];
    const mathInlines = [];

    text = text.replace(/\$\$([\s\S]*?)\$\$/g, (_, expr) => {
      mathBlocks.push(expr);
      return `%%MATHBLOCK_${mathBlocks.length - 1}%%`;
    });

    text = text.replace(/\$([^\$\n]+?)\$/g, (_, expr) => {
      mathInlines.push(expr);
      return `%%MATHINLINE_${mathInlines.length - 1}%%`;
    });

    let html = marked.parse(text);

    html = html.replace(/%%MATHBLOCK_(\d+)%%/g, (_, i) => {
      try {
        return katex.renderToString(mathBlocks[i], { displayMode: true, throwOnError: false });
      } catch (e) {
        return `<span class="math-error">${escapeHtml(mathBlocks[i])}</span>`;
      }
    });

    html = html.replace(/%%MATHINLINE_(\d+)%%/g, (_, i) => {
      try {
        return katex.renderToString(mathInlines[i], { displayMode: false, throwOnError: false });
      } catch (e) {
        return `<span class="math-error">${escapeHtml(mathInlines[i])}</span>`;
      }
    });

    return html;
  }

  function renderMermaidBlocks() {
    if (typeof mermaid === 'undefined') return;
    try {
      mermaid.run({ nodes: document.querySelectorAll('.mermaid:not([data-processed])') });
    } catch (e) {}
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function copyCode(btn) {
    const code = btn.parentElement.querySelector('code');
    if (code) {
      navigator.clipboard.writeText(code.textContent).then(() => {
        btn.textContent = '已复制';
        setTimeout(() => btn.textContent = '复制', 2000);
      });
    }
  }

  async function runCode(btn, lang) {
    const code = btn.parentElement.querySelector('code');
    if (!code) return;

    btn.textContent = '⏳ 运行中';
    btn.disabled = true;

    ChatManager.showConsole(lang, code.textContent);

    setTimeout(() => {
      btn.textContent = '▶ 运行';
      btn.disabled = false;
    }, 1000);
  }

  function zoomMermaid(container, delta) {
    let zoom = parseFloat(container.dataset.zoom || '1');
    zoom = Math.max(0.5, Math.min(3, zoom + delta));
    container.dataset.zoom = zoom;
    const diagram = container.querySelector('.mermaid');
    if (diagram) diagram.style.transform = `scale(${zoom})`;
  }

  async function exportMermaid(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const svg = el.querySelector('svg') || el;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = async () => {
      canvas.width = img.width * 2;
      canvas.height = img.height * 2;
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0);
      const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `diagram_${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  }

  return { init, render, renderMermaidBlocks, copyCode, runCode, zoomMermaid, exportMermaid };
})();
