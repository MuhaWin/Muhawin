// Görev 37: rapordaki "Luca'da aç" → Luca'da Fiş Listesi o fiş numarasıyla süzülür (fişe dokunulmaz).
// Gerçek Luca'ya gidilmez: çerçeveli taklit Luca sunucusu (frm3 çalışma alanı, frm4 firma / dönem çubuğu).
//   node test/luca/fis-goster.js        (Chromium yolu gerekirse PW_CHROMIUM)
const http = require('http'); const fs = require('fs'); const path = require('path');
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'luca.js'), 'utf8');
const JS = eval(src.match(/const FIS_GOSTER_JS = (`[\s\S]*?`);/)[1]);
const fisNoBicim = eval(src.match(/const fisNoBicim = ([^\n]*);\n/)[1]);
let ok = true; const t = (ad, kosul) => { console.log((kosul ? '  ✓ ' : '  ✗ ') + ad); if (!kosul) ok = false; };

let kayit, ymFormlu = true, secimYoksay = false, sonucFormlu = false;
const sunucu = http.createServer((q, r) => {
  const u = new URL(q.url, 'http://x'); const html = s => { r.setHeader('Content-Type', 'text/html; charset=utf-8'); r.end(s); };
  if (u.pathname === '/Luca/luca.do') return html('<frameset rows="40,*"><frame name="frm4" src="TopFrameAction.do"><frame name="frm3" src="bos.do"></frameset>');
  if (u.pathname === '/Luca/TopFrameAction.do') {   // firma / dönem çubuğu: açılır listede seçili firma (secimYoksay: Luca seçimi uygulamaz)
    const id = u.searchParams.get('SIRKET_ID'); if (id) { kayit.firma = Object.fromEntries(u.searchParams); kayit.firmaSay = (kayit.firmaSay || 0) + 1; }
    const sec = secimYoksay ? '1' : (id || '');
    return html(`<b>firma çubuğu</b><select id="SirketCombo">${['1', '55', '66'].map(v => `<option value="${v}"${v === sec ? ' selected' : ''}>F${v}</option>`).join('')}</select>`); }
  if (u.pathname === '/Luca/bos.do') return html('<p>ana ekran</p>');
  if (u.pathname === '/Luca/YMFrameAction.do') {
    kayit.modul = u.searchParams.get('modul'); kayit.modulSay = (kayit.modulSay || 0) + 1;
    return html(ymFormlu ? '<frameset cols="*"><frame name="ic" src="getFisParametreJSPAction.do?c_musteri_id=99"></frameset>' : '<p>modül yükleniyor</p>');
  }
  if (u.pathname === '/Luca/getFisParametreJSPAction.do') {
    kayit.parametre = u.searchParams.get('c_musteri_id');
    return html(`<form name="listFisParametreForm" method="post" action="listFisParametreAction.do" onsubmit="return false">
      <input name="ilkFisNo"><input name="sonFisNo"><input name="ilkFisTarihi" value="01/01/2026"><input name="sonFisTarihi" value="31/12/2026">
      <input name="fisTipi"><input name="fisKategori"><input name="fisDenge"><input type="hidden" name="fisDurum" value="1">
      <select name="P_FIS_KODU"><option>Tümü</option><option>Mahsup</option></select><input name="fisAciklama"><input name="evrakNoBas"><input name="evrakNoBit">
      <button type="button" id="sil" onclick="location='fisSilAction.do'">Sil</button></form>`);
  }
  if (u.pathname === '/Luca/listFisParametreAction.do' && q.method === 'POST') {
    let b = ''; q.on('data', d => b += d); q.on('end', () => { kayit.gonderim = Object.fromEntries(new URLSearchParams(b));
      html(sonucFormlu ? '<form name="listFisParametreForm" method="post" action="listFisParametreAction.do"><input name="ilkFisNo"><input name="sonFisNo"><input name="ilkFisTarihi"><input name="sonFisTarihi"><input name="fisAciklama" value=""><select name="P_FIS_KODU"><option>Tümü</option><option>Mahsup</option></select></form><table><tr><td>Fiş ' + kayit.gonderim.ilkFisNo + '</td></tr></table>'
        : '<table><tr><td>Fiş 0143</td></tr></table>'); }); return;
  }
  if (/fisSil/.test(u.pathname)) kayit.sil = true;
  r.statusCode = 404; r.end();
});

