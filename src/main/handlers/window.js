const fs = require('fs');
const path = require('path');
const { app, BrowserWindow, dialog, shell } = require('electron');

function register(ipcMain, { mainWindow, webSearch, webReader, linkPreview, filePreviewHandler, pptGenerator, codeRunner, ocr, loadConfig, saveConfig }) {
  ipcMain.handle('app:getDataPath', () => {
    return path.join(app.getPath('userData'), 'data');
  });

  ipcMain.handle('avatar:set', async (_, filePath) => {
    const destDir = path.join(app.getPath('userData'), 'data');
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    const dest = path.join(destDir, 'user-avatar.png');
    const buffer = fs.readFileSync(filePath);
    fs.writeFileSync(dest, buffer);
    return dest;
  });

  ipcMain.handle('avatar:get', () => {
    const avatarPath = path.join(app.getPath('userData'), 'data', 'user-avatar.png');
    if (fs.existsSync(avatarPath)) return avatarPath;
    return null;
  });

  ipcMain.handle('code:run', (_, lang, code) => {
    return codeRunner.run(lang, code);
  });

  ipcMain.handle('code:runStream', (event, lang, code, streamId) => {
    codeRunner.runStream(lang, code, (type, data) => {
      event.sender.send('code:streamChunk', { streamId, type, data });
    });
  });

  ipcMain.handle('ocr:recognize', async (event, imagePath) => {
    return await ocr.recognize(imagePath, (progress) => {
      event.sender.send('ocr:progress', progress);
    });
  });

  ipcMain.handle('libreoffice:status', () => {
    const p = filePreviewHandler.libreOfficePath;
    return { detected: !!p, path: p || '' };
  });

  ipcMain.handle('libreoffice:install', async () => {
    const pafPath = app.isPackaged
      ? path.join(process.resourcesPath, 'LibreOfficePortable.paf.exe')
      : path.join(__dirname, '..', '..', '..', 'static', 'LibreOfficePortable_26.2.1_MultilingualAll.paf.exe');
    if (!fs.existsSync(pafPath)) return { success: false, error: '安装包不存在（可能已安装）' };

    const openResult = await shell.openPath(pafPath);
    if (openResult) return { success: false, error: `无法启动安装程序: ${openResult}` };

    await new Promise(r => setTimeout(r, 1000));
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: '后续步骤',
      message: '安装包已启动。请选择解压目录（推荐使用默认路径）。\n\n安装完成后，请在弹出的文件选择框中找到 soffice.exe：\n通常位于您选择的解压目录下的 App\\libreoffice\\program\\soffice.exe',
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
      return { success: true, path: pickResult.filePaths[0] };
    }
    return { success: false };
  });

  ipcMain.handle('libreoffice:setPath', (_, libPath) => {
    const appCfg = loadConfig();
    appCfg.libreOfficePath = libPath;
    saveConfig(appCfg);
    filePreviewHandler.config.libreOfficePath = libPath;
    filePreviewHandler.invalidateCache();
  });

  ipcMain.handle('libreoffice:cleanInstaller', () => {
    const pafPath = app.isPackaged
      ? path.join(process.resourcesPath, 'LibreOfficePortable.paf.exe')
      : path.join(__dirname, '..', '..', '..', 'static', 'LibreOfficePortable_26.2.1_MultilingualAll.paf.exe');
    if (fs.existsSync(pafPath)) fs.unlinkSync(pafPath);
    return true;
  });

  ipcMain.handle('web:read', async (_, url) => {
    return await webReader.read(url);
  });

  ipcMain.handle('link:preview', async (_, url) => {
    return await linkPreview.getPreview(url);
  });

  ipcMain.on('window:new', () => {
    const win = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 900,
      minHeight: 600,
      frame: false,
      webPreferences: {
        preload: path.join(__dirname, '..', '..', '..', 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false
      }
    });
    win.loadFile(path.join(__dirname, '..', '..', '..', 'src/renderer/index.html'));
  });

  ipcMain.handle('config:get', () => loadConfig());
  ipcMain.handle('config:set', (_, key, value) => {
    const config = loadConfig();
    config[key] = value;
    saveConfig(config);
    if (key === 'tavilyApiKey') webSearch.setApiKey(value);
    return config;
  });

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

  ipcMain.on('window:minimize', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize();
  });
  ipcMain.on('window:maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win?.isMaximized()) win.unmaximize();
    else win?.maximize();
  });
  ipcMain.on('window:close', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close();
  });
}

module.exports = { register };
