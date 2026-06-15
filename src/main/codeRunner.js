const vm = require('vm');
const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

class CodeRunner {
  constructor() {
    this.tempDir = path.join(os.tmpdir(), 'ai-chat-code');
    if (!fs.existsSync(this.tempDir)) fs.mkdirSync(this.tempDir, { recursive: true });
  }

  checkEnvironment(lang) {
    try {
      if (['python', 'py'].includes(lang)) {
        execSync('python --version', { timeout: 3000, stdio: 'pipe' });
        return { available: true };
      } else if (lang === 'java') {
        execSync('javac -version', { timeout: 3000, stdio: 'pipe' });
        return { available: true };
      } else if (['javascript', 'js'].includes(lang)) {
        return { available: true };
      }
    } catch (e) {
      const names = { python: 'Python', py: 'Python', java: 'Java' };
      return { available: false, error: `未检测到 ${names[lang] || lang} 环境，请先安装` };
    }
    return { available: true };
  }

  run(lang, code) {
    const env = this.checkEnvironment(lang);
    if (!env.available) return { success: false, error: env.error };

    if (this.isGuiApp(code, lang)) {
      return this.runGuiApp(lang, code);
    }

    try {
      if (['javascript', 'js'].includes(lang)) return this.runJS(code);
      if (['python', 'py'].includes(lang)) return this.runPython(code);
      if (lang === 'java') return this.runJava(code);
      return { success: false, error: `不支持的语言: ${lang}` };
    } catch (e) {
      return { success: false, error: e.message || String(e) };
    }
  }

  isGuiApp(code, lang) {
    if (lang === 'java') {
      return /JFrame|setVisible|javafx|SwingUtilities|extends\s+JFrame/.test(code);
    }
    if (lang === 'python' || lang === 'py') {
      return /tkinter|PyQt|matplotlib\.pyplot|Tk\(\)|wx\./.test(code);
    }
    return false;
  }

  runGuiApp(lang, code) {
    try {
      if (['java'].includes(lang)) return this.runJavaGui(code);
      if (['python', 'py'].includes(lang)) return this.runPythonGui(code);
    } catch (e) {
      return { success: false, error: e.message };
    }
    return { success: false, error: '不支持的 GUI 类型' };
  }

  runJavaGui(code) {
    const classMatch = code.match(/class\s+(\w+)/);
    const className = classMatch ? classMatch[1] : 'Main';
    const tempFile = path.join(this.tempDir, `${className}.java`);
    fs.writeFileSync(tempFile, code, 'utf-8');
    try {
      execSync(`javac -encoding UTF-8 "${tempFile}"`, { cwd: this.tempDir, timeout: 15000, stdio: ['pipe', 'pipe', 'pipe'] });
      const child = spawn('java', ['-cp', this.tempDir, className], { detached: true, stdio: 'ignore' });
      child.unref();
      return { success: true, output: 'Java GUI 程序已启动，窗口应在桌面上显示' };
    } finally {
      try { fs.unlinkSync(tempFile); } catch (e) {}
    }
  }

  runPythonGui(code) {
    const tempFile = path.join(this.tempDir, `run_${Date.now()}.py`);
    fs.writeFileSync(tempFile, code, 'utf-8');
    try {
      execSync(`python -c "import py_compile; py_compile.compile(r'${tempFile.replace(/\\/g, '\\\\')}', doraise=True)"`, { timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] });
      const child = spawn('python', [tempFile], { detached: true, stdio: 'ignore' });
      child.unref();
      return { success: true, output: 'Python GUI 程序已启动，窗口应在桌面上显示' };
    } catch (e) {
      return { success: false, error: (e.stderr || e.message || e).toString().substring(0, 500) };
    }
  }

  runStream(lang, code, onData) {
    const env = this.checkEnvironment(lang);
    if (!env.available) { onData('stderr', env.error); onData('done', 1); return; }

    let cmd, args;

    if (['javascript', 'js'].includes(lang)) {
      const tempFile = path.join(this.tempDir, `run_${Date.now()}.js`);
      fs.writeFileSync(tempFile, code, 'utf-8');
      cmd = 'node';
      args = [tempFile];
    } else if (['python', 'py'].includes(lang)) {
      const tempFile = path.join(this.tempDir, `run_${Date.now()}.py`);
      fs.writeFileSync(tempFile, code, 'utf-8');
      cmd = 'python';
      args = [tempFile];
    } else if (lang === 'java') {
      const classMatch = code.match(/class\s+(\w+)/);
      const className = classMatch ? classMatch[1] : 'Main';
      const tempFile = path.join(this.tempDir, `${className}.java`);
      fs.writeFileSync(tempFile, code, 'utf-8');
      try {
        const compResult = execSync(`javac -encoding UTF-8 "${tempFile}"`, { cwd: this.tempDir, timeout: 15000, stdio: ['pipe', 'pipe', 'pipe'], encoding: 'utf-8' });
        if (compResult && compResult.length > 0) onData('stderr', compResult.toString());
      } catch (e) {
        onData('stderr', (e.stderr || e.message).toString().substring(0, 1000));
        onData('done', 1);
        try { fs.unlinkSync(tempFile); } catch (ex) {}
        return;
      }
      cmd = 'java';
      args = ['-cp', this.tempDir, className];
    } else {
      onData('stderr', `不支持的语言: ${lang}`);
      onData('done', 1);
      return;
    }

    const child = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    child.stdout.on('data', data => onData('stdout', data.toString()));
    child.stderr.on('data', data => onData('stderr', data.toString()));
    child.on('close', code => onData('done', code));
  }

  runJS(code) {
    const output = [];
    const sandbox = {
      console: {
        log: (...args) => output.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
        error: (...args) => output.push('[ERROR] ' + args.join(' ')),
        warn: (...args) => output.push('[WARN] ' + args.join(' '))
      },
      setTimeout: () => {},
      setInterval: () => {},
      Math, Date, JSON, parseInt, parseFloat, isNaN, Array, Object, String, Number, Boolean, RegExp, Map, Set
    };
    vm.createContext(sandbox);
    const result = vm.runInContext(code, sandbox, { timeout: 5000 });
    if (result !== undefined && output.length === 0) {
      output.push(typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result));
    }
    return { success: true, output: output.join('\n') || '(无输出)' };
  }

  runPython(code) {
    const tempFile = path.join(this.tempDir, `run_${Date.now()}.py`);
    fs.writeFileSync(tempFile, code, 'utf-8');
    try {
      const result = execSync(`python "${tempFile}"`, { timeout: 10000, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
      return { success: true, output: result || '(无输出)' };
    } catch (e) {
      return { success: false, error: e.stderr || e.message };
    } finally {
      try { fs.unlinkSync(tempFile); } catch (e) {}
    }
  }

  runJava(code) {
    const classMatch = code.match(/class\s+(\w+)/);
    const className = classMatch ? classMatch[1] : 'Main';
    const tempFile = path.join(this.tempDir, `${className}.java`);
    fs.writeFileSync(tempFile, code, 'utf-8');
    try {
      execSync(`javac "${tempFile}"`, { timeout: 15000, cwd: this.tempDir, stdio: ['pipe', 'pipe', 'pipe'] });
      const result = execSync(`java -cp "${this.tempDir}" ${className}`, { timeout: 10000, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
      return { success: true, output: result || '(无输出)' };
    } catch (e) {
      return { success: false, error: e.stderr || e.message };
    } finally {
      try { fs.unlinkSync(tempFile); fs.unlinkSync(path.join(this.tempDir, `${className}.class`)); } catch (e) {}
    }
  }
}

module.exports = CodeRunner;
