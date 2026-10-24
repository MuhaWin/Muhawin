// Sitedeki Denetim: derlenmiş paketle (web/site/denetim/py) Pyodide'de uçtan uca, sahte verilerle.
// Önce:  cd web/denetim && npm ci && pip download --no-deps -r wheels.txt -d wheels && cd ../.. && node tools/site_uret.js --denetim
// Çalıştırma:  node --test web/denetim/kopru.test.mjs
import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadPyodide } from 'pyodide';

const BURA = path.dirname(fileURLToPath(import.meta.url));
const KOK = path.join(BURA, '..', '..');
const PY = path.join(KOK, 'web', 'site', 'denetim', 'py');
const ORNEK = path.join(KOK, 'web', 'tarayici-deneme', 'ornek');
const oku = y => new Uint8Array(fs.readFileSync(y));

let py, cagir;
async function istek(yontem, yol, { sorgu = {}, govde = null, form = {} } = {}) {
  const s = await cagir(yontem, yol, py.toPy(sorgu), govde == null ? null : py.toPy(govde), py.toPy(form));
  const j = s.toJs({ dict_converter: Object.fromEntries }); s.destroy();
  return j;
}
const json = y => JSON.parse(y.govde);

test.before(async () => {
  execFileSync('python3', [path.join(KOK, 'web', 'tarayici-deneme', 'ornek_uret.py')]);
  const paket = JSON.parse(fs.readFileSync(path.join(PY, 'paket.json'), 'utf8'));
  py = await loadPyodide();
  for (const w of paket.wheels) py.unpackArchive(oku(path.join(PY, w)), 'wheel');
  py.FS.mkdirTree('/kod');
  py.unpackArchive(oku(path.join(PY, paket.paket)), 'zip', { extractDir: '/kod' });
  py.FS.writeFile('/kod/kopru.py', oku(path.join(PY, 'kopru.py')));
  py.runPython("import os, sys; os.environ['FK_VERI'] = '/veri'; os.environ['FK_BILDIRIM_URL'] = ''; sys.path.insert(0, '/kod')");
  const kopru = py.pyimport('kopru');
  assert.ok(kopru.yukle() > 20, 'uç noktalar kaydedildi');
  cagir = kopru.cagir;
});

test('denetim: yükle → sonuç → liste → Excel → çıktı raporu → fiş', async () => {
  const form = {
    faturalar: [{ ad: 'faturalar.zip', veri: oku(path.join(ORNEK, 'faturalar.zip')) }],
    muavinler: [{ ad: 'muavin.xlsx', veri: oku(path.join(ORNEK, 'muavin.xlsx')) }],
    bas: ['2026-09-01'], bit: ['2026-09-30'], program: ['mikro'], firma_ad: ['ÖRNEK TİCARET A.Ş.'],
  };
  const y = await istek('POST', '/api/denetim', { form });
  assert.strictEqual(y.durum, 200, y.govde);
  const d = json(y);
  const sorun = Object.fromEntries(Object.entries(d.denetim.ozet).map(([k, v]) => [k, v.sorunlu]));
  assert.deepStrictEqual({ KDV: sorun.KDV, Matrah: sorun.Matrah, Cari: sorun.Cari }, { KDV: 0, Matrah: 1, Cari: 1 });
  const id = d.rapor_id;

  const liste = json(await istek('GET', '/api/denetim/liste')).liste;
  assert.strictEqual(liste.length, 1);
  assert.strictEqual(liste[0].id, id);

  const tekrar = json(await istek('GET', '/api/denetim', { sorgu: { id } }));
  assert.ok(tekrar.sonuclar.length >= 4);

  const excel = await istek('GET', '/api/rapor/excel', { sorgu: { id } });
  assert.strictEqual(excel.durum, 200);
  assert.strictEqual(excel.tur, 'dosya');
  assert.ok(excel.govde instanceof Uint8Array && excel.govde[0] === 0x50 && excel.govde[1] === 0x4b, 'xlsx (zip) baytları');
  assert.match(excel.dosya_adi, /\.xlsx$/);

  const cikti = await istek('GET', '/api/rapor/cikti', { sorgu: { id } });
  assert.strictEqual(cikti.durum, 200);
  assert.match(cikti.medya, /html/);
  assert.match(cikti.govde, /ÖRNEK TİCARET/);

  const fisMetni = tekrar.sonuclar.map(s => s.fisler || '').find(Boolean) || '';
  const m = /(\S+) \((\d\d\.\d\d\.\d{4})\)/.exec(fisMetni);
  assert.ok(m, 'sonuçlarda fiş bilgisi: ' + fisMetni);
  const fis = await istek('GET', '/api/denetim/fis/yazdir', { sorgu: { id, fis: m[1], tarih: m[2] } });
  assert.strictEqual(fis.durum, 200, fis.govde);
  assert.match(fis.govde, /Hazırlayan/);

  const fatura = await istek('GET', '/api/fatura/goruntu', { sorgu: { id, belge: 'AAA2026000000001' } });
  assert.strictEqual(fatura.durum, 200, fatura.govde);
  assert.match(fatura.govde, /AAA2026000000001/);

  const yerel = json(await istek('GET', '/api/yerel-belgeler', { sorgu: { firma_ad: 'ÖRNEK TİCARET A.Ş.' } }));
  assert.ok((yerel.donemler || []).some(x => x.ay === '2026-09' && x.hazir), JSON.stringify(yerel));
  const yeniden = await istek('POST', '/api/denetim/yerel', { govde: { firma_ad: 'ÖRNEK TİCARET A.Ş.', ay: '2026-09', bas: '2026-09-01', bit: '2026-09-30' } });
  assert.strictEqual(yeniden.durum, 200, yeniden.govde);
});