(async () => {
  t('fiş no Luca biçiminde (baştaki sıfırlar)', fisNoBicim(143) === '0143' && fisNoBicim('7') === '0007' && fisNoBicim('12345') === '12345' && fisNoBicim(' A-12 ') === 'A-12' && fisNoBicim(null) === '');
  await new Promise(r => sunucu.listen(0, '127.0.0.1', r)); const adres = 'http://127.0.0.1:' + sunucu.address().port;
  const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
  for (const [ad, formlu] of [['Fiş Listesi modülü formu kendisi yükler', true], ['modül formu yüklemezse süzgeç sayfası doğrudan', false]]) {
    console.log(ad); kayit = {}; ymFormlu = formlu;
    const p = await b.newPage(); await p.goto(adres + '/Luca/luca.do'); await p.waitForTimeout(300);
    const firma = 'TopFrameAction.do?time=1&SIRKET_ID=55&DONEM_ID=D9&DONEM_TXT=' + encodeURIComponent('01/01/2026 - 31/12/2026');
    const r = await p.evaluate(JS + '(' + JSON.stringify({ firma, sirket: '55', donem: 'D9', uye: '99', fisNo: '0143' }) + ')');
    for (let i = 0; i < 40 && !kayit.gonderim; i++) await p.waitForTimeout(100);
    const g = kayit.gonderim || {};
    t('işlev başarılı döner', r && r.ok === true);
    t('firma / dönem çubuğu seçilen firmaya geçer', kayit.firma && kayit.firma.SIRKET_ID === '55' && kayit.firma.DONEM_ID === 'D9');
    t('Fiş Listesi modülü (modul=10) açılır', kayit.modul === '10');
    t('süzgeç sayfası üye numarasıyla', kayit.parametre === '99');
    t('form yalnız o fiş numarasıyla gönderilir', g.ilkFisNo === '0143' && g.sonFisNo === '0143');
    t('tarih aralığı boş (tüm dönem)', g.ilkFisTarihi === '' && g.sonFisTarihi === '');
    t('diğer süzgeçler Luca varsayılanında (fisDurum=1, Tümü)', g.fisDurum === '1' && g.P_FIS_KODU === 'Tümü');
    const icerik = await Promise.all(p.frames().filter(f => f === p.frame({ name: 'frm3' }) || f.parentFrame() === p.frame({ name: 'frm3' })).map(f => f.content()));
    t('sonuç çalışma alanında (frm3) görünür', icerik.some(c => /Fiş 0143/.test(c)));
    t('fişe / başka düğmeye dokunulmaz', !kayit.sil);
    await p.close();
  }
  // Görev 48: sonraki açılışlar — firma aynıysa çubuk yeniden seçilmez, Fiş Listesi formu açıksa modül yeniden açılmaz
  console.log('Sonraki açılışlar (hız)');
  { ymFormlu = true; sonucFormlu = true; const p = await b.newPage(); await p.goto(adres + '/Luca/luca.do'); await p.waitForTimeout(300);
    const ac = async (sirket, donem, fisNo) => { kayit = {}; const firma = 'TopFrameAction.do?time=1&SIRKET_ID=' + sirket + '&DONEM_ID=' + donem;
      const r = await p.evaluate(JS + '(' + JSON.stringify({ firma, sirket, donem, uye: '99', fisNo }) + ')'); for (let i = 0; i < 40 && !kayit.gonderim; i++) await p.waitForTimeout(50); await p.waitForTimeout(150); return r; };
    const r1 = await ac('55', 'D9', '0143');
    t('ilk açılış: firma seçildi, modül açıldı, form gönderildi (' + JSON.stringify(r1.sure) + ')', r1.ok && kayit.firmaSay === 1 && kayit.modulSay === 1 && kayit.gonderim.ilkFisNo === '0143' && r1.sure.firmaSecildi === true && r1.sure.toplam >= 0);
    // çalışan açık formda bir süzgeç değiştirmiş olsun: yeniden kullanılan form varsayılana döner
    await p.evaluate(() => { const f = window.frames['frm3']; const bul = w => { const x = w.document.querySelector('form[name=listFisParametreForm]'); if (x) return x; for (let i = 0; i < w.frames.length; i++) { const y = bul(w.frames[i]); if (y) return y; } return null; };
      const form = bul(f); form.elements.namedItem('fisAciklama').value = 'KİRA'; form.elements.namedItem('P_FIS_KODU').selectedIndex = 1; });
    const r2 = await ac('55', 'D9', '0150');
    t('ikinci açılış (aynı firma, form açık): firma çubuğu ve modül yeniden yüklenmedi, yalnız form gönderildi (' + JSON.stringify(r2.sure) + ')', r2.ok && !kayit.firmaSay && !kayit.modulSay && kayit.gonderim.ilkFisNo === '0150' && r2.sure.firmaSecildi === false && r2.sure.modul === 0);
    t('yeniden kullanılan formda elle değiştirilmiş süzgeçler varsayılana döndü', kayit.gonderim.fisAciklama === '' && kayit.gonderim.P_FIS_KODU === 'Tümü');
    const r3 = await ac('55', 'D10', '0151');
    t('aynı firmanın başka dönemi: çubuk yeniden seçildi, modül yeniden açıldı', r3.ok && kayit.firmaSay === 1 && kayit.modulSay === 1 && kayit.gonderim.ilkFisNo === '0151');
    const r4 = await ac('66', 'D9', '0152');
    t('başka firma: çubuk ve modül yeniden', r4.ok && kayit.firmaSay === 1 && kayit.modulSay === 1 && kayit.firma.SIRKET_ID === '66');
    secimYoksay = true; const r5 = await ac('55', 'D9', '0153');
    t('Luca firma seçimini uygulamazsa form gönderilmez (FIRMA)', r5.ok === false && r5.hata === 'FIRMA' && !kayit.gonderim);
    secimYoksay = false; sonucFormlu = false; await p.close(); }
  console.log('Çerçeve yoksa');
  { const p = await b.newPage(); await p.setContent('<p>giriş</p>'); const r = await p.evaluate(JS + '({"fisNo":"1"})'); t('açık hata döner (CERCEVE)', r && r.ok === false && r.hata === 'CERCEVE'); await p.close(); }
  await b.close(); sunucu.close();
  process.exit(ok ? 0 : 1);
})().catch(e => { console.log('HATA', e); process.exit(1); });
