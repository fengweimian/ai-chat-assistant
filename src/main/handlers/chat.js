function register(ipcMain, { apiClient, store, modelStore }) {
  ipcMain.on('chat:stop', () => {
    apiClient.abort();
  });

  ipcMain.on('chat:send', (event, { conversationId, content, images, docNames, docPaths, imagePaths }) => {
    const conversation = store.getById(conversationId);
    if (!conversation) {
      event.sender.send('chat:error', 'Conversation not found');
      return;
    }

    const settingModel = conversation.settings?.model;
    let modelConfig = null;
    if (settingModel) {
      modelConfig = modelStore.getById(settingModel)
        || modelStore.getAll().find(m => m.modelId === settingModel)
        || modelStore.getDefault();
    } else {
      modelConfig = modelStore.getDefault();
    }

    apiClient._conversation = {
      ...conversation,
      messages: [
        ...conversation.messages,
        { role: 'user', content, images, docNames: docNames || [], docPaths: docPaths || [], imagePaths: imagePaths || [] }
      ]
    };

    apiClient.streamChat(
      conversation,
      content,
      images,
      docNames,
      docPaths,
      (chunk) => event.sender.send('chat:chunk', { conversationId, chunk }),
      (fullContent, fullThinking) => event.sender.send('chat:done', { conversationId, fullContent, fullThinking }),
      (error) => event.sender.send('chat:error', { conversationId, error }),
      modelConfig,
      (thinkingChunk) => event.sender.send('chat:thinking', { conversationId, thinkingChunk }),
      (query) => event.sender.send('chat:searching', { conversationId, query }),
      (usage) => event.sender.send('chat:usage', { conversationId, usage }),
      (file) => event.sender.send('chat:fileCreated', { conversationId, file })
    );
  });

  ipcMain.on('settings:update', (_, settings) => {
    apiClient.configure(settings.baseUrl, settings.apiKey);
  });
}

module.exports = { register };
