const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

process.on('uncaughtException', (err) => {
  if (err.message && err.message.includes('node-pty')) return;
  console.error('Uncaught Exception:', err);
});

// Core modules
const Store = require('./src/main/store');
const ApiClient = require('./src/main/api');
const PptGenerator = require('./src/main/pptGenerator');
const DownloadManager = require('./src/main/download');
const FileParser = require('./src/main/fileParser');
const Exporter = require('./src/main/exporter');
const ModelStore = require('./src/main/modelStore');
const ImageGenerator = require('./src/main/imageGenerator');
const WebSearch = require('./src/main/webSearch');
const CodeRunner = require('./src/main/codeRunner');
const WebReader = require('./src/main/webReader');
const LinkPreview = require('./src/main/linkPreview');
const Tools = require('./src/main/tools');
const OCR = require('./src/main/ocr');
const FileCreator = require('./src/main/fileCreator');
const FilePreviewHandler = require('./src/main/filePreviewHandler');
const DatabaseManager = require('./src/main/database');
const EmailClient = require('./src/main/emailClient');
const ReplManager = require('./src/main/repl');
const FileSystem = require('./src/main/fileSystem');

// Handler modules
const conversationsHandlers = require('./src/main/handlers/conversations');
const chatHandlers = require('./src/main/handlers/chat');
const exportHandlers = require('./src/main/handlers/export');
const fileHandlers = require('./src/main/handlers/file');
const modelsHandlers = require('./src/main/handlers/models');
const databaseHandlers = require('./src/main/handlers/database');
const emailHandlers = require('./src/main/handlers/email');
const toolsHandlers = require('./src/main/handlers/tools');
const windowHandlers = require('./src/main/handlers/window');

let mainWindow;

