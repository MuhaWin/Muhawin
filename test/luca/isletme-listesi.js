// luca.js işletme / serbest meslek defteri betiklerinin örnek sayfada sınanması (gelir/gider listesi, fiş ekranı adresleri)
const { chromium } = require('playwright'); const http = require('http'); const path = require('path');
const src = require('fs').readFileSync(path.join(__dirname, '..', '..', 'luca.js'), 'utf8');
const LISTE = eval(src.match(/const ISLETME_LISTE_JS = (`[\s\S]*?`);/)[1]);
const ADRES = eval('`' + src.match(/const adresJS = `([\s\S]*?)`;/)[1] + '`');
const SAYFA = `<!doctype html><meta charset=utf-8><form name=isletmeFisParametreForm method=get action="/liste2"><input name=evrakTarih1><input name=evrakTarih2><input name=evrakNo1><input name=evrakNo2><select name=kategori><option value="">Hepsi</option><option>Defter Fişleri</option></select><input name=durum></form>
<a href="#" onclick="location='addIsletmeFisAction.do?TUR=1'">Yeni</a><a href="deleteIsletmeFisAction.do?id=3">Sil</a><a href="listIsletmeFisFilitreAction.do">Liste</a>`;
const SONUC = `<!doctype html><meta charset=utf-8><table><tbody class="data-table"><tr id=tr1 onclick="sec(this, '55')"><td></td><td>05/09/2026</td><td>SMM2026000000705</td><td>Serbest Meslek Fişleri</td><td>e-SMM</td><td>Danışmanlık</td><td>AHMET</td><td>1.000,00</td><td>200,00</td><td>1.200,00</td></tr></tbody></table>`;
const srv = http.createServer((q, r) => { r.setHeader('content-type', 'text/html; charset=utf-8'); r.end(q.url.startsWith('/liste2') ? (global.q = q.url, SONUC) : SAYFA); }).listen(0, async () => {
  const b = await chromium.launch(); const p = await b.newPage(); const u = 'http://127.0.0.1:' + srv.address().port + '/';
  await p.goto(u);
  console.log('adresler', JSON.stringify(await p.evaluate(ADRES)));
  await Promise.all([p.waitForNavigation(), p.evaluate(`(() => { const f = document.forms.isletmeFisParametreForm; const s = (n, v) => { if (f[n]) f[n].value = v; }; s('evrakTarih1', '01/01/2026'); s('evrakTarih2', '31/12/2026'); s('kategori', ''); f.submit(); })()`)]);
  console.log('sorgu', decodeURIComponent(global.q));
  console.log('satirlar', JSON.stringify(await p.evaluate(LISTE)));
  await b.close(); srv.close();
});
