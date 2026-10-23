// Görev 18: Luca giriş düğmeleri (üst şerit, komut paleti, doğrulama kodu kutusu) – gerçek Luca'ya gidilmez:
// ana süreçteki luca-* IPC işleyicileri test içinde taklitle değiştirilir.  xvfb-run -a node test/luca-dugme-tarama.js
const { _electron: electron } = require('playwright');
const path = require('path'), fs = require('fs'), os = require('os');
const sb = require('./sahte_sb');
const APP = path.resolve(__dirname, '..');
const ok = [], bad = [];
const check = (c, m) => { (c ? ok : bad).push(m); console.log((c ? '  ✓ ' : '  ✗ ') + m); };
(async () => {
  const fake = await sb.start({ fatura: 'lisansli', ekstre: 'lisansli' });
  const cfg = fs.mkdtempSync(path.join(os.tmpdir(), 'mw-'));
  const app = await electron.launch({ executablePath: require(path.join(APP, 'node_modules/electron')), args: [APP, '--no-sandbox'],
    env: { ...process.env, EKSTRE_TEST_SB: fake.url, XDG_CONFIG_HOME: cfg, MUHAWIN_NO_SPLASH: '1' } });
  const hatalar = [];
  try {
    // luca IPC'leri taklit: çağrılar kaydedilir
    await app.evaluate(({ ipcMain }) => {
      global.__cagri = [];
      const k = (ad, d) => { try { ipcMain.removeHandler(ad); } catch (e) {} ipcMain.handle(ad, (e, a) => { global.__cagri.push(ad); return typeof d === 'function' ? d(a) : d; }); };
      k('luca-open', { opened: true, gizli: true }); k('luca-calis', { ok: true, giris: true }); global.__durum = { loggedIn: false, windows: 0 }; k('luca-status', () => global.__durum); k('luca-firms', []);
      k('luca-captcha-gir', { ok: true, sonuc: 'basildi' }); k('luca-captcha-yenile', { ok: true }); k('luca-giris-goster', { ok: true });
    });
    const w = await app.firstWindow();
    w.on('pageerror', e => hatalar.push('pageerror: ' + e.message));
    w.on('console', m => { if (m.type() === 'error') hatalar.push('console: ' + m.text()); });
    await w.waitForSelector('#authGate:not([hidden]) input[type=email]', { timeout: 15000 });
    const gb = await w.$('#authGate >> text=Zaten üyeyim, giriş yap'); if (gb) { await gb.click(); await w.waitForTimeout(300); }
    await w.fill('#authGate input[type=email]', 'test@ornek.com'); await w.fill('#authGate input[type=password]', 'Sifre1234');
    await w.click('#authGate .btn.primary');
    await w.waitForSelector('#modGate:not([hidden]) .modcard', { timeout: 15000 });
    await w.click('.modcard[data-mod=ekstre]'); await w.waitForSelector('#modGate', { state: 'hidden' });
    const cagri = () => app.evaluate(() => global.__cagri.splice(0));
    await cagri();
    await w.click('#lucaTopBtn'); await w.waitForTimeout(400);
    check((await cagri()).includes('luca-open'), 'üst şerit "Luca\'ya giriş" → luca-open çağrıldı');
    // ana süreç doğrulama kodunu gönderir (kayıtlı Luca bilgisiyle gizli giriş)
    const RESIM = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    await app.evaluate(({ BrowserWindow }, r) => BrowserWindow.getAllWindows()[0].webContents.send('luca-event', 'captcha', { resim: r }), RESIM);
    await w.waitForTimeout(500);
    check(await w.isVisible('#lucaCap'), 'doğrulama kodu kutusu açıldı');
    if (await w.isVisible('#lucaCap')) {
      await w.fill('#lucaCapKod', '7K3P'); await w.click('#lucaCapGir'); await w.waitForTimeout(400);
      check((await cagri()).includes('luca-captcha-gir'), 'kutudaki Giriş → luca-captcha-gir çağrıldı');
      check(!(await w.isVisible('#lucaCap')), 'kod gönderilince kutu kapanır');
      await app.evaluate(({ BrowserWindow }, r) => BrowserWindow.getAllWindows()[0].webContents.send('luca-event', 'captcha', { resim: r }), RESIM);
      await w.waitForTimeout(400);
      if (await w.isVisible('#lucaCap')) { await w.click('#lucaCapYenile'); await w.waitForTimeout(300); check((await cagri()).includes('luca-captcha-yenile'), 'Yeni kod → luca-captcha-yenile'); }
    }
    await w.evaluate(() => { const k = document.getElementById('lucaCap'); if (k) k.remove(); });
    await app.evaluate(({ BrowserWindow }, r) => BrowserWindow.getAllWindows()[0].webContents.send('luca-event', 'captcha', { resim: r }), RESIM);
    await w.waitForTimeout(400);
    if (await w.isVisible('#lucaCap')) { await w.click('#lucaCapGoster'); await w.waitForTimeout(300); check((await cagri()).includes('luca-giris-goster'), 'Luca\'yı göster → luca-giris-goster'); }
    await app.evaluate(({ BrowserWindow }, r) => BrowserWindow.getAllWindows()[0].webContents.send('luca-event', 'captcha', { resim: r }), RESIM);
    await w.waitForTimeout(400);
    if (await w.isVisible('#lucaCap')) { await w.click('#lucaCapVazgec'); await w.waitForTimeout(200); check(!(await w.isVisible('#lucaCap')), 'Vazgeç kutuyu kapatır'); }
    await app.evaluate(({ BrowserWindow }, r) => BrowserWindow.getAllWindows()[0].webContents.send('luca-event', 'captcha', { resim: r }), RESIM);
    await w.waitForTimeout(400);
    if (await w.isVisible('#lucaCap')) { await w.focus('#lucaCapKod'); await w.keyboard.press('Escape'); await w.waitForTimeout(200); check(!(await w.isVisible('#lucaCap')), 'Esc kutuyu kapatır'); }
    check(!hatalar.length, 'sayfa / konsol hatası yok');
    // "Mizanları güncelle" Luca bağlı değilken: kendi "Luca'yı aç" düğmesi yok, üst şeritteki giriş düğmesi vurgulanır
    await w.click('#toolbar [data-luca=mizan]'); await w.waitForSelector('#lucaModal:not([hidden])'); await w.waitForTimeout(300);
    check(!(await w.$('#lucaModal [data-lgo=open]')) && /üst şeritteki/.test(await w.textContent('#lucaModal')), 'Mizanları güncelle: ayrı "Luca\'yı aç" yok, üst şeritteki düğmeye yönlendiriyor');
    check(await w.evaluate(() => document.getElementById('lucaTopBtn').classList.contains('vurgu')), 'üst şeritteki "Luca\'ya giriş" vurgulandı');
    await app.evaluate(({ BrowserWindow }) => { global.__durum = { loggedIn: true, windows: 1 }; BrowserWindow.getAllWindows()[0].webContents.send('luca-event', 'durum', global.__durum); });
    await w.waitForTimeout(800);
    check(/Mizanları güncelle/i.test(await w.textContent('#lucaTitle')) && !/üst şeritteki/.test(await w.textContent('#lucaModal')), 'bağlanınca pencere kendiliğinden mizan adımına geçti');
    await w.keyboard.press('Escape'); await w.waitForTimeout(200);
    await app.evaluate(({ BrowserWindow }) => { global.__durum = { loggedIn: false, windows: 0 }; BrowserWindow.getAllWindows()[0].webContents.send('luca-event', 'durum', global.__durum); });
    await w.waitForTimeout(300);
    if (await w.isVisible('#lucaCalisBtn')) { await w.click('#lucaCalisBtn'); await w.waitForTimeout(400); check((await cagri()).includes('luca-calis'), 'Luca\'da Çalış → luca-calis'); }
  } catch (e) { bad.push('HATA: ' + e.message); console.error(e); }
  finally { console.log('Hatalar:\n' + hatalar.join('\n')); await app.close().catch(() => {}); fake.server.close(); }
  console.log(`\n${ok.length} geçti, ${bad.length} başarısız`);
  process.exit(bad.length ? 1 : 0);
})();