// Config helpers
const configPath = path.join(app.getPath('userData'), 'data', 'config.json');
function loadConfig() {
  try {
    if (fs.existsSync(configPath)) return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const defaultPath = path.join(__dirname, 'data', 'config.json');
    if (fs.existsSync(defaultPath)) return JSON.parse(fs.readFileSync(defaultPath, 'utf-8'));
  } catch (e) {}
  return {};
}
function saveConfig(config) {
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

// Masks helpers
const masksPath = path.join(app.getPath('userData'), 'data', 'masks.json');
function loadMasks() {
  try {
    if (fs.existsSync(masksPath)) return JSON.parse(fs.readFileSync(masksPath, 'utf-8'));
    const defaultPath = path.join(__dirname, 'data', 'masks.json');
    if (fs.existsSync(defaultPath)) {
      const data = fs.readFileSync(defaultPath, 'utf-8');
      const dir = path.dirname(masksPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(masksPath, data, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {}
  return [];
}
function saveMasks(masks) {
  const dir = path.dirname(masksPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(masksPath, JSON.stringify(masks, null, 2), 'utf-8');
}

// Create instances
const store = new Store();
const apiClient = new ApiClient();
const pptGenerator = new PptGenerator();
const downloadManager = new DownloadManager();
const fileParser = new FileParser();
const exporter = new Exporter();
const modelStore = new ModelStore();
const imageGenerator = new ImageGenerator();
const appConfig = loadConfig();
const webSearch = new WebSearch(appConfig.tavilyApiKey || '');
const codeRunner = new CodeRunner();
const webReader = new WebReader();
const linkPreview = new LinkPreview();
const tools = new Tools();
const databaseManager = new DatabaseManager();
const emailClient = new EmailClient();
const replManager = new ReplManager();
const fileSystem = new FileSystem();
const ocr = new OCR();
const fileCreator = new FileCreator();
const filePreviewHandler = new FilePreviewHandler(appConfig);

// Wire up apiClient dependencies
if (appConfig.emailConfig) emailClient.configure(appConfig.emailConfig);
apiClient.webSearch = webSearch;
apiClient.tools = tools;
apiClient.databaseManager = databaseManager;
apiClient.emailClient = emailClient;
apiClient.webReader = webReader;
apiClient.ocr = ocr;
apiClient.fileCreator = fileCreator;
apiClient.imageGenerator = imageGenerator;
apiClient.modelStore = modelStore;
apiClient.fileParser = fileParser;
apiClient.replManager = replManager;
apiClient.fileSystem = fileSystem;

// Shared deps object for handlers
const deps = {
  get mainWindow() { return mainWindow; },
  store, apiClient, exporter, fileCreator, fileParser, filePreviewHandler,
  downloadManager, modelStore, imageGenerator, webSearch, webReader,
  linkPreview, tools, databaseManager, emailClient, codeRunner, ocr,
  pptGenerator, loadConfig, saveConfig, loadMasks, saveMasks, replManager, fileSystem
};

// Register all IPC handlers
conversationsHandlers.register(ipcMain, deps);
chatHandlers.register(ipcMain, deps);
exportHandlers.register(ipcMain, deps);
fileHandlers.register(ipcMain, deps);
modelsHandlers.register(ipcMain, deps);
databaseHandlers.register(ipcMain, deps);
emailHandlers.register(ipcMain, deps);
toolsHandlers.register(ipcMain, deps);
windowHandlers.register(ipcMain, deps);

// REPL
ipcMain.handle('repl:spawn', (event, lang) => {
  const id = replManager.spawn(lang, (sessionId, data) => {
    event.sender.send('repl:data', { sessionId, data });
  });
  return id;
});
ipcMain.on('repl:write', (_, { sessionId, data }) => replManager.write(sessionId, data));
ipcMain.on('repl:interrupt', (_, sessionId) => replManager.interrupt(sessionId));
ipcMain.handle('repl:kill', (_, sessionId) => replManager.kill(sessionId));

// Window creation
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src/renderer/index.html'));

  mainWindow.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file://')) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// App lifecycle
app.whenReady().then(async () => {
  createWindow();
  apiClient.mainWindow = mainWindow;

  const cfg = loadConfig();
  if (!cfg.libreOfficeAsked && !filePreviewHandler.libreOfficePath) {
    const pafPath = app.isPackaged
      ? path.join(process.resourcesPath, 'LibreOfficePortable.paf.exe')
      : path.join(__dirname, 'static', 'LibreOfficePortable_26.2.1_MultilingualAll.paf.exe');
    if (fs.existsSync(pafPath)) {
      const result = await dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: '文件预览增强',
        message: '是否安装 LibreOffice Portable（约 200MB）？\n\n安装后可获得 Word/Excel/PPT 的完整预览\n（含排版、图形、图表等）',
        buttons: ['安装', '稍后再说'],
        defaultId: 0
      });
      if (result.response === 0) {
        const openResult = await shell.openPath(pafPath);
        if (openResult) {
          dialog.showErrorBox('启动失败', `无法启动安装程序:\n${openResult}`);
        } else {
          await new Promise(r => setTimeout(r, 1000));
          dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: '后续步骤',
            message: '安装包已启动。请选择解压目录（推荐使用默认路径）。\n\n安装完成后，请在接下来弹出的选择框中找到 soffice.exe：\n通常位于您选择的解压目录下的 App\\libreoffice\\program\\soffice.exe',
            buttons: ['好的']
          });
          const pickResult = await dialog.showOpenDialog(mainWindow, {
            title: '选择 soffice.exe',
            filters: [{ name: 'soffice.exe', extensions: ['exe'] }],
            properties: ['openFile']
          });
          if (!pickResult.canceled && pickResult.filePaths[0]) {
            const appCfg = loadConfig();
            appCfg.libreOfficePath = pickResult.filePaths[0];
            saveConfig(appCfg);
            filePreviewHandler.config.libreOfficePath = pickResult.filePaths[0];
            filePreviewHandler.invalidateCache();
          }
        }
      }
    }
    cfg.libreOfficeAsked = true;
    saveConfig(cfg);
  }
}).catch(err => {
  console.error('Startup error:', err);
});

app.on('before-quit', () => {
  store.flush();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
