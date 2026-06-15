function register(ipcMain, { databaseManager }) {
  ipcMain.handle('db:detect', () => databaseManager.detectInstalled());
  ipcMain.handle('db:scan', () => databaseManager.scanSqliteFiles());
  ipcMain.handle('db:connect', async (_, config) => databaseManager.connect(config));
  ipcMain.handle('db:query', async (_, sql) => databaseManager.query(sql));
  ipcMain.handle('db:create', async (_, name) => databaseManager.createSqliteDatabase(name));
  ipcMain.handle('db:disconnect', async () => databaseManager.disconnect());
}

module.exports = { register };
