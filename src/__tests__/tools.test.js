const path = require('path');
const os = require('os');
const Tools = require('../main/tools');

describe('Tools', () => {
  let tools;

  beforeAll(() => {
    tools = new Tools();
  });

  describe('generatePassword', () => {
    it('should generate password with default length 16', () => {
      const result = tools.generatePassword();
      expect(result.password).toHaveLength(16);
      expect(result.length).toBe(16);
      expect(['weak', 'medium', 'strong']).toContain(result.strength);
    });

    it('should generate password with custom length', () => {
      const result = tools.generatePassword({ length: 32 });
      expect(result.password).toHaveLength(32);
      expect(result.length).toBe(32);
    });

    it('should generate strong password with length >= 12 and symbols', () => {
      const result = tools.generatePassword({ length: 20, symbols: true });
      expect(result.strength).toBe('strong');
    });

    it('should generate different passwords on each call', () => {
      const r1 = tools.generatePassword();
      const r2 = tools.generatePassword();
      expect(r1.password).not.toBe(r2.password);
    });
  });

  describe('notes CRUD', () => {
    it('should save and load a note', () => {
      const note = tools.saveNote('Test Title', 'Test Content', ['tag1']);
      expect(note.title).toBe('Test Title');
      expect(note.content).toBe('Test Content');
      expect(note.tags).toEqual(['tag1']);
      expect(note.id).toMatch(/^note_/);

      const notes = tools.loadNotes();
      const found = notes.find(n => n.id === note.id);
      expect(found).toBeTruthy();
      expect(found.title).toBe('Test Title');

      tools.deleteNote(note.id);
    });

    it('should search notes by keyword', () => {
      tools.saveNote('Searchable Note', 'UniqueContent123', []);
      const results = tools.searchNotes('UniqueContent123');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.some(n => n.content.includes('UniqueContent123'))).toBe(true);

      results.forEach(n => tools.deleteNote(n.id));
    });

    it('should delete a note', () => {
      const note = tools.saveNote('To Delete', 'content', []);
      tools.deleteNote(note.id);
      const notes = tools.loadNotes();
      expect(notes.find(n => n.id === note.id)).toBeUndefined();
    });
  });

  describe('isDestructiveSQL', () => {
    it('should detect DROP TABLE', () => {
      expect(tools.isDestructiveSQL('DROP TABLE users')).toBe(true);
    });

    it('should detect DELETE', () => {
      expect(tools.isDestructiveSQL('DELETE FROM users WHERE id = 1')).toBe(true);
    });

    it('should detect TRUNCATE', () => {
      expect(tools.isDestructiveSQL('TRUNCATE TABLE users')).toBe(true);
    });

    it('should detect ALTER', () => {
      expect(tools.isDestructiveSQL('ALTER TABLE users ADD COLUMN age INT')).toBe(true);
    });

    it('should detect UPDATE', () => {
      expect(tools.isDestructiveSQL('UPDATE users SET name = "test"')).toBe(true);
    });

    it('should detect INSERT', () => {
      expect(tools.isDestructiveSQL('INSERT INTO users VALUES (1, "test")')).toBe(true);
    });

    it('should not flag SELECT', () => {
      expect(tools.isDestructiveSQL('SELECT * FROM users')).toBe(false);
    });

    it('should not flag SHOW', () => {
      expect(tools.isDestructiveSQL('SHOW TABLES')).toBe(false);
    });

    it('should not flag DESCRIBE', () => {
      expect(tools.isDestructiveSQL('DESCRIBE users')).toBe(false);
    });
  });
});
