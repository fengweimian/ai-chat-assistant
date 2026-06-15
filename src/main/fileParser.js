const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
const XLSX = require('xlsx');
const JSZip = require('jszip');
const pdfParse = require('pdf-parse');

const MAX_TEXT_LENGTH = 50000;

class FileParser {
  async parse(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const fileName = path.basename(filePath);

    let text = '';
    switch (ext) {
      case '.docx':
      case '.doc':
        text = await this.parseDocx(filePath);
        break;
      case '.xlsx':
      case '.xls':
      case '.csv':
        text = await this.parseXlsx(filePath);
        break;
      case '.pptx':
      case '.ppt':
        text = await this.parsePptx(filePath);
        break;
      case '.pdf':
        text = await this.parsePdf(filePath);
        break;
      case '.txt':
      case '.md':
      case '.json':
      case '.xml':
      case '.html':
      case '.css':
      case '.js':
      case '.ts':
      case '.py':
      case '.java':
      case '.c':
      case '.cpp':
        text = fs.readFileSync(filePath, 'utf-8');
        break;
      default:
        throw new Error(`不支持的文件类型: ${ext}`);
    }

    if (text.length > MAX_TEXT_LENGTH) {
      text = text.substring(0, MAX_TEXT_LENGTH) + '\n\n[... 内容过长，已截断 ...]';
    }

    return { fileName, text, ext };
  }

  async parseDocx(filePath) {
    const buffer = fs.readFileSync(filePath);
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  async parseXlsx(filePath) {
    const workbook = XLSX.readFile(filePath);
    const lines = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      lines.push(`=== 工作表: ${sheetName} ===`);
      const csv = XLSX.utils.sheet_to_csv(sheet);
      lines.push(csv);
      lines.push('');
    }

    return lines.join('\n');
  }

  async parsePptx(filePath) {
    const buffer = fs.readFileSync(filePath);
    const zip = await JSZip.loadAsync(buffer);

    const slides = [];
    let slideIndex = 1;

    while (true) {
      const slideFile = zip.file(`ppt/slides/slide${slideIndex}.xml`);
      if (!slideFile) break;

      const xml = await slideFile.async('string');
      const texts = this.extractTextFromXml(xml);
      if (texts.length > 0) {
        slides.push(`--- 第${slideIndex}页 ---\n${texts.join('\n')}`);
      }
      slideIndex++;
    }

    return slides.join('\n\n');
  }

  extractTextFromXml(xml) {
    const texts = [];
    const regex = /<a:t[^>]*>([\s\S]*?)<\/a:t>/g;
    let match;
    let currentLine = '';

    while ((match = regex.exec(xml)) !== null) {
      currentLine += match[1];
    }

    if (currentLine) {
      const paragraphs = xml.split(/<\/a:p>/);
      for (const para of paragraphs) {
        const paraTexts = [];
        const tRegex = /<a:t[^>]*>([\s\S]*?)<\/a:t>/g;
        let tMatch;
        while ((tMatch = tRegex.exec(para)) !== null) {
          paraTexts.push(tMatch[1]);
        }
        if (paraTexts.length > 0) {
          texts.push(paraTexts.join(''));
        }
      }
    }

    return texts;
  }

  async parsePdf(filePath) {
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return data.text;
  }

  getSupportedExtensions() {
    return ['.docx', '.doc', '.xlsx', '.xls', '.csv', '.pptx', '.ppt', '.pdf',
            '.txt', '.md', '.json', '.xml', '.html', '.css', '.js', '.ts', '.py',
            '.java', '.c', '.cpp'];
  }
}

module.exports = FileParser;
