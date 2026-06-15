# AI Chat Assistant V5.2.1

> 一个功能强大的 AI 桌面助手，基于 Electron + 22 个 AI Tool Calls，支持多模型管理、文件创建、数据库操作、代码运行、REPL 终端、联网搜索等。毕业设计项目，独立全栈开发。

## 📸 功能概览

### 🤖 AI 聊天
- 支持 OpenAI 和 Gemini 双格式 API
- 多模型管理（可自由添加/切换/测试连接，支持对话模型和生图模型）
- 流式回复 + 思考内容展示（支持 DeepSeek/QwQ/Gemini/逆向模型的推理过程）
- 暗色/亮色主题切换
- Markdown 渲染（含 KaTeX 数学公式 + Mermaid 图表 + Chart.js 图表）
- 代码高亮 + 一键运行（JS/Python/Java）+ 内置 REPL 终端
- 对话导出（Markdown / PDF / Word）
- 多窗口独立对话
- 停止按钮（点击中止 AI 生成，已生成内容保留 + 保存到对话）
- 24 个 AI 工具自动调度（跨模型协作）

### 🔧 AI 工具集（24 个 Tool Calls）

| 类别 | 工具 | 说明 |
|------|------|------|
| 🔍 搜索 | `web_search` | 联网搜索实时信息（Tavily API） |
| | `read_web_page` | 读取指定网页内容并提取文本 |
| 📄 文档 | `create_docx` | 创建 Word 文档（标题/正文/列表/表格/图片） |
| | `create_xlsx` | 创建 Excel 表格（多 Sheet/公式） |
| | `create_pdf` | 创建 PDF 文档 |
| | `create_pptx` | 创建 PPT 演示文稿（支持图片嵌入，AI 自定义位置/尺寸/缩放） |
| | `merge_pdfs` | 合并多个 PDF |
| | `read_file` | **按需读取**用户上传的文件（节省 Token） |
| | `write_file` | 创建文件并写入内容（自动创建目录，UTF-8 编码） |
| | `create_folder` | 创建文件夹（支持多级目录） |
| 🖼 图片 | `generate_image` | 调用生图模型生成图片（开发者模式，跨模型协作） |
| | `ocr_image` | OCR 识别图片文字（视觉模型 → cnocr → Tesseract.js 三级降级） |
| 🗄️ 数据库 | `detect_databases` | 检测电脑上安装的数据库系统（SQLite/MySQL/PostgreSQL） |
| | `connect_database` | 连接数据库（支持多种类型 + 密码认证） |
| | `execute_sql` | 执行 SQL 语句（SELECT/CREATE/INSERT/UPDATE/DELETE） |
| | `create_database` | 创建 SQLite 数据库 |
| 📧 邮件 | `read_emails` | 读取邮箱最近邮件（IMAP） |
| | `send_email` | 发送邮件（SMTP，发送前弹框确认） |
| 📝 笔记 | `save_note` | 保存笔记到本地 |
| | `search_notes` | 搜索已保存的笔记 |
| 🖥 终端 | `execute_console` | 在控制台执行命令（CMD/PowerShell/Python/Node.js） |
| 🔧 实用 | `generate_password` | 生成安全随机密码 |

### 🖥 REPL 交互式终端

- **基于 child_process.spawn**：真正的终端，支持 CMD / PowerShell / Python / Node.js
- **直接在终端区域打字**：体验和真实 cmd.exe 一致，字符实时回显
- **代码运行 + REPL 共存**：代码块"▶ 运行"的输出与 REPL 输出混排（分隔线区分）
- **AI 可操控终端**：通过 `execute_console` 工具执行命令并返回结果
- **支持中断**：⏸ 按钮发送 Ctrl+C 中断当前命令
- **支持重启**：🔄 按钮 kill + respawn 终端
- **ANSI 过滤**：自动过滤终端控制码，显示干净文字
- **拖拽调整高度**：拖动分隔条调整面板大小

