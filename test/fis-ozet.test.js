// Görev 53: fiş çıktısı ortak yardımcıları (renderer/fis-cikti.js) — ana hesap özeti, denklik, imza alanları
// node --test test/fis-ozet.test.js
const test = require('node:test');
const assert = require('node:assert');
const Y = require('../renderer/fis-cikti.js');

const fis = (...s) => s.map(([kod, borc, alacak]) => ({ kod, borc, alacak }));

test('birden fazla 102 satırı tek satırda toplanır, borç = alacak', () => {
  const oz = Y.anaHesapOzeti(fis(['770.01', 1000, 0], ['191.01.20', 200, 0], ['102.01', 0, 700], ['102.02', 0, 300], ['102.05.001', 0, 200]));
  assert.strictEqual(oz.goster, true);
  assert.deepStrictEqual(oz.L.map(a => [a.kod, a.borc, a.alacak, a.n]), [['102', 0, 1200, 3], ['191', 200, 0, 1], ['770', 1000, 0, 1]]);
  assert.strictEqual(oz.L[0].ad, 'Bankalar');
  assert.ok(oz.denk && oz.tb === 1200 && oz.ta === 1200);
  const h = Y.fisEkHtml(oz);
  assert.match(h, /Ana hesap özeti/); assert.match(h, /borç = alacak/); assert.match(h, /1\.200,00/);
  assert.ok(h.indexOf('Ana hesap özeti') < h.indexOf('Hazırlayan'));
  const aoa = Y.fisEkAoa(oz);
  assert.ok(aoa.some(r => r[0] === 'Ana hesap özeti'));
  assert.deepStrictEqual(aoa.find(r => r[0] === '102'), ['102', 'Bankalar', '', '', 0, 1200]);
  assert.deepStrictEqual(aoa.find(r => r[0] === 'Toplam'), ['Toplam', 'borç = alacak', '', '', 1200, 1200]);
});

test('hesap planındaki ad önce gelir; dengesiz fiş farkıyla belirtilir', () => {
  const oz = Y.anaHesapOzeti(fis(['770.01', 100, 0], ['770.02', 50, 0], ['320.01', 0, 140]), k => (k === '770' ? 'GENEL YÖNETİM GİD.' : ''));
  assert.strictEqual(oz.L.find(a => a.kod === '770').ad, 'GENEL YÖNETİM GİD.');
  assert.strictEqual(oz.L.find(a => a.kod === '320').ad, 'Satıcılar');
  assert.strictEqual(oz.denk, false);
  assert.match(Y.fisEkHtml(oz), /fiş dengesiz \(fark 10,00\)/);
  assert.ok(Y.fisEkAoa(oz).some(r => r[1] === 'fiş dengesiz (fark 10,00)'));
});

test('her ana hesap bir kez geçiyorsa özet yok; imza alanları yine var', () => {
  const oz = Y.anaHesapOzeti(fis(['153.01', 100, 0], ['191.01.20', 20, 0], ['320.01', 0, 120]));
  assert.strictEqual(oz.goster, false);
  const h = Y.fisEkHtml(oz), aoa = Y.fisEkAoa(oz);
  assert.doesNotMatch(h, /Ana hesap özeti/);
  assert.ok(!aoa.some(r => r[0] === 'Ana hesap özeti'));
  for (const a of ['Hazırlayan', 'Kontrol Eden', 'Onaylayan']) { assert.ok(h.includes(a)); assert.ok(aoa.some(r => r.includes(a))); }
  assert.match(h, /Ad Soyad:[\s\S]*Tarih:[\s\S]*İmza:/);
});

test('iki 770 + bir 191 + bir 320 → özet gösterilir', () => {
  const oz = Y.anaHesapOzeti(fis(['770.01', 60, 0], ['770.02', 40, 0], ['191.01.20', 20, 0], ['320.01', 0, 120]));
  assert.strictEqual(oz.goster, true);
  assert.deepStrictEqual(oz.L.map(a => [a.kod, a.borc, a.alacak]), [['191', 20, 0], ['320', 0, 120], ['770', 100, 0]]);
});
