// Görev 37: rapordaki "Luca'da aç" → Luca'da Fiş Listesi o fiş numarasıyla süzülür (fişe dokunulmaz).
// Gerçek Luca'ya gidilmez: çerçeveli taklit Luca sunucusu (frm3 çalışma alanı, frm4 firma / dönem çubuğu).
//   node test/luca/fis-goster.js        (Chromium yolu gerekirse PW_CHROMIUM)
const http = require('http'); const fs = require('fs'); const path = require('path');
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'luca.js'), 'utf8');
const JS = eval(src.match(/const FIS_GOSTER_JS = (`[\s\S]*?`);/)[1]);
const fisNoBicim = eval(src.match(/const fisNoBicim = ([^\n]*);\n/)[1]);
let ok = true; const t = (ad, kosul) => { console.log((kosul ? '  ✓ ' : '  ✗ ') + ad); if (!kosul) ok = false; };

let kayit, ymFormlu = true;
const sunucu = http.createServer((q, r) => {
  const u = new URL(q.url, 'http://x'); const html = s => { r.setHeader('Content-Type', 'text/html; charset=utf-8'); r.end(s); };
  if (u.pathname === '/Luca/luca.do') return html('<frameset rows="40,*"><frame name="frm4" src="TopFrameAction.do"><frame name="frm3" src="bos.do"></frameset>');
  if (u.pathname === '/Luca/TopFrameAction.do') { if (u.searchParams.get('SIRKET_ID')) kayit.firma = Object.fromEntries(u.searchParams); return html('<b>firma çubuğu</b>'); }
  if (u.pathname === '/Luca/bos.do') return html('<p>ana ekran</p>');
  if (u.pathname === '/Luca/YMFrameAction.do') {
    kayit.modul = u.searchParams.get('modul');
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
    let b = ''; q.on('data', d => b += d); q.on('end', () => { kayit.gonderim = Object.fromEntries(new URLSearchParams(b)); html('<table><tr><td>Fiş 0143</td></tr></table>'); }); return;
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
    const r = await p.evaluate(JS + '(' + JSON.stringify({ firma, uye: '99', fisNo: '0143' }) + ')');
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
  console.log('Çerçeve yoksa');
  { const p = await b.newPage(); await p.setContent('<p>giriş</p>'); const r = await p.evaluate(JS + '({"fisNo":"1"})'); t('açık hata döner (CERCEVE)', r && r.ok === false && r.hata === 'CERCEVE'); await p.close(); }
  await b.close(); sunucu.close();
  process.exit(ok ? 0 : 1);
})().catch(e => { console.log('HATA', e); process.exit(1); });
