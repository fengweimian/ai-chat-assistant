const fs = require('fs');
const path = require('path');

const toolHandlers = {
  web_search: async (args, ctx) => {
    if (ctx.onSearching) ctx.onSearching(`🔍 正在搜索: ${args.query}`);
    return await ctx.webSearch.search(args.query);
  },

  generate_password: async (args, ctx) => {
    const pw = ctx.tools.generatePassword(args);
    return `密码: ${pw.password}\n强度: ${pw.strength}\n长度: ${pw.length}`;
  },

  save_note: async (args, ctx) => {
    const note = ctx.tools.saveNote(args.title, args.content, args.tags);
    return `笔记已保存: ${note.title} (ID: ${note.id})`;
  },

  search_notes: async (args, ctx) => {
    const notes = ctx.tools.searchNotes(args.keyword);
    return notes.length > 0
      ? notes.map(n => `[${n.title}] ${n.content.substring(0, 100)}`).join('\n')
      : '未找到相关笔记';
  },

  read_emails: async (args, ctx) => {
    const emails = await ctx.emailClient.readEmails('INBOX', args.count || 10);
    return emails.length > 0
      ? emails.map(e => `[${e.date}] 来自: ${e.from} | 主题: ${e.subject}`).join('\n')
      : '没有邮件';
  },

  send_email: async (args, ctx) => {
    if (ctx.mainWindow && ctx.tools) {
      const confirmed = await ctx.tools.confirmSendEmail(ctx.mainWindow, args.to, args.subject);
      if (confirmed) {
        await ctx.emailClient.sendEmail(args.to, args.subject, args.body);
        return `邮件已发送至 ${args.to}，主题: ${args.subject}`;
      } else {
        return '用户取消了发送';
      }
    }
    await ctx.emailClient.sendEmail(args.to, args.subject, args.body);
    return `邮件已发送至 ${args.to}，主题: ${args.subject}`;
  },

  detect_databases: async (args, ctx) => {
    const installed = ctx.databaseManager.detectInstalled();
    const sqliteFiles = ctx.databaseManager.scanSqliteFiles();
    let result = '已安装的数据库系统:\n' + installed.map(d => `- ${d.name} (${d.available ? '可用' : '不可用'})`).join('\n');
    if (sqliteFiles.length > 0) {
      result += '\n\n发现的SQLite文件:\n' + sqliteFiles.slice(0, 10).map(f => `- ${f.name} (${(f.size/1024).toFixed(1)}KB) [${f.path}]`).join('\n');
    }
    return result;
  },

  connect_database: async (args, ctx) => {
    const connResult = await ctx.databaseManager.connect(args);
    return `已连接到 ${connResult.type} 数据库。可用表: ${connResult.tables.join(', ') || '(空)'}`;
  },

  execute_sql: async (args, ctx) => {
    if (ctx.tools && ctx.tools.isDestructiveSQL(args.sql) && ctx.mainWindow) {
      const confirmed = await ctx.tools.confirmSqlExecution(ctx.mainWindow, args.sql);
      if (!confirmed) {
        return '用户取消了 SQL 执行';
      }
    }
    const sqlResult = await ctx.databaseManager.query(args.sql);
    if (sqlResult.columns && sqlResult.columns.length > 0) {
      let result = `列: ${sqlResult.columns.join(', ')}\n` + sqlResult.rows.slice(0, 50).map(r => r.join(' | ')).join('\n');
      if (sqlResult.rows.length > 50) result += `\n... (共${sqlResult.rows.length}行)`;
      ctx.databaseManager.saveSqlite();
      return result;
    }
    ctx.databaseManager.saveSqlite();
    return `执行成功，影响行数: ${sqlResult.changes || 0}`;
  },

  create_database: async (args, ctx) => {
    const dbInfo = await ctx.databaseManager.createSqliteDatabase(args.name);
    return `SQLite数据库已创建: ${dbInfo.path}`;
  },

  write_file: async (args, ctx) => {
    const result = ctx.fileSystem.writeFile(args.path, args.content, args.overwrite);
    return `文件已创建: ${result}`;
  },

  create_folder: async (args, ctx) => {
    const result = ctx.fileSystem.createFolder(args.path);
    return `文件夹已创建: ${result}`;
  },

  execute_console: async (args, ctx) => {
    let sessionId = ctx.replManager.getFirstActive();
    if (!sessionId) {
      return '控制台未启动。请先在应用中点击 📟 按钮打开控制台，确保终端已启动后再重试。';
    }
    return await ctx.replManager.execCommand(sessionId, args.command);
  },

  read_file: async (args, ctx) => {
    const messages = ctx.conversation?.messages || [];
    const fileMsg = [...messages].reverse().find(m =>
      m.docNames && m.docNames.includes(args.fileName)
    );
    if (!fileMsg || !fileMsg.docNames || fileMsg.docNames.length === 0) {
      return '当前对话中没有上传的文件';
    }
    const idx = fileMsg.docNames.indexOf(args.fileName);
    if (idx === -1) {
      return `未找到文件"${args.fileName}"。可用文件: ${fileMsg.docNames.join(', ')}`;
    }
    const filePath = fileMsg.docPaths?.[idx];
    if (!filePath) return '文件路径不可用';
    try {
      if (!fs.existsSync(filePath)) return `文件不存在: ${filePath}`;
      const parsed = await ctx.fileParser.parse(filePath);
      return `[文件内容: ${parsed.fileName}]\n${parsed.text}`;
    } catch (e) {
      return `读取失败: ${e.message}`;
    }
  },

  read_web_page: async (args, ctx) => {
    const webContent = await ctx.webReader.read(args.url);
    return webContent || '无法读取网页内容';
  },

  generate_image: async (args, ctx) => {
    if (ctx.onSearching) ctx.onSearching(`正在生成图片: ${(args.prompt || '').substring(0, 40)}...`);
    const imageModel = ctx.modelStore.getAll().find(m => m.type === 'image');
    if (!imageModel) return '请在设置中添加一个生图模型';
    const images = await ctx.imageGenerator.generate(imageModel, args.prompt);
    for (const img of images) {
      if (ctx.onFileCreated) ctx.onFileCreated({ name: path.basename(img.path), path: img.path, type: 'image' });
    }
    return images.map(img => img.path).join('\n');
  },

  ocr_image: async (args, ctx) => {
    const ocrText = await ctx.ocr.recognize(args.imagePath);
    return ocrText || '未识别到文字';
  },

  create_docx: async (args, ctx) => {
    const res = await ctx.fileCreator.createDocx(args.filename, args.content);
    if (res.success && ctx.onFileCreated) ctx.onFileCreated({ name: res.name, path: res.path, type: 'docx' });
    return res.success ? 'Word 文档已生成，点击下方 [下载] 按钮保存' : '创建失败';
  },

  create_xlsx: async (args, ctx) => {
    const res = await ctx.fileCreator.createXlsx(args.filename, args.sheets);
    if (res.success && ctx.onFileCreated) ctx.onFileCreated({ name: res.name, path: res.path, type: 'xlsx' });
    return res.success ? 'Excel 表格已生成，点击下方 [下载] 按钮保存' : '创建失败';
  },

  create_pdf: async (args, ctx) => {
    const res = await ctx.fileCreator.createPdf(args.filename, args.content);
    if (res.success && ctx.onFileCreated) ctx.onFileCreated({ name: res.name, path: res.path, type: 'pdf' });
    return res.success ? 'PDF 文档已生成，点击下方 [下载] 按钮保存' : '创建失败';
  },

  merge_pdfs: async (args, ctx) => {
    const res = await ctx.fileCreator.mergePdfs(args.files, args.output);
    if (res.success && ctx.onFileCreated) ctx.onFileCreated({ name: res.name, path: res.path, type: 'pdf' });
    return res.success ? 'PDF 已合并，点击下方 [下载] 按钮保存' : '创建失败';
  },

  create_pptx: async (args, ctx) => {
    const res = await ctx.fileCreator.createPptx(args);
    if (res.success && ctx.onFileCreated) ctx.onFileCreated({ name: res.name, path: res.path, type: 'pptx' });
    return res.success ? 'PPT 已生成，点击下方 [下载] 按钮保存' : '创建失败';
  }
};

module.exports = { toolHandlers };
