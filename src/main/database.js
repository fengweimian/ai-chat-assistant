const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { execSync } = require('child_process');

class DatabaseManager {
  constructor() {
    this.SQL = null;
    this.currentDb = null;
    this.currentType = null;
    this.currentFilePath = null;
    this.mysqlConnection = null;
    this.pgClient = null;
  }

  detectInstalled() {
    const results = [];
    results.push({ type: 'sqlite', name: 'SQLite (内置)', available: true, needsAuth: false });

    try {
      execSync('mysql --version', { stdio: 'pipe', timeout: 3000 });
      results.push({ type: 'mysql', name: 'MySQL', available: true, needsAuth: true });
    } catch (e) {
      results.push({ type: 'mysql', name: 'MySQL (未检测到)', available: false, needsAuth: true });
    }

    try {
      execSync('psql --version', { stdio: 'pipe', timeout: 3000 });
      results.push({ type: 'postgresql', name: 'PostgreSQL', available: true, needsAuth: true });
    } catch (e) {
      results.push({ type: 'postgresql', name: 'PostgreSQL (未检测到)', available: false, needsAuth: true });
    }

    return results;
  }

  scanSqliteFiles() {
    const searchDirs = [app.getPath('desktop'), app.getPath('documents'), app.getPath('home')];
    const extensions = ['.db', '.sqlite', '.sqlite3'];
    const results = [];
    for (const dir of searchDirs) {
      this.scanDir(dir, extensions, results, 0, 2);
    }
    return results;
  }

  scanDir(dir, extensions, results, depth, maxDepth) {
    if (depth > maxDepth || results.length > 50) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
          try {
            const stats = fs.statSync(fullPath);
            results.push({ path: fullPath, name: entry.name, size: stats.size });
          } catch (e) {}
        } else if (entry.isDirectory() && depth < maxDepth) {
          this.scanDir(fullPath, extensions, results, depth + 1, maxDepth);
        }
      }
    } catch (e) {}
  }

  async connect(config) {
    await this.disconnect();
    this.currentType = config.type;

    if (config.type === 'sqlite') {
      return await this.connectSqlite(config.filePath);
    } else if (config.type === 'mysql') {
      return await this.connectMysql(config);
    } else if (config.type === 'postgresql') {
      return await this.connectPostgresql(config);
    }
    throw new Error(`不支持的数据库类型: ${config.type}`);
  }

  async connectSqlite(filePath) {
    if (!this.SQL) {
      const initSqlJs = require('sql.js');
      this.SQL = await initSqlJs();
    }
    if (filePath && fs.existsSync(filePath)) {
      const buffer = fs.readFileSync(filePath);
      this.currentDb = new this.SQL.Database(new Uint8Array(buffer));
    } else {
      this.currentDb = new this.SQL.Database();
    }
    this.currentFilePath = filePath;
    const tables = this.currentDb.exec("SELECT name FROM sqlite_master WHERE type='table'");
    return { type: 'sqlite', tables: tables.length > 0 ? tables[0].values.map(r => r[0]) : [] };
  }

  async connectMysql(config) {
    const mysql = require('mysql2/promise');
    this.mysqlConnection = await mysql.createConnection({
      host: config.host || 'localhost',
      port: config.port || 3306,
      user: config.user,
      password: config.password,
      database: config.database
    });
    const [rows] = await this.mysqlConnection.query('SHOW TABLES');
    const tables = rows.map(r => Object.values(r)[0]);
    return { type: 'mysql', tables };
  }

  async connectPostgresql(config) {
    const { Client } = require('pg');
    this.pgClient = new Client({
      host: config.host || 'localhost',
      port: config.port || 5432,
      user: config.user,
      password: config.password,
      database: config.database
    });
    await this.pgClient.connect();
    const res = await this.pgClient.query("SELECT tablename FROM pg_tables WHERE schemaname='public'");
    const tables = res.rows.map(r => r.tablename);
    return { type: 'postgresql', tables };
  }

  async query(sql) {
    if (this.currentType === 'sqlite') return this.querySqlite(sql);
    if (this.currentType === 'mysql') return await this.queryMysql(sql);
    if (this.currentType === 'postgresql') return await this.queryPostgresql(sql);
    throw new Error('未连接数据库');
  }

  querySqlite(sql) {
    if (!this.currentDb) throw new Error('未连接数据库');
    const result = this.currentDb.exec(sql);
    if (result.length === 0) return { columns: [], rows: [], changes: this.currentDb.getRowsModified() };
    return { columns: result[0].columns, rows: result[0].values };
  }

  async queryMysql(sql) {
    if (!this.mysqlConnection) throw new Error('未连接数据库');
    const [rows, fields] = await this.mysqlConnection.query(sql);
    if (Array.isArray(rows) && fields) {
      return { columns: fields.map(f => f.name), rows: rows.map(r => Object.values(r)) };
    }
    return { columns: [], rows: [], changes: rows.affectedRows || 0 };
  }

  async queryPostgresql(sql) {
    if (!this.pgClient) throw new Error('未连接数据库');
    const res = await this.pgClient.query(sql);
    if (res.fields && res.rows) {
      return { columns: res.fields.map(f => f.name), rows: res.rows.map(r => Object.values(r)) };
    }
    return { columns: [], rows: [], changes: res.rowCount || 0 };
  }

  saveSqlite() {
    if (this.currentType === 'sqlite' && this.currentDb && this.currentFilePath) {
      const data = this.currentDb.export();
      fs.writeFileSync(this.currentFilePath, Buffer.from(data));
    }
  }

  async createSqliteDatabase(name) {
    if (!this.SQL) {
      const initSqlJs = require('sql.js');
      this.SQL = await initSqlJs();
    }
    const filePath = path.join(app.getPath('documents'), `${name}.db`);
    await this.disconnect();
    this.currentDb = new this.SQL.Database();
    this.currentType = 'sqlite';
    this.currentFilePath = filePath;
    this.saveSqlite();
    return { path: filePath };
  }

  async disconnect() {
    if (this.currentType === 'sqlite' && this.currentDb) {
      this.saveSqlite();
      this.currentDb.close();
      this.currentDb = null;
    }
    if (this.mysqlConnection) {
      await this.mysqlConnection.end();
      this.mysqlConnection = null;
    }
    if (this.pgClient) {
      await this.pgClient.end();
      this.pgClient = null;
    }
    this.currentType = null;
    this.currentFilePath = null;
  }
}

module.exports = DatabaseManager;
