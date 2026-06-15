const { spawn } = require('child_process');
const os = require('os');
const iconv = require('iconv-lite');

function pipeAnsi(str) {
    return str.replace(/[\u001b\u009b][[()#;?]*([0-9;]*)[A-Za-z]/g, '')
        .replace(/[\u001b\u009b]\][^\u0007]*\u0007/g, '');
}

function decode(data, encoding) {
    if (encoding === 'cp936') {
        return iconv.decode(data, 'cp936');
    }
    return data.toString('utf8');
}

class ReplManager {
  constructor() {
    this.sessions = new Map();
  }

  spawn(lang, callback) {
    const spawnMap = {
      'cmd': { cmd: 'cmd.exe', args: [] },
      'powershell': { cmd: 'powershell.exe', args: ['-NoLogo'] },
      'python': { cmd: 'python', args: ['-i'] },
      'py': { cmd: 'python', args: ['-i'] },
      'node': { cmd: 'node', args: ['-i'] },
      'javascript': { cmd: 'node', args: ['-i'] },
      'js': { cmd: 'node', args: ['-i'] },
    };

    const config = spawnMap[lang] || spawnMap['cmd'];
    const child = spawn(config.cmd, config.args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: os.homedir(),
      env: process.env,
      shell: true
    });
    const encoding = (lang === 'cmd' || lang === 'powershell') ? 'cp936' : 'utf8';

    const id = 'repl_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    const session = { child, lang, outputBuffer: '', lastOutputTime: Date.now() };
    this.sessions.set(id, session);

    child.on('error', () => {});
    child.on('exit', () => {
      this.sessions.delete(id);
      try { if (callback) callback(id, '\r\n// 进程已退出\r\n'); } catch (e) {}
    });

    child.stdout.on('data', data => {
      const clean = pipeAnsi(decode(data, encoding));
      session.outputBuffer += clean;
      session.lastOutputTime = Date.now();
      if (callback) callback(id, clean);
    });

    child.stderr.on('data', data => {
      const clean = pipeAnsi(decode(data, encoding));
      session.outputBuffer += clean;
      session.lastOutputTime = Date.now();
      if (callback) callback(id, clean);
    });

    return id;
  }

  write(id, data) {
    const session = this.sessions.get(id);
    if (session && session.child) {
      try { session.child.stdin.write(data + '\r\n'); } catch (e) {}
    }
  }

  interrupt(id) {
    const session = this.sessions.get(id);
    if (session && session.child) {
      try { session.child.stdin.write('\x03'); } catch (e) {}
    }
  }

  resize(id, cols, rows) {}

  kill(id) {
    const session = this.sessions.get(id);
    if (session) {
      try { session.child.kill(); } catch (e) {}
      this.sessions.delete(id);
    }
  }

  getFirstActive() {
    return this.sessions.size > 0 ? this.sessions.keys().next().value : null;
  }

  execCommand(id, command) {
    const session = this.sessions.get(id);
    if (!session) throw new Error('控制台会话不可用，请先打开控制台（点击 📟 按钮）');

    session.outputBuffer = '';
    session.lastOutputTime = Date.now();
    try { session.child.stdin.write(command + '\r\n'); } catch (e) {
      this.sessions.delete(id);
      throw new Error('控制台会话已断开，请重新打开控制台');
    }

    return new Promise((resolve) => {
      const check = () => {
        if (Date.now() - session.lastOutputTime > 800) {
          resolve(session.outputBuffer.trim() || '(无输出)');
        } else {
          setTimeout(check, 200);
        }
      };
      setTimeout(check, 300);
    });
  }

  killAll() {
    for (const [id, session] of this.sessions) {
      try { session.child.kill(); } catch (e) {}
    }
    this.sessions.clear();
  }
}

module.exports = ReplManager;
