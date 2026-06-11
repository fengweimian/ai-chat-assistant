const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Store = require('./src/main/store');

let mainWindow;
const store = new Store();

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
