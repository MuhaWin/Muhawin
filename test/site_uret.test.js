// Tanıtım sitesinin sürüm notları: OKUBENI.txt → surum.json (tools/site_uret.js)
const test = require('node:test');
const assert = require('node:assert');
const { notlariOku, modulleriOku, uret } = require('../tools/site_uret');

test('YENİLİKLER bölümleri, alt maddeler ve devam satırları okunur', () => {
  const metin = [
    'BAŞLIK', '',
    '2.0.1 YENİLİKLER',
    '- Birinci madde', '  devamı.',
    '- İkinci madde:', '  · alt bir', '    sürer', '  · alt iki', '',
    '2.0.0 YENİLİKLER', '- Eski', '',
    'KURULUM', '- bölüm dışı',
  ].join('\r\n');
  assert.deepStrictEqual(notlariOku(metin, 8), [
    { surum: '2.0.1', maddeler: [{ metin: 'Birinci madde devamı.', alt: [] }, { metin: 'İkinci madde:', alt: ['alt bir sürer', 'alt iki'] }] },
    { surum: '2.0.0', maddeler: [{ metin: 'Eski', alt: [] }] },
  ]);
  assert.strictEqual(notlariOku(metin, 1).length, 1);
});

test('modüller ve yakında gelecekler ilk satırdan', () => {
  assert.deepStrictEqual(modulleriOku('MuhaWin 1.0  ·  Modüller: A · B · (yakında: C · D)'), { moduller: ['A', 'B'], yakinda: ['C', 'D'] });
});

test('gerçek dosyalarla: sürüm package.json ile aynı, indirme bağlantısı GitHub sürümüne gider', () => {
  const v = uret();
  const pkg = require('../package.json');
  assert.strictEqual(v.surum, pkg.version);
  assert.strictEqual(v.notlar[0].surum, pkg.version);
  assert.ok(v.indir.endsWith(`/releases/download/v${pkg.version}/MuhaWin-Kurulum-${pkg.version}.exe`));
});

test('zip yazıcı: Python zipfile ile açılır, içerik aynı', () => {
  const { zipYaz } = require('../tools/site_uret');
  const { execFileSync } = require('node:child_process');
  const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
  const icerik = [{ ad: 'paket/__init__.py', veri: Buffer.from('') }, { ad: 'paket/ç.py', veri: Buffer.from('x = "ğüşİ"\n'.repeat(50)) }];
  const y = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'zip-')), 'a.zip');
  fs.writeFileSync(y, zipYaz(icerik));
  const cikti = execFileSync('python3', ['-c', 'import sys,zipfile,json;z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None;print(json.dumps({n:z.read(n).decode() for n in z.namelist()}))', y]).toString();
  assert.deepStrictEqual(JSON.parse(cikti), Object.fromEntries(icerik.map(x => [x.ad, x.veri.toString()])));
});

test('denetim sayfası siteye uyarlanır: köprü önce yüklenir, Luca captcha betiği çıkar, adresler göreli', () => {
  const { sayfaUyarla } = require('../tools/site_uret');
  const fs = require('node:fs'), path = require('node:path');
  const STATIK = path.join(__dirname, '..', 'fk', 'fatura_kontrol', 'web', 'static');
  const d = sayfaUyarla(fs.readFileSync(path.join(STATIK, 'denetim.html'), 'utf8'));
  assert.ok(d.indexOf('src="kopru.js"') > 0 && d.indexOf('src="kopru.js"') < d.indexOf('<script>\n'));
  assert.ok(d.indexOf('src="/ortak/oturum.js"') < d.indexOf('src="kopru.js"'));
  assert.ok(!d.includes('captcha.js') && !d.includes('href="/tema.css"') && d.includes('href="tema.css"'));
  const b = sayfaUyarla(fs.readFileSync(path.join(STATIK, 'beyanname.html'), 'utf8'));
  assert.ok(!/location\.href = [`"']\/api/.test(b) && b.includes('MW_KOPRU.git = `/api/'));
  assert.throws(() => sayfaUyarla('<html><body>bozuk</body></html>'), /beklenen biçimde değil/);
});

test('sitede modül adı Muhasebe Denetimi', () => {
  const { sayfaUyarla } = require('../tools/site_uret');
  const html = '<title>Mikro Denetim</title><link rel="stylesheet" href="/tema.css"><h1 style="x">Mikro Denetim</h1><script>\nx()</script>';
  const d = sayfaUyarla(html);
  assert.ok(d.includes('<title>Muhasebe Denetimi</title>') && d.includes('<h1 style="x">Muhasebe Denetimi</h1>'));
});
