// Luca'da Çalış: yeni pencere düğmesi bulunamazsa sorgu penceresi gösterilmeden ürün seçim sayfası (gizli) üzerinden açılır
const Module = require('module'); const orig = Module._load; const tum = []; let paketVar = true, ssoUrl = 'https://agiris.luca.com.tr/LUCASSO/main.erp';
class W { constructor(o) { this.o = o || {}; this.url = ''; this.d = false; this.min = false; this.max = false; this.shown = 0; this.h = {}; this.wh = {}; tum.push(this); const self = this;
    this.webContents = { getURL: () => this.url, on: (e, f) => { (self.wh[e] = self.wh[e] || []).push(f); }, once: (e, f) => { (self.wh[e] = self.wh[e] || []).push(f); }, setWindowOpenHandler: () => {}, executeJavaScript: async () => null,
      mainFrame: { get framesInSubtree() { return [{ executeJavaScript: async s => {
        if (/PAKET/.test(s)) { if (!paketVar || !/main\.erp/.test(self.url)) return ''; setTimeout(() => { const c = new W({}); c.url = 'https://auygs.luca.com.tr/Luca/luca.do'; (self.wh['did-create-window'] || []).forEach(f => f(c)); }, 100); return 'MALİ MÜŞAVİR PAKETİ'; }
        return ''; } }]; } }, session: { webRequest: { onBeforeRequest() {}, onCompleted() {} } } }; }
  removeMenu() {} setTitle() {} on(e, f) { this.h[e] = f; } once(e, f) { this.h[e] = f; } async loadURL(u) { this.url = /LUCASSO\/main/.test(u) ? ssoUrl : u; } isDestroyed() { return this.d; } destroy() { this.d = true; this.h.closed && this.h.closed(); }
  isMinimized() { return this.min; } restore() { this.min = false; } show() { this.shown++; } focus() {} maximize() { this.max = true; } setAlwaysOnTop() {} moveTop() {} minimize() { this.min = true; } isVisible() { return true; } close() { this.destroy(); } }
Module._load = function (r, ...a) { if (r === 'electron') return { BrowserWindow: W, session: { fromPartition: () => ({ clearStorageData: async () => {} }) } }; return orig.call(this, r, ...a); };
const L = require(require('path').join(__dirname, '..', '..', 'luca.js')); L.init({ parent: null, notify: () => {} });
const tamam = (k, m) => { console.log((k ? '✓ ' : '✗ ') + m); if (!k) process.exitCode = 1; };
(async () => {
  L.openLogin(); const g = tum[0]; const app = new W({}); app.url = 'https://auygs.luca.com.tr/Luca/luca.do'; (g.wh['did-create-window'] || []).forEach(f => f(app));
  app.shown = 0;
  const r = await L.calis(); const cw = tum[tum.length - 1];
  tamam(r.ok && r.yol === 'sso', 'düğme yokken ürün seçim sayfasından açıldı (' + JSON.stringify(r) + ')');
  tamam(app.shown === 0, 'sorgu yapan Luca penceresi öne getirilmedi');
  tamam(cw.max && /luca\.do/.test(cw.url), 'yeni ana ekran tam ekran çalışma penceresi');
  tamam((await L.status()).url === app.url, 'program sorguları için eski pencereyi kullanmaya devam ediyor');
  cw.close(); paketVar = false; ssoUrl = 'https://agiris.luca.com.tr/LUCASSO/giris.erp';
  const r2 = await L.calis(); tamam(r2.elle && app.shown > 0, 'ürün seçim sayfası da açılamazsa elle yol (' + JSON.stringify(r2) + ')');
  process.exit();
})();
