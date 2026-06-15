const { net } = require('electron');

class LinkPreview {
  constructor() {
    this.cache = new Map();
  }

  async getPreview(url) {
    if (this.cache.has(url)) return this.cache.get(url);

    try {
      const response = await net.fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      });
      if (!response.ok) return null;
      const html = await response.text();

      const title = this.extractMeta(html, 'og:title') || this.extractTitle(html);
      const description = this.extractMeta(html, 'og:description') || this.extractMeta(html, 'description');
      const domain = new URL(url).hostname;

      if (!title && !description) return null;

      const preview = { title: title || domain, description: description || '', domain };
      this.cache.set(url, preview);
      return preview;
    } catch (e) {
      return null;
    }
  }

  extractMeta(html, property) {
    const ogRegex = new RegExp(`<meta[^>]*(?:property|name)=["'](?:og:)?${property}["'][^>]*content=["']([^"']*)["']`, 'i');
    const ogMatch = html.match(ogRegex);
    if (ogMatch) return ogMatch[1];

    const reverseRegex = new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["'](?:og:)?${property}["']`, 'i');
    const reverseMatch = html.match(reverseRegex);
    return reverseMatch ? reverseMatch[1] : null;
  }

  extractTitle(html) {
    const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    return match ? match[1].trim() : null;
  }
}

module.exports = LinkPreview;
