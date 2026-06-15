const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Conversations
  conversations: {
    getAll: () => ipcRenderer.invoke('conversations:getAll'),
    getById: (id) => ipcRenderer.invoke('conversations:getById', id),
    create: (title) => ipcRenderer.invoke('conversations:create', title),
    update: (id, updates) => ipcRenderer.invoke('conversations:update', id, updates),
    addMessage: (convId, message) => ipcRenderer.invoke('conversations:addMessage', convId, message),
    delete: (id) => ipcRenderer.invoke('conversations:delete', id),
    removeLastMessage: (convId) => ipcRenderer.invoke('conversations:removeLastMessage', convId)
  },
  // Chat
  chat: {
    send: (data) => ipcRenderer.send('chat:send', data),
    stop: () => ipcRenderer.send('chat:stop'),
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
    onThinking: (callback) => {
      const handler = (_, data) => callback(data);
      ipcRenderer.on('chat:thinking', handler);
      return () => ipcRenderer.removeListener('chat:thinking', handler);
    },
    onSearching: (callback) => {
      const handler = (_, data) => callback(data);
      ipcRenderer.on('chat:searching', handler);
      return () => ipcRenderer.removeListener('chat:searching', handler);
    },
    onUsage: (callback) => {
      const handler = (_, data) => callback(data);
      ipcRenderer.on('chat:usage', handler);
      return () => ipcRenderer.removeListener('chat:usage', handler);
    },
    onFileCreated: (callback) => {
      const handler = (_, data) => callback(data);
      ipcRenderer.on('chat:fileCreated', handler);
      return () => ipcRenderer.removeListener('chat:fileCreated', handler);
    },
    onError: (callback) => {
      const handler = (_, data) => callback(data);
      ipcRenderer.on('chat:error', handler);
      return () => ipcRenderer.removeListener('chat:error', handler);
    }
  },
  // App
  app: {
    getDataPath: () => ipcRenderer.invoke('app:getDataPath')
  },
  // OCR
  ocr: {
    recognize: (imagePath) => ipcRenderer.invoke('ocr:recognize', imagePath),
    onProgress: (callback) => {
      const handler = (_, data) => callback(data);
      ipcRenderer.on('ocr:progress', handler);
      return () => ipcRenderer.removeListener('ocr:progress', handler);
    }
  },
  // LibreOffice
  libreoffice: {
    install: () => ipcRenderer.invoke('libreoffice:install'),
    status: () => ipcRenderer.invoke('libreoffice:status'),
    setPath: (path) => ipcRenderer.invoke('libreoffice:setPath', path),
    cleanInstaller: () => ipcRenderer.invoke('libreoffice:cleanInstaller')
  },
  // File preview
  filePreview: {
    preview: (filePath) => ipcRenderer.invoke('file:preview', filePath)
  },
  // File creation
  fileCreate: {
    docx: (filename, content) => ipcRenderer.invoke('file:createDocx', filename, content),
    xlsx: (filename, sheets) => ipcRenderer.invoke('file:createXlsx', filename, sheets),
    pdf: (filename, content) => ipcRenderer.invoke('file:createPdf', filename, content),
    mergePdfs: (files, outputName) => ipcRenderer.invoke('file:mergePdfs', files, outputName),
    pptx: (pptData) => ipcRenderer.invoke('file:createPptx', pptData)
  },
  // REPL
  repl: {
    spawn: (lang) => ipcRenderer.invoke('repl:spawn', lang),
    write: (sessionId, data) => ipcRenderer.send('repl:write', { sessionId, data }),
    interrupt: (sessionId) => ipcRenderer.send('repl:interrupt', sessionId),
    kill: (sessionId) => ipcRenderer.invoke('repl:kill', sessionId),
    onData: (callback) => {
      const handler = (_, data) => callback(data);
      ipcRenderer.on('repl:data', handler);
      return () => ipcRenderer.removeListener('repl:data', handler);
    }
  },
  // Code execution
  code: {
    run: (lang, code) => ipcRenderer.invoke('code:run', lang, code),
    runStream: (lang, code, streamId) => ipcRenderer.invoke('code:runStream', lang, code, streamId),
    onStreamChunk: (callback) => {
      const handler = (_, data) => callback(data);
      ipcRenderer.on('code:streamChunk', handler);
      return () => ipcRenderer.removeListener('code:streamChunk', handler);
    }
  },
  // Tools
  tools: {
    generatePassword: (options) => ipcRenderer.invoke('tools:generatePassword', options)
  },
  // Notes
  notes: {
    list: () => ipcRenderer.invoke('notes:list'),
    save: (title, content, tags) => ipcRenderer.invoke('notes:save', title, content, tags),
    search: (keyword) => ipcRenderer.invoke('notes:search', keyword),
    delete: (id) => ipcRenderer.invoke('notes:delete', id)
  },
  // Masks
  masks: {
    getAll: () => ipcRenderer.invoke('masks:getAll'),
    add: (mask) => ipcRenderer.invoke('masks:add', mask),
    remove: (id) => ipcRenderer.invoke('masks:remove', id)
  },
  // Database
  db: {
    detect: () => ipcRenderer.invoke('db:detect'),
    scan: () => ipcRenderer.invoke('db:scan'),
    connect: (config) => ipcRenderer.invoke('db:connect', config),
    query: (sql) => ipcRenderer.invoke('db:query', sql),
    create: (name) => ipcRenderer.invoke('db:create', name),
    disconnect: () => ipcRenderer.invoke('db:disconnect')
  },
  // Email
  email: {
    configure: (config) => ipcRenderer.invoke('email:configure', config),
    read: (folder, count) => ipcRenderer.invoke('email:read', folder, count),
    send: (to, subject, body) => ipcRenderer.invoke('email:send', to, subject, body)
  },
  // Notification
  notify: (title, body) => ipcRenderer.send('notification:show', { title, body }),
  // Web reading
  web: {
    read: (url) => ipcRenderer.invoke('web:read', url)
  },
  // Link preview
  link: {
    preview: (url) => ipcRenderer.invoke('link:preview', url)
  },
  // Config
  config: {
    get: () => ipcRenderer.invoke('config:get'),
    set: (key, value) => ipcRenderer.invoke('config:set', key, value)
  },
  // Avatar
  avatar: {
    set: (filePath) => ipcRenderer.invoke('avatar:set', filePath),
    get: () => ipcRenderer.invoke('avatar:get')
  },
  // Models
  models: {
    testConnection: (baseUrl, apiKey) => ipcRenderer.invoke('models:testConnection', baseUrl, apiKey),
    getAll: () => ipcRenderer.invoke('models:getAll'),
    getById: (id) => ipcRenderer.invoke('models:getById', id),
    add: (model) => ipcRenderer.invoke('models:add', model),
    update: (id, updates) => ipcRenderer.invoke('models:update', id, updates),
    remove: (id) => ipcRenderer.invoke('models:remove', id),
    setDefault: (id) => ipcRenderer.invoke('models:setDefault', id)
  },
  // Image generation
  image: {
    generate: (modelId, prompt, refImages) => ipcRenderer.invoke('image:generate', modelId, prompt, refImages)
  },
  // Export
  export: {
    markdown: (convId) => ipcRenderer.invoke('export:markdown', convId),
    pdf: (convId) => ipcRenderer.invoke('export:pdf', convId),
    docx: (convId) => ipcRenderer.invoke('export:docx', convId)
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
    openDialog: () => ipcRenderer.invoke('file:openDialog'),
    readImage: (filePath) => ipcRenderer.invoke('file:readImage', filePath),
    parse: (filePath) => ipcRenderer.invoke('file:parse', filePath),
    save: (sourcePath, suggestedName) => ipcRenderer.invoke('file:save', sourcePath, suggestedName),
    openLocation: (filePath) => ipcRenderer.invoke('file:openLocation', filePath),
    copyToData: (sourcePath) => ipcRenderer.invoke('file:copyToData', sourcePath)
  },
  // Window controls
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
    newWindow: () => ipcRenderer.send('window:new')
  }
});
