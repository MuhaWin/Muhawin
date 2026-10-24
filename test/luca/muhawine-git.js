// Görev 44: Luca'da Çalış penceresindeki "MuhaWin'e git" düğmesi (sahte Luca ana ekranı, Chromium)
// üst şeritte, logonun sağında; Luca öğelerinin üstüne binmez; pencere boyu / şerit değişince yeniden yerleşir; basınca işaret verir
const Module = require('module'); const orig = Module._load;
Module._load = function (r, ...a) { if (r === 'electron') return { BrowserWindow: class {}, session: { fromPartition: () => ({}) } }; return orig.call(this, r, ...a); };
const path = require('path');
const L = require(path.join(__dirname, '..', '..', 'luca.js'));
const { cakisma } = require(path.join(__dirname, '..', 'cakisma.js'));
const { baslat } = require('./sahte-ust-serit');
const { chromium } = require('playwright');
const tamam = (k, m) => { console.log((k ? '✓ ' : '✗ ') + m); if (!k) process.exitCode = 1; };
const { GIT_JS, GIT_YEDEK_JS, KONUM_JS, GIT_ID } = L._git;
// ana süreçteki seçimin aynısı: sol üst köşeden başlayan, en kısa çerçeve
async function ekle(p) {
  const k = []; for (const f of p.frames()) { const x = await f.evaluate(KONUM_JS).catch(() => null); if (x) k.push({ f, ...x }); }
  for (const a of k.filter(x => x.t <= 2 && x.l <= 2 && x.h >= 36).sort((a, b) => a.h - b.h)) if (await a.f.evaluate(GIT_JS)) return a.f;
  const ic = k.find(x => x.f.name() === 'frm3') || [...k].sort((a, b) => b.h * b.w - a.h * a.w)[0];   // yedek: içerik çerçevesinin sağ altı
  if (ic && await ic.f.evaluate(GIT_YEDEK_JS)) return ic.f;
  return null;
}
const durum = f => f.evaluate(id => { const b = document.getElementById(id); const l = document.getElementById('lucaLogo') || document.querySelector('img');
  const r = b && !b.hidden ? b.getBoundingClientRect() : null; const lr = l.getBoundingClientRect();
  return r && { metin: b.textContent, sol: Math.round(r.left), sag: Math.round(r.right), ust: Math.round(r.top), alt: Math.round(r.bottom), logoSag: Math.round(lr.right), gen: innerWidth, yuk: innerHeight, sayi: document.querySelectorAll('#' + id).length }; }, GIT_ID);
