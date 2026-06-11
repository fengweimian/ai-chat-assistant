const fs = require('fs');
const path = require('path');

class Store {
  constructor() {
    this.dataDir = path.join(__dirname, '../../data');
    this.filePath = path.join(this.dataDir, 'conversations.json');
    this.conversations = [];
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
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.conversations, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to save conversations:', e);
    }
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

  delete(id) {
    this.conversations = this.conversations.filter(c => c.id !== id);
    this.save();
  }
}

module.exports = Store;
