// Luca'da Çalış penceresindeki "Muavine dön" düğmesi: eklenir, ikinci kez eklenmez, basınca konsol iletisi ve başlık işareti
const { chromium } = require('playwright'); const path = require('path');
const src = require('fs').readFileSync(path.join(__dirname, '..', '..', 'luca.js'), 'utf8');
const JS = eval(src.match(/const DON_JS = (`[\s\S]*?`);/)[1]);
(async () => { const b = await chromium.launch(); const p = await b.newPage(); const log = [];
  p.on('console', m => log.push(m.text()));
  await p.setContent('<title>LUCA</title><div style="height:2000px">Luca içerik</div>');
  console.log('ilk', await p.evaluate(JS), 'ikinci', await p.evaluate(JS));
  const basliklar = []; await p.exposeFunction('__b', t => basliklar.push(t));
  await p.evaluate(() => new MutationObserver(() => window.__b(document.title)).observe(document.querySelector('title'), { childList: true }));
  await p.click('#mwMuavineDon'); await p.waitForTimeout(600);
  console.log('konsol', log.includes('__MUHAWIN_MUAVINE_DON__'), 'başlık', basliklar.some(t => t.startsWith('__MW_DON__')), 'geri', await p.title());
  await p.setContent('<frameset><frame src="about:blank"></frameset>'); console.log('frameset', JSON.stringify(await p.evaluate(JS)));
  await b.close(); })();