(async () => {
  const s = await baslat(); const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1366, height: 800 } }); const log = []; p.on('console', m => log.push(m.text()));
  try {
    await p.goto(s.url + '/Luca/luca.do'); await p.waitForTimeout(400);
    const f = await ekle(p);
    tamam(f && f.name() === 'frm4', 'düğme en üstteki şeride (frm4) eklendi (' + (f && f.name()) + ')');
    for (const g of [1366, 1024, 1920, 980]) {
      await p.setViewportSize({ width: g, height: 800 }); await p.waitForTimeout(450);
      const d = await durum(f); const c = await f.evaluate(cakisma, null);
      tamam(d && d.metin === "MuhaWin'e git" && d.sol >= d.logoSag + 16 && d.ust >= 0 && d.alt <= d.yuk && d.sag <= d.gen && !c.cakisan.length && !c.tasan.length,
        g + ' px: "MuhaWin\'e git" logonun sağında, şeridin içinde, Luca öğeleriyle çakışmıyor (' + JSON.stringify({ ...d, cakisan: c.cakisan.slice(0, 2) }) + ')');
    }
    tamam((await Promise.all(p.frames().map(x => x.evaluate(id => !!document.getElementById(id), GIT_ID).catch(() => false)))).filter(Boolean).length === 1, 'yalnız bir düğme var (içerik ve menü çerçevesine eklenmedi)');
    // şeride Luca'dan yeni bir öğe gelince (düğmenin olduğu yere) düğme kayar
    await p.setViewportSize({ width: 1366, height: 800 }); await p.waitForTimeout(450);
    const d0 = await durum(f);
    await f.evaluate(x => { const e = document.createElement('span'); e.textContent = 'Duyuru: yeni sürüm'; e.style.cssText = `position:absolute;left:${x}px;top:18px;width:150px`; document.body.appendChild(e); }, d0.sol);
    await p.waitForTimeout(500); const d1 = await durum(f); const c1 = await f.evaluate(cakisma, null);
    tamam(d1 && d1.sol !== d0.sol && !c1.cakisan.length, 'şeride yeni Luca öğesi gelince düğme boş yere kaydı (' + d0.sol + ' → ' + (d1 && d1.sol) + ')');
    // Luca'nın kendi düğmeleri tıklanabiliyor
    await f.click('#cikis'); tamam(await f.evaluate(() => window.__cikis) === 1, 'Luca\'nın "Çıkış" bağlantısı tıklanabiliyor (düğme engellemiyor)');
    // basınca ana süreç için işaret: konsol iletisi ve başlık
    const basliklar = []; await p.exposeFunction('__b', t => basliklar.push(t));
    await p.evaluate(() => new MutationObserver(() => window.__b(document.title)).observe(document.querySelector('title'), { childList: true }));
    await f.click('#' + GIT_ID); await p.waitForTimeout(600);
    tamam(log.includes('__MUHAWIN_GIT__') && basliklar.some(t => t.startsWith('__MW_GIT__')) && (await p.title()) === 'LUCA', 'basınca ana sürece işaret gitti (konsol + başlık), başlık geri geldi');
    tamam((await f.evaluate(GIT_JS)) === 'yerinde' && (await durum(f)).sayi === 1, 'yeniden eklemede ikinci düğme oluşmuyor');
    // çerçevesiz sayfa: şerit sayfanın kendisinde
    await p.goto(s.url + '/Luca/tek.do'); await p.waitForTimeout(300); const f2 = await ekle(p); const d2 = f2 && await durum(f2); const c2 = f2 && await f2.evaluate(cakisma, null);
    tamam(d2 && d2.ust < 56 && d2.sol >= d2.logoSag + 16 && !c2.cakisan.length, 'çerçevesiz Luca sayfasında da üst şeritte, logonun sağında (' + JSON.stringify(d2) + ')');
    // şerit dolarsa (yer kalmazsa) düğme Luca öğelerinin üstüne binmez, gizlenir
    await p.goto(s.url + '/Luca/luca.do'); await p.waitForTimeout(400); const f3 = await ekle(p);
    await f3.evaluate(() => { const e = document.createElement('span'); e.textContent = 'çok uzun duyuru'; e.style.cssText = 'position:absolute;left:150px;top:18px;width:2000px'; document.body.appendChild(e); }); await p.waitForTimeout(500);
    const yedek = await ekle(p); const yd = yedek && await yedek.evaluate(id => { const b = document.getElementById(id), r = b.getBoundingClientRect(); return { sag: Math.round(innerWidth - r.right), alt: Math.round(innerHeight - r.bottom), gizli: b.hidden }; }, GIT_ID);
    tamam(await f3.evaluate(id => document.getElementById(id).hidden, GIT_ID) && yedek && yedek.name() === 'frm3' && yd.sag === 14 && yd.alt === 14 && !yd.gizli,
      'şeritte boş yer kalmazsa düğme şeritte Luca öğesinin üstüne binmez; içerik çerçevesinin sağ altına konur (' + JSON.stringify(yd) + ')');
    await f3.evaluate(() => document.querySelector('span[style*="2000px"]').remove()); await p.waitForTimeout(600);
    const sayi2 = await Promise.all(p.frames().map(x => x.evaluate(id => { const b = document.getElementById(id); return b && !b.hidden ? 1 : 0; }, GIT_ID).catch(() => 0)));
    tamam(await f3.evaluate(id => !document.getElementById(id).hidden, GIT_ID) && sayi2.reduce((a, b) => a + b, 0) === 1, 'şeritte yer açılınca düğme üste döner, sağ alttaki kalkar (' + sayi2.join(',') + ')');
    await p.setContent('<frameset><frame src="about:blank"></frameset>'); tamam((await p.evaluate(GIT_JS)) === '', 'çerçeve kümesi (frameset) sayfasına eklenmez');
  } catch (e) { tamam(false, 'HATA ' + e.message.split('\n')[0]); }
  finally { await b.close(); s.kapat(); }
})();
