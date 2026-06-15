const fs = require('fs');
const path = require('path');
const { net, app } = require('electron');

class ImageGenerator {
  constructor() {
    this.cacheDir = path.join(app.getPath('userData'), 'data', 'images');
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  buildUrl(baseUrl, endpoint) {
    let base = baseUrl.replace(/\/+$/, '');
    if (base.endsWith('/v1')) {
      return `${base}${endpoint}`;
    }
    return `${base}/v1${endpoint}`;
  }

  async generate(modelConfig, prompt, referenceImages = []) {
    if (modelConfig.apiFormat === 'gemini') {
      return await this.generateGemini(modelConfig, prompt, referenceImages);
    }
    return await this.generateOpenAI(modelConfig, prompt);
  }

  async generateOpenAI(modelConfig, prompt) {
    const url = this.buildUrl(modelConfig.baseUrl, '/images/generations');
    const body = {
      model: modelConfig.modelId,
      prompt,
      n: modelConfig.sampleCount || 1,
      size: this.aspectRatioToSize(modelConfig.aspectRatio || '1:1'),
      response_format: 'b64_json'
    };

    const response = await net.fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${modelConfig.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`API Error (${response.status}): ${err}`);
    }

    const data = await response.json();
    const images = [];

    if (data.data) {
      for (let i = 0; i < data.data.length; i++) {
        const item = data.data[i];
        let base64 = item.b64_json;
        if (!base64 && item.url) {
          const imgResp = await net.fetch(item.url);
          const buffer = Buffer.from(await imgResp.arrayBuffer());
          base64 = buffer.toString('base64');
        }
        if (base64) {
          const filePath = this.saveToCache(base64, i);
          images.push({ path: filePath, base64: `data:image/png;base64,${base64}` });
        }
      }
    }

    return images;
  }

  async generateGemini(modelConfig, prompt, referenceImages = []) {
    let base = modelConfig.baseUrl.replace(/\/+$/, '');
    if (base.endsWith('/v1')) base = base.slice(0, -3);
    const url = `${base}/v1beta/models/${modelConfig.modelId}:generateContent?key=${modelConfig.apiKey}`;

    const parts = [{ text: prompt }];
    for (const img of referenceImages) {
      parts.push({
        inline_data: {
          mime_type: 'image/jpeg',
          data: img.replace(/^data:image\/\w+;base64,/, '')
        }
      });
    }

    const body = {
      contents: [{ role: 'user', parts }],
      generationConfig: {
        responseModalities: ['IMAGE'],
        imageConfig: {}
      }
    };

    if (modelConfig.aspectRatio) {
      body.generationConfig.imageConfig.aspectRatio = modelConfig.aspectRatio;
    }
    if (modelConfig.imageSize) {
      body.generationConfig.imageConfig.imageSize = modelConfig.imageSize;
    }

    const response = await net.fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`API Error (${response.status}): ${err}`);
    }

    const data = await response.json();
    const images = [];

    if (data.candidates) {
      let idx = 0;
      for (const candidate of data.candidates) {
        if (candidate.content && candidate.content.parts) {
          for (const part of candidate.content.parts) {
            if (part.inlineData && part.inlineData.data) {
              const mime = part.inlineData.mimeType || 'image/png';
              const ext = mime.includes('png') ? 'png' : 'jpg';
              const filePath = this.saveToCache(part.inlineData.data, idx, ext);
              images.push({ path: filePath, base64: `data:${mime};base64,${part.inlineData.data}` });
              idx++;
            }
          }
        }
      }
    }

    return images;
  }

  aspectRatioToSize(ratio) {
    const map = {
      '1:1': '1024x1024',
      '16:9': '1792x1024',
      '9:16': '1024x1792',
      '4:3': '1024x768',
      '3:4': '768x1024'
    };
    return map[ratio] || '1024x1024';
  }

  saveToCache(base64Data, index = 0, ext = 'png') {
    const filename = `img_${Date.now()}_${index}.${ext}`;
    const filePath = path.join(this.cacheDir, filename);
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(filePath, buffer);
    return filePath;
  }
}

module.exports = ImageGenerator;
