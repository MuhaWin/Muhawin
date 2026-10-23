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
