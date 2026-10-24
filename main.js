'use strict';
const { app, BrowserWindow, ipcMain, dialog, shell, safeStorage, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const luca = require('./luca');
const { makeDataStore } = require('./datastore');
const { makeCloud, kodUret, kodOzet, kodGrupla } = require('./cloud');
const { makeKur } = require('./kur');
const { makeSidecar } = require('./sidecar');
const { makeGuncelleme } = require('./guncelleme');
let ds, auth, fk;

// Ekstre Luca'dan MuhaWin'e geçiş: eski program verisi (hesaplar, ayarlar, oturum) bir kez kopyalanır.
// Eski klasör silinmez; Ekstre Luca kurulu kalırsa o da çalışmaya devam eder.
function migrateFromEkstreLuca() {
  try {
    const dst = app.getPath('userData');
    const src = path.join(app.getPath('appData'), 'Ekstre Luca');
    if (!fs.existsSync(src) || fs.existsSync(path.join(dst, 'ekstre-luca-aktarildi.txt'))) return;
    fs.mkdirSync(dst, { recursive: true });
    if (!fs.existsSync(path.join(dst, 'hesaplar'))) {
      for (const n of ['hesaplar', 'mizan', 'yedek', 'veri.json', 'ayarlar.json', 'luca-giris.bin', 'oturum.bin', 'cihaz.json', 'son-hesap.txt', 'Local State']) {
        const f = path.join(src, n);
        if (fs.existsSync(f)) fs.cpSync(f, path.join(dst, n), { recursive: true, errorOnExist: false, force: false });
      }
    }
    fs.writeFileSync(path.join(dst, 'ekstre-luca-aktarildi.txt'), new Date().toISOString());
  } catch (e) { /* aktarılamazsa program boş başlar */ }
}

app.commandLine.appendSwitch('lang', 'tr');
let win;
const userDir = () => app.getPath('userData');
const dataFile = () => path.join(ds ? ds.root() : userDir(), 'veri.json');
let acctDir = null;                       // giriş yapan hesabın veri klasörü
const credFile = () => path.join(acctDir || userDir(), 'luca-giris.bin');
// Ofis üyesi: Luca üye numarası ofisinkine sabitlenir
const officeUye = () => { try { const o = auth && auth.isAuthed() && auth.office(); return (o && o.luca_uye_no) || ''; } catch (e) { return ''; } };
function readCreds() {
  const c = readCredsRaw(); const u = officeUye();
  return u ? { ...c, uyeno: u, uyeKilitli: true } : c;
}
function readCredsRaw() {
  try {
    const raw = fs.readFileSync(credFile());
    let json;
    try { json = safeStorage && safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(raw) : raw.toString('utf8'); }
    catch (e) { json = raw.toString('utf8'); }
    const c = JSON.parse(json); return c && typeof c === 'object' ? c : {};
  } catch (e) { return {}; }
}
function writeCreds(c) {
  const json = JSON.stringify(c || {});
  let buf;
  try { buf = safeStorage && safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(json) : Buffer.from(json, 'utf8'); }
  catch (e) { buf = Buffer.from(json, 'utf8'); }
  fs.mkdirSync(path.dirname(credFile()), { recursive: true }); fs.writeFileSync(credFile(), buf);
}

function backup() {
  try {
    const f = dataFile(); if (!fs.existsSync(f)) return;
    const dir = path.join(acctDir || userDir(), 'yedek'); fs.mkdirSync(dir, { recursive: true });
    const name = 'veri-' + new Date().toISOString().slice(0, 10) + '.json';
    if (!fs.existsSync(path.join(dir, name))) fs.copyFileSync(f, path.join(dir, name));
    const all = fs.readdirSync(dir).filter(n => /^veri-.*\.json$/.test(n)).sort();
    all.slice(0, Math.max(0, all.length - 15)).forEach(n => fs.unlinkSync(path.join(dir, n)));
  } catch (e) { /* yedek alınamazsa çalışmaya devam */ }
}

// Başlangıç ekranı: program yüklenirken logo ve yükleniyor çubuğu (en az 1,2 sn)
const APP_ICON = path.join(__dirname, 'renderer', 'logo.png');
let splash = null;
function showSplash() {
  splash = new BrowserWindow({ width: 640, height: 400, frame: false, useContentSize: true, resizable: false, movable: true, center: true, show: false,
    skipTaskbar: false, alwaysOnTop: false, backgroundColor: '#16325C', title: 'MuhaWin', icon: APP_ICON,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true } });
  splash.removeMenu();
  splash.loadFile(path.join(__dirname, 'renderer', 'splash.html'), { hash: 'v=' + app.getVersion() });
  splash.once('ready-to-show', () => splash && splash.show());
  return Date.now();
}
// açılış ekranındaki durum yazısı ve yüzde
function splashDurum(metin, yuzde) {
  try { if (splash && !splash.isDestroyed()) splash.webContents.executeJavaScript(`window.setDurum && setDurum(${JSON.stringify(metin)}, ${yuzde})`).catch(() => {}); } catch (e) {}
}
let cikisOnay = false;
app.on('before-quit', () => { cikisOnay = true; });
// "Beni hatırla": e-posta ve şifre yalnız bu bilgisayarda, Windows'un kullanıcıya özel şifrelemesiyle (DPAPI) saklanır
const hatirlaDosya = () => path.join(app.getPath('userData'), 'beni-hatirla.bin');
function hatirlaOku() {
  try { if (!safeStorage.isEncryptionAvailable()) return null;
    const c = JSON.parse(safeStorage.decryptString(fs.readFileSync(hatirlaDosya())));
    return c && c.email && c.password ? c : null; } catch (e) { return null; }
}
function hatirlaYaz(email, password) {
  try { if (!safeStorage.isEncryptionAvailable()) return false;
    fs.mkdirSync(path.dirname(hatirlaDosya()), { recursive: true });
    fs.writeFileSync(hatirlaDosya(), safeStorage.encryptString(JSON.stringify({ email, password }))); return true; } catch (e) { return false; }
}
function hatirlaSil() { try { fs.unlinkSync(hatirlaDosya()); } catch (e) {} }

