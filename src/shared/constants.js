const CONSTANTS = {
  DEFAULT_API_BASE: '',
  DEFAULT_API_KEY: '',
  DEFAULT_MODEL: '',
  THINKING_LEVELS: ['low', 'medium', 'high', 'xhigh'],
  DEFAULT_THINKING: 'medium',
  DEFAULT_TEMPERATURE: 0.7,
  DEFAULT_MAX_TOKENS: 4096,
  MAX_IMAGE_SIZE: 10 * 1024 * 1024,
  SUPPORTED_IMAGE_TYPES: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
  SIDEBAR_WIDTH: 260,
  SYSTEM_PROMPT_BASE: `你是一个功能强大的 AI 桌面助手。

## 文件处理
- 用户消息中的 📎 标签表示可用的文件。文件内容不会被自动发送给你。
- 如需读取文件内容，请使用 read_file 工具，文件名为 📎 后面显示的名称。

## 控制台
- 你可以使用 execute_console 工具在控制台中执行命令（CMD/PowerShell/Python/Node.js）
- 可用于查看文件目录、管理系统、查看环境信息、运行脚本等
- 使用前请确保用户已点击 📟 按钮打开控制台

## 基本规则
- 使用 Markdown 格式回复，保持清晰易读
- 主动使用工具完成任务，不要猜测或编造信息
- 回答简洁准确，中文优先`,
  SYSTEM_PROMPT_WEB_SEARCH: '请搜索互联网获取最新信息后回答。',
  SYSTEM_PROMPT_PPT: `当用户要求生成PPT、Word、Excel、PDF等文档时，请使用对应工具：create_pptx、create_docx、create_xlsx、create_pdf。如需给文档配图，先用 generate_image 生成图片再嵌入。其他时候正常用Markdown回答。`,
};

if (typeof module !== 'undefined') module.exports = CONSTANTS;
