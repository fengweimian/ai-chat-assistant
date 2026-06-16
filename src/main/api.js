const CONSTANTS = require('../shared/constants');
const { net } = require('electron');
const path = require('path');
const { toolHandlers } = require('./toolRegistry');

class ApiClient {
  constructor() {
    this.baseUrl = CONSTANTS.DEFAULT_API_BASE;
    this.apiKey = CONSTANTS.DEFAULT_API_KEY;
    this.currentAbortController = null;
    this._aborted = false;
  }

  abort() {
    this._aborted = true;
    if (this.currentAbortController) {
      try { this.currentAbortController.abort(); } catch (e) {}
    }
  }

  configure(baseUrl, apiKey) {
    if (baseUrl) this.baseUrl = baseUrl;
    if (apiKey) this.apiKey = apiKey;
  }

  buildUrl(endpoint) {
    let base = this.baseUrl.replace(/\/+$/, '');
    if (base.endsWith('/v1')) {
      return `${base}${endpoint}`;
    }
    return `${base}/v1${endpoint}`;
  }

  buildUrlFrom(baseUrl, endpoint) {
    let base = baseUrl.replace(/\/+$/, '');
    if (base.endsWith('/v1')) {
      return `${base}${endpoint}`;
    }
    return `${base}/v1${endpoint}`;
  }

  buildModelName(baseModel, thinkingLevel) {
    if (thinkingLevel && thinkingLevel !== 'none') {
      return `${baseModel}-${thinkingLevel}`;
    }
    return baseModel;
  }

  buildSystemPrompt(settings) {
    let prompt = settings.customSystemPrompt || CONSTANTS.SYSTEM_PROMPT_BASE;
    prompt += '\n' + CONSTANTS.SYSTEM_PROMPT_PPT;
    if (settings.webSearch) {
      prompt += '\n' + CONSTANTS.SYSTEM_PROMPT_WEB_SEARCH;
    }
    return prompt;
  }

  buildMessages(conversation) {
    const messages = [];
    messages.push({
      role: 'system',
      content: this.buildSystemPrompt(conversation.settings)
    });

    for (const msg of conversation.messages) {
      if (msg.role === 'user') {
        let textContent = msg.content;
        if (msg.docNames && msg.docNames.length > 0) {
          textContent += '\n\n[附件: ' + msg.docNames.map(n => n + ' 📎').join(', ') + ']';
        }
        if (msg.images && msg.images.length > 0) {
          const content = [{ type: 'text', text: textContent }];
          for (const img of msg.images) {
            content.push({
              type: 'image_url',
              image_url: { url: img }
            });
          }
          messages.push({ role: 'user', content });
        } else {
          messages.push({ role: 'user', content: textContent });
        }
      } else if (msg.role === 'assistant') {
        messages.push({ role: 'assistant', content: msg.content });
      }
    }

    return messages;
  }

  async convertImagesToOCR(messages, onProgress) {
    let hasImages = false;
    const newMessages = [];
    for (const msg of messages) {
      if (Array.isArray(msg.content)) {
        const newContent = [];
        for (const part of msg.content) {
          if (part.type === 'image_url' && part.image_url?.url) {
            hasImages = true;
            try {
              let imagePath = part.image_url.url;
              if (imagePath.startsWith('data:')) {
                const fs = require('fs');
                const path = require('path');
                const os = require('os');
                const base64 = imagePath.replace(/^data:image\/\w+;base64,/, '');
                const tempPath = path.join(os.tmpdir(), `ocr_${Date.now()}.png`);
                fs.writeFileSync(tempPath, Buffer.from(base64, 'base64'));
                imagePath = tempPath;
              }
              const ocrText = await this.ocr.recognize(imagePath, onProgress);
              newContent.push({ type: 'text', text: `[图片OCR识别结果]\n${ocrText}` });
            } catch (e) {
              newContent.push({ type: 'text', text: '[图片无法识别]' });
            }
          } else {
            newContent.push(part);
          }
        }
        newMessages.push({ ...msg, content: newContent });
      } else {
        newMessages.push(msg);
      }
    }
    return hasImages ? newMessages : messages;
  }

  getThinkingMode(modelConfig) {
    if (!modelConfig) return 'suffix';
    if (modelConfig.thinkingMode) return modelConfig.thinkingMode;
    if (modelConfig.thinkingSuffix === true) return 'suffix';
    if (modelConfig.thinkingSuffix === false) return 'none';
    return 'none';
  }

