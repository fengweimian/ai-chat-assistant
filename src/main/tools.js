const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { app, Notification, dialog } = require('electron');

class Tools {
  constructor() {
    this.dataDir = path.join(app.getPath('userData'), 'data');
    this.notesPath = path.join(this.dataDir, 'notes.json');
    if (!fs.existsSync(this.dataDir)) fs.mkdirSync(this.dataDir, { recursive: true });
  }

  generatePassword(options = {}) {
    const { length = 16, uppercase = true, lowercase = true, numbers = true, symbols = true } = options;
    let chars = '';
    if (uppercase) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (lowercase) chars += 'abcdefghijklmnopqrstuvwxyz';
    if (numbers) chars += '0123456789';
    if (symbols) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';
    if (!chars) chars = 'abcdefghijklmnopqrstuvwxyz0123456789';

    const bytes = crypto.randomBytes(length);
    let password = '';
    for (let i = 0; i < length; i++) {
      password += chars[bytes[i] % chars.length];
    }

    let strength = 'weak';
    if (length >= 12 && chars.length > 50) strength = 'strong';
    else if (length >= 8 && chars.length > 30) strength = 'medium';

    return { password, strength, length };
  }

  loadNotes() {
    try {
      if (fs.existsSync(this.notesPath)) return JSON.parse(fs.readFileSync(this.notesPath, 'utf-8'));
    } catch (e) {}
    return [];
  }

  saveNotes(notes) {
    fs.writeFileSync(this.notesPath, JSON.stringify(notes, null, 2), 'utf-8');
  }

  saveNote(title, content, tags = []) {
    const notes = this.loadNotes();
    const note = { id: 'note_' + Date.now(), title, content, tags, createdAt: Date.now() };
    notes.unshift(note);
    this.saveNotes(notes);
    return note;
  }

  searchNotes(keyword) {
    const notes = this.loadNotes();
    if (!keyword) return notes.slice(0, 20);
    const lower = keyword.toLowerCase();
    return notes.filter(n =>
      n.title.toLowerCase().includes(lower) ||
      n.content.toLowerCase().includes(lower) ||
      (n.tags && n.tags.some(t => t.toLowerCase().includes(lower)))
    );
  }

  deleteNote(id) {
    const notes = this.loadNotes();
    const filtered = notes.filter(n => n.id !== id);
    this.saveNotes(filtered);
  }

  showNotification(title, body) {
    if (Notification.isSupported()) {
      new Notification({ title, body }).show();
    }
  }

  async confirmSendEmail(mainWindow, to, subject) {
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'question',
      buttons: ['发送', '取消'],
      title: '确认发送邮件',
      message: `确认发送邮件？\n收件人: ${to}\n主题: ${subject}`
    });
    return result.response === 0;
  }

  isDestructiveSQL(sql) {
    const normalized = sql.trim().toUpperCase();
    const destructivePattern = /^\s*(DROP|DELETE|TRUNCATE|ALTER|UPDATE|INSERT|CREATE|REPLACE)\b/;
    return destructivePattern.test(normalized);
  }

  async confirmSqlExecution(mainWindow, sql) {
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      buttons: ['执行', '取消'],
      title: '确认执行 SQL',
      message: `AI 请求执行以下 SQL 语句：\n\n${sql.substring(0, 500)}${sql.length > 500 ? '...' : ''}\n\n是否允许执行？`
    });
    return result.response === 0;
  }
}

module.exports = Tools;
