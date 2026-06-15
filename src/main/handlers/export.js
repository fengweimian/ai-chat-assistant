function register(ipcMain, { store, exporter, mainWindow }) {
  ipcMain.handle('export:markdown', async (_, conversationId) => {
    const conv = store.getById(conversationId);
    if (!conv) throw new Error('Conversation not found');
    return await exporter.exportMarkdown(conv);
  });

  ipcMain.handle('export:pdf', async (_, conversationId) => {
    const conv = store.getById(conversationId);
    if (!conv) throw new Error('Conversation not found');
    return await exporter.exportPdf(conv, mainWindow);
  });

  ipcMain.handle('export:docx', async (_, conversationId) => {
    const conv = store.getById(conversationId);
    if (!conv) throw new Error('Conversation not found');
    return await exporter.exportDocx(conv);
  });
}

module.exports = { register };