  async streamChat(conversation, userContent, images, docNames, docPaths, onChunk, onDone, onError, modelConfig, onThinking, onSearching, onUsage, onFileCreated) {
    const settings = conversation.settings;
    const baseUrl = modelConfig ? modelConfig.baseUrl : this.baseUrl;
    const apiKey = modelConfig ? modelConfig.apiKey : this.apiKey;
    const modelId = modelConfig ? modelConfig.modelId : (settings.model || CONSTANTS.DEFAULT_MODEL);

    if (!apiKey) {
      onError('未配置 API Key。请在设置中添加模型并填写 API Key。');
      return;
    }
    const thinkingMode = this.getThinkingMode(modelConfig);

    let model = modelId;
    const extraBody = {};

    if (thinkingMode === 'suffix') {
      model = this.buildModelName(modelId, settings.thinkingLevel);
    } else if (thinkingMode === 'param') {
      extraBody.thinking = { type: 'enabled' };
      extraBody.reasoning_effort = (settings.thinkingLevel === 'xhigh') ? 'max' : 'high';
    }

    const toolsList = [];

    if (settings.webSearch && this.webSearch && this.webSearch.apiKey) {
      toolsList.push({
        type: 'function',
        function: {
          name: 'web_search',
          description: '搜索互联网获取实时信息，如天气、新闻、最新事实、实时数据等',
          parameters: { type: 'object', properties: { query: { type: 'string', description: '搜索关键词' } }, required: ['query'] }
        }
      });
    }

    toolsList.push({
      type: 'function',
      function: {
        name: 'generate_password',
        description: '生成安全随机密码',
        parameters: { type: 'object', properties: { length: { type: 'integer', description: '密码长度，默认16' }, symbols: { type: 'boolean', description: '是否包含特殊字符' } } }
      }
    });

    toolsList.push({
      type: 'function',
      function: {
        name: 'save_note',
        description: '保存一条笔记，用于记录重要信息',
        parameters: { type: 'object', properties: { title: { type: 'string', description: '笔记标题' }, content: { type: 'string', description: '笔记内容' }, tags: { type: 'array', items: { type: 'string' }, description: '标签' } }, required: ['title', 'content'] }
      }
    });

    toolsList.push({
      type: 'function',
      function: {
        name: 'search_notes',
        description: '搜索已保存的笔记',
        parameters: { type: 'object', properties: { keyword: { type: 'string', description: '搜索关键词' } }, required: ['keyword'] }
      }
    });

    toolsList.push({
      type: 'function',
      function: {
        name: 'read_emails',
        description: '读取用户邮箱中的最近邮件列表',
        parameters: { type: 'object', properties: { count: { type: 'integer', description: '读取数量，默认10' } } }
      }
    });

    toolsList.push({
      type: 'function',
      function: {
        name: 'send_email',
        description: '发送邮件给指定收件人（发送前会弹出确认框）',
        parameters: { type: 'object', properties: { to: { type: 'string', description: '收件人邮箱' }, subject: { type: 'string', description: '邮件主题' }, body: { type: 'string', description: '邮件正文' } }, required: ['to', 'subject', 'body'] }
      }
    });

    toolsList.push({
      type: 'function',
      function: {
        name: 'detect_databases',
        description: '检测用户电脑上安装了哪些数据库系统（SQLite/MySQL/PostgreSQL），以及可用的SQLite文件',
        parameters: { type: 'object', properties: {} }
      }
    });

    toolsList.push({
      type: 'function',
      function: {
        name: 'connect_database',
        description: '连接到数据库。SQLite需要filePath；MySQL/PostgreSQL需要host、port、user、password、database',
        parameters: { type: 'object', properties: { type: { type: 'string', description: '数据库类型: sqlite, mysql, postgresql' }, filePath: { type: 'string', description: 'SQLite文件路径' }, host: { type: 'string', description: '主机地址' }, port: { type: 'integer', description: '端口号' }, user: { type: 'string', description: '用户名' }, password: { type: 'string', description: '密码' }, database: { type: 'string', description: '数据库名' } }, required: ['type'] }
      }
    });

    toolsList.push({
      type: 'function',
      function: {
        name: 'execute_sql',
        description: '在已连接的数据库上执行SQL语句（支持SELECT、CREATE TABLE、INSERT、UPDATE、DELETE等所有操作）',
        parameters: { type: 'object', properties: { sql: { type: 'string', description: 'SQL语句' } }, required: ['sql'] }
      }
    });

    toolsList.push({
      type: 'function',
      function: {
        name: 'create_database',
        description: '创建一个新的SQLite数据库文件（保存在文档目录）',
        parameters: { type: 'object', properties: { name: { type: 'string', description: '数据库名称（不含扩展名）' } }, required: ['name'] }
      }
    });

    toolsList.push({
      type: 'function',
      function: {
        name: 'read_file',
        description: '读取代码/文本文件内容（.txt .md .json .js .py .java .c .cpp .html .css .xml 等）。用户消息中的 📎 标签就是可用的文件。如需读取 Office 文档请使用 read_document。',
        parameters: { type: 'object', properties: { fileName: { type: 'string', description: '📎 后面显示的文件名' } }, required: ['fileName'] }
      }
    });

    toolsList.push({
      type: 'function',
      function: {
        name: 'read_document',
        description: '读取 Office 文档内容（Word .docx、Excel .xlsx、PPT .pptx、PDF .pdf、CSV .csv）。用户消息中的 📎 标签就是可用的文件。如需读取代码文件请使用 read_file。',
        parameters: { type: 'object', properties: { fileName: { type: 'string', description: '📎 后面显示的文件名' } }, required: ['fileName'] }
      }
    });

    toolsList.push({
      type: 'function',
      function: {
        name: 'execute_console',
        description: '在控制台中执行命令（CMD/PowerShell/Python/Node.js）。可用于查看文件、管理系统、运行脚本等。使用前请确保已打开控制台（点击 📟 按钮）。',
        parameters: { type: 'object', properties: { command: { type: 'string', description: '要执行的命令' } }, required: ['command'] }
      }
    });

    toolsList.push({
      type: 'function',
      function: {
        name: 'write_file',
        description: '创建文件并写入内容。自动创建所需的目录。默认不覆盖已有文件（需设置overwrite为true才覆盖）。所有文件使用UTF-8编码。',
        parameters: { type: 'object', properties: { path: { type: 'string', description: '文件路径，如 C:/project/main.py' }, content: { type: 'string', description: '文件内容' }, overwrite: { type: 'boolean', description: '是否覆盖已存在的文件，默认false' } }, required: ['path', 'content'] }
      }
    });

    toolsList.push({
      type: 'function',
      function: {
        name: 'create_folder',
        description: '创建文件夹（支持多级目录，如 project/src/utils/ 会一次性创建所有层级）',
        parameters: { type: 'object', properties: { path: { type: 'string', description: '文件夹路径' } }, required: ['path'] }
      }
    });

    toolsList.push({
      type: 'function',
      function: {
        name: 'read_web_page',
        description: '读取指定URL网页的文本内容',
        parameters: { type: 'object', properties: { url: { type: 'string', description: '网页URL' } }, required: ['url'] }
      }
    });

    toolsList.push({
      type: 'function',
      function: {
        name: 'ocr_image',
        description: '使用本地OCR识别图片中的文字（支持中英文）。不传参数则自动识别对话中最新的图片。',
        parameters: { type: 'object', properties: { imagePath: { type: 'string', description: '可选。图片文件路径，留空则自动识别对话中最近的图片' } }, required: [] }
      }
    });

    toolsList.push({
      type: 'function',
      function: {
        name: 'create_docx',
        description: '创建Word文档。content为数组，每项可以是：{"type":"heading","level":1-3,"text":"标题"} / {"type":"paragraph","text":"正文"} / {"type":"list","items":["要点1","要点2"]} / {"type":"table","headers":["列1","列2"],"rows":[["值1","值2"]]} / {"type":"image","path":"图片路径","w":400,"h":300}。图片宽高单位为像素。',
        parameters: { type: 'object', properties: { filename: { type: 'string', description: '文件名（不含扩展名）' }, content: { type: 'array', description: '文档内容块数组' } }, required: ['filename', 'content'] }
      }
    });

    toolsList.push({
      type: 'function',
      function: {
        name: 'create_xlsx',
        description: '创建Excel表格。sheets为数组，每项含name、headers(列标题数组)、rows(数据行数组)、formulas(可选,如{"B4":"=SUM(B2:B3)"})',
        parameters: { type: 'object', properties: { filename: { type: 'string', description: '文件名' }, sheets: { type: 'array', description: '工作表数组' } }, required: ['filename', 'sheets'] }
      }
    });

    toolsList.push({
      type: 'function',
      function: {
        name: 'create_pdf',
        description: '创建PDF文档',
        parameters: { type: 'object', properties: { filename: { type: 'string', description: '文件名' }, content: { type: 'string', description: '文档内容（支持换行）' } }, required: ['filename', 'content'] }
      }
    });

    toolsList.push({
      type: 'function',
      function: {
        name: 'merge_pdfs',
        description: '合并多个PDF文件为一个',
        parameters: { type: 'object', properties: { files: { type: 'array', items: { type: 'string' }, description: 'PDF文件路径数组' }, output: { type: 'string', description: '输出文件名' } }, required: ['files', 'output'] }
      }
    });

    toolsList.push({
      type: 'function',
      function: {
        name: 'create_pptx',
        description: '创建PPT演示文稿。slides为数组，每项含：title(标题)、content(要点数组)、images(可选，图片数组)。图片每项：{path:"路径",x?:"英寸",y?:"英寸",w?:"英寸",h?:"英寸",sizing?:"contain/cover/crop"}。默认x:6.5,y:1.5,w:3,h:3。可先用generate_image生成图片获取路径，再嵌入幻灯片。',
        parameters: { type: 'object', properties: { title: { type: 'string', description: '演示文稿标题' }, slides: { type: 'array', description: '幻灯片数组，每项{title,content:[],images:[{path,x?,y?,w?,h?,sizing?}]}' } }, required: ['title', 'slides'] }
      }
    });

    if (settings.developerMode && this.imageGenerator && this.modelStore) {
      toolsList.push({
        type: 'function',
        function: {
          name: 'generate_image',
          description: '调用生图模型生成图片。返回每行一个图片文件的完整路径。可直接将这些路径用于create_pptx(images[].path)或create_docx({type:"image",path})中嵌入文档。支持自定义提示词、宽高比(aspectRatio:1:1/16:9/9:16/4:3/3:4)、分辨率(size:1K/2K/4K)',
          parameters: { type: 'object', properties: { prompt: { type: 'string', description: '图片提示词' }, aspectRatio: { type: 'string', description: '宽高比' }, size: { type: 'string', description: '分辨率' } }, required: ['prompt'] }
        }
      });
    }

    if (toolsList.length > 0) {
      extraBody.tools = toolsList;
    }

    const tempConv = {
      ...conversation,
      messages: [...conversation.messages, { role: 'user', content: userContent, images, docNames, docPaths }]
    };
    const messages = this.buildMessages(tempConv);

    try {
      await this.doStreamRequest(messages, model, baseUrl, apiKey, settings, extraBody, onChunk, onDone, onError, onThinking, onSearching, onUsage, onFileCreated);
    } catch (e) {
      onError(`Network error: ${e.message}`);
    }
  }

