const fs = require('fs');
const path = require('path');

class FileSystem {
  writeFile(filePath, content, overwrite = false) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (fs.existsSync(filePath) && !overwrite) {
      throw new Error(`文件已存在: ${filePath}。如需覆盖请设置 overwrite: true`);
    }
    fs.writeFileSync(filePath, content, 'utf-8');
    return filePath;
  }

  createFolder(dirPath) {
    if (fs.existsSync(dirPath)) {
      return `${dirPath}（已存在）`;
    }
    fs.mkdirSync(dirPath, { recursive: true });
    return dirPath;
  }
}

module.exports = FileSystem;
