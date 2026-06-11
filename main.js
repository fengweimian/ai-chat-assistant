const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Store = require('./src/main/store');

const ApiClient = require('./src/main/api');
const PptGenerator = require('./src/main/pptGenerator');
const DownloadManager = require('./src/main/download');

let mainWindow;
const store = new Store();
const apiClient = new ApiClient();
const pptGenerator = new PptGenerator();
const downloadManager = new DownloadManager();

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
}

// IPC Handlers
ipcMain.handle('conversations:getAll', () => store.getAll());
ipcMain.handle('conversations:getById', (_, id) => store.getById(id));
ipcMain.handle('conversations:create', (_, title) => store.create(title));
ipcMain.handle('conversations:update', (_, id, updates) => store.update(id, updates));
ipcMain.handle('conversations:addMessage', (_, convId, message) => store.addMessage(convId, message));
ipcMain.handle('conversations:delete', (_, id) => store.delete(id));

// Chat streaming
ipcMain.on('chat:send', (event, { conversationId, content, images }) => {
  const conversation = store.getById(conversationId);
  if (!conversation) {
    event.sender.send('chat:error', 'Conversation not found');
    return;
  }

  apiClient.streamChat(
    conversation,
    content,
    images,
    (chunk) => event.sender.send('chat:chunk', { conversationId, chunk }),
    (fullContent) => event.sender.send('chat:done', { conversationId, fullContent }),
    (error) => event.sender.send('chat:error', { conversationId, error })
  );
});

// Settings update
ipcMain.on('settings:update', (_, settings) => {
  apiClient.configure(settings.baseUrl, settings.apiKey);
});

// PPT generation
ipcMain.handle('ppt:generate', async (_, pptData) => {
  try {
    return await pptGenerator.generate(pptData);
  } catch (e) {
    throw new Error(`PPT generation failed: ${e.message}`);
  }
});

ipcMain.handle('ppt:detect', (_, text) => {
  return pptGenerator.detectPptxRequest(text);
});

// File download
ipcMain.handle('file:save', async (_, sourcePath, suggestedName) => {
  return await downloadManager.saveFile(sourcePath, suggestedName);
});

ipcMain.handle('file:openLocation', (_, filePath) => {
  downloadManager.openInExplorer(filePath);
});

// Window controls
ipcMain.on('window:minimize', () => mainWindow?.minimize());
ipcMain.on('window:maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.on('window:close', () => mainWindow?.close());

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
