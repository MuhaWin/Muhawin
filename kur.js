'use strict';
// TCMB gösterge kurları (https://www.tcmb.gov.tr/kurlar/YYYYMM/DDMMYYYY.xml).
// İşlem tarihinden ÖNCEKİ son iş gününün bülteni kullanılır (TCMB kurları ilan edildiği günün ertesi işlemler için geçerlidir):
// tarih−1, tarih−2 … geriye doğru ilk yayımlanmış bülten. Döviz alış (ForexBuying) / birim (JPY gibi 100 birimlik kurlar bölünür).
// Bültenler hesap klasöründe kurlar.json'da önbelleklenir; yayımlanmayan (tatil) günler de not edilir.
const fs = require('fs');
const path = require('path');

const pad = n => String(n).padStart(2, '0');
const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());

function bultenCoz(xml) {
  const out = {};
  const re = /<Currency\b[^>]*\bKod="([A-Z]{3})"[^>]*>([\s\S]*?)<\/Currency>/g;
  let m;
  while ((m = re.exec(xml))) {
    const g = t => { const x = m[2].match(new RegExp('<' + t + '>\\s*([^<]*)</' + t + '>')); return x ? x[1].trim() : ''; };
    const birim = parseInt(g('Unit'), 10) || 1;
    const alis = parseFloat(g('ForexBuying').replace(',', '.'));
    if (alis > 0) out[m[1]] = { alis, birim, kur: Math.round(alis / birim * 1e6) / 1e6, ad: g('Isim') };
  }
  const t = xml.match(/<Tarih_Date[^>]*\bTarih="(\d{2})\.(\d{2})\.(\d{4})"/);
  return { kurlar: out, tarih: t ? `${t[3]}-${t[2]}-${t[1]}` : null };
}

function makeKur(dirFn, { fetchFn = (...a) => fetch(...a), bugun = () => new Date() } = {}) {
  const dosya = () => path.join(dirFn(), 'kurlar.json');
  let C = null;
  const oku = () => { if (C) return C; try { C = JSON.parse(fs.readFileSync(dosya(), 'utf8')); } catch (e) { C = {}; } C.b = C.b || {}; C.yok = C.yok || {}; return C; };
  const yaz = () => { try { fs.mkdirSync(path.dirname(dosya()), { recursive: true }); fs.writeFileSync(dosya(), JSON.stringify(C)); } catch (e) {} };

  async function bulten(g) {           // g: 'YYYY-MM-DD' → {kurlar} | null (yayımlanmamış)
    const c = oku();
    if (c.b[g]) return c.b[g];
    if (c.yok[g]) return null;
    const [y, a, d] = g.split('-');
    const url = `https://www.tcmb.gov.tr/kurlar/${y}${a}/${d}${a}${y}.xml`;
    let r;
    try { r = await fetchFn(url, { headers: { 'User-Agent': 'MuhaWin' } }); }
    catch (e) { throw new Error('TCMB kur sayfasına ulaşılamadı. İnternet bağlantınızı kontrol edin.'); }
    if (r.status === 404) {
      const bugunIso = iso(bugun());
      if (g < bugunIso) { c.yok[g] = 1; yaz(); }      // geçmiş gün ve bülten yok: tatil / hafta sonu
      return null;
    }
    if (!r.ok) throw new Error('TCMB kur sayfası yanıt vermedi (' + r.status + ').');
    const x = bultenCoz(await r.text());
    if (!Object.keys(x.kurlar).length) return null;
    c.b[g] = { kurlar: x.kurlar }; yaz();
    return c.b[g];
  }

  /** İşlem tarihinden önceki son iş gününün döviz alış kuru. */
  async function kur(pb, tarih) {
    pb = String(pb || '').toUpperCase();
    if (!pb || pb === 'TRY' || pb === 'TL') return { pb: 'TRY', kur: 1, bulten: null };
    const t = new Date(String(tarih).slice(0, 10) + 'T12:00:00');
    if (isNaN(t)) throw new Error('Geçersiz tarih: ' + tarih);
    for (let i = 1; i <= 12; i++) {
      const d = new Date(t); d.setDate(d.getDate() - i);
      const g = iso(d);
      if (g > iso(bugun())) continue;
      const b = await bulten(g);
      if (!b) continue;
      const k = b.kurlar[pb];
      if (!k) throw new Error(`TCMB ${g} bülteninde ${pb} kuru yok.`);
      return { pb, kur: k.kur, alis: k.alis, birim: k.birim, bulten: g };
    }
    throw new Error(`${String(tarih).slice(0, 10)} için TCMB kuru bulunamadı (önceki 12 günde bülten yok).`);
  }

  async function kurlar(istekler) {
    const out = {}, hatalar = [];
    for (const q of istekler || []) {
      const k = String(q.pb).toUpperCase() + '|' + String(q.tarih).slice(0, 10);
      if (out[k]) continue;
      try { out[k] = await kur(q.pb, q.tarih); } catch (e) { hatalar.push(k + ': ' + e.message); }
    }
    return { kurlar: out, hatalar };
  }
  return { kur, kurlar, _bultenCoz: bultenCoz };
}
module.exports = { makeKur, bultenCoz };
