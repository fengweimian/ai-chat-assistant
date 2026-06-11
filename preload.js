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
  // Chat
  chat: {
    send: (data) => ipcRenderer.send('chat:send', data),
    onChunk: (callback) => {
      const handler = (_, data) => callback(data);
      ipcRenderer.on('chat:chunk', handler);
      return () => ipcRenderer.removeListener('chat:chunk', handler);
    },
    onDone: (callback) => {
      const handler = (_, data) => callback(data);
      ipcRenderer.on('chat:done', handler);
      return () => ipcRenderer.removeListener('chat:done', handler);
    },
    onError: (callback) => {
      const handler = (_, data) => callback(data);
      ipcRenderer.on('chat:error', handler);
      return () => ipcRenderer.removeListener('chat:error', handler);
    }
  },
  // Settings
  updateSettings: (settings) => ipcRenderer.send('settings:update', settings),
  // PPT
  ppt: {
    generate: (data) => ipcRenderer.invoke('ppt:generate', data),
    detect: (text) => ipcRenderer.invoke('ppt:detect', text)
  },
  // File
  file: {
    save: (sourcePath, suggestedName) => ipcRenderer.invoke('file:save', sourcePath, suggestedName),
    openLocation: (filePath) => ipcRenderer.invoke('file:openLocation', filePath)
  },
  // Window controls
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close')
  }
});
