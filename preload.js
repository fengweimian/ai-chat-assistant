const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Conversations
  conversations: {
    getAll: () => ipcRenderer.invoke('conversations:getAll'),
    getById: (id) => ipcRenderer.invoke('conversations:getById', id),
    create: (title) => ipcRenderer.invoke('conversations:create', title),
    update: (id, updates) => ipcRenderer.invoke('conversations:update', id, updates),
    addMessage: (convId, message) => ipcRenderer.invoke('conversations:addMessage', convId, message),
    delete: (id) => ipcRenderer.invoke('conversations:delete', id)
  },
  // Window controls
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close')
  }
});