function createWindow() {
  const t0 = process.env.MUHAWIN_NO_SPLASH ? 0 : showSplash();
  win = new BrowserWindow({
    width: 1440, height: 920, minWidth: 980, minHeight: 640, title: 'MuhaWin', show: false, icon: APP_ICON, backgroundColor: '#eef2f7',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  // program ekranı kaplayacak şekilde (tam pencere) açılır
  if (!t0) win.once('ready-to-show', () => { if (win && !win.isDestroyed()) { win.maximize(); win.show(); } });
  if (t0) {
    splashDurum('Arayüz yükleniyor…', 35);
    win.webContents.once('dom-ready', () => splashDurum('Hesap ve lisans bilgileri hazırlanıyor…', 70));
    win.once('ready-to-show', () => {
      splashDurum('Hazır', 100);
      setTimeout(() => {
        if (win && !win.isDestroyed()) { win.maximize(); win.show(); win.focus(); }
        if (splash && !splash.isDestroyed()) splash.close(); splash = null;
      }, Math.max(450, 1400 - (Date.now() - t0)));
    });
  }
  win.removeMenu();
  // Fatura Kontrol'ün açtığı sayfalar (rapor çıktısı, fatura görüntüsü) program içinde açılır; diğer bağlantılar tarayıcıda.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (fk && fk.isOwnUrl(url)) return { action: 'allow', overrideBrowserWindowOptions: { width: 1200, height: 860, autoHideMenuBar: true, webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true } } };
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('did-create-window', child => { child.removeMenu(); child.webContents.setWindowOpenHandler(({ url }) => (fk && fk.isOwnUrl(url)) ? { action: 'allow' } : (shell.openExternal(url), { action: 'deny' })); });
  // ana pencere yalnız kendi sayfasında kalır: başka adrese gidilirse preload köprüsü (window.desktop) o sayfaya geçerdi
  const anaSayfa = require('url').pathToFileURL(path.join(__dirname, 'renderer', 'index.html')).href;
  win.webContents.on('will-navigate', (e, hedef) => {
    if (String(hedef).split(/[?#]/)[0] === anaSayfa) return;
    e.preventDefault();
    if (/^https:\/\//i.test(hedef)) shell.openExternal(hedef);
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  // sağ üstteki ✕ ile yanlışlıkla kapatmaya karşı sor
  win.on('close', e => {
    if (cikisOnay || !win || win.isDestroyed() || (!app.isPackaged && process.env.EKSTRE_TEST_SB)) return;
    e.preventDefault();
    dialog.showMessageBox(win, { type: 'question', buttons: ['Çıkış Yap', 'Vazgeç'], defaultId: 1, cancelId: 1, noLink: true, title: 'MuhaWin',
      message: "MuhaWin'den çıkmak istediğinize emin misiniz?",
      detail: 'Devam eden işlemler (Luca kayıtları, indirmeler, kontroller) yarıda kalabilir.' })
      .then(r => { if (r.response === 0) { cikisOnay = true; if (win && !win.isDestroyed()) win.close(); } }).catch(() => {});
  });
  win.on('closed', () => app.quit());
  luca.init({ parent: win, getCreds: readCreds, getRequiredUye: officeUye, notify: (ev, data) => {
    if (win && !win.isDestroyed()) win.webContents.send('luca-event', ev, data);
    if (ev === 'loggedIn' || ev === 'durum') lucaOturumPaylas(ev === 'durum' && data && !data.loggedIn);
  } });
}

// Luca oturumu Fatura Kontrol'ün Luca otomasyonuyla (ayrı Chrome) paylaşılır: "Faturaları Luca'dan Al" / toplu kontrol
// yeniden giriş ve doğrulama kodu istemez. Çerezler yalnız yerel Fatura Kontrol modülüne (anahtarlı istekle) bellekte verilir.
let lucaPayIz = '', lucaPayZaman = 0, lucaPayPort = 0;
async function lucaOturumPaylas(kapandi) {
  try {
    if (!fk || !fk.info().running) return;
    const port = fk.info().port;
    let cerezler = [];
    if (!kapandi) { const st = await luca.status(); if (!st.loggedIn) kapandi = true; else cerezler = await luca.oturumCerezleri(); }
    const iz = require('crypto').createHash('sha256').update(JSON.stringify(cerezler.map(c => [c.name, c.value, c.domain || c.url]))).digest('hex');
    if (iz === lucaPayIz && port === lucaPayPort && Date.now() - lucaPayZaman < 10 * 60e3) return;
    await fk.request('POST', '/api/toplu/luca-oturum', { cerezler });
    lucaPayIz = iz; lucaPayPort = port; lucaPayZaman = Date.now();
  } catch (e) {}
}
setInterval(() => lucaOturumPaylas(false), 60e3).unref();

app.whenReady().then(() => {
  migrateFromEkstreLuca();
  fk = makeSidecar({ isPackaged: app.isPackaged, resourcesPath: process.resourcesPath, appDir: __dirname });
  fk.attach(require('electron').session.defaultSession);
  auth = makeCloud(userDir(), { version: app.getVersion(), safeStorage, _testUrl: (!app.isPackaged && process.env.EKSTRE_TEST_SB) || null });
  createWindow();
  setupUpdater();
});
// ---------- otomatik güncelleme (GitHub sürümleri; yalnız kurulu programda) ----------
let guncelleme = null, updateState = { state: 'idle' };
function updateSend(st) { updateState = { ...st, current: app.getVersion() }; if (win && !win.isDestroyed()) win.webContents.send('update-event', updateState); }
function setupUpdater() {
  if (!app.isPackaged || process.env.MUHAWIN_NO_UPDATE) return;
  let updater;
  try { updater = require('electron-updater').autoUpdater; } catch (e) { return; }
  // yeni sürüm sorulmadan indirilmez; karar mantığı guncelleme.js'de
  guncelleme = makeGuncelleme({ updater, dialog, surum: app.getVersion(), gonder: updateSend,
    pencere: () => (win && !win.isDestroyed()) ? win : null, cikisaIzin: () => { cikisOnay = true; } });
  const check = () => guncelleme.denetle(false);
  setTimeout(check, 10000);
  setInterval(check, 4 * 3600 * 1000);
}
ipcMain.handle('update-status', () => ({ ...updateState, current: app.getVersion(), enabled: !!guncelleme }));
ipcMain.handle('update-check', async () => { if (!guncelleme) return { ...updateState, enabled: false, current: app.getVersion() }; await guncelleme.denetle(true); return { ...updateState, enabled: true }; });
ipcMain.handle('update-install', () => ({ ok: !!(guncelleme && guncelleme.kur()) }));

app.on('window-all-closed', () => app.quit());
// geçici fatura / PDF / WhatsApp görüntüleri çıkışta silinir (WhatsApp fişleri önce hesabın okc klasörüne kopyalanır)
const GECICI = ['MuhaWin-pdf', 'MuhaWin-faturalar', 'MuhaWin-wa'];
function geciciTemizle() { for (const ad of GECICI) { try { fs.rmSync(path.join(app.getPath('temp'), ad), { recursive: true, force: true }); } catch (e) {} } }
app.on('will-quit', () => { if (fk) fk.stop(); geciciTemizle(); });

// Fatura Kontrol: hesap klasörü ve MuhaWin Ayarlar'ındaki Luca bilgileri Python modülüne verilir.
function fkEnv() {
  const c = readCreds();
  const env = (c.uyeno && c.kullanici && c.parola) ? { FK_LUCA_GIRIS: JSON.stringify({ uye_no: c.uyeno, kullanici: c.kullanici, parola: c.parola }) } : {};
  if (officeUye()) env.FK_LUCA_UYE = officeUye();          // Fatura Kontrol de yalnız ofisin üye numarasıyla çalışır
  return env;
}
function fkConfigure() { if (fk) return fk.configure({ dir: acctDir ? path.join(acctDir, 'fatura_kontrol') : null, env: acctDir ? fkEnv() : {} }); }

// --- program girişi ---
// Her hesabın verisi ayrı klasörde: %APPDATA%/Ekstre Luca/hesaplar/<e-posta özeti>/
const legacyFile = () => path.join(userDir(), 'veri.json');
async function onAuthed(r) {
  if (!r || !r.ok || !auth.isAuthed()) return r;
  const email = auth.info().email;
  const dir = path.join(userDir(), 'hesaplar', require('crypto').createHash('sha256').update(email).digest('hex').slice(0, 16));
  fs.mkdirSync(dir, { recursive: true });
  try { fs.writeFileSync(path.join(dir, 'hesap.txt'), email); } catch (e) {}
  // bu bilgisayarda en son başka bir hesap çalıştıysa Luca oturumunu temizle
  const lastF = path.join(userDir(), 'son-hesap.txt'); let last = ''; try { last = fs.readFileSync(lastF, 'utf8'); } catch (e) {}
  if (last && last !== email) { try { await luca.logout(); } catch (e) {} }
  try { fs.writeFileSync(lastF, email); } catch (e) {}
  if (ds && ds.unwatch) ds.unwatch();
  acctDir = dir; ds = makeDataStore(dir);
  try { ds.load(); } catch (e) {}
  backup();
  ds.watch(() => { if (win && !win.isDestroyed()) win.webContents.send('data-changed'); });
  fkConfigure();
  // önceki sürümden kalan (hesapsız) veri varsa ve bu hesabın verisi boşsa sor
  let legacy = null;
  try {
    if (fs.existsSync(legacyFile()) && !fs.existsSync(path.join(dir, 'veri.json')) && !fs.existsSync(path.join(dir, 'eski-veri-soruldu'))) {
      const d = JSON.parse(fs.readFileSync(legacyFile(), 'utf8')); const n = Object.keys(d.firms || {}).length;
      if (n) legacy = { firms: n };
    }
  } catch (e) {}
  return { ...r, legacy };
}
ipcMain.handle('auth-claim-legacy', (e, take) => {
  if (!acctDir) throw new Error('Önce giriş yapın.');
  fs.writeFileSync(path.join(acctDir, 'eski-veri-soruldu'), take ? 'aktarildi' : 'hayir');
  if (!take) return { ok: true };
  const root = userDir();
  for (const n of ['veri.json', 'ayarlar.json', 'luca-giris.bin']) { const f = path.join(root, n); if (fs.existsSync(f)) fs.copyFileSync(f, path.join(acctDir, n)); }
  const mz = path.join(root, 'mizan'); if (fs.existsSync(mz)) { fs.mkdirSync(path.join(acctDir, 'mizan'), { recursive: true }); for (const n of fs.readdirSync(mz)) fs.copyFileSync(path.join(mz, n), path.join(acctDir, 'mizan', n)); }
  // eski konumdaki dosyalar "aktarıldı" olarak yeniden adlandırılır (silinmez)
  for (const n of ['veri.json', 'luca-giris.bin']) { const f = path.join(root, n); if (fs.existsSync(f)) fs.renameSync(f, path.join(root, n.replace(/(\.\w+)$/, '-aktarildi$1'))); }
  if (ds && ds.unwatch) ds.unwatch(); ds = makeDataStore(acctDir); ds.load(); ds.watch(() => { if (win && !win.isDestroyed()) win.webContents.send('data-changed'); });
  return { ok: true };
});
ipcMain.handle('auth-status', () => ({ ...auth.info(), lastEmail: auth.lastEmail() }));
ipcMain.handle('auth-signup', async (e, a) => onAuthed(await auth.signup(a || {})));
ipcMain.handle('auth-login', async (e, a) => { const o = a || {}; const r = await auth.login(o);
  if (r && !r.needCode) { if (o.remember) hatirlaYaz(String(o.email || '').trim(), String(o.password || '')); else if (o.remember === false) hatirlaSil(); }
  return onAuthed(r); });
ipcMain.handle('auth-remembered', () => { const c = hatirlaOku(); return c ? { email: c.email } : null; });
ipcMain.handle('auth-remember-available', () => { try { return safeStorage.isEncryptionAvailable(); } catch (e) { return false; } });
ipcMain.handle('auth-login-remembered', async () => { const c = hatirlaOku(); if (!c) return { needLogin: true };
  try { const r = await auth.login({ email: c.email, password: c.password }); if (r && r.needCode) return { needLogin: true, email: c.email }; return onAuthed(r); }
  catch (err) { if (/hatalı|invalid/i.test(String(err && err.message || err))) hatirlaSil(); throw err; } });
ipcMain.handle('auth-verify', async (e, a) => onAuthed(await auth.verify(a || {})));
ipcMain.handle('auth-resend', (e, a) => auth.resend(a || {}));
ipcMain.handle('auth-recover', (e, a) => auth.recover(a || {}));
ipcMain.handle('auth-newpw', async (e, a) => { const r = await auth.setNewPassword(a || {}); hatirlaSil(); return r; });
ipcMain.handle('auth-change', async (e, a) => { const r = await auth.changePassword(a || {}); const c = hatirlaOku(); const y = a && a.next;
  if (c) { if (y) hatirlaYaz(c.email, String(y)); else hatirlaSil(); } return r; });
ipcMain.handle('auth-logout', () => { admAcik = false; hatirlaSil(); auth.logout(); if (ds && ds.unwatch) ds.unwatch(); ds = null; acctDir = null; if (fk) { fk.stop(); fkConfigure(); } try { luca.logout(); } catch (err) {} if (win && !win.isDestroyed()) win.webContents.reload(); return true; });
const needAuth = () => { if (!auth || !auth.isAuthed()) throw new Error('Önce programa giriş yapın.'); };
const _handle = ipcMain.handle.bind(ipcMain);
ipcMain.handle = (ch, fn) => _handle(ch, /^(auth-|app-info$)/.test(ch) ? fn : (...a) => { needAuth(); return fn(...a); });

// --- veri ---
const errText = e => String(e && e.message || e);
ipcMain.on('store-load', e => { if (!auth || !auth.isAuthed()) { e.returnValue = { ok: false, error: 'Önce programa giriş yapın.', data: null }; return; } try { e.returnValue = { ok: true, data: ds.load() }; } catch (err) { e.returnValue = { ok: false, error: errText(err), data: null }; } });
ipcMain.handle('store-op', (e, op, args) => ds.apply(op, args));

// ---------- ÖKC fiş girişi: görüntü ekleme ve okuma (OCR, Türkçe; bilgisayarda çalışır, internete gönderilmez) ----------
let ocrWorker = null, ocrSira = Promise.resolve(), ocrIptal = false;
ipcMain.handle('okc-iptal', () => { ocrIptal = true; return true; });
function okcLicensed() { const l = auth.moduleStatus('okc'); if (!l || !l.valid) throw new Error((l && l.reason) || 'Belgeden Fiş lisansı geçerli değil.'); }
const okcDir = fid => { const d = path.join(acctDir || userDir(), 'okc', String(fid || 'genel').replace(/[^\w.-]+/g, '_')); fs.mkdirSync(d, { recursive: true }); return d; };
async function ocrAl() {
  if (ocrWorker) return ocrWorker;
  const { createWorker } = require('tesseract.js');
  const langPath = app.isPackaged ? path.join(process.resourcesPath, 'tessdata') : path.join(__dirname, 'node_modules', '@tesseract.js-data', 'tur', '4.0.0');
  const cachePath = path.join(app.getPath('userData'), 'ocr-onbellek'); fs.mkdirSync(cachePath, { recursive: true });
  // Electron'da tesseract.js dil dosyasını URL sanıp indirmeye çalışır; önbelleğe koyunca yerelden okunur
  const onb = path.join(cachePath, 'tur.traineddata');
  if (!fs.existsSync(onb)) fs.copyFileSync(path.join(langPath, 'tur.traineddata.gz'), onb);
  ocrWorker = await createWorker('tur', 1, { langPath, cachePath, gzip: true });
  await ocrWorker.setParameters({ preserve_interword_spaces: '1' });
  return ocrWorker;
}
function ocrOku(dosya) {
  const is = ocrSira.then(async () => {
    const w = await ocrAl();
    let girdi = dosya;
    try { const png = require('./ocr_onisle').onIsle(nativeImage, dosya); if (png) girdi = png; } catch (x) {}   // ön işleme olmazsa özgün görüntü
    const r = await w.recognize(girdi); return { text: r.data.text || '', conf: Math.round(r.data.confidence || 0) }; });
  ocrSira = is.catch(() => {});
  return is;
}
const RESIM = ['jpg', 'jpeg', 'png', 'bmp', 'webp', 'tif', 'tiff'];
ipcMain.handle('okc-ekle', async (e, a) => {
  okcLicensed();
  const o = a || {};
  let yollar = o.yollar;
  if (!yollar) {
    const yd = o.tur === 'yd';
    const r = await dialog.showOpenDialog(win, { title: o.tur === 'z' ? 'Z raporu görüntüleri' : yd ? 'Yurt dışı faturaları (PDF ya da görüntü)' : 'ÖKC fişi görüntüleri', properties: ['openFile', 'multiSelections'],
      filters: yd ? [{ name: 'PDF ya da görüntü', extensions: ['pdf', ...RESIM] }] : [{ name: 'Görüntü', extensions: RESIM }] });
    if (r.canceled) return [];
    yollar = r.filePaths;
  }
  const dir = okcDir(o.fid); const out = [];
  const oku = async (hedef, ad, ek) => {
    const id = path.basename(hedef).replace(/\.[^.]+$/, '');
    try { const r = await ocrOku(hedef); out.push({ id, ad, img: hedef, url: require('url').pathToFileURL(hedef).href, text: r.text, conf: r.conf, ...(ek || {}) }); }
    catch (x) { out.push({ id, ad, img: hedef, url: require('url').pathToFileURL(hedef).href, text: '', conf: 0, hata: 'Okunamadı: ' + String(x && x.message || x).slice(0, 120), ...(ek || {}) }); }
  };
  const yeniId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  ocrIptal = false; let sira = 0;
  const bildir = (ad) => { try { if (win && !win.isDestroyed()) win.webContents.send('okc-ilerleme', { i: sira, n: yollar.length, ad }); } catch (x) {} };
  for (const y of yollar) {
    if (ocrIptal) { out.push({ ad: path.basename(y), hata: 'İptal edildi', iptal: true }); continue; }
    sira++; bildir(path.basename(y));
    const ext = path.extname(y).toLowerCase().replace('.', '');
    // PDF (yurt dışı faturaları): metni ve ilk sayfanın görüntüsünü ekran (pdf.js) çıkarır → okc-pdf-png
    if (ext === 'pdf' && o.tur === 'yd') {
      const id = yeniId(); const hedef = path.join(dir, id + '.pdf'); fs.copyFileSync(y, hedef);
      out.push({ id, ad: path.basename(y), img: hedef, pdf: true, url: '', buf: fs.readFileSync(hedef), text: '', conf: 100, ...(o.ek || {}) });
      continue;
    }
    if (!RESIM.includes(ext)) { out.push({ ad: path.basename(y), hata: 'Desteklenmeyen dosya (görüntü seçin)' }); continue; }
    // tek fotoğrafta yan yana birden çok fiş varsa parçalara ayrılır; her parça ayrı belge olur
    let parcalar = [];
    if (o.parcala !== false && o.tur !== 'yd') { try { parcalar = require('./ocr_onisle').parcala(nativeImage, y); } catch (x) { parcalar = []; } }
    if (parcalar.length >= 2) {
      for (let i = 0; i < parcalar.length; i++) { const hedef = path.join(dir, yeniId() + '.png'); fs.writeFileSync(hedef, parcalar[i]); await oku(hedef, `${path.basename(y)} (${i + 1}/${parcalar.length})`, { parca: i + 1, parcaToplam: parcalar.length, kaynakDosya: path.basename(y), ...(o.ek || {}) }); }
      continue;
    }
    const hedef = path.join(dir, yeniId() + '.' + ext);
    fs.copyFileSync(y, hedef);
    await oku(hedef, path.basename(y), o.ek || null);
  }
  return out;
});
ipcMain.handle('okc-yeniden-oku', async (e, img) => { okcLicensed(); const p = path.resolve(String(img || '')); if (!p.startsWith(path.join(acctDir || userDir(), 'okc'))) throw new Error('Geçersiz dosya'); return ocrOku(p); });
ipcMain.handle('okc-sil', (e, imgs) => { for (const i of imgs || []) { const p = path.resolve(String(i || '')); if (p.startsWith(path.join(acctDir || userDir(), 'okc'))) { try { fs.unlinkSync(p); } catch (x) {} if (/\.pdf$/i.test(p)) { try { fs.unlinkSync(p.replace(/\.pdf$/i, '.png')); } catch (x) {} } } } return { ok: true }; });
// PDF'in ilk sayfa görüntüsü (ekranda pdf.js ile çizilir): yanına .png yazılır; metni olmayan (taranmış) PDF'te görüntü okunur (OCR)
ipcMain.handle('okc-pdf-png', async (e, a) => { okcLicensed(); const o = a || {}; const p = path.resolve(String(o.img || ''));
  if (!p.startsWith(path.join(acctDir || userDir(), 'okc')) || !/\.pdf$/i.test(p)) throw new Error('Geçersiz dosya');
  const png = p.replace(/\.pdf$/i, '.png'); if (o.png) fs.writeFileSync(png, Buffer.from(o.png));
  const url = require('url').pathToFileURL(png).href;
  if (o.ocr && fs.existsSync(png)) { const r = await ocrOku(png); return { url, text: r.text, conf: r.conf }; }
  return { url }; });
ipcMain.handle('okc-pdf-oku', (e, img) => { okcLicensed(); const p = path.resolve(String(img || '')); if (!p.startsWith(path.join(acctDir || userDir(), 'okc')) || !/\.pdf$/i.test(p)) throw new Error('Geçersiz dosya'); return fs.readFileSync(p); });
ipcMain.handle('store-mizan', (e, fid) => ds.getMizan(fid));
ipcMain.handle('data-info', () => ds.info());
ipcMain.handle('open-data-folder', () => shell.openPath(ds.root()));
// yalnız e-posta (mailto:) ve https bağlantıları; başka protokol işleyicisi açılmaz
ipcMain.handle('open-mail', (e, url) => {
  const u = String(url || '');
  if (u.length > 4000 || !/^(mailto:|https:\/\/)/i.test(u)) throw new Error('Geçersiz bağlantı.');
  return shell.openExternal(u);
});
ipcMain.handle('data-export', async () => {
  const name = 'ekstre-luca-veri-' + new Date().toISOString().slice(0, 10) + '.json';
  const r = await dialog.showSaveDialog(win, { defaultPath: path.join(app.getPath('documents'), name), filters: [{ name: 'Ekstre Luca veri', extensions: ['json'] }] });
  if (r.canceled || !r.filePath) return { ok: false };
  const b = ds.bundle(); fs.writeFileSync(r.filePath, JSON.stringify(b));
  return { ok: true, path: yazildi(r.filePath), firms: Object.keys(b.firms).length };
});
let pendingImport = null;
ipcMain.handle('data-import-pick', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name: 'Ekstre Luca veri', extensions: ['json'] }] });
  if (r.canceled || !r.filePaths[0]) return { ok: false };
  const b = JSON.parse(fs.readFileSync(r.filePaths[0], 'utf8'));
  const sum = ds.validateBundle(b); pendingImport = b;
  return { ok: true, file: path.basename(r.filePaths[0]), ...sum };
});
ipcMain.handle('data-import-apply', (e, mode) => { if (!pendingImport) throw new Error('Önce dosya seçin.'); const r = ds.importBundle(pendingImport, mode); pendingImport = null; return r; });
ipcMain.handle('data-pick-shared', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Büronun ortak klasörünü seçin', properties: ['openDirectory', 'createDirectory'] });
  if (r.canceled || !r.filePaths[0]) return { ok: false };
  return { ok: true, dir: r.filePaths[0], ...ds.inspectShared(r.filePaths[0]) };
});
ipcMain.handle('data-use-shared', (e, dir, mode) => { const r = ds.useShared(dir, mode); ds.watch(); return r; });
ipcMain.handle('data-use-local', () => { const r = ds.useLocal(); ds.watch(); return r; });

// --- dosya kaydet ---
// "Klasörde göster" yalnız programın kaydettiği dosyalar ve veri klasörü için (arayüzden gelen rastgele yol açılmaz)
const yazilanlar = new Set();
const yazildi = p => { yazilanlar.add(path.resolve(p)); return p; };
function gosterilebilir(p) {
  const r = path.resolve(String(p || ''));
  return yazilanlar.has(r) || [userDir(), acctDir].filter(Boolean).some(k => r === path.resolve(k) || r.startsWith(path.resolve(k) + path.sep));
}
ipcMain.handle('save-file', async (e, { filename, data }) => {
  const r = await dialog.showSaveDialog(win, { defaultPath: path.join(app.getPath('documents'), filename), filters: [{ name: 'Excel', extensions: ['xlsx'] }] });
  if (r.canceled || !r.filePath) return { ok: false };
  fs.writeFileSync(r.filePath, Buffer.from(data)); return { ok: true, path: yazildi(r.filePath) };
});
ipcMain.handle('show-in-folder', (e, p) => {
  if (!gosterilebilir(p)) throw new Error('Bu dosya klasörde gösterilemez.');
  shell.showItemInFolder(path.resolve(String(p)));
});

// --- lisans ---
ipcMain.handle('license-status', () => auth.licenseStatus());
// --- modüller (her modülün ayrı lisansı / deneme süresi) ---
ipcMain.handle('modules-list', () => auth.modules());
ipcMain.handle('office-call', async (e, fn, args) => {
  const r = await auth.officeCall(String(fn || ''), args || {});
  if (/^office_(create|update|join|remove_member)$/.test(fn)) { fkConfigure(); try { luca.recheck(); } catch (x) {} }
  return r;
});
ipcMain.handle('office-get', () => auth.office());
// WhatsApp fiş kutusu: bekleyen fotoğrafları indirip ÖKC klasörüne koyar (okc-ekle ile aynı yoldan okunur)
ipcMain.handle('wa-bekleyenler', async () => { okcLicensed(); const r = await auth.waBekleyenler(); return (r && r.fisler) || []; });
ipcMain.handle('wa-indir', async (e, a) => { okcLicensed(); const o = a || {}; const dir = path.join(app.getPath('temp'), 'MuhaWin-wa'); fs.mkdirSync(dir, { recursive: true }); const out = [];
  for (const f of o.fisler || []) { if (!f || !f.url) continue;
    try { const r = await fetch(f.url); if (!r.ok) throw new Error('HTTP ' + r.status); const buf = Buffer.from(await r.arrayBuffer());
      const uz = (String(f.mime || '').split('/')[1] || 'jpg').replace('jpeg', 'jpg').split(';')[0]; const yol = path.join(dir, String(f.id).replace(/[^\w-]/g, '') + '.' + (RESIM.includes(uz) ? uz : 'jpg'));
      fs.writeFileSync(yol, buf); out.push({ ...f, yol }); } catch (x) { out.push({ ...f, hata: String(x && x.message || x) }); } }
  return out; });
ipcMain.handle('wa-alindi', (e, ids) => { okcLicensed(); return auth.waAlindi(ids || []); });
ipcMain.handle('wa-numara', () => auth.waNumara());
ipcMain.handle('wa-numara-bagla', (e, a) => auth.waNumaraBagla((a || {}).id, (a || {}).display));
ipcMain.handle('module-open', (e, id) => auth.openModule(String(id || '')));
ipcMain.handle('license-refresh', () => auth.licenseRefresh());
ipcMain.handle('license-activate', (e, key) => auth.activate(key));
ipcMain.handle('reg-save', (e, reg) => auth.saveReg(reg));
// Yönetim: yalnız program sahibi + girişte yönetim şifresi (oturum boyunca, modülden çıkınca kilitlenir)
let admAcik = false;
const admKontrol = () => { if (!auth.isAdmin()) throw new Error('Bu işlem için yetkiniz yok.'); if (!admAcik) throw new Error('Yönetim şifresi girilmedi.'); };
ipcMain.handle('admin-call', (e, fn, args) => { admKontrol(); return auth.admin(fn, args); });
ipcMain.handle('admin-unlock', async (e, pin) => { admAcik = false; const r = await auth.adminPin(pin); admAcik = !!(r && r.ok); return r; });
ipcMain.handle('admin-lock', () => { admAcik = false; return true; });
ipcMain.handle('admin-pin-set', async (e, a) => { admKontrol(); return auth.adminPinSet((a || {}).eski, (a || {}).yeni); });
ipcMain.handle('admin-ok', () => auth.isAdmin());
// TCMB döviz alış kurları (işlem tarihinden önceki son iş günü); Chromium ağı (sistem vekil sunucusu / sertifikaları) kullanılır
let kurSrv = null;
ipcMain.handle('tcmb-kurlar', (e, istekler) => {
  if (!kurSrv) kurSrv = makeKur(() => acctDir || userDir(), { fetchFn: (u, o) => require('electron').net.fetch(u, o) });
  return kurSrv.kurlar(Array.isArray(istekler) ? istekler.slice(0, 2000) : []);
});
ipcMain.handle('app-duyuru', () => auth.duyuru());
// Yeni lisans kodu partisi: kodlar BU bilgisayarda üretilir, kullanıcının seçtiği GİZLİ CSV'ye yazılır; sunucuya yalnız özetler gider.
ipcMain.handle('admin-kod-uret', async (e, a) => {
  admKontrol();
  const o = a || {}; const mod = String(o.modul || ''); const adet = Math.floor(+o.adet || 0); const gun = Math.floor(+o.gun || 365);
  if (!/^[a-z]+$/.test(mod)) throw new Error('Modül seçin.');
  if (!(adet >= 1 && adet <= 2000)) throw new Error('Adet 1 ile 2000 arasında olmalı.');
  if (!(gun >= 1 && gun <= 3660)) throw new Error('Gün 1 ile 3660 arasında olmalı.');
  const parti = String(o.parti || '').trim().slice(0, 60) || `${mod}-${new Date().toISOString().slice(0, 10)}-${adet}`;
  const r = await dialog.showSaveDialog(win, { title: 'Lisans kodlarının kaydedileceği GİZLİ dosya', defaultPath: path.join(app.getPath('documents'), `GIZLI-${mod}-lisans-kodlari-${parti}.csv`), filters: [{ name: 'CSV', extensions: ['csv'] }] });
  if (r.canceled || !r.filePath) return { ok: false };
  const kodlar = kodUret(adet);
  const sonuc = await auth.admin('admin_codes_add', { p_hashes: kodlar.map(k => kodOzet(k)), p_days: gun, p_module: mod, p_batch: parti });
  const csv = ['sira;modul;gun;parti;kod', ...kodlar.map((k, i) => `${i + 1};${mod};${gun};${parti};${kodGrupla(k)}`)].join('\r\n');
  fs.writeFileSync(r.filePath, '\ufeff' + csv);
  return { ok: true, added: (sonuc && sonuc.added) || 0, path: yazildi(r.filePath), parti, kodlar: adet <= 20 ? kodlar.map(kodGrupla) : null };
});
ipcMain.handle('app-info', () => ({ version: app.getVersion(), dataDir: userDir() }));
// Hata günlüğü: arayüz hataları ve ana süreç hataları Belgeler\MuhaWin Günlük\hatalar.log'a yazılır
const gunlukDosya = () => path.join(app.getPath('documents'), 'MuhaWin Günlük', 'hatalar.log');
function hataYaz(kaynak, metin) {
  try { fs.mkdirSync(path.dirname(gunlukDosya()), { recursive: true });
    const satir = `[${new Date().toISOString()}] [${app.getVersion()}] [${kaynak}] ${String(metin).replace(/\s+/g, ' ').slice(0, 2000)}\n`;
    fs.appendFileSync(gunlukDosya(), satir);
    try { if (fs.statSync(gunlukDosya()).size > 2e6) { const t = fs.readFileSync(gunlukDosya(), 'utf8'); fs.writeFileSync(gunlukDosya(), t.slice(-1e6)); } } catch (e) {} } catch (e) {}
}
process.on('uncaughtException', e => hataYaz('main', e && e.stack || e));
process.on('unhandledRejection', e => hataYaz('main-promise', e && e.stack || e));
ipcMain.handle('hata-yaz', (e, a) => { hataYaz('arayuz', (a && a.metin) || ''); return true; });
ipcMain.handle('hata-gunlugu-ac', () => { try { fs.mkdirSync(path.dirname(gunlukDosya()), { recursive: true }); if (!fs.existsSync(gunlukDosya())) fs.writeFileSync(gunlukDosya(), ''); return shell.showItemInFolder(gunlukDosya()); } catch (e) { return false; } });
ipcMain.handle('hata-gunlugu-oku', () => { try { return fs.readFileSync(gunlukDosya(), 'utf8').slice(-20000); } catch (e) { return ''; } });
// Yedekleme: hesap klasörünün tamamı seçilen klasöre kopyalanır / oradan geri alınır
function klasorKopyala(kaynak, hedef) { fs.mkdirSync(hedef, { recursive: true }); for (const d of fs.readdirSync(kaynak, { withFileTypes: true })) { const s = path.join(kaynak, d.name), h = path.join(hedef, d.name); if (d.isDirectory()) { if (d.name === 'yedek' || d.name === 'ocr-onbellek') continue; klasorKopyala(s, h); } else fs.copyFileSync(s, h); } }
ipcMain.handle('yedek-al', async () => { needAuth(); const r = await dialog.showOpenDialog(win, { title: 'Yedeğin kaydedileceği klasör', properties: ['openDirectory', 'createDirectory'] }); if (r.canceled || !r.filePaths[0]) return { ok: false };
  const ad = 'MuhaWin-yedek-' + new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-'); const hedef = path.join(r.filePaths[0], ad); klasorKopyala(acctDir || userDir(), hedef); return { ok: true, path: hedef }; });
ipcMain.handle('yedek-geri-yukle', async () => { needAuth(); const r = await dialog.showOpenDialog(win, { title: 'Geri yüklenecek yedek klasörü (MuhaWin-yedek-…)', properties: ['openDirectory'] }); if (r.canceled || !r.filePaths[0]) return { ok: false };
  const k = r.filePaths[0]; if (!fs.existsSync(path.join(k, 'veri.json')) && !fs.existsSync(path.join(k, 'firmalar')) && !fs.readdirSync(k).length) throw new Error('Bu klasör bir MuhaWin yedeği gibi görünmüyor.');
  backup(); klasorKopyala(k, acctDir || userDir()); if (ds && ds.unwatch) ds.unwatch(); ds = makeDataStore(acctDir); ds.load(); ds.watch(() => { if (win && !win.isDestroyed()) win.webContents.send('data-changed'); });
  return { ok: true, path: k }; });

// --- Luca ---
ipcMain.handle('luca-open', () => luca.openLogin());
ipcMain.handle('luca-calis', () => luca.calis());
ipcMain.handle('luca-captcha-gir', (e, kod) => luca.captchaGir(kod));
ipcMain.handle('luca-captcha-yenile', () => luca.captchaYenile());
ipcMain.handle('luca-giris-goster', () => luca.girisGoster());
ipcMain.handle('luca-status', () => luca.status());
ipcMain.handle('luca-firms', () => luca.listFirms());
ipcMain.handle('luca-mizan', (e, args) => luca.fetchMizan(args));
ipcMain.handle('luca-prepare-fis', (e, args) => luca.prepareFis(args));
ipcMain.handle('luca-fis-kes', (e, args) => luca.fisKes(args));
// Rapordaki fişi Luca'da göster (Görev 37): yalnız fiş listesi süzülür, fişte değişiklik yapılmaz
ipcMain.handle('luca-fis-goster', (e, a) => { const o = a || {};
  const lucaId = String(o.lucaId || ''), year = String(o.year || ''), fisNo = String(o.fisNo || '').trim();
  if (!/^\d{1,12}$/.test(lucaId) || !/^20\d\d$/.test(year) || !fisNo || fisNo.length > 20 || /[^0-9A-Za-z\-\/]/.test(fisNo)) throw new Error('Geçersiz fiş bilgisi.');
  return luca.fisGoster({ lucaId, year, fisNo }); });
ipcMain.handle('luca-hesap-plani', (e, a) => luca.hesapPlani(a || {}));
// muavin: açık Luca oturumuyla indirilir, Fatura Kontrol'ün firma / dönem klasörüne yazılır (ayrı tarayıcı açılmaz)
ipcMain.handle('luca-muavin-indir', async (e, a) => { fkLicensed(); const o = a || {};
  const ay = String(o.ay || ''); if (!/^20\d\d-(0[1-9]|1[0-2])$/.test(ay)) throw new Error('Dönem geçersiz');
  // İşletme / serbest meslek defteri: muavin yerine Gelir ve Gider Listesi (toplu kontroldekiyle aynı)
  let defter = String(o.defter || '');
  if (!/^(bilanco|isletme|serbest)$/.test(defter)) { try { defter = (await luca.defterTuru({ lucaId: o.lucaId, year: ay.slice(0, 4) })).defter; } catch (x) { defter = ''; } }
  if (defter === 'isletme' || defter === 'serbest') {
    const L = await luca.isletmeListesiIndir({ lucaId: o.lucaId, year: ay.slice(0, 4) });
    const veri = Buffer.from(JSON.stringify(L), 'utf8');
    const y2 = await fk.request('POST', '/api/muavin/yukle', { ad: String(o.ad || o.lucaId), luca_id: String(o.lucaId), yil: +ay.slice(0, 4), ay: +ay.slice(5, 7), program: 'luca_isletme', dosya_adi: 'muavin_isletme.json', b64: veri.toString('base64') });
    return { ...y2, boyut: veri.length, defter, gelir: L.gelir.length, gider: L.gider.length };
  }
  const r = await luca.muavinIndir({ lucaId: o.lucaId, year: ay.slice(0, 4) });
  const y = await fk.request('POST', '/api/muavin/yukle', { ad: String(o.ad || o.lucaId), luca_id: String(o.lucaId), yil: +ay.slice(0, 4), ay: +ay.slice(5, 7), program: 'luca', dosya_adi: 'muavin' + r.uzanti, b64: Buffer.from(r.veri).toString('base64') });
  return { ...y, boyut: r.veri.length }; });
ipcMain.handle('luca-hesap-ekle', (e, a) => luca.hesapEkle(a || {}));
ipcMain.handle('luca-defter-turu', (e, a) => luca.defterTuru(a || {}));
ipcMain.handle('luca-kdv-hesaplari', (e, a) => luca.kdvHesaplari(a || {}));
ipcMain.handle('luca-hesap-ara-vkn', (e, a) => luca.hesapAraVkn(a || {}));
ipcMain.handle('luca-doviz-kodlari', () => luca.dovizKodlari());
ipcMain.handle('luca-isletme-listeleri', (e, a) => luca.isletmeListeleri(a || {}));
ipcMain.handle('luca-kayit-baslat', () => luca.kayitBaslat());
ipcMain.handle('luca-kayit-durum', () => luca.kayitDurumu());
// Luca istek kayıtları fatura / muavin içeriğini düz metin tutar (rapor-02 D16): 7 günden eskiler silinir
const KAYIT_KLASORU = () => path.join(app.getPath('documents'), 'MuhaWin Luca Kayıtları');
function eskiLucaKayitlariniSil(gun = 7) {
  try {
    const dir = KAYIT_KLASORU(); const sinir = Date.now() - gun * 864e5;
    for (const ad of fs.readdirSync(dir)) {
      if (!/^luca-istek-kaydi-.*\.json$/.test(ad)) continue;
      const y = path.join(dir, ad); try { if (fs.statSync(y).mtimeMs < sinir) fs.unlinkSync(y); } catch (e) {}
    }
  } catch (e) {}
}
app.whenReady().then(() => eskiLucaKayitlariniSil());
ipcMain.handle('luca-kayit-durdur', async () => {
  const olaylar = luca.kayitDurdur();
  eskiLucaKayitlariniSil();
  const dir = KAYIT_KLASORU(); fs.mkdirSync(dir, { recursive: true });
  const dosya = path.join(dir, 'luca-istek-kaydi-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) + '.json');
  fs.writeFileSync(dosya, JSON.stringify({ uyari: 'Bu dosya Luca\'dan gelen fatura ve muavin içeriklerini düz metin olarak içerir. Destek için gönderdikten sonra silin; MuhaWin 7 gün sonra kendiliğinden siler.', surum: app.getVersion(), olusturuldu: new Date().toISOString(), adet: olaylar.length, pencere: olaylar.pencere, atlanan: olaylar.atlanan || {}, olaylar: [...olaylar] }, null, 1), 'utf8');
  shell.showItemInFolder(dosya);
  return { dosya, adet: olaylar.length };
});
ipcMain.handle('luca-logout', () => luca.logout());
ipcMain.handle('luca-cred-get', () => { const c = readCreds(); return { uyeno: c.uyeno || '', kullanici: c.kullanici || '', hasParola: !!c.parola, uyeKilitli: !!c.uyeKilitli }; });
ipcMain.handle('luca-cred-set', (e, c) => {
  const cur = readCredsRaw();
  const next = { uyeno: officeUye() || (c && c.uyeno) || '', kullanici: (c && c.kullanici) || '' };
  next.parola = (c && typeof c.parola === 'string' && c.parola.length) ? c.parola : (cur.parola || '');
  writeCreds(next); fkConfigure(); return true;
});
ipcMain.handle('luca-cred-clear', () => { try { fs.unlinkSync(credFile()); } catch (e) {} fkConfigure(); return true; });

// --- Fatura Kontrol modülü ---
ipcMain.handle('fk-start', async () => {
  fkLicensed();
  const r = await fk.start();
  lucaPayPort = 0; setTimeout(() => lucaOturumPaylas(false), 500);   // modül (yeniden) başladı: oturum yeniden verilir
  return r;
});
ipcMain.handle('fk-info', () => fk.info());
// Fatura Kontrol (Python) servisi: Muhasebe İşlemleri, Denetim ve Analiz ya da Özel İşlemler lisanslarından biri yeterli
const fkLicensed = () => { const ls = ['fatura', 'denetim', 'ozel'].map(m => auth.moduleStatus(m)); if (!ls.some(l => l && l.valid)) throw new Error(((ls[0] || {}).reason) || 'Muhasebe İşlemleri lisansı geçerli değil.'); };
// Firmalar: MuhaWin'deki (Luca'dan eklenmiş) firmalar ya da Luca'nın tüm listesi Fatura Kontrol'ün firma listesine yazılır
ipcMain.handle('fk-set-firms', (e, firmalar, tam) => { fkLicensed(); return fk.request('POST', '/api/toplu/firmalar/muhawin', { firmalar: firmalar || [], tam: !!tam }); });
// Firma silinirken Fatura Kontrol verisi (muavinler / tüm belgeler) — lisans gerekmez, modül kapalıysa sessizce geçilir
ipcMain.handle('fk-firma-sil', async (e, b) => { try { return await fk.request('POST', '/api/firma/sil', b || {}); } catch (err) { return { tamam: false, hata: String(err.message || err) }; } });
ipcMain.handle('fk-kayit-adaylari', (e, id) => { fkLicensed(); return fk.request('GET', '/api/kayit/adaylar?id=' + encodeURIComponent(String(id || ''))); });
ipcMain.handle('fk-muavin-list', () => { fkLicensed(); return fk.request('GET', '/api/muavin/donemler'); });
// Faturayı PDF olarak gösterir: GİB görsel şablonuyla açılan sayfa PDF'e basılır, Chromium PDF görüntüleyicisinde açılır
ipcMain.handle('fk-fatura-pdf', async (e, a) => {
  fkLicensed();
  const o = a || {}; await fk.start(); const base = fk.info().url;
  if (!base) throw new Error('Fatura Kontrol modülü çalışmıyor.');
  const belge = String(o.belge || '');
  // faturaya gömülü şablon güvenilmez: bu pencerede JavaScript kapalı (yalnız PDF'e yazdırılır)
  const w = new BrowserWindow({ show: false, width: 1000, height: 1400, webPreferences: { sandbox: true, contextIsolation: true, javascript: false } });
  try {
    let kod = 0; w.webContents.on('did-navigate', (ev, url, c) => { kod = c; });
    await w.loadURL(base + '/api/fatura/goruntu?id=' + encodeURIComponent(String(o.id || '')) + '&belge=' + encodeURIComponent(belge));
    if (kod === 404) throw new Error('Faturanın kendisi (XML) bu dönemin arşivinde bulunamadı.');
    if (kod !== 200) throw new Error('Fatura görüntülenemedi (HTTP ' + kod + ').');
    const pdf = await w.webContents.printToPDF({ printBackground: true, pageSize: 'A4', margins: { marginType: 'default' } });
    const dir = path.join(app.getPath('temp'), 'MuhaWin-faturalar'); fs.mkdirSync(dir, { recursive: true });
    const dosya = path.join(dir, 'Fatura_' + belge.replace(/[^\w.-]+/g, '_') + '.pdf');
    fs.writeFileSync(dosya, pdf);
    const v = new BrowserWindow({ width: 900, height: 1100, title: 'Fatura ' + belge, autoHideMenuBar: true, webPreferences: { plugins: true, sandbox: true, contextIsolation: true } });
    v.removeMenu(); v.loadFile(dosya);
    return { ok: true, path: dosya };
  } finally { if (!w.isDestroyed()) w.destroy(); }
});
// program içinde hazırlanan bir sayfayı (fiş, liste) PDF yapıp görüntüleyicide açar: yazdır / kaydet oradan
ipcMain.handle('html-pdf', async (e, a) => {
  const o = a || {}; const html = String(o.html || ''); if (!html || html.length > 8e6) throw new Error('Sayfa boş');
  const ad = String(o.ad || 'MuhaWin').replace(/[^\wÇĞİÖŞÜçğıöşü.-]+/g, '_').slice(0, 80);
  const w = new BrowserWindow({ show: false, width: 1000, height: 1400, webPreferences: { sandbox: true, contextIsolation: true, javascript: false } });
  try {
    await w.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    const pdf = await w.webContents.printToPDF({ printBackground: true, pageSize: 'A4', landscape: !!o.yatay, margins: { marginType: 'default' } });
    const dir = path.join(app.getPath('temp'), 'MuhaWin-pdf'); fs.mkdirSync(dir, { recursive: true });
    const dosya = path.join(dir, ad + '_' + Date.now() + '.pdf'); fs.writeFileSync(dosya, pdf);
    const v = new BrowserWindow({ width: 900, height: 1100, title: ad, autoHideMenuBar: true, webPreferences: { plugins: true, sandbox: true, contextIsolation: true } });
    v.removeMenu(); v.loadFile(dosya);
    return { ok: true, path: dosya };
  } finally { if (!w.isDestroyed()) w.destroy(); }
});
ipcMain.handle('fk-kayit-haric', (e, b) => { fkLicensed(); return fk.request('POST', '/api/kayit/haric', b || {}); });
ipcMain.handle('fk-muavin-programlar', () => { fkLicensed(); return fk.request('GET', '/api/muavin/programlar'); });
ipcMain.handle('fk-muavin-yukle', (e, b) => { fkLicensed(); const o = b || {};
  return fk.request('POST', '/api/muavin/yukle', { ad: String(o.ad || ''), luca_id: o.luca_id ? String(o.luca_id) : null, yil: o.yil, ay: o.ay,
    program: String(o.program || ''), dosya_adi: String(o.dosya_adi || ''), b64: Buffer.from(o.veri || []).toString('base64') }); });
// Çek / Senet sayfasından muavin indirme: Fatura Kontrol'ün toplu otomasyonu tek firma için (varsa yalnız muavin adımı)
ipcMain.handle('fk-muavin-cek', async (e, b) => { fkLicensed(); const o = b || {};
  const id = String(o.id || ''), ay = String(o.ay || '');
  if (!/^\d+$/.test(id) || !/^20\d\d-(0[1-9]|1[0-2])$/.test(ay)) throw new Error('Firma ya da dönem geçersiz');
  await fk.request('POST', '/api/toplu/firmalar/muhawin', { firmalar: [{ id, ad: String(o.ad || id) }], tam: false }).catch(() => {});
  // yalnız muavin indirilir (e-belgeler yeniden indirilmez); önceki çalışma yoksa sunucu klasörü kendisi açar
  return fk.request('POST', '/api/toplu/baslat', { ay, idler: [id], klasor: ay, adim: 'muavin' }); });
ipcMain.handle('fk-toplu-durum', () => { fkLicensed(); return fk.request('GET', '/api/toplu/durum'); });
ipcMain.handle('fk-muavin-get', (e, id) => { fkLicensed(); return fk.request('GET', '/api/muavin?id=' + encodeURIComponent(String(id || ''))); });
ipcMain.handle('fk-storage', () => { fkLicensed(); return fk.request('GET', '/api/depolama'); });
ipcMain.handle('fk-wipe', () => { fkLicensed(); return fk.request('POST', '/api/verileri-sil', { onay: 'SİL' }); });
ipcMain.handle('fk-open-folder', () => { const d = fk.dataDir(); if (!d) throw new Error('Önce programa giriş yapın.'); fs.mkdirSync(d, { recursive: true }); return shell.openPath(d); });
ipcMain.handle('fk-restart', async () => { fk.stop(); return fk.start(); });
