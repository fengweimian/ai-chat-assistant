const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const { app } = require('electron');
const mammoth = require('mammoth');
const XLSX = require('xlsx');
const JSZip = require('jszip');

class FilePreviewHandler {
  constructor(config) {
    this.tempDir = path.join(os.tmpdir(), 'ai-chat-preview');
    if (!fs.existsSync(this.tempDir)) fs.mkdirSync(this.tempDir, { recursive: true });
    this.config = config || {};
    this._libreOfficePath = null;
    this._loChecked = false;
  }

  get libreOfficePath() {
    if (this._loChecked) return this._libreOfficePath;
    this._loChecked = true;
    this._libreOfficePath = this.findLibreOffice();
    return this._libreOfficePath;
  }

  findLibreOffice() {
    const candidates = [
      this.config.libreOfficePath,
      path.join(app.getPath('userData'), 'LibreOfficePortable', 'App', 'libreoffice', 'program', 'soffice.exe'),
      'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
      'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
      'D:\\libreoffice\\LibreOfficePortable\\App\\libreoffice\\program\\soffice.exe',
      '/usr/bin/libreoffice',
      '/usr/bin/soffice',
      '/Applications/LibreOffice.app/Contents/MacOS/soffice'
    ].filter(Boolean);

    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }

    try {
      execSync('soffice --version', { stdio: 'pipe', timeout: 5000 });
      return 'soffice';
    } catch (e) {}

    return null;
  }

  invalidateCache() {
    this._loChecked = false;
    this._libreOfficePath = null;
  }

  convertToPdfWith(filePath, libreOfficePath) {
    return new Promise((resolve) => {
      try {
        const outDir = path.join(this.tempDir, 'convert_' + Date.now());
        fs.mkdirSync(outDir, { recursive: true });
        const cmd = `"${libreOfficePath}" --headless --convert-to pdf --outdir "${outDir}" "${filePath}"`;
        execSync(cmd, { timeout: 30000, stdio: 'pipe' });
        const pdfName = path.basename(filePath).replace(/\.[^.]+$/, '.pdf');
        const pdfPath = path.join(outDir, pdfName);
        resolve(fs.existsSync(pdfPath) ? pdfPath : null);
      } catch (e) {
        resolve(null);
      }
    });
  }

  async preview(filePath) {
    const ext = path.extname(filePath).toLowerCase();

    if (['.docx', '.doc', '.xlsx', '.xls', '.pptx', '.ppt'].includes(ext) && this.libreOfficePath) {
      const pdfPath = await this.convertToPdfWith(filePath, this.libreOfficePath);
      if (pdfPath) {
        return { type: 'pdf', path: pdfPath, title: path.basename(filePath) };
      }
    }

    switch (ext) {
      case '.docx': case '.doc': return await this.previewDocx(filePath);
      case '.xlsx': case '.xls': case '.csv': return await this.previewXlsx(filePath);
      case '.pptx': case '.ppt': return await this.previewPptxText(filePath);
      case '.pdf': return { type: 'pdf', path: filePath };
      default: return { type: 'unsupported', error: `不支持预览: ${ext}` };
    }
  }

  async previewDocx(filePath) {
    const buffer = fs.readFileSync(filePath);
    const result = await mammoth.convertToHtml({ buffer });
    return { type: 'html', content: result.value, title: path.basename(filePath) };
  }

  async previewXlsx(filePath) {
    const workbook = XLSX.readFile(filePath);
    const sheets = [];
    for (const name of workbook.SheetNames) {
      const sheet = workbook.Sheets[name];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      sheets.push({ name, data: json.slice(0, 200) });
    }
    return { type: 'xlsx', sheets, title: path.basename(filePath) };
  }

  async previewPptxText(filePath) {
    const buffer = fs.readFileSync(filePath);
    const zip = await JSZip.loadAsync(buffer);
    const slides = [];
    let i = 1;
    while (true) {
      const slideFile = zip.file(`ppt/slides/slide${i}.xml`);
      if (!slideFile) break;
      const xml = await slideFile.async('string');
      const texts = [];
      const regex = /<a:t[^>]*>([\s\S]*?)<\/a:t>/g;
      let match;
      while ((match = regex.exec(xml)) !== null) {
        if (match[1].trim()) texts.push(match[1]);
      }
      slides.push({ page: i, text: texts.join('\n') });
      i++;
    }
    return { type: 'pptx-text', slides, title: path.basename(filePath) };
  }
}

module.exports = FilePreviewHandler;
