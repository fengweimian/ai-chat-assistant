const { dialog, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, ImageRun } = require('docx');
const { marked } = require('marked');

class Exporter {
  constructor() {
    this.tempDir = path.join(os.tmpdir(), 'ai-chat-export');
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  buildMarkdownContent(conversation) {
    const lines = [];
    lines.push(`# ${conversation.title || '对话'}`);
    lines.push(`> 导出时间: ${new Date().toLocaleString()}`);
    lines.push('');

    for (const msg of conversation.messages) {
      if (msg.role === 'user') {
        lines.push('## 👤 用户');
      } else if (msg.role === 'assistant') {
        lines.push('## 🤖 AI');
      }
      lines.push('');
      if (msg.docNames && msg.docNames.length > 0) {
        for (const name of msg.docNames) {
          lines.push(`> 📎 附件: ${name}`);
        }
        lines.push('');
      }
      lines.push(msg.content || '');
      lines.push('');
      lines.push('---');
      lines.push('');
    }

    return lines.join('\n');
  }

  async exportMarkdown(conversation) {
    const content = this.buildMarkdownContent(conversation);
    const result = await dialog.showSaveDialog({
      defaultPath: `${conversation.title || '对话'}.md`,
      filters: [{ name: 'Markdown', extensions: ['md'] }]
    });

    if (result.canceled || !result.filePath) return { success: false };
    fs.writeFileSync(result.filePath, content, 'utf-8');
    return { success: true, path: result.filePath };
  }

  async exportPdf(conversation, parentWindow) {
    const content = this.buildMarkdownContent(conversation);
    const htmlContent = this.buildHtmlForPdf(conversation, content);

    const tempHtml = path.join(this.tempDir, `export_${Date.now()}.html`);
    fs.writeFileSync(tempHtml, htmlContent, 'utf-8');

    const win = new BrowserWindow({
      show: false,
      width: 800,
      height: 600,
      webPreferences: { nodeIntegration: false, contextIsolation: true }
    });

    await win.loadFile(tempHtml);
    await new Promise(resolve => setTimeout(resolve, 500));

    const pdfBuffer = await win.webContents.printToPDF({
      marginType: 0,
      printBackground: true,
      pageSize: 'A4'
    });

    win.close();
    fs.unlinkSync(tempHtml);

    const result = await dialog.showSaveDialog(parentWindow, {
      defaultPath: `${conversation.title || '对话'}.pdf`,
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    });

    if (result.canceled || !result.filePath) return { success: false };
    fs.writeFileSync(result.filePath, pdfBuffer);
    return { success: true, path: result.filePath };
  }

  buildHtmlForPdf(conversation) {
    const messages = conversation.messages.map(msg => {
      const role = msg.role === 'user' ? '👤 用户' : '🤖 AI';
      const roleClass = msg.role === 'user' ? 'user' : 'assistant';
      let docTags = '';
      if (msg.docNames && msg.docNames.length > 0) {
        docTags = msg.docNames.map(n => `<span class="doc-tag">📎 ${this.escapeHtml(n)}</span>`).join(' ');
        docTags = `<div class="doc-tags">${docTags}</div>`;
      }
      let imagesHtml = '';
      if (msg.generatedImages && msg.generatedImages.length > 0) {
        imagesHtml = msg.generatedImages.map(imgPath => {
          try {
            const buffer = fs.readFileSync(imgPath);
            const base64 = buffer.toString('base64');
            const ext = path.extname(imgPath).toLowerCase();
            const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
            return `<img src="data:${mime};base64,${base64}" style="max-width:100%;border-radius:8px;margin:8px 0;">`;
          } catch (e) {
            return '<p>[图片文件不可用]</p>';
          }
        }).join('');
      }
      const content = marked.parse(msg.content === '[图片已生成]' ? '' : (msg.content || ''), { breaks: true, gfm: true });
      return `<div class="message"><h3 class="${roleClass}">${role}</h3><div class="bubble ${roleClass}-bubble">${docTags}${content}${imagesHtml}</div></div>`;
    }).join('');

    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', sans-serif; padding: 40px; font-size: 14px; color: #1f2328; line-height: 1.6; }
h1 { font-size: 24px; margin-bottom: 8px; }
.meta { color: #656d76; font-size: 12px; margin-bottom: 24px; }
.message { margin-bottom: 20px; }
.message h3 { margin-bottom: 8px; font-size: 15px; }
.message h3.user { color: #0969da; }
.message h3.assistant { color: #1a7f37; }
.bubble { padding: 12px 16px; border-radius: 8px; line-height: 1.7; }
.user-bubble { background: #eff6ff; border: 1px solid #bfdbfe; }
.assistant-bubble { background: #f6f8fa; border: 1px solid #d0d7de; }
.bubble pre { background: #161b22; color: #e6edf3; padding: 12px; border-radius: 6px; overflow-x: auto; font-size: 13px; }
.bubble code { font-family: 'Cascadia Code', 'Fira Code', Consolas, monospace; font-size: 13px; }
.bubble p code { background: #eaeef2; padding: 2px 6px; border-radius: 4px; }
.bubble table { border-collapse: collapse; width: 100%; margin: 8px 0; }
.bubble th, .bubble td { border: 1px solid #d0d7de; padding: 6px 10px; text-align: left; }
.bubble th { background: #eaeef2; font-weight: 600; }
.bubble ul, .bubble ol { padding-left: 1.5em; margin: 8px 0; }
.bubble li { margin-bottom: 4px; }
.bubble blockquote { border-left: 3px solid #0969da; padding-left: 12px; color: #656d76; margin: 8px 0; }
.bubble h1, .bubble h2, .bubble h3, .bubble h4 { margin: 12px 0 6px; }
.doc-tags { margin-bottom: 8px; }
.doc-tag { display: inline-block; padding: 3px 10px; background: #e1ecf4; border-radius: 12px; font-size: 12px; color: #0969da; margin-right: 6px; }
</style></head><body>
<h1>${this.escapeHtml(conversation.title || '对话')}</h1>
<div class="meta">导出时间: ${new Date().toLocaleString()}</div>
${messages}
</body></html>`;
  }

  async exportDocx(conversation) {
    const children = [];

    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: conversation.title || '对话', bold: true })]
    }));

    children.push(new Paragraph({
      children: [new TextRun({ text: `导出时间: ${new Date().toLocaleString()}`, color: '656d76', size: 20 })]
    }));

    children.push(new Paragraph({ children: [] }));

    for (const msg of conversation.messages) {
      const roleText = msg.role === 'user' ? '👤 用户' : '🤖 AI';

      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: roleText, bold: true })]
      }));

      if (msg.docNames && msg.docNames.length > 0) {
        for (const name of msg.docNames) {
          children.push(new Paragraph({
            children: [new TextRun({ text: `📎 附件: ${name}`, italics: true, color: '0969da', size: 22 })]
          }));
        }
      }

      const textContent = msg.content === '[图片已生成]' ? '' : (msg.content || '');
      if (textContent) {
        const contentLines = textContent.split('\n');
        for (const line of contentLines) {
          children.push(new Paragraph({
            children: [new TextRun({ text: line, size: 24 })]
          }));
        }
      }

      if (msg.generatedImages && msg.generatedImages.length > 0) {
        for (const imgPath of msg.generatedImages) {
          try {
            const imgBuffer = fs.readFileSync(imgPath);
            const ext = path.extname(imgPath).toLowerCase();
            const imgType = (ext === '.jpg' || ext === '.jpeg') ? 'jpg' : 'png';
            children.push(new Paragraph({
              children: [new ImageRun({
                type: imgType,
                data: imgBuffer,
                transformation: { width: 400, height: 400 }
              })]
            }));
          } catch (e) {
            children.push(new Paragraph({
              children: [new TextRun({ text: '[图片文件不可用]', italics: true, color: '999999' })]
            }));
          }
        }
      }

      children.push(new Paragraph({ children: [] }));
    }

    const doc = new Document({
      sections: [{ children }]
    });

    const buffer = await Packer.toBuffer(doc);

    const result = await dialog.showSaveDialog({
      defaultPath: `${conversation.title || '对话'}.docx`,
      filters: [{ name: 'Word Document', extensions: ['docx'] }]
    });

    if (result.canceled || !result.filePath) return { success: false };
    fs.writeFileSync(result.filePath, buffer);
    return { success: true, path: result.filePath };
  }

  escapeHtml(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

module.exports = Exporter;
