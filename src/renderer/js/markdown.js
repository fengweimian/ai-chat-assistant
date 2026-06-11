const MarkdownRenderer = (() => {
  let configured = false;

  function init() {
    if (configured) return;
    if (typeof marked === 'undefined') return;

    // Use custom renderer for code blocks with highlight.js
    const renderer = {
      code({ text, lang }) {
        let highlighted = text;
        if (typeof hljs !== 'undefined' && lang && hljs.getLanguage(lang)) {
          highlighted = hljs.highlight(text, { language: lang }).value;
        } else if (typeof hljs !== 'undefined') {
          highlighted = hljs.highlightAuto(text).value;
        }
        return `<pre><button class="copy-btn" onclick="MarkdownRenderer.copyCode(this)">复制</button><code class="language-${lang || ''}">${highlighted}</code></pre>`;
      }
    };

    marked.use({ renderer, breaks: true, gfm: true });
    configured = true;
  }

  function render(text) {
    if (!configured) init();
    if (typeof marked === 'undefined') return escapeHtml(text);

    return marked.parse(text);
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

  return { init, render, copyCode };
})();
