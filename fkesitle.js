'use strict';
// Görev 51: Fatura Kontrol'ün firma bazlı kural ve karar dosyalarının ofis deposuyla (Supabase ofis_veri) eşitlenmesi.
// Dosyalar veri klasöründe (FK_VERI/firmalar/<FİRMA>/) kalır; Python kodu değişmez. Her kayıt ayrı satırdır (iki kişi aynı dosyaya
// farklı karar eklerse ikisi de korunur). Güvenlik: bir kaydın silinmesi yalnız dosyası duruyorken o kayıt dosyadan çıkarıldıysa
// gönderilir; klasör silinirse / veri klasörü değişirse / klasöre ulaşılamazsa ofisteki kayıtlar silinmez.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// dosya → [tür, biçim]: tek (bütün dosya bir kayıt), sozluk ({anahtar: kayıt}), liste ([{id, …}])
const DOSYALAR = {
  'firma.json': ['fk_firma', 'tek'],
  'kaydedilmeyecek.json': ['fk_haric', 'sozluk'],
  'kaydedilmeyecek-kurallari.json': ['fk_hkural', 'liste'],
  'uygun-kararlar.json': ['fk_uygun', 'sozluk'],
  'detay-kararlar.json': ['fk_dkarar', 'sozluk'],
  'detay-kurallari.json': ['fk_dkural', 'liste']
};
const TUR_DOSYA = Object.fromEntries(Object.entries(DOSYALAR).map(([d, [t, b]]) => [t, [d, b]]));
const TURLER = Object.keys(TUR_DOSYA);
const listeAnahtar = x => (x && x.id != null) ? String(x.id) : 'h:' + crypto.createHash('sha1').update(JSON.stringify(x)).digest('hex').slice(0, 16);

function makeFkKaynak(kokFn) {
  const onbellek = new Map();                       // dosya yolu → {imza, kayitlar}
  let sonImza = '';
  const firmalarKok = () => { const k = kokFn(); return k ? path.join(k, 'firmalar') : null; };
  function imza(f) { try { const s = fs.statSync(f); return s.mtimeMs + ':' + s.size; } catch (e) { return null; } }
  function oku(f, bicim) {
    const i = imza(f); if (i == null) return null;
    const o = onbellek.get(f); if (o && o.imza === i) return o.kayitlar;
    let v; try { v = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return o ? o.kayitlar : null; }   // yazılırken okundu: öncekini kullan
    const k = {};
    if (bicim === 'tek') { if (v && typeof v === 'object') k.firma = v; }
    else if (bicim === 'sozluk') { for (const [a, x] of Object.entries(v || {})) k[a] = x; }
    else for (const x of Array.isArray(v) ? v : []) k[listeAnahtar(x)] = x;
    onbellek.set(f, { imza: i, kayitlar: k });
    return k;
  }
  // { satirlar: {anahtar: satır}, dosyaVar: Set('tur|firma') } ya da klasöre ulaşılamıyorsa null
  function goruntu() {
    const kok = firmalarKok(); if (!kok) return null;
    let adlar; try { adlar = fs.readdirSync(kok, { withFileTypes: true }).filter(d => d.isDirectory() && !d.name.startsWith('.')).map(d => d.name); }
    catch (e) { return e.code === 'ENOENT' ? { satirlar: {}, dosyaVar: new Set() } : null; }
    const satirlar = {}, dosyaVar = new Set();
    for (const firma of adlar) for (const [dosya, [tur, bicim]] of Object.entries(DOSYALAR)) {
      const k = oku(path.join(kok, firma, dosya), bicim); if (k == null) continue;
      dosyaVar.add(tur + '|' + firma);
      for (const [a, veri] of Object.entries(k)) satirlar[tur + '|' + firma + '|' + a] = { tur, firma, anahtar: a, veri };
    }
    return { satirlar, dosyaVar };
  }
  // ucuz değişiklik denetimi (yalnız dosya zamanları)
  function degisti() {
    const kok = firmalarKok(); if (!kok) return false;
    let parca = [];
    try { for (const d of fs.readdirSync(kok)) if (!d.startsWith('.')) for (const dosya of Object.keys(DOSYALAR)) { const i = imza(path.join(kok, d, dosya)); if (i) parca.push(d + '/' + dosya + '=' + i); } }
    catch (e) { return false; }
    const s = parca.sort().join('|'); const d = s !== sonImza; sonImza = s; return d;
  }
  // ofis deposundan gelen satırları dosyalara yaz
  function uygula(satirlar) {
    const kok = firmalarKok(); if (!kok) return 0;
    const gruplar = new Map();
    for (const x of satirlar) { const td = TUR_DOSYA[x.tur]; if (!td || !x.firma || /[\\/]|^\.\.?$/.test(x.firma)) continue;
      const f = path.join(kok, x.firma, td[0]); if (!gruplar.has(f)) gruplar.set(f, { bicim: td[1], L: [] }); gruplar.get(f).L.push(x); }
    let n = 0;
    for (const [f, { bicim, L }] of gruplar) {
      let v; try { v = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { v = bicim === 'liste' ? [] : {}; }
      if (bicim === 'tek') { const son = L[L.length - 1]; if (son.silindi || son.veri == null) continue; v = { ...(v || {}), ...son.veri }; }
      else if (bicim === 'sozluk') { v = v && typeof v === 'object' && !Array.isArray(v) ? v : {}; for (const x of L) { if (x.silindi || x.veri == null) delete v[x.anahtar]; else v[x.anahtar] = x.veri; } }
      else { v = Array.isArray(v) ? v : [];
        for (const x of L) { const i = v.findIndex(y => listeAnahtar(y) === x.anahtar);
          if (x.silindi || x.veri == null) { if (i >= 0) v.splice(i, 1); } else if (i >= 0) v[i] = x.veri; else v.push(x.veri); } }
      try { fs.mkdirSync(path.dirname(f), { recursive: true }); const t = f + '.' + process.pid + '.tmp'; fs.writeFileSync(t, JSON.stringify(v, null, 1)); fs.renameSync(t, f); onbellek.delete(f); n += L.length; } catch (e) {}
    }
    sonImza = '';                                      // kendi yazdıklarımız sonraki denetimde değişiklik sayılsa da fark çıkmaz
    return n;
  }
  return { turler: TURLER, goruntu, uygula, degisti };
}

module.exports = { makeFkKaynak, DOSYALAR, TURLER };
