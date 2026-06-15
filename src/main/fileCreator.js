const fs = require('fs');
const path = require('path');
const os = require('os');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle, ImageRun } = require('docx');
const XLSX = require('xlsx');
const { PDFDocument } = require('pdf-lib');
const PptxGenJS = require('pptxgenjs');

class FileCreator {
  constructor() {
    this.tempDir = path.join(os.tmpdir(), 'ai-chat-files');
    if (!fs.existsSync(this.tempDir)) fs.mkdirSync(this.tempDir, { recursive: true });
  }

  async createDocx(filename, content) {
    const children = [];

    for (const block of content) {
      if (block.type === 'heading') {
        const level = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3][Math.min((block.level || 1) - 1, 2)];
        children.push(new Paragraph({ heading: level, children: [new TextRun({ text: block.text, bold: true })] }));
      } else if (block.type === 'paragraph') {
        children.push(new Paragraph({ children: [new TextRun({ text: block.text, size: 24 })] }));
      } else if (block.type === 'list') {
        for (const item of (block.items || [])) {
          children.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: item, size: 24 })] }));
        }
      } else if (block.type === 'table' && block.headers && block.rows) {
        const border = { style: BorderStyle.SINGLE, size: 1, color: '999999' };
        const borders = { top: border, bottom: border, left: border, right: border };
        const tableRows = [];
        tableRows.push(new TableRow({
          children: block.headers.map(h => new TableCell({
            borders, children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })]
          }))
        }));
        for (const row of block.rows) {
          tableRows.push(new TableRow({
            children: row.map(cell => new TableCell({
              borders, children: [new Paragraph({ children: [new TextRun({ text: String(cell) })] })]
            }))
          }));
        }
        children.push(new Table({ rows: tableRows, width: { size: 100, type: WidthType.PERCENTAGE } }));
      } else if (block.type === 'image' && block.path) {
        try {
          if (fs.existsSync(block.path)) {
            const imgBuffer = fs.readFileSync(block.path);
            const ext = path.extname(block.path).toLowerCase();
            const imgType = (ext === '.jpg' || ext === '.jpeg') ? 'jpg' : 'png';
            children.push(new Paragraph({
              children: [new ImageRun({
                type: imgType,
                data: imgBuffer,
                transformation: { width: block.w || 400, height: block.h || 300 }
              })]
            }));
          }
        } catch (e) {}
      }
    }

    const doc = new Document({ sections: [{ children }] });
    const buffer = await Packer.toBuffer(doc);
    const safeName = (filename || 'document').replace(/[<>:"/\\|?*]/g, '_') + '.docx';
    const filePath = path.join(this.tempDir, safeName);
    fs.writeFileSync(filePath, buffer);
    return { success: true, path: filePath, name: safeName };
  }

  async createXlsx(filename, sheets) {
    const wb = XLSX.utils.book_new();

    for (const sheet of sheets) {
      const data = [];
      if (sheet.headers) data.push(sheet.headers);
      if (sheet.rows) data.push(...sheet.rows);
      const ws = XLSX.utils.aoa_to_sheet(data);
      if (sheet.formulas) {
        for (const [cell, formula] of Object.entries(sheet.formulas)) {
          ws[cell] = { t: 'n', f: formula.startsWith('=') ? formula.slice(1) : formula };
        }
      }
      XLSX.utils.book_append_sheet(wb, ws, sheet.name || 'Sheet1');
    }

    const safeName = (filename || 'spreadsheet').replace(/[<>:"/\\|?*]/g, '_') + '.xlsx';
    const filePath = path.join(this.tempDir, safeName);
    XLSX.writeFile(wb, filePath);
    return { success: true, path: filePath, name: safeName };
  }

  async createPdf(filename, content) {
    const { BrowserWindow } = require('electron');
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
body{font-family:-apple-system,'Microsoft YaHei',sans-serif;padding:40px;font-size:14px;line-height:1.8;color:#1f2328;}
h1{font-size:24px;} h2{font-size:20px;} h3{font-size:16px;}
</style></head><body>${content.replace(/\n/g, '<br>')}</body></html>`;

    const tempHtml = path.join(this.tempDir, `pdf_${Date.now()}.html`);
    fs.writeFileSync(tempHtml, html, 'utf-8');

    const win = new BrowserWindow({ show: false, width: 800, height: 600, webPreferences: { nodeIntegration: false, contextIsolation: true } });
    await win.loadFile(tempHtml);
    await new Promise(r => setTimeout(r, 500));
    const pdfBuffer = await win.webContents.printToPDF({ marginType: 0, printBackground: true, pageSize: 'A4' });
    win.close();
    fs.unlinkSync(tempHtml);

    const safeName = (filename || 'document').replace(/[<>:"/\\|?*]/g, '_') + '.pdf';
    const filePath = path.join(this.tempDir, safeName);
    fs.writeFileSync(filePath, pdfBuffer);
    return { success: true, path: filePath, name: safeName };
  }

  async mergePdfs(files, outputName) {
    const mergedPdf = await PDFDocument.create();

    for (const filePath of files) {
      if (!fs.existsSync(filePath)) throw new Error(`文件不存在: ${filePath}`);
      const pdfBytes = fs.readFileSync(filePath);
      const pdf = await PDFDocument.load(pdfBytes);
      const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      pages.forEach(page => mergedPdf.addPage(page));
    }

    const mergedBytes = await mergedPdf.save();
    const safeName = (outputName || 'merged').replace(/[<>:"/\\|?*]/g, '_') + '.pdf';
    const filePath = path.join(this.tempDir, safeName);
    fs.writeFileSync(filePath, Buffer.from(mergedBytes));
    return { success: true, path: filePath, name: safeName };
  }

  async createPptx(pptData) {
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_16x9';
    pptx.title = pptData.title || 'Presentation';

    if (pptData.slides) {
      for (const slide of pptData.slides) {
        const s = pptx.addSlide();
        if (slide.title) {
          s.addText(slide.title, { x: 0.5, y: 0.3, w: 9, h: 0.8, fontSize: 28, bold: true, fontFace: 'Microsoft YaHei' });
        }
        if (slide.content && Array.isArray(slide.content)) {
          const bullets = slide.content.map(item => ({ text: item, options: { fontSize: 16, bullet: true, breakLine: true, fontFace: 'Microsoft YaHei' } }));
          s.addText(bullets, { x: 0.8, y: 1.3, w: 8.4, h: 4, valign: 'top' });
        }
        if (slide.images && Array.isArray(slide.images)) {
          for (const img of slide.images) {
            try {
              if (img.path && fs.existsSync(img.path)) {
                s.addImage({
                  path: img.path,
                  x: img.x ?? 6.5,
                  y: img.y ?? 1.5,
                  w: img.w ?? 3,
                  h: img.h ?? 3,
                  sizing: img.sizing ? { type: img.sizing, w: img.w ?? 3, h: img.h ?? 3 } : undefined
                });
              }
            } catch (e) {}
          }
        }
      }
    }

    const safeName = (pptData.title || 'presentation').replace(/[<>:"/\\|?*]/g, '_') + '.pptx';
    const filePath = path.join(this.tempDir, safeName);
    await pptx.writeFile({ fileName: filePath });
    return { success: true, path: filePath, name: safeName };
  }
}

module.exports = FileCreator;
