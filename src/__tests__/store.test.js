const fs = require('fs');
const path = require('path');
const os = require('os');
const Store = require('../main/store');

describe('Store', () => {
  let store;
  let testDir;

  beforeEach(() => {
    testDir = path.join(os.tmpdir(), `store-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    fs.mkdirSync(testDir, { recursive: true });

    store = new Store();
    store.dataDir = testDir;
    store.filePath = path.join(testDir, 'conversations.json');
    store.conversations = [];
  });

  afterEach(() => {
    if (store) {
      clearTimeout(store._saveTimer);
      store._doSave();
    }
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch (e) {}
  });

  describe('create', () => {
    it('should create a new conversation', () => {
      const conv = store.create('Test Chat');
      expect(conv.title).toBe('Test Chat');
      expect(conv.id).toMatch(/^conv_/);
      expect(conv.messages).toEqual([]);
      expect(conv.settings.model).toBe('gpt-5.5');
    });

    it('should add conversation to the list', () => {
      store.create('Chat 1');
      store.create('Chat 2');
      const all = store.getAll();
      expect(all.length).toBe(2);
      expect(all[0].title).toBe('Chat 2');
    });
  });

  describe('getById', () => {
    it('should find conversation by id', () => {
      const conv = store.create('Findable');
      const found = store.getById(conv.id);
      expect(found.title).toBe('Findable');
    });

    it('should return undefined for non-existent id', () => {
      expect(store.getById('nonexistent')).toBeUndefined();
    });
  });

  describe('addMessage', () => {
    it('should add a message to a conversation', () => {
      const conv = store.create('Chat');
      store.addMessage(conv.id, { role: 'user', content: 'Hello' });
      const updated = store.getById(conv.id);
      expect(updated.messages.length).toBe(1);
      expect(updated.messages[0].role).toBe('user');
      expect(updated.messages[0].content).toBe('Hello');
      expect(updated.messages[0].id).toMatch(/^msg_/);
    });
  });

  describe('removeLastMessage', () => {
    it('should remove the last message', () => {
      const conv = store.create('Chat');
      store.addMessage(conv.id, { role: 'user', content: 'msg1' });
      store.addMessage(conv.id, { role: 'assistant', content: 'msg2' });
      store.removeLastMessage(conv.id);
      const updated = store.getById(conv.id);
      expect(updated.messages.length).toBe(1);
      expect(updated.messages[0].content).toBe('msg1');
    });
  });

  describe('delete', () => {
    it('should delete a conversation', () => {
      const conv = store.create('To Delete');
      store.delete(conv.id);
      expect(store.getById(conv.id)).toBeUndefined();
      expect(store.getAll().length).toBe(0);
    });
  });

  describe('update', () => {
    it('should update conversation fields', () => {
      const conv = store.create('Original');
      store.update(conv.id, { title: 'Updated' });
      const updated = store.getById(conv.id);
      expect(updated.title).toBe('Updated');
    });
  });

  describe('flush', () => {
    it('should persist data to disk immediately', () => {
      store.create('Flushed');
      store.flush();
      const raw = fs.readFileSync(store.filePath, 'utf-8');
      const data = JSON.parse(raw);
      expect(data.length).toBe(1);
      expect(data[0].title).toBe('Flushed');
    });
  });
});
