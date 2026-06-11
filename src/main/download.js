const { dialog, shell } = require('electron');
const fs = require('fs');
const path = require('path');

class DownloadManager {
  async saveFile(sourcePath, suggestedName) {
    const result = await dialog.showSaveDialog({
      defaultPath: suggestedName || path.basename(sourcePath),
      filters: [
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (!result.canceled && result.filePath) {
      fs.copyFileSync(sourcePath, result.filePath);
      return { success: true, path: result.filePath };
    }
    return { success: false };
  }

  openInExplorer(filePath) {
    shell.showItemInFolder(filePath);
  }
}

module.exports = DownloadManager;