test('Denetim program seçimi: yalnız denetime uygun programlar (?denetim=1)', async () => {
  const hepsi = json(await istek('GET', '/api/muavin/programlar')).programlar.map(p => p.kod);
  const denetim = json(await istek('GET', '/api/muavin/programlar', { sorgu: { denetim: '1' } })).programlar.map(p => p.kod);
  const sifir = json(await istek('GET', '/api/muavin/programlar', { sorgu: { denetim: '0' } })).programlar.map(p => p.kod);
  assert.deepStrictEqual(denetim, ['mikro', 'elektra', 'luca']);          // Görev 43: Mikro · Elektra (örnek bekliyor) · Luca
  assert.ok(!hepsi.includes('elektra'), JSON.stringify(hepsi));
  assert.deepStrictEqual(sifir, hepsi);
});

test('Elektra muavini tarayıcıda okunur (hızlı xlsx okuyucu): Mikro ile aynı sonuç', async () => {
  const form = muavin => ({
    faturalar: [{ ad: 'faturalar.zip', veri: oku(path.join(ORNEK, 'faturalar.zip')) }],
    muavinler: [{ ad: 'muavin.xlsx', veri: oku(path.join(ORNEK, muavin)) }],
    bas: ['2026-09-01'], bit: ['2026-09-30'], program: [muavin === 'elektra.xlsx' ? 'elektra' : 'mikro'], firma_ad: ['ELEKTRA DENEME A.Ş.'],
  });
  const ozet = y => { assert.strictEqual(y.durum, 200, y.govde); return Object.fromEntries(Object.entries(json(y).denetim.ozet).map(([k, v]) => [k, v.sorunlu])); };
  const e = ozet(await istek('POST', '/api/denetim', { form: form('elektra.xlsx') }));
  assert.deepStrictEqual(e, ozet(await istek('POST', '/api/denetim', { form: form('muavin.xlsx') })));
  assert.deepStrictEqual({ KDV: e.KDV, Matrah: e.Matrah, Cari: e.Cari }, { KDV: 0, Matrah: 1, Cari: 1 });
});

