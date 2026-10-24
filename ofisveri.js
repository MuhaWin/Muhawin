'use strict';
// Görev 51: ofis ortak verisi (Supabase ofis_veri) ile yerel önbelleğin (datastore / veri.json) eşitlenmesi.
// Tasarım: yonetim/belgeler/bulut-veri-tasarimi.md "Güncelleme – Görev 51".
//  · Yerel işlem önce veri.json'a yazılır (internetsiz de çalışır). Ardından ortak verinin satır görüntüsü (firmalar, kurallar,
//    çıktı ayarı, büro bilgileri) son eşitlenen görüntüyle (taban) karşılaştırılır; farklar kalıcı kuyruğa (giden.json) girer.
//  · Döngü: önce kuyruk gönderilir (ofis_veri_yaz), sonra sunucudaki değişiklikler çekilir (ofis_veri_degisenler) ve yerele işlenir.
//    Satır düzeyinde son yazan kazanır. İnternet yoksa kuyruk bekler, artan aralıkla yeniden denenir.
//  · İlk eşitlemede (ya da ofis değişince) sunucudaki her şey çekilir; aynı firma başka kimlikle varsa (Luca no / VKN / ad)
//    yereldeki kimlik sunucudakine çevrilir, yerelde olup sunucuda olmayanlar yüklenir (birleştirme).
//  · İşlem günlüğü kayıtları ayrı kuyrukta (gunluk-giden.json) tutulur ve ofis_gunluk_yaz ile gönderilir.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TURLER = ['firma', 'kural', 'fkural', 'okckural', 'cikti', 'buro'];
const anahtarOf = x => x.tur + '|' + (x.firma || '') + '|' + (x.anahtar || '');
const ozet = v => crypto.createHash('sha1').update(JSON.stringify(v === undefined ? null : v)).digest('hex').slice(0, 20);
const buyuk = s => String(s || '').trim().toLocaleUpperCase('tr-TR').replace(/\s+/g, ' ');
// firmanın ofis içi ortak anahtarı: Luca firma no > VKN > ad
const firmaAnahtari = f => f ? (f.lucaId ? 'luca:' + f.lucaId : (f.vkn ? 'vkn:' + String(f.vkn).replace(/\D/g, '') : 'ad:' + buyuk(f.name))) : '';

// veri.json → ortak satırlar {anahtar: {tur, firma, anahtar, veri}}
function goruntu(d) {
  const out = {};
  const ekle = (tur, firma, anahtar, veri) => { const x = { tur, firma: firma || '', anahtar: String(anahtar), veri }; out[anahtarOf(x)] = x; };
  for (const [id, f] of Object.entries((d && d.firms) || {})) { const { mizanInfo, ...v } = f || {}; ekle('firma', '', id, v); }
  for (const [alan, tur] of [['rules', 'kural'], ['fkurallar', 'fkural'], ['okckural', 'okckural']])
    for (const [fid, L] of Object.entries((d && d[alan]) || {})) for (const [id, v] of Object.entries(L || {})) if (v) ekle(tur, fid, id, v);
  if (d && d.output) ekle('cikti', '', 'cikti', d.output);
  if (d && d.registration && Object.keys(d.registration).length) ekle('buro', '', 'buro', d.registration);
  return out;
}

