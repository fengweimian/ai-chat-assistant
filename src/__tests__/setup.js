// Setup file - runs before all tests
// Intercept require('electron') to return a mock since electron only works inside an Electron process

const os = require('os');
const path = require('path');
const Module = require('module');

const electronMock = {
  app: {
    getPath: () => path.join(os.tmpdir(), 'test-electron-data'),
    isPackaged: false,
    whenReady: () => Promise.resolve(),
    on: () => {},
    quit: () => {},
  },
  BrowserWindow: class BrowserWindow {
    constructor() {}
    loadFile() {}
    webContents = { on: () => {}, setWindowOpenHandler: () => {} };
  },
  ipcMain: { handle: () => {}, on: () => {} },
  dialog: {
    showMessageBox: () => Promise.resolve({ response: 0 }),
    showOpenDialog: () => Promise.resolve({ canceled: true, filePaths: [] }),
    showErrorBox: () => {},
  },
  shell: { openExternal: () => {}, openPath: () => Promise.resolve('') },
  Notification: { isSupported: () => false, show: () => {} },
  net: { fetch: () => Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve('') }) },
};

// Delete cached electron module and replace with mock
const electronPath = require.resolve('electron');
delete require.cache[electronPath];
require.cache[electronPath] = {
  id: electronPath,
  filename: electronPath,
  loaded: true,
  exports: electronMock,
};