test('Detay denetim: gider / gelir kontrolü, karar, kural, rapor (tarayıcıda, firma klasöründe saklanır)', async () => {
  const liste = json(await istek('GET', '/api/denetim/liste')).liste;
  const id = liste.find(x => x.firma === 'ÖRNEK TİCARET A.Ş.' || /ÖRNEK/.test(x.id)).id;
  const d = json(await istek('GET', '/api/denetim/detay', { sorgu: { id } }));
  assert.ok(d.gider.length && d.gelir.length, JSON.stringify(d.ozet));
  const g = d.gider[0];
  assert.strictEqual((await istek('POST', '/api/denetim/detay/karar', { govde: { id, anahtar: g.anahtar, karar: 'uygun_degil', notu: 'deneme' } })).durum, 200);
  const k = await istek('POST', '/api/denetim/detay/kural', { govde: { id, yon: 'SATIS', vkn: d.gelir[0].vkn, hesap: d.gelir[0].hesaplar[0].kod.slice(0, 3) } });
  assert.strictEqual(k.durum, 200, k.govde);
  const d2 = json(await istek('GET', '/api/denetim/detay', { sorgu: { id } }));
  assert.strictEqual(d2.gider[0].durum, 'uygun_degil');
  assert.strictEqual(d2.gelir[0].durum, 'kural');
  const r = await istek('GET', '/api/denetim/detay/rapor', { sorgu: { id } });
  assert.strictEqual(r.durum, 200);
  assert.match(r.govde, /Gider kontrolü/);
  assert.match(r.govde, /deneme/);
});

test('Muhtasar beyannamesi (1003A PDF) tarayıcıda okunur ve muavinle karşılaştırılır; kişisel veri saklanmaz', async () => {
  const id = json(await istek('GET', '/api/denetim/liste')).liste.find(x => /ÖRNEK/.test(x.id)).id;
  const y = await istek('POST', '/api/denetim/muhtasar', { form: { id: [id], beyanname: [{ ad: 'muhtasar.pdf', veri: oku(path.join(ORNEK, 'muhtasar.pdf')) }] } });
  assert.strictEqual(y.durum, 200, y.govde);
  const j = json(y);
  assert.strictEqual(j.beyan.form, '1003A');
  assert.strictEqual(j.beyan.kodlar['022'].vergi, 500);
  const serbest = j.satirlar.find(x => x.ad.startsWith('022 Serbest meslek · vergi'));
  assert.strictEqual(serbest.durum, 'uyumlu');
  assert.ok(!/12345678901|AHMET|MEHMET|KONYAALTI/.test(y.govde));
  assert.ok(!/12345678901|AHMET/.test(py.runPython("import pathlib; ''.join(p.read_text('utf-8') for p in pathlib.Path('/veri').rglob('*.json'))")));
});

test('Luca ve sqlite olmadan çalışır (taklit yalnız fastapi / pydantic)', async () => {
  const y = py.runPython("import sys; json_ = __import__('json'); json_.dumps([m in sys.modules for m in ('playwright', 'sqlite3', 'fastapi')])");
  assert.deepStrictEqual(JSON.parse(y), [false, false, true]);
});

test('belge sınırı (GirdiSiniri): uygulamanın kendi 400 iletisi döner', async () => {
  const { createRequire } = await import('node:module');
  const { zipYaz } = createRequire(import.meta.url)('../../tools/site_uret.js');
  const bomba = zipYaz([{ ad: 'bomba.xml', veri: Buffer.alloc(11 * 1024 * 1024) }]);   // 11 MB sıfır ≈ 11 KB: oran sınırı
  const form = {
    faturalar: [{ ad: 'bomba.zip', veri: new Uint8Array(bomba) }],
    muavinler: [{ ad: 'muavin.xlsx', veri: oku(path.join(ORNEK, 'muavin.xlsx')) }],
    bas: ['2026-09-01'], bit: ['2026-09-30'], program: ['mikro'],
  };
  const y = await istek('POST', '/api/denetim', { form });
  assert.strictEqual(y.durum, 400, y.govde);
  assert.match(json(y).detail, /olağan dışı sıkıştırılmış/);
});

test('hatalar ve kapalı bölümler', async () => {
  const eksik = await istek('POST', '/api/denetim', { form: { bas: ['2026-09-01'] } });
  assert.strictEqual(eksik.durum, 400);                              // muavin artık isteğe bağlı alan (Luca'dan da gelir)
  assert.match(json(eksik).detail, /e-fatura dosyalarını/);

  for (const yol of ['/api/toplu/durum', '/api/kontrol/luca-faturalari', '/api/ayarlar']) {
    assert.strictEqual((await istek('GET', yol)).durum, 404, yol);
  }
  assert.strictEqual(json(await istek('GET', '/api/saglik')).tarayici, true);
  assert.strictEqual((await istek('GET', '/api/denetim', { sorgu: { id: 'YOK/2026/09' } })).durum, 404);
});
