const { net } = require('electron');

function register(ipcMain, { modelStore, imageGenerator }) {
  ipcMain.handle('models:testConnection', async (_, baseUrl, apiKey) => {
    try {
      let base = baseUrl.replace(/\/+$/, '');
      if (!base.endsWith('/v1')) base += '/v1';
      const response = await net.fetch(base + '/models', {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      return { ok: response.ok, status: response.status };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('models:getAll', () => modelStore.getAll());
  ipcMain.handle('models:add', (_, model) => modelStore.add(model));
  ipcMain.handle('models:update', (_, id, updates) => modelStore.update(id, updates));
  ipcMain.handle('models:remove', (_, id) => modelStore.remove(id));
  ipcMain.handle('models:setDefault', (_, id) => modelStore.setDefault(id));
  ipcMain.handle('models:getById', (_, id) => modelStore.getById(id));

  ipcMain.handle('image:generate', async (_, modelId, prompt, refImages) => {
    const model = modelStore.getById(modelId);
    if (!model) throw new Error('Model not found');
    try {
      return await imageGenerator.generate(model, prompt, refImages || []);
    } catch (e) {
      throw new Error(`生图失败: ${e.message}`);
    }
  });
}

module.exports = { register };