function makeOfisVeri({ dir, ds, rpc, onChange = () => {}, log = () => {}, cihaz = '', aralik = 5000 } = {}) {
  const durumF = path.join(dir, 'bulut.json'), gidenF = path.join(dir, 'giden.json'), gunlukF = path.join(dir, 'gunluk-giden.json');
  const oku = (f, v) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return v; } };
  const yaz = (f, v) => { try { const t = f + '.tmp'; fs.writeFileSync(t, JSON.stringify(v)); fs.renameSync(t, f); } catch (e) { log('yazılamadı ' + f + ': ' + e.message); } };
  let st = Object.assign({ sahip: null, surum: 0, taban: {}, ilk: true }, oku(durumF, {}));
  let giden = oku(gidenF, {});                        // {anahtar: satır}: aynı satırın bekleyen son hâli
  let gunluk = oku(gunlukF, []);
  const kaydet = () => { yaz(durumF, st); yaz(gidenF, giden); };
  let calisiyor = false, zamanlayici = null, durdu = true, hata = null, sonBasari = 0, bekle = aralik, kapali = false;

  // yerel bir işlemden sonra: görüntü farkını kuyruğa al
  function yerelDegisti(d) {
    if (kapali) return;
    d = d || ds.load();
    const g = goruntu(d), yeniTaban = {};
    let n = 0;
    for (const [k, x] of Object.entries(g)) { const h = ozet(x.veri); yeniTaban[k] = h; if (st.taban[k] !== h) { giden[k] = { ...x, silindi: false }; n++; } }
    for (const k of Object.keys(st.taban)) if (!(k in g)) { const [tur, firma, ...a] = k.split('|'); giden[k] = { tur, firma, anahtar: a.join('|'), veri: null, silindi: true }; n++; }
    st.taban = yeniTaban;
    if (n) { kaydet(); simdi(); }
    return n;
  }
  function gunlukEkle(k) {
    if (kapali || !k || !k.tur) return;
    gunluk.push({ id: crypto.randomUUID(), cihaz, ...k, zaman: (() => { try { return new Date(k.zaman || Date.now()).toISOString(); } catch (e) { return new Date().toISOString(); } })() });
    if (gunluk.length > 5000) gunluk = gunluk.slice(-5000);
    yaz(gunlukF, gunluk); simdi();
  }

  // sunucudan gelen satırları yerele işle; tabanı güncelle (geri gönderilmesin)
  function uygula(satirlar) {
    // kendi gönderdiğimiz (yerelde zaten aynı olan) satırlar yeniden yazılmaz; arayüz boşuna yenilenmez
    const L = satirlar.filter(x => TURLER.includes(x.tur) && (x.silindi ? anahtarOf(x) in st.taban : st.taban[anahtarOf(x)] !== ozet(x.veri)));
    if (!L.length) return 0;
    for (const x of L) if (giden[anahtarOf(x)]) delete giden[anahtarOf(x)];   // aynı satırın bekleyen eski hâli sunucudakiyle değişti
    const d = ds.apply('uzakUygula', { satirlar: L });
    const g = goruntu(d);
    for (const x of L) { const k = anahtarOf(x); if (g[k]) st.taban[k] = ozet(g[k].veri); else delete st.taban[k]; }
    return L.length;
  }

  // ilk eşitleme: sunucudakini çek, firmaları eşle, yereldekileri yükle
  async function ilkEsitleme() {
    const tum = []; let surum = 0, sahip = null;
    for (let i = 0; i < 1000; i++) { const r = await rpc('ofis_veri_degisenler', { p_surum: surum, p_limit: 2000 }); sahip = r.sahip; tum.push(...(r.satirlar || [])); surum = r.surum || surum; if (!r.devam) break; }
    const son = {}; for (const x of tum) son[anahtarOf(x)] = x;                   // her satırın son hâli
    const canli = Object.values(son).filter(x => !x.silindi);
    // aynı firma sunucuda başka kimlikle varsa yerel kimliği çevir
    const sunucuFirma = new Map(canli.filter(x => x.tur === 'firma').map(x => [firmaAnahtari(x.veri), x.anahtar]));
    let d = ds.load(); let cevrilen = 0;
    for (const f of Object.values(d.firms || {})) {
      if (canli.some(x => x.tur === 'firma' && x.anahtar === f.id)) continue;
      const hedef = sunucuFirma.get(firmaAnahtari(f));
      if (hedef && hedef !== f.id) { d = ds.apply('firmaKimlik', { eski: f.id, yeni: hedef }); cevrilen++; }
    }
    // sunucudakiler yerele (yerelde olup sunucuda olmayanlar kalır); taban yalnız sunucudakilerden oluşur → farkı yerel fazlası
    // büro bilgileri dahil sunucudaki esastır; yalnız aynı firmada sunucuda boş olan alanlar (ör. banka hesapları) yereldekinden
    // doldurulur ve birleşmiş hâl sunucuya gönderilir (ilk birleştirmede hiçbir bilgisayarın tanımı kaybolmasın)
    const bos = v => v == null || v === '' || (Array.isArray(v) && !v.length) || (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length);
    const uygulanacak = canli.filter(x => TURLER.includes(x.tur)).map(x => {
      const yf = x.tur === 'firma' && d.firms && d.firms[x.anahtar];
      if (!yf) return x;
      const { mizanInfo, ...yerelV } = yf; const v = { ...x.veri };
      for (const [k, val] of Object.entries(yerelV)) if (bos(v[k]) && !bos(val)) v[k] = val;
      return { ...x, veri: v };
    });
    if (uygulanacak.length) d = ds.apply('uzakUygula', { satirlar: uygulanacak });
    st.taban = {}; const g = goruntu(d);
    for (const x of canli) { const k = anahtarOf(x); if (g[k] && TURLER.includes(x.tur)) st.taban[k] = ozet(g[k].veri); }
    st.sahip = sahip; st.surum = surum; st.ilk = false; kaydet();
    const yuklenen = yerelDegisti(d);
    log(`ilk eşitleme: sunucudan ${canli.length} satır, ${cevrilen} firma kimliği eşlendi, ${yuklenen} satır yüklenecek`);
    onChange();
    return { sunucu: canli.length, cevrilen, yuklenen };
  }

  async function gonder() {
    const L = Object.entries(giden);
    for (let i = 0; i < L.length; i += 200) {
      const parca = L.slice(i, i + 200);
      const r = await rpc('ofis_veri_yaz', { p_satirlar: parca.map(([, x]) => ({ tur: x.tur, firma: x.firma, anahtar: x.anahtar, veri: x.veri, silindi: !!x.silindi })) });
      for (const [k, x] of parca) if (giden[k] === x) delete giden[k];
      if (r && r.sahip && st.sahip && r.sahip !== st.sahip) { st.ilk = true; }   // ofis değişti
      kaydet();
    }
    while (gunluk.length) {
      const parca = gunluk.slice(0, 200);
      await rpc('ofis_gunluk_yaz', { p_kayitlar: parca });
      gunluk = gunluk.slice(parca.length); yaz(gunlukF, gunluk);
    }
  }
  async function cek() {
    let n = 0;
    for (let i = 0; i < 100; i++) {
      const r = await rpc('ofis_veri_degisenler', { p_surum: st.surum, p_limit: 1000 });
      if (r.sahip && st.sahip && r.sahip !== st.sahip) { st.ilk = true; kaydet(); return n; }    // ofis değişti: sonraki turda ilk eşitleme
      n += uygula(r.satirlar || []); st.surum = r.surum || st.surum; kaydet();
      if (!r.devam) break;
    }
    if (n) onChange();
    return n;
  }
  async function tur() {
    if (calisiyor || kapali) return;
    calisiyor = true;
    try {
      if (st.ilk || !st.sahip) await ilkEsitleme();
      await gonder();
      await cek();
      if (st.ilk) await ilkEsitleme();
      hata = null; sonBasari = Date.now(); bekle = aralik;
    } catch (e) {
      hata = String(e && e.message || e);
      if (e && (e.status === 404 || /Could not find the function|schema cache/i.test(hata))) { kapali = true; log('ofis deposu sunucuda yok; yerel çalışılıyor'); }
      bekle = Math.min(bekle * 2, 60000);
    } finally { calisiyor = false; }
    planla(bekle);
  }
  function planla(ms) { if (durdu) return; clearTimeout(zamanlayici); zamanlayici = setTimeout(tur, ms); }
  function simdi() { if (!durdu && !calisiyor) planla(50); }
  return {
    yerelDegisti, gunlukEkle, tur,
    baslat() { durdu = false; planla(10); },
    durdur() { durdu = true; clearTimeout(zamanlayici); },
    durum: () => ({ etkin: !kapali, ilk: !!st.ilk, bekleyen: Object.keys(giden).length, gunlukBekleyen: gunluk.length, hata, sonBasari, surum: st.surum }),
    // testler için: döngü bitene kadar bekle
    async bosalt(tekrar = 3) { for (let i = 0; i < tekrar; i++) { while (calisiyor) await new Promise(r => setTimeout(r, 20)); await tur(); } }
  };
}

module.exports = { makeOfisVeri, goruntu, firmaAnahtari };
