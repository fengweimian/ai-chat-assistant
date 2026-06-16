const fs = require('fs');
const path = require('path');
const { app, dialog } = require('electron');

function register(ipcMain, { fileCreator, fileParser, filePreviewHandler, downloadManager, mainWindow }) {
  ipcMain.handle('file:copyToData', async (_, sourcePath) => {
    const destDir = path.join(app.getPath('userData'), 'data', 'files');
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    const dest = path.join(destDir, path.basename(sourcePath));
    if (!fs.existsSync(dest)) fs.copyFileSync(sourcePath, dest);
    return dest;
  });

  ipcMain.handle('file:saveBuffer', async (_, fileName, arrayBuffer) => {
    const destDir = path.join(app.getPath('userData'), 'data', 'files');
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    const dest = path.join(destDir, fileName);
    fs.writeFileSync(dest, Buffer.from(arrayBuffer));
    return dest;
  });

  ipcMain.handle('file:saveImage', async (_, dataUrl, fileName) => {
    const destDir = path.join(app.getPath('userData'), 'data', 'files');
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
    const ext = path.extname(fileName) || '.png';
    const safeName = `img_${Date.now()}_${Math.random().toString(36).slice(2, 5)}${ext}`;
    const dest = path.join(destDir, safeName);
    fs.writeFileSync(dest, Buffer.from(base64, 'base64'));
    return dest;
  });

  ipcMain.handle('file:preview', async (_, filePath) => {
    return await filePreviewHandler.preview(filePath);
  });

  ipcMain.handle('file:createDocx', async (_, filename, content) => fileCreator.createDocx(filename, content));
  ipcMain.handle('file:createXlsx', async (_, filename, sheets) => fileCreator.createXlsx(filename, sheets));
  ipcMain.handle('file:createPdf', async (_, filename, content) => fileCreator.createPdf(filename, content));
  ipcMain.handle('file:mergePdfs', async (_, files, outputName) => fileCreator.mergePdfs(files, outputName));
  ipcMain.handle('file:createPptx', async (_, pptData) => fileCreator.createPptx(pptData));

  ipcMain.handle('file:readImage', async (_, filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    const mimeMap = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp' };
    const mime = mimeMap[ext] || 'image/png';
    const buffer = fs.readFileSync(filePath);
    return `data:${mime};base64,${buffer.toString('base64')}`;
  });

  ipcMain.handle('file:openDialog', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: '文档', extensions: ['docx', 'doc', 'xlsx', 'xls', 'csv', 'pptx', 'ppt', 'pdf', 'txt', 'md', 'json'] },
        { name: '图片', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    });
    if (result.canceled) return [];
    return result.filePaths;
  });

  ipcMain.handle('file:parse', async (_, filePath) => {
    try {
      return await fileParser.parse(filePath);
    } catch (e) {
      throw new Error(`文件解析失败: ${e.message}`);
    }
  });

  ipcMain.handle('file:save', async (_, sourcePath, suggestedName) => {
    return await downloadManager.saveFile(sourcePath, suggestedName);
  });

  ipcMain.handle('file:openLocation', (_, filePath) => {
    downloadManager.openInExplorer(filePath);
  });
}

module.exports = { register };
