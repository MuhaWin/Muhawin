'use strict';
// Fatura Kontrol modülü: Python sunucusunu (fatura_kontrol.web) arka planda çalıştırır.
// - Yalnız 127.0.0.1'de, boş bir portta açılır.
// - Her açılışta rastgele bir anahtar üretilir; Electron bu adrese giden her isteğe "X-MuhaWin" başlığını ekler,
//   sunucu başlıksız istekleri reddeder (bilgisayardaki başka programlar/tarayıcılar erişemez).
// - Veriler giriş yapan hesabın klasöründe: <hesap>/fatura_kontrol
const { spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const net = require('net');
const path = require('path');
const http = require('http');

// Sabit port tercih edilir (tarayıcı tarafındaki tema vb. ayarlar port değişince kaybolmasın); doluysa boş port.
const PREFERRED_PORT = 47615;
function tryPort(p) {
  return new Promise(res => {
    const s = net.createServer(); s.unref();
    s.on('error', () => res(0));
    s.listen(p, '127.0.0.1', () => { const x = s.address().port; s.close(() => res(x)); });
  });
}
async function freePort() { return (await tryPort(PREFERRED_PORT)) || (await tryPort(0)); }

function ping(port, timeout = 1000) {
  return new Promise(res => {
    const r = http.get({ host: '127.0.0.1', port, path: '/api/saglik', timeout }, x => {
      let b = ''; x.on('data', d => b += d); x.on('end', () => res(x.statusCode === 200 && b.includes('fatura-kontrol')));
    });
    r.on('error', () => res(false)); r.on('timeout', () => { r.destroy(); res(false); });
  });
}

function makeSidecar({ isPackaged, resourcesPath, appDir, log = () => {} }) {
  let proc = null, port = 0, key = '', dataDir = null, envExtra = {}, starting = null, lastErr = '';
  const logLines = [];

  // Python ve kod nerede?
  function locate() {
    if (process.env.MUHAWIN_PYTHON) return { py: process.env.MUHAWIN_PYTHON, cwd: path.join(appDir, 'fk') };
    if (isPackaged) {
      const py = path.join(resourcesPath, 'python', process.platform === 'win32' ? 'python.exe' : 'bin/python3');
      return { py, cwd: path.join(resourcesPath, 'fk') };
    }
    // geliştirme: fk/.venv varsa onu, yoksa sistem Python'unu kullan
    const venv = path.join(appDir, 'fk', '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
    return { py: fs.existsSync(venv) ? venv : (process.platform === 'win32' ? 'python' : 'python3'), cwd: path.join(appDir, 'fk') };
  }

  async function start() {
    if (proc && port && await ping(port)) return info();
    if (starting) return starting;
    starting = (async () => {
      if (!dataDir) throw new Error('Önce programa giriş yapın.');
      fs.mkdirSync(dataDir, { recursive: true });
      const { py, cwd } = locate();
      port = await freePort();
      key = crypto.randomBytes(24).toString('hex');
      lastErr = ''; logLines.length = 0;
      const env = {
        ...process.env, ...envExtra,
        PYTHONUNBUFFERED: '1', PYTHONIOENCODING: 'utf-8', PYTHONDONTWRITEBYTECODE: '1',
        FK_VERI: dataDir, FK_PORT: String(port), FK_ANAHTAR: key, FK_MUHAWIN: '1',
        FK_TARAYICI_ACMA: '1',          // tarayıcı açma: ekran MuhaWin penceresinde
        FK_BILDIRIM_URL: ''             // kayıt bildirimi kapalı: üyelik MuhaWin hesabıyla
      };
      const p = spawn(py, ['-m', 'fatura_kontrol.web'], { cwd, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      proc = p;
      let logFile = null; try { logFile = fs.createWriteStream(path.join(dataDir, 'muhawin-modul.log'), { flags: 'a' }); logFile.write('\n=== ' + new Date().toISOString() + ' başlatıldı (port ' + port + ')\n'); } catch (e) {}
      const onOut = d => { const t = String(d); logLines.push(t); if (logLines.length > 200) logLines.shift(); log(t); try { if (logFile) logFile.write(t); } catch (e) {} };
      p.on('close', () => { try { if (logFile) logFile.end(); } catch (e) {} });
      p.stdout.on('data', onOut); p.stderr.on('data', onOut);
      p.on('error', e => { lastErr = 'Fatura Kontrol başlatılamadı: ' + e.message; });
      p.on('exit', code => { if (proc === p) { proc = null; if (code) lastErr = lastErr || ('Fatura Kontrol kapandı (kod ' + code + ').'); } });
      const t0 = Date.now();
      while (Date.now() - t0 < 30000) {
        if (!proc) break;
        if (await ping(port, 800)) return info();
        await new Promise(r => setTimeout(r, 300));
      }
      const tail = logLines.join('').split(/\r?\n/).filter(Boolean).slice(-6).join('\n');
      stop();
      throw new Error((lastErr || 'Fatura Kontrol modülü açılamadı.') + (tail ? '\n' + tail : ''));
    })();
    try { return await starting; } finally { starting = null; }
  }

  function stop() {
    const p = proc; proc = null;
    if (!p) return;
    try {
      if (process.platform === 'win32') spawn('taskkill', ['/pid', String(p.pid), '/T', '/F'], { windowsHide: true });
      else p.kill('SIGTERM');
    } catch (e) {}
  }

  function info() { return { running: !!proc, port, url: port ? `http://127.0.0.1:${port}` : null, error: lastErr }; }

  // Hesap değişince (giriş/çıkış) ya da Luca bilgileri değişince yeniden başlatılır.
  async function configure({ dir, env }) {
    const changed = dir !== dataDir || JSON.stringify(env || {}) !== JSON.stringify(envExtra);
    dataDir = dir; envExtra = env || {};
    if (changed && proc) { stop(); if (dataDir) await start().catch(() => {}); }
  }

  // Electron oturumuna: bu porta giden isteklere anahtar başlığı eklenir.
  function attach(ses) {
    ses.webRequest.onBeforeSendHeaders({ urls: ['http://127.0.0.1/*', 'http://127.0.0.1:*/*'] }, (d, cb) => {
      try {
        const u = new URL(d.url);
        if (port && +u.port === port) d.requestHeaders['X-MuhaWin'] = key;
      } catch (e) {}
      cb({ requestHeaders: d.requestHeaders });
    });
  }
  const isOwnUrl = u => { try { const x = new URL(u); return x.hostname === '127.0.0.1' && port && +x.port === port; } catch (e) { return false; } };

  // Ana süreçten Python API'sine istek (anahtar başlığıyla)
  async function request(method, p, body) {
    await start();
    const data = body === undefined ? null : Buffer.from(JSON.stringify(body));
    return new Promise((res, rej) => {
      const r = http.request({ host: '127.0.0.1', port, path: p, method, timeout: 180000,
        headers: { 'X-MuhaWin': key, 'Content-Type': 'application/json', ...(data ? { 'Content-Length': data.length } : {}) } }, x => {
        let b = ''; x.setEncoding('utf8'); x.on('data', d => b += d);
        x.on('end', () => { let j = null; try { j = b ? JSON.parse(b) : null; } catch (e) {}
          if (x.statusCode >= 400) rej(new Error((j && j.detail) || ('Fatura Kontrol hatası (' + x.statusCode + ')'))); else res(j); });
      });
      r.on('error', e => rej(new Error('Fatura Kontrol modülüne ulaşılamadı: ' + e.message)));
      r.on('timeout', () => r.destroy(new Error('zaman aşımı')));
      if (data) r.write(data); r.end();
    });
  }

  return { start, stop, info, configure, attach, isOwnUrl, request, dataDir: () => dataDir, logTail: () => logLines.join('') };
}

module.exports = { makeSidecar };
