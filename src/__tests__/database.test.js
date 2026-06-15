const os = require('os');
const path = require('path');
const fs = require('fs');

describe('DatabaseManager', () => {
  let DatabaseManager;
  let db;
  let testDbPath;

  beforeEach(async () => {
    DatabaseManager = require('../main/database');
    db = new DatabaseManager();
    testDbPath = path.join(os.tmpdir(), `test-${Date.now()}.db`);
  });

  afterEach(async () => {
    await db.disconnect();
    try { fs.unlinkSync(testDbPath); } catch (e) {}
  });

  describe('SQLite', () => {
    it('should connect to a new in-memory database', async () => {
      const result = await db.connect({ type: 'sqlite' });
      expect(result.type).toBe('sqlite');
      expect(result.tables).toEqual([]);
    });

    it('should create a table and query it', async () => {
      await db.connect({ type: 'sqlite' });
      await db.query('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)');
      await db.query("INSERT INTO users VALUES (1, 'Alice')");
      const result = await db.query('SELECT * FROM users');
      expect(result.columns).toEqual(['id', 'name']);
      expect(result.rows).toEqual([[1, 'Alice']]);
    });

    it('should persist to file and reload', async () => {
      await db.connect({ type: 'sqlite', filePath: testDbPath });
      await db.query('CREATE TABLE items (id INTEGER, value TEXT)');
      await db.query("INSERT INTO items VALUES (1, 'test')");
      db.saveSqlite();
      await db.disconnect();

      // Reconnect
      const db2 = new DatabaseManager();
      await db2.connect({ type: 'sqlite', filePath: testDbPath });
      const result = await db2.query('SELECT * FROM items');
      expect(result.rows).toEqual([[1, 'test']]);
      await db2.disconnect();
    });

    it('should list tables', async () => {
      await db.connect({ type: 'sqlite', filePath: testDbPath });
      await db.query('CREATE TABLE t1 (id INTEGER)');
      await db.query('CREATE TABLE t2 (id INTEGER)');
      db.saveSqlite();
      await db.disconnect();

      const db2 = new DatabaseManager();
      const result = await db2.connect({ type: 'sqlite', filePath: testDbPath });
      expect(result.tables).toContain('t1');
      expect(result.tables).toContain('t2');
      await db2.disconnect();
    });

    it('should report changes for INSERT/UPDATE/DELETE', async () => {
      await db.connect({ type: 'sqlite' });
      await db.query('CREATE TABLE test (id INTEGER, val TEXT)');
      await db.query("INSERT INTO test VALUES (1, 'a')");
      await db.query("INSERT INTO test VALUES (2, 'b')");
      const result = await db.query("UPDATE test SET val = 'c' WHERE id = 1");
      expect(result.changes).toBe(1);
    });
  });

  describe('detectInstalled', () => {
    it('should always detect SQLite as available', () => {
      const result = db.detectInstalled();
      const sqlite = result.find(d => d.type === 'sqlite');
      expect(sqlite).toBeTruthy();
      expect(sqlite.available).toBe(true);
    });

    it('should return array with sqlite, mysql, postgresql', () => {
      const result = db.detectInstalled();
      const types = result.map(d => d.type);
      expect(types).toContain('sqlite');
      expect(types).toContain('mysql');
      expect(types).toContain('postgresql');
    });
  });
});