  async doStreamRequest(messages, model, baseUrl, apiKey, settings, extraBody, onChunk, onDone, onError, onThinking, onSearching, onUsage, onFileCreated, depth = 0) {
    this.currentAbortController = new AbortController();

    const url = this.buildUrlFrom(baseUrl, '/chat/completions');
    let response;
    try {
      response = await net.fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages,
          stream: true,
          temperature: settings.temperature || CONSTANTS.DEFAULT_TEMPERATURE,
          max_tokens: settings.maxTokens || CONSTANTS.DEFAULT_MAX_TOKENS,
          ...extraBody
        }),
        signal: this.currentAbortController.signal
      });
    } catch (e) {
      if (e.name === 'AbortError' || e.code === 'ABORT_ERR' || (e.message && e.message.toLowerCase().includes('abort'))) {
        this._aborted = false;
        onDone('', '');
        return;
      }
      throw e;
    }

    if (!response.ok) {
      const errorText = await response.text();
      const lowerErr = errorText.toLowerCase();
      if (this.ocr && depth === 0 && (lowerErr.includes('image') || lowerErr.includes('vision') || lowerErr.includes('multimodal') || lowerErr.includes('invalid_type'))) {
        if (onSearching) onSearching('正在 OCR 识别图片...');
        const ocrMessages = await this.convertImagesToOCR(messages, onSearching);
        if (ocrMessages !== messages) {
          return await this.doStreamRequest(ocrMessages, model, baseUrl, apiKey, settings, extraBody, onChunk, onDone, onError, onThinking, onSearching, onUsage, onFileCreated, depth + 1);
        }
      }
      onError(`API Error (${response.status}): ${errorText}`);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullContent = '';
    let fullThinking = '';
    let isInThinkTag = false;
    let toolCalls = [];
    let finishReason = null;

    try {
    while (true) {
      if (this._aborted) {
        this._aborted = false;
        onDone(fullContent, fullThinking);
        return;
      }
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          if (parsed.usage && onUsage) {
            onUsage(parsed.usage);
          }

          const choice = parsed.choices?.[0];
          const delta = choice?.delta;

          if (choice?.finish_reason) {
            finishReason = choice.finish_reason;
          }

          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index || 0;
              if (!toolCalls[idx]) {
                toolCalls[idx] = { id: '', function: { name: '', arguments: '' } };
              }
              if (tc.id) toolCalls[idx].id = tc.id;
              if (tc.function?.name) toolCalls[idx].function.name += tc.function.name;
              if (tc.function?.arguments) toolCalls[idx].function.arguments += tc.function.arguments;
            }
          }

          if (delta?.reasoning_content && onThinking) {
            fullThinking += delta.reasoning_content;
            onThinking(delta.reasoning_content);
          }

          if (delta?.reasoning && onThinking) {
            fullThinking += delta.reasoning;
            onThinking(delta.reasoning);
          }

          if (delta?.content) {
            let text = delta.content;
            while (text.length > 0) {
              if (!isInThinkTag) {
                const thinkStart = text.indexOf('<think>');
                if (thinkStart === -1) {
                  fullContent += text;
                  onChunk(text);
                  break;
                } else {
                  if (thinkStart > 0) {
                    const before = text.substring(0, thinkStart);
                    fullContent += before;
                    onChunk(before);
                  }
                  isInThinkTag = true;
                  text = text.substring(thinkStart + 7);
                }
              } else {
                const thinkEnd = text.indexOf('</think>');
                if (thinkEnd === -1) {
                  fullThinking += text;
                  if (onThinking) onThinking(text);
                  break;
                } else {
                  const thinkText = text.substring(0, thinkEnd);
                  fullThinking += thinkText;
                  if (onThinking) onThinking(thinkText);
                  isInThinkTag = false;
                  text = text.substring(thinkEnd + 8);
                }
              }
            }
          }
        } catch (e) {}
      }
    }

    if (finishReason === 'tool_calls' && toolCalls.length > 0) {
      const toolResults = [];
      const ctx = {
        webSearch: this.webSearch,
        tools: this.tools,
        emailClient: this.emailClient,
        databaseManager: this.databaseManager,
        fileParser: this.fileParser,
        webReader: this.webReader,
        imageGenerator: this.imageGenerator,
        modelStore: this.modelStore,
        ocr: this.ocr,
        fileCreator: this.fileCreator,
        replManager: this.replManager,
        fileSystem: this.fileSystem,
        mainWindow: this.mainWindow,
        conversation: this._conversation,
        onSearching,
        onFileCreated
      };

      for (const tc of toolCalls) {
        try {
          const args = JSON.parse(tc.function.arguments || '{}');
          const handler = toolHandlers[tc.function.name];
          let result;

          if (handler) {
            result = await handler(args, ctx);
          } else {
            result = `未知工具: ${tc.function.name}`;
          }

          toolResults.push({ tool_call_id: tc.id, role: 'tool', content: result });
        } catch (e) {
          toolResults.push({ tool_call_id: tc.id, role: 'tool', content: `工具执行失败: ${e.message}` });
        }
      }

      const newMessages = [
        ...messages,
        { role: 'assistant', content: fullContent || null, tool_calls: toolCalls.map(tc => ({ id: tc.id, type: 'function', function: tc.function })) },
        ...toolResults
      ];

      if (fullThinking) {
        newMessages[newMessages.length - toolResults.length - 1].reasoning_content = fullThinking;
      }

      const secondExtraBody = { ...extraBody };

      await this.doStreamRequest(newMessages, model, baseUrl, apiKey, settings, secondExtraBody, onChunk, onDone, onError, onThinking, onSearching, onUsage, onFileCreated, depth + 1);
    } else {
      onDone(fullContent, fullThinking);
    }
    } catch (e) {
      if (e.name === 'AbortError' || e.code === 'ABORT_ERR' || (e.message && e.message.toLowerCase().includes('abort'))) {
        this._aborted = false;
        onDone(fullContent, fullThinking);
        return;
      }
      throw e;
    }
  }
}

module.exports = ApiClient;
