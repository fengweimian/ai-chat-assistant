const os = require('os');
const path = require('path');

module.exports = {
  app: {
    getPath: (name) => path.join(os.tmpdir(), 'test-electron-data'),
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
  ipcMain: {
    handle: () => {},
    on: () => {},
  },
  dialog: {
    showMessageBox: () => Promise.resolve({ response: 0 }),
    showOpenDialog: () => Promise.resolve({ canceled: true, filePaths: [] }),
    showErrorBox: () => {},
  },
  shell: {
    openExternal: () => {},
    openPath: () => Promise.resolve(''),
  },
  Notification: {
    isSupported: () => false,
    show: () => {},
  },
  net: {
    fetch: () => Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve('') }),
  },
};
