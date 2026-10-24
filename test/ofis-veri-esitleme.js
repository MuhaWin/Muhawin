// Görev 51: ofis ortak verisinin iki bilgisayar arasında eşitlenmesi (sahte Supabase; Electron gerekmez)
//   node test/ofis-veri-esitleme.js
// Her "bilgisayar" gerçek datastore.js + cloud.js + ofisveri.js ile kendi hesap klasörünü kullanır.
const fs = require('fs'), os = require('os'), path = require('path');
const sb = require('./sahte_sb');
const { makeDataStore } = require('../datastore');
const { makeCloud } = require('../cloud');
const { makeOfisVeri } = require('../ofisveri');
const ok = [], bad = [];
const check = (c, m) => { (c ? ok : bad).push(m); console.log((c ? '  ✓ ' : '  ✗ ') + m); };
const now = () => new Date().toISOString();

async function bilgisayar(url, ad, hazirla) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mw-ov-' + ad + '-'));
  const ds = makeDataStore(dir); ds.load();
  if (hazirla) hazirla(ds, dir);
  const auth = makeCloud(dir, { _testUrl: url }); await auth.login({ email: 'test@ornek.com', password: 'Sifre1234' });
  let degisim = 0;
  const yeni = () => makeOfisVeri({ dir, ds, rpc: (fn, a) => auth.ofis(fn, a), onChange: () => degisim++, cihaz: ad, aralik: 60000 });
  const pc = { dir, ds, auth, ov: yeni(), degisim: () => degisim, op: (op, a) => { const d = ds.apply(op, a); pc.ov.yerelDegisti(d); return d; } };
  pc.yenidenAc = () => { pc.ov = yeni(); return pc; };      // program kapatılıp açıldı: durum diskten okunur
  return pc;
}
const kurallar = (pc, fid) => Object.values((pc.ds.load().rules || {})[fid] || {}).map(r => r.k).sort().join(',');

