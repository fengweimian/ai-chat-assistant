const { execSync, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

class OCR {
  constructor() {
    this.cnocrAvailable = null;
    this.tesseractWorker = null;
    this.cachePath = path.join(app.getPath('userData'), 'ocr-data');
    if (!fs.existsSync(this.cachePath)) fs.mkdirSync(this.cachePath, { recursive: true });
  }

  async recognize(imagePath, onProgress) {
    if (this.cnocrAvailable === null) {
      this.cnocrAvailable = this.checkCnocr();
    }

    if (this.cnocrAvailable) {
      if (onProgress) onProgress('正在使用 cnocr 识别...');
      try {
        return await this.recognizeWithCnocr(imagePath);
      } catch (e) {
        if (onProgress) onProgress('cnocr 失败，切换到 Tesseract...');
      }
    }

    if (onProgress) onProgress('正在使用 Tesseract 识别...');
    return await this.recognizeWithTesseract(imagePath, onProgress);
  }

  checkCnocr() {
    try {
      execSync('python -c "from cnocr import CnOcr"', { timeout: 10000, stdio: 'pipe' });
      return true;
    } catch (e) {
      return false;
    }
  }

  recognizeWithCnocr(imagePath) {
    return new Promise((resolve, reject) => {
      const scriptPath = app.isPackaged
        ? path.join(process.resourcesPath, 'ocr_script.py')
        : path.join(__dirname, 'ocr_script.py');
      const child = exec(`python "${scriptPath}" "${imagePath}"`, { timeout: 180000 }, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(error.message));
          return;
        }
        try {
          const result = JSON.parse(stdout.trim());
          if (result.success) {
            resolve(result.text);
          } else {
            reject(new Error(result.error));
          }
        } catch (e) {
          reject(new Error('OCR 输出解析失败'));
        }
      });
    });
  }

  async recognizeWithTesseract(imagePath, onProgress) {
    const Tesseract = require('tesseract.js');

    const worker = await Tesseract.createWorker('chi_sim+eng', 1, {
      cachePath: this.cachePath,
      logger: (m) => {
        if (onProgress && m.progress !== undefined) {
          const pct = Math.round(m.progress * 100);
          if (m.status === 'loading tesseract core') {
            onProgress(`加载 OCR 引擎... ${pct}%`);
          } else if (m.status === 'loading language traineddata') {
            onProgress(`下载语言包... ${pct}%`);
          } else if (m.status === 'recognizing text') {
            onProgress(`识别中... ${pct}%`);
          }
        }
      }
    });

    try {
      const { data: { text } } = await worker.recognize(imagePath);
      return text.trim() || '未识别到文字';
    } finally {
      await worker.terminate();
    }
  }
}

module.exports = OCR;
