function register(ipcMain, { store }) {
  ipcMain.handle('conversations:getAll', () => store.getAll());
  ipcMain.handle('conversations:getById', (_, id) => store.getById(id));
  ipcMain.handle('conversations:create', (_, title) => store.create(title));
  ipcMain.handle('conversations:update', (_, id, updates) => store.update(id, updates));
  ipcMain.handle('conversations:addMessage', (_, convId, message) => store.addMessage(convId, message));
  ipcMain.handle('conversations:delete', (_, id) => store.delete(id));
  ipcMain.handle('conversations:removeLastMessage', (_, convId) => store.removeLastMessage(convId));
}

module.exports = { register };
