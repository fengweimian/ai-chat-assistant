const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class Store {
  constructor() {
    this.dataDir = path.join(app.getPath('userData'), 'data');
    this.filePath = path.join(this.dataDir, 'conversations.json');
    this.conversations = [];
    this._saveTimer = null;
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        this.conversations = JSON.parse(raw);
      }
    } catch (e) {
      console.error('Failed to load conversations:', e);
      this.conversations = [];
    }
  }

  save() {
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this._doSave(), 300);
  }

  _doSave() {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
      const tmp = this.filePath + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(this.conversations, null, 2), 'utf-8');
      fs.renameSync(tmp, this.filePath);
    } catch (e) {
      console.error('Failed to save conversations:', e);
    }
  }

  flush() {
    clearTimeout(this._saveTimer);
    this._doSave();
  }

  getAll() {
    return this.conversations;
  }

  getById(id) {
    return this.conversations.find(c => c.id === id);
  }

  create(title = '新对话') {
    const conv = {
      id: 'conv_' + Date.now(),
      title,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      settings: {
        model: 'gpt-5.5',
        webSearch: true,
        thinkingLevel: 'medium',
        temperature: 0.7
      },
      messages: []
    };
    this.conversations.unshift(conv);
    this.save();
    return conv;
  }

  update(id, updates) {
    const conv = this.getById(id);
    if (conv) {
      Object.assign(conv, updates, { updatedAt: Date.now() });
      this.save();
    }
    return conv;
  }

  addMessage(convId, message) {
    const conv = this.getById(convId);
    if (conv) {
      conv.messages.push({
        id: 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        ...message,
        timestamp: Date.now()
      });
      conv.updatedAt = Date.now();
      this.save();
    }
  }

  removeLastMessage(convId) {
    const conv = this.getById(convId);
    if (conv && conv.messages.length > 0) {
      conv.messages.pop();
      conv.updatedAt = Date.now();
      this.save();
    }
    return conv;
  }

  delete(id) {
    this.conversations = this.conversations.filter(c => c.id !== id);
    this.save();
  }
}

module.exports = Store;