(async () => {
  const fake = await sb.start({});
  try {
    console.log('İlk eşitleme ve birleştirme');
    // A: DEMO (Luca 11) + 2 kural; B: aynı DEMO başka kimlikle + kendi kuralı + mizanı, ayrıca YENİ LTD
    const A = await bilgisayar(fake.url, 'A', ds => {
      ds.apply('saveFirm', { firm: { id: 'a-demo', name: 'DEMO A.Ş.', lucaId: '11', banks: [], createdAt: now() } });
      ds.apply('addRule', { fid: 'a-demo', rule: { id: 'r1', k: 'KİRA', dir: 'out', acc: '770.01' } });
      ds.apply('addRule', { fid: 'a-demo', rule: { id: 'r2', k: 'MAAŞ', dir: 'out', acc: '335.01' } });
      ds.apply('saveReg', { reg: { buro: 'Örnek SMMM', yetkili: 'Ayşe Örnek' } });
    });
    await A.ov.bosalt();
    check(A.ov.durum().bekleyen === 0 && fake.state.ofisVeri.size === 4, 'A: yereldeki firma, 2 kural ve büro bilgileri ofis deposuna yüklendi (' + fake.state.ofisVeri.size + ' satır)');
    const B = await bilgisayar(fake.url, 'B', (ds, dir) => {
      ds.apply('saveFirm', { firm: { id: 'b-demo', name: 'Demo A.Ş.', lucaId: '11', banks: [{ label: 'ÖRNEK BANK TL', code: '102.01' }], createdAt: now(), mizanInfo: { count: 2 } } });
      ds.apply('addRule', { fid: 'b-demo', rule: { id: 'r3', k: 'ELEKTRİK', dir: 'out', acc: '770.02' } });
      ds.apply('saveMizan', { fid: 'b-demo', acc: [['100', 'KASA'], ['102.01', 'BANKA']] });
      ds.apply('saveFirm', { firm: { id: 'b-yeni', name: 'YENİ LTD.', banks: [], createdAt: now() } });
      ds.apply('saveReg', { reg: { buro: 'Eski büro adı' } });
    });
    await B.ov.bosalt();
    const bd = B.ds.load();
    check(bd.firms['a-demo'] && !bd.firms['b-demo'] && Object.keys(bd.firms).length === 2, 'B: aynı firma (Luca 11) ofis deposundaki kimliğe çevrildi; iki firma: ' + Object.keys(bd.firms).join(','));
    check(kurallar(B, 'a-demo') === 'ELEKTRİK,KİRA,MAAŞ', 'B: A\'nın kuralları geldi, kendi kuralı korundu (' + kurallar(B, 'a-demo') + ')');
    check(B.ds.getMizan('a-demo').length === 2 && bd.firms['a-demo'].mizanInfo && bd.firms['a-demo'].banks.length === 1, 'B: mizan dosyası ve mizan bilgisi yeni kimliğe taşındı (mizan bu bilgisayarda kalır)');
    check(bd.registration && bd.registration.buro === 'Örnek SMMM', 'B: büro bilgileri ofis deposundan geldi (sunucudaki esas)');
    await A.ov.bosalt();
    const ad = A.ds.load();
    check(kurallar(A, 'a-demo') === 'ELEKTRİK,KİRA,MAAŞ' && ad.firms['b-yeni'] && A.degisim() > 0, 'A: B\'nin kuralı ve YENİ LTD birkaç saniyede (sonraki turda) geldi; arayüze haber verildi');

    console.log('Değiştirme ve silme (tüm çalışanlar)');
    A.op('addRule', { fid: 'a-demo', rule: { id: 'r4', k: 'TELEFON', dir: 'out', acc: '770.03' } });
    await A.ov.bosalt(1); await B.ov.bosalt(1);
    check(kurallar(B, 'a-demo').includes('TELEFON'), 'A kural ekledi → B\'de göründü');
    B.op('delRule', { fid: 'a-demo', rid: 'r1' });
    B.op('saveReg', { reg: { buro: 'Örnek SMMM', yetkili: 'Ayşe Örnek', telefon: '0242 000 00 00' } });
    await B.ov.bosalt(1); await A.ov.bosalt(1);
    check(!kurallar(A, 'a-demo').includes('KİRA') && A.ds.load().registration.telefon === '0242 000 00 00', 'B kural sildi ve büro telefonunu değiştirdi → A\'da göründü');
    A.op('deleteFirm', { id: 'b-yeni' });
    await A.ov.bosalt(1); await B.ov.bosalt(1);
    check(!B.ds.load().firms['b-yeni'], 'A firmayı sildi → B\'den de kalktı');

    console.log('İnternetsiz çalışma ve kuyruk');
    fake.state.agYok = true;
    A.op('addRule', { fid: 'a-demo', rule: { id: 'r5', k: 'SU', dir: 'out', acc: '770.04' } });
    A.op('addFKural', { fid: 'a-demo', kural: { id: 'f1', sart: [{ alan: 'unvan', deger: 'GAMA' }], hesap: '153.01' } });
    await A.ov.bosalt(1);
    const dA = A.ov.durum();
    check(kurallar(A, 'a-demo').includes('SU') && dA.bekleyen === 2 && dA.hata, 'bağlantı yokken kural yerelde kaydedildi, 2 değişiklik kuyrukta (' + dA.hata + ')');
    A.ov.durdur(); A.yenidenAc();
    check(A.ov.durum().bekleyen === 2 && fs.existsSync(path.join(A.dir, 'giden.json')), 'program kapatılıp açıldı: kuyruk diskten geri geldi');
    fake.state.agYok = false;
    await A.ov.bosalt(1); await B.ov.bosalt(1);
    check(A.ov.durum().bekleyen === 0 && kurallar(B, 'a-demo').includes('SU') && Object.keys((B.ds.load().fkurallar || {})['a-demo'] || {}).length === 1, 'bağlantı gelince kuyruk gönderildi; B kuralı ve Luca\'ya kaydet kuralını aldı');

    console.log('Gereksiz yazma yok');
    const y0 = fake.state.yazmaSayisi, deg0 = B.degisim();
    await A.ov.bosalt(2); await B.ov.bosalt(2);
    check(fake.state.yazmaSayisi === y0 && B.degisim() === deg0, 'değişiklik yokken sunucuya yazılmıyor, arayüz yenilenmiyor');

    console.log('Eski ortak klasörden geçiş (sharedDir)');
    const ortak = fs.mkdtempSync(path.join(os.tmpdir(), 'mw-ortak-'));
    const C = await bilgisayar(fake.url, 'C', (ds, dir) => {
      ds.useShared(ortak, 'copy');
      ds.apply('saveFirm', { firm: { id: 'c-kuzey', name: 'KUZEY LTD.', lucaId: '33', banks: [], createdAt: now() } });
      ds.apply('okcKural', { fid: 'c-kuzey', kural: { id: 'o1', isyeri: 'YOL AKARYAKIT', hesap: '770.05' } });
      ds.useLocal();                          // main.js veriBaslat: ortak klasördeki veri bu bilgisayara alınır
    });
    await C.ov.bosalt();
    check(C.ds.load().firms['a-demo'] && C.ds.load().firms['c-kuzey'] && !C.ds.info().shared, 'C: ortak klasördeki firma bu bilgisayara alındı, ofis deposuyla birleşti (ortak klasör ayarı kalktı)');
    await A.ov.bosalt(1);
    check(A.ds.load().firms['c-kuzey'] && Object.keys((A.ds.load().okckural || {})['c-kuzey'] || {}).length === 1, 'A: C\'nin ortak klasörden taşınan firması ve ÖKC kuralı geldi');
  } catch (e) { bad.push('HATA ' + e.stack); console.log(e); }
  finally { fake.server.close(); }
  console.log(`\n${ok.length} geçti, ${bad.length} başarısız`);
  process.exit(bad.length ? 1 : 0);
})();
