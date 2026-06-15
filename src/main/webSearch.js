const { net } = require('electron');

class WebSearch {
  constructor(apiKey) {
    this.apiKey = apiKey || '';
  }

  setApiKey(key) {
    this.apiKey = key;
  }

  async search(query, maxResults = 5) {
    if (!this.apiKey) {
      throw new Error('未配置搜索 API Key');
    }

    const response = await net.fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: this.apiKey,
        query,
        max_results: maxResults,
        include_answer: true
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`搜索失败 (${response.status}): ${err}`);
    }

    const data = await response.json();

    let result = '';
    if (data.answer) {
      result += `摘要: ${data.answer}\n\n`;
    }
    if (data.results && data.results.length > 0) {
      result += '搜索结果:\n';
      for (const item of data.results) {
        result += `- ${item.title}\n  ${item.content}\n  来源: ${item.url}\n\n`;
      }
    }

    return result || '未找到相关结果';
  }
}

module.exports = WebSearch;
