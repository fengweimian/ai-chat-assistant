const fs = require('fs');
const path = require('path');
const { app } = require('electron');

function register(ipcMain, { tools, loadMasks, saveMasks }) {
  ipcMain.handle('tools:generatePassword', (_, options) => {
    return tools.generatePassword(options);
  });

  ipcMain.handle('notes:list', () => tools.loadNotes());
  ipcMain.handle('notes:save', (_, title, content, tags) => tools.saveNote(title, content, tags));
  ipcMain.handle('notes:search', (_, keyword) => tools.searchNotes(keyword));
  ipcMain.handle('notes:delete', (_, id) => tools.deleteNote(id));

  ipcMain.handle('masks:getAll', () => loadMasks());
  ipcMain.handle('masks:add', (_, mask) => {
    const masks = loadMasks();
    mask.id = 'mask_' + Date.now();
    mask.isPreset = false;
    masks.push(mask);
    saveMasks(masks);
    return mask;
  });
  ipcMain.handle('masks:remove', (_, id) => {
    let masks = loadMasks();
    masks = masks.filter(m => m.id !== id || m.isPreset);
    saveMasks(masks);
  });

  ipcMain.on('notification:show', (_, { title, body }) => {
    tools.showNotification(title, body);
  });
}

module.exports = { register };
