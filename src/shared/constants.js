const CONSTANTS = {
  DEFAULT_API_BASE: 'https://REDACTED',
  DEFAULT_API_KEY: 'sk-REDACTED',
  DEFAULT_MODEL: 'gpt-5.5',
  THINKING_LEVELS: ['low', 'medium', 'high', 'xhigh'],
  DEFAULT_THINKING: 'medium',
  DEFAULT_TEMPERATURE: 0.7,
  DEFAULT_MAX_TOKENS: 4096,
  MAX_IMAGE_SIZE: 10 * 1024 * 1024,
  SUPPORTED_IMAGE_TYPES: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
  SIDEBAR_WIDTH: 260,
  SYSTEM_PROMPT_BASE: '你是一个有用的AI助手。',
  SYSTEM_PROMPT_WEB_SEARCH: '请搜索互联网获取最新信息后回答。',
  SYSTEM_PROMPT_PPT: '当用户要求生成PPT时，请返回以下JSON格式（用```json包裹）：{"type":"pptx","title":"标题","slides":[{"title":"幻灯片标题","content":["要点1","要点2"]}]}。其他时候正常用Markdown回答。'
};

if (typeof module !== 'undefined') module.exports = CONSTANTS;
