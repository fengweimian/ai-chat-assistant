const MarkdownRenderer = (() => {
  let markedInstance = null;
  let hljsInstance = null;

  function init() {
    if (typeof marked !== 'undefined') {
      markedInstance = marked;
      markedInstance.setOptions({
        breaks: true,
        gfm: true,
        highlight: function (code, lang) {
          if (hljsInstance && lang && hljsInstance.getLanguage(lang)) {
            return hljsInstance.highlight(code, { language: lang }).value;
          }
          return code;
        }
      });
    }
    if (typeof hljs !== 'undefined') {
      hljsInstance = hljs;
    }
  }

  function render(text) {
    if (!markedInstance) init();
    if (!markedInstance) return escapeHtml(text);

    let html = markedInstance.parse(text);

    // Add copy buttons to code blocks
    html = html.replace(/<pre><code class="language-(\w+)">/g,
      '<pre><button class="copy-btn" onclick="MarkdownRenderer.copyCode(this)">复制</button><code class="language-$1 hljs">');

    html = html.replace(/<pre><code>/g,
      '<pre><button class="copy-btn" onclick="MarkdownRenderer.copyCode(this)">复制</button><code>');

    return html;
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
