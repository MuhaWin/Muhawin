// Görev 18: ekranlardaki düğmelerin taranması – her görünür düğmeye basılır; sayfa hatası, konsol hatası ve
// "hiçbir etki yok" (DOM değişmedi, ana sürece çağrı gitmedi) kaydedilir. Gerçek Luca / GİB'e gidilmez:
// luca-* IPC'leri ve dosya pencereleri taklit edilir.  xvfb-run -a node test/dugme-tarama.js [modül…]
const { _electron: electron } = require('playwright');
const path = require('path'), fs = require('fs'), os = require('os');
const sb = require('./sahte_sb');
const APP = path.resolve(__dirname, '..');
const MODULLER = process.argv.slice(2).length ? process.argv.slice(2) : ['ekstre', 'fatura', 'okc'];
const ATLA = /çıkış|oturumu kapat|hesaptan çık|güncelle(meleri denetle)?$|yeniden başlat/i;
const sonuc = [];
const DOSYA = process.env.OUT || path.join(os.tmpdir(), 'dugme-tarama.json');
const kaydet = () => { try { fs.writeFileSync(DOSYA, JSON.stringify(sonuc, null, 1)); } catch (e) {} };

async function ac(mod) {
  const fake = await sb.start({ fatura: 'lisansli', ekstre: 'lisansli' });
  const cfg = fs.mkdtempSync(path.join(os.tmpdir(), 'mw-'));
  const app = await electron.launch({ executablePath: require(path.join(APP, 'node_modules/electron')), args: [APP, '--no-sandbox'],
    env: { ...process.env, EKSTRE_TEST_SB: fake.url, XDG_CONFIG_HOME: cfg, MUHAWIN_NO_SPLASH: '1' } });
  await app.evaluate(({ ipcMain, dialog, shell }) => {
    global.__cagri = 0;
    const k = (ad, d) => { try { ipcMain.removeHandler(ad); } catch (e) {} ipcMain.handle(ad, () => { global.__cagri++; return d; }); };
    k('luca-open', { opened: true }); k('luca-calis', { ok: true, giris: true }); k('luca-status', { loggedIn: false, windows: 0 });
    k('luca-captcha-gir', { ok: true }); k('luca-captcha-yenile', { ok: true }); k('luca-giris-goster', { ok: true });
    for (const ad of ['luca-firms', 'luca-mizan', 'luca-hesap-plani', 'luca-muavin-indir', 'luca-isletme-listeleri', 'luca-doviz-kodlari', 'luca-fis-kes', 'luca-prepare-fis'])
      k(ad, Promise.reject(Object.assign(new Error('NO_SESSION: Luca oturumu açık değil (test)'))).catch(e => { throw e; }));
    dialog.showOpenDialog = async () => { global.__cagri++; return { canceled: true, filePaths: [] }; };
    dialog.showSaveDialog = async () => { global.__cagri++; return { canceled: true }; };
    dialog.showMessageBox = async () => { global.__cagri++; return { response: 0 }; };
    shell.openExternal = async () => { global.__cagri++; };
    const eski = ipcMain.emit.bind(ipcMain);  // ipcRenderer.send / invoke sayacı
    ipcMain.emit = (...a) => { global.__cagri++; return eski(...a); };
  });
  const w = await app.firstWindow();
  const hata = [];
  w.on('pageerror', e => hata.push('pageerror: ' + e.message));
  w.on('console', m => { if (m.type() === 'error' && !/favicon|net::ERR/.test(m.text())) hata.push('console: ' + m.text().slice(0, 200)); });
  w.on('filechooser', fc => fc.setFiles([]).catch(() => {}));
  w.on('dialog', d => d.dismiss().catch(() => {}));
  await w.waitForSelector('#authGate:not([hidden]) input[type=email]', { timeout: 15000 });
  const gb = await w.$('#authGate >> text=Zaten üyeyim, giriş yap'); if (gb) { await gb.click(); await w.waitForTimeout(300); }
  await w.fill('#authGate input[type=email]', 'test@ornek.com'); await w.fill('#authGate input[type=password]', 'Sifre1234');
  await w.click('#authGate .btn.primary');
  await w.waitForSelector('#modGate:not([hidden]) .modcard', { timeout: 15000 });
  await w.evaluate(() => {
    window.__mut = 0;
    new MutationObserver(L => { for (const m of L) { const t = m.target.nodeType === 1 ? m.target : m.target.parentElement;
      if (t && !t.closest('[data-lucabag],#modLuca,#islerBtn')) window.__mut++; } })
      .observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
  });
  return { app, w, fake, hata };
}
const gir = async (w, mod) => { if (await w.isVisible('#modGate')) { await w.click(`.modcard[data-mod=${mod}]`); await w.waitForSelector('#modGate', { state: 'hidden', timeout: 15000 }); await w.waitForTimeout(800); } };
// açık kutuları kapat: Escape, ardından görünür kapat / vazgeç düğmeleri
const ACIK = '.modal:not([hidden]),#mmPanel:not([hidden]),#fkKayit:not([hidden]),#mwAra:not([hidden]),.mmmenu:not([hidden]),.thememenu:not([hidden]),#mwBusy:not([hidden]),#popForm,dialog[open],#hsDrop:not([hidden]),#kzMenu,#lucaCap';
// açık kutu / panel varsa Esc (Görev 17'den sonra ana ekranda Esc modül seçimine döndüğü için yalnız açık bir şey varken)
async function temizle(w) {
  await w.evaluate(() => { const k = document.getElementById('lucaCap'); if (k) k.remove(); }).catch(() => {});
  for (let i = 0; i < 4; i++) {
    const acik = await w.evaluate(s => [...document.querySelectorAll(s)].some(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }), ACIK).catch(() => false);
    if (!acik) break;
    await w.keyboard.press('Escape').catch(() => {}); await w.waitForTimeout(150);
  }
}
const anahtar = () => {
  const vis = e => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && !e.closest('[hidden]'); };
  window.__taraNo = window.__taraNo || 0;
  return [...document.querySelectorAll('button, [role=button], a.btn')].filter(e => vis(e) && !e.disabled).map(e => {
    if (!e.dataset.mwtara) e.dataset.mwtara = String(++window.__taraNo);
    const ad = (e.innerText || e.title || e.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 60);
    const kap = e.closest('[id]'); return { s: e.id ? '#' + e.id : null, t: e.dataset.mwtara, ad, kap: kap ? kap.id : '' };
  });
};
// işaret (data-mwtara) yeniden çizimde kaybolursa aynı kaptaki aynı yazılı düğme
async function bul(w, b) {
  if (b.s) return w.locator(b.s).first();
  const l = w.locator(`[data-mwtara="${b.t}"]`).first();
  if (await l.count()) return l;
  return w.locator(`${b.kap ? '#' + b.kap + ' ' : ''}:is(button,[role=button],a.btn)`).filter({ hasText: b.ad.slice(0, 40) }).first();
}
let o;
async function tara(mod, liste, gorulen, ust) {
  for (const b of liste) {
    const k = b.s || b.kap + '>' + b.ad; if (gorulen.has(k)) continue; gorulen.add(k);
    try {
      if (o.app.process().exitCode != null || o.w.isClosed()) { o = await ac(mod); }
      await gir(o.w, mod);
      let loc = await bul(o.w, b);
      if (ust && !(await loc.isVisible().catch(() => false))) { await temizle(o.w); await (await bul(o.w, ust)).click({ timeout: 2000 }).catch(() => {}); await o.w.waitForTimeout(500); loc = await bul(o.w, b); }
      if (!(await loc.isVisible().catch(() => false))) { sonuc.push({ mod, ust: ust && ust.ad, ...b, durum: 'görünmüyor (önceki düğme ekranı değiştirdi)' }); continue; }
      const once = new Set((await o.w.evaluate(anahtar)).map(x => x.t));
      await o.w.evaluate(() => { window.__mut = 0; }); await o.app.evaluate(() => { global.__cagri = 0; });
      const h0 = o.hata.length;
      let tik = 'ok';
      await loc.click({ timeout: 3000 }).catch(e => { tik = /intercepts pointer events/.test(e.message) ? 'üstü kapalı' : 'tıklanamadı: ' + e.message.split('\n')[0]; });
      await o.w.waitForTimeout(700);
      const mut = await o.w.evaluate(() => window.__mut).catch(() => -1), cagri = await o.app.evaluate(() => global.__cagri).catch(() => -1);
      const yeni = o.hata.slice(h0);
      const durum = tik !== 'ok' ? tik : yeni.length ? 'HATA' : (mut === 0 && cagri === 0 ? 'etkisiz' : 'ok');
      sonuc.push({ mod, ust: ust && ust.ad, ...b, durum, mut, cagri, hata: yeni });
      if (durum !== 'ok') console.log(`  ${durum.padEnd(12)} ${ust ? '(' + ust.ad + ') ' : ''}${b.s || ''} «${b.ad}» [${b.kap}] ${yeni.join(' | ')}`);
      if (!ust && durum === 'ok') {                     // açılan panel / kutudaki yeni düğmeler (bir düzey)
        const ic = (await o.w.evaluate(anahtar)).filter(x => !once.has(x.t) && x.ad && !ATLA.test(x.ad));
        if (ic.length) { console.log(`   ↳ «${b.ad}»: ${ic.length} yeni düğme`); await tara(mod, ic, gorulen, b); }
      }
      await temizle(o.w); kaydet();
    } catch (e) { sonuc.push({ mod, ...b, durum: 'test hatası: ' + e.message.split('\n')[0] }); }
  }
}

(async () => {
  for (const mod of MODULLER) {
    o = await ac(mod); await gir(o.w, mod);
    const liste = (await o.w.evaluate(anahtar)).filter(b => b.ad && !ATLA.test(b.ad));
    console.log(`\n== ${mod}: ${liste.length} düğme`);
    await tara(mod, liste, new Set(), null);
    await o.app.close().catch(() => {}); o.fake.server.close();
  }
  kaydet(); const dosya = DOSYA;
  const say = d => sonuc.filter(x => x.durum === d).length;
  console.log(`\nToplam ${sonuc.length}: ok ${say('ok')}, HATA ${say('HATA')}, etkisiz ${say('etkisiz')}, diğer ${sonuc.length - say('ok') - say('HATA') - say('etkisiz')} → ${dosya}`);
  process.exit(0);
})();