### 📂 文件处理
- **上传预览**：点击输入区的文件标签直接预览 Word/Excel/PPT/PDF
- **发送后预览**：消息中的文件卡片可点击预览（Word/Excel/PPT 专属图标）
- **LibreOffice 集成**：安装后 Word/Excel/PPT 转为 PDF 完整排版预览（含图形/图表/表格）
- **文件持久化**：上传的文件自动复制到 `data/files/`，重启后不丢失
- **按需读取**：文件内容不自动发送，AI 通过 `read_file` 工具按需读取（大幅节省 Token）

### 📊 数据可视化
- Chart.js 图表渲染（AI 返回图表 JSON 时自动显示）
- 链接预览卡片（消息中的 URL 自动显示标题和摘要）

### 🎨 界面功能
- 自定义用户头像（上传本地图片）
- 8 个预设 AI 面具 + 支持自定义
- 快捷指令面板（预设 + 自定义 Prompt）
- Markdown 实时预览（左右分屏 + 高度同步）
- 重新生成按钮（最新 AI 回复右侧底部）
- 输入框清除后 width 自动恢复
- 敏感信息保护（API Key 等存于本地，不上传）

### 🔬 开发者模式
开启后，对话模型获得 `generate_image` 工具，可调用生图模型生成图片并自动嵌入 PPT/Word 文档。

### 📁 数据目录
所有数据存储在用户 `AppData` 目录下，可在设置页查看路径并一键打开文件夹。

## 🏗️ 架构设计

### Handler 模式 + 依赖注入

```
main.js (231行)
  ├── deps 对象（统一依赖注入）
  └── 9 个 handler 模块
```

每个 handler 模块职责单一，通过 `deps` 获取所需依赖。

### Tool Registry 模式

```
api.js
  ↓ 查表调用
toolRegistry.js
  ├── web_search: async (args, ctx) => { ... }
  ├── generate_password: async (args, ctx) => { ... }
  ├── execute_console: async (args, ctx) => { ... }  ← V5.2.0 新增
  └── ... (22 tools)
```

### 测试体系

```
src/__tests__/
  ├── setup.js          # Electron API 完整 mock
  ├── tools.test.js     # 密码生成 + 笔记 CRUD
  ├── database.test.js  # 数据库查询
  └── store.test.js     # 数据持久化
```

## 🛠️ 技术栈

| 层级 | 技术 |
|------|------|
| **桌面框架** | Electron 35 |
| **前端** | 原生 HTML/CSS/JS |
| **Markdown** | marked + highlight.js + KaTeX + Mermaid |
| **图表** | Chart.js |
| **终端** | child_process.spawn + iconv-lite（GBK 编码支持） |
| **OCR** | cnocr (Python) + Tesseract.js (Node.js) 三级降级 |
| **文档读写** | mammoth + docx + pptxgenjs + xlsx (SheetJS) |
| **PDF** | pdf-parse + pdf-lib + Electron printToPDF |
| **数据库** | sql.js + mysql2 + pg |
| **邮件** | nodemailer (SMTP) + imapflow (IMAP) |
| **搜索** | Tavily API |
| **代码执行** | Node.js vm 沙盒 + child_process (Python/Java) |
| **测试** | vitest + Electron mock |
| **构建** | electron-builder (NSIS + Portable) |

## 📦 安装

### 安装包
1. 下载 `AI Chat Assistant Setup 5.2.0.exe`
2. 双击安装，支持自定义安装路径
3. 首次启动可选安装 LibreOffice Portable

### 便携版
1. 下载 `AI Chat Assistant-Portable-5.2.0.exe`
2. 双击直接运行

### 开发环境
```bash
git clone <仓库地址>
cd gpt_demo
npm install
npm start        # 启动应用
npm test         # 运行单元测试
```

## 🔨 构建

```bash
npm run build
```

## 📄 许可证

MIT License

## 👨‍💻 作者

独立全栈开发

---

**V5.2.1** | 24 AI Tool Calls | Electron 35 | GBK 中文终端 | Handler + Tool Registry | 跨模型协作
