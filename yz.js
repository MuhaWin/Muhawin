'use strict';
/* Muhasebe Denetimi › Detay denetim › Yapay zekâ ile karşılaştırma (Görev 43 Faz 4). Yalnız ana süreçte çalışır.
   - Anthropic API anahtarı kullanıcınındır; Windows'un kullanıcıya özel şifrelemesiyle (safeStorage / DPAPI) bu bilgisayarda
     saklanır. Şifreleme yoksa anahtar KAYDEDİLMEZ. Anahtar ekrana, günlüğe, depoya ya da Fatura Kontrol yan sürecine verilmez.
   - Ayar ofis bazındadır (açık / kapalı, model, onay zamanı); ilk açılışta kullanıcı veri gönderimini açıkça onaylar.
   - Gönderilecek veriyi Fatura Kontrol (fk/fatura_kontrol/yz.py) maskeli hazırlar; burada ikinci kez maskelenir.
   - Yapay zekâ yalnız ÖNERİ verir (uygun / şüpheli / uygun değil); hiçbir kayıt yapmaz, kesin kararı kullanıcı verir. */
const fs = require('fs');
const path = require('path');

// Model adları ve fiyatları tek yerde ($ / 1M token; önbellekten okuma ayrı). Varsayılan: kalite.
const MODELLER = {
  kalite: { id: 'claude-opus-5-5', ad: 'Claude Opus 5.5 (kalite)', girdi: 4, cikti: 20, onbellek: 0.20, yazma: 5 },
  ekonomik: { id: 'claude-sonnet-5-5', ad: 'Claude Sonnet 5.5 (daha ekonomik)', girdi: 2, cikti: 10, onbellek: 0.20, yazma: 2.5 },
};
const VARSAYILAN_MODEL = 'kalite';
const CIKTI_TAHMIN = 900;           // fatura başına tahmini çıktı (düşünme dahil) token'ı — maliyet tahmini için
const BAGLAM_SINIR = 120000, ISTEK_SINIR = 30000;   // karakter

const SISTEM = `Sen Türkiye'de çalışan deneyimli bir mali müşavirin yardımcısısın. Görevin bir faturanın muhasebe kaydını
(Tek Düzen Hesap Planı) kontrol edip ÖNERİ vermek. Kayıt yapmazsın, kayıt önermezsin; yalnız değerlendirirsin. Kesin kararı mali müşavir verir.

Değerlendirirken bak:
- Faturanın türü ve kalemleri, kaydedildiği hesapla uyumlu mu? (ör. kira 770/760 kira gideri, ticari mal alışı 153, demirbaş 255,
  enerji / iletişim giderleri 770 ya da 760 altı, binek araç giderleri ve KKEG, satışlar 600)
- Kayıttaki hesap tutarı faturanın matrahıyla tutarlı mı?
- Cari önceki aylarda farklı hesaba gittiyse bu ayki değişiklik makul mü?
- Fişte cari ve KDV satırları yerinde mi?

karar: "uygun" (kayıt doğru görünüyor), "supheli" (bakılmalı ya da bilgi yetersiz), "uygun_degil" (açıkça yanlış hesap ya da tutar).
guven: 0 ile 1 arası. gerekce: en fazla üç kısa cümle, Türkçe, somut. onerilen_hesap: doğru hesap kodu (firmanın hesap planındaki
koddan; yoksa ana hesap kodu); kayıt doğruysa mevcut hesap.
Kişi adları ve numaralar maskelidir ([gerçek kişi], [numara], [cari hesap]); bunları tahmin etmeye çalışma.`;

const SEMA = {
  type: 'object',
  properties: {
    karar: { type: 'string', enum: ['uygun', 'supheli', 'uygun_degil'] },
    guven: { type: 'number' },
    gerekce: { type: 'string' },
    onerilen_hesap: { type: 'string' },
  },
  required: ['karar', 'guven', 'gerekce', 'onerilen_hesap'],
  additionalProperties: false,
};

// İkinci maskeleme (Fatura Kontrol'deki yz.maskele ile aynı kurallar): IBAN, e-posta, 10–11 haneli numaralar
function maskele(s) {
  return String(s == null ? '' : s)
    .replace(/\bTR\s?\d{2}(?:\s?\d{4}){5}\s?\d{2}\b/gi, '[IBAN]')
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '[e-posta]')
    .replace(/(?<!\d)\d{10,11}(?!\d)/g, '[numara]')
    .replace(/(?<![\d.,])\+?\d[\d ]{9,14}\d(?![\d,])/g, m => (m.replace(/\D/g, '').length >= 10 ? '[numara]' : m));
}

function makeYz({ dir, safeStorage, istemciYap } = {}) {
  const ayarDosya = () => path.join(dir(), 'yz-ayar.json');
  const anahtarDosya = () => path.join(dir(), 'yz-anahtar.bin');
  const sifreVar = () => { try { return !!(safeStorage && safeStorage.isEncryptionAvailable()); } catch (e) { return false; } };
  const ayarOku = () => { try { const v = JSON.parse(fs.readFileSync(ayarDosya(), 'utf8')); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; } };
  const ayarYaz = v => { fs.mkdirSync(dir(), { recursive: true }); fs.writeFileSync(ayarDosya(), JSON.stringify(v, null, 1)); };
  function anahtar() {
    if (!sifreVar()) return '';
    try { return safeStorage.decryptString(fs.readFileSync(anahtarDosya())); } catch (e) { return ''; }
  }
  const ofisAyar = ofis => (ayarOku().ofisler || {})[ofis || '-'] || {};

  function durum(ofis) {
    const a = ofisAyar(ofis), m = MODELLER[a.model] ? a.model : VARSAYILAN_MODEL;
    const anahtarVar = !!anahtar();
    return { acik: !!a.acik && !!a.onay && anahtarVar, istenen: !!a.acik, onay: a.onay || '', anahtarVar, sifreVar: sifreVar(),
             model: m, modeller: Object.fromEntries(Object.entries(MODELLER).map(([k, v]) => [k, { ad: v.ad, id: v.id, girdi: v.girdi, cikti: v.cikti, onbellek: v.onbellek, yazma: v.yazma }])),
             ciktiTahmin: CIKTI_TAHMIN };
  }
  function ayarla(ofis, { acik, model, onay } = {}) {
    const v = ayarOku(); v.ofisler = v.ofisler || {};
    const a = { ...(v.ofisler[ofis || '-'] || {}) };
    if (model !== undefined) { if (!MODELLER[model]) throw new Error('Bilinmeyen model seçimi'); a.model = model; }
    if (onay === true && !a.onay) a.onay = new Date().toISOString();
    if (acik !== undefined) {
      if (acik && !a.onay) throw new Error('Önce veri gönderimini onaylayın.');
      a.acik = !!acik;
    }
    v.ofisler[ofis || '-'] = a; ayarYaz(v);
    return durum(ofis);
  }
  function anahtarKaydet(k) {
    const s = String(k || '').trim();
    if (!/^sk-ant-[A-Za-z0-9_-]{20,}$/.test(s)) throw new Error('Anthropic API anahtarı "sk-ant-" ile başlamalı.');
    if (!sifreVar()) throw new Error('Bu bilgisayarda güvenli saklama (Windows şifrelemesi) kullanılamıyor; anahtar kaydedilmedi.');
    fs.mkdirSync(dir(), { recursive: true });
    fs.writeFileSync(anahtarDosya(), safeStorage.encryptString(s));
    return true;
  }
  function anahtarSil() { try { fs.unlinkSync(anahtarDosya()); } catch (e) {} return true; }

  // Bir faturanın değerlendirmesi. baglam: firmanın hesap planı (önbelleklenir); istek: faturanın maskeli özeti (JSON)
  async function degerlendir(ofis, { baglam, istek } = {}) {
    const d = durum(ofis);
    if (!d.anahtarVar) throw new Error('Yapay zekâ kapalı: Ayarlar\'da Anthropic API anahtarı girilmemiş.');
    if (!d.acik) throw new Error('Yapay zekâ ile karşılaştırma Ayarlar\'da kapalı.');
    const b = maskele(baglam), i = maskele(typeof istek === 'string' ? istek : JSON.stringify(istek || {}));
    if (!b || b.length > BAGLAM_SINIR || !i || i.length > ISTEK_SINIR) throw new Error('Gönderilecek veri beklenen boyutta değil.');
    const M = MODELLER[d.model];
    const istemci = (istemciYap || varsayilanIstemci)(anahtar());
    const r = await istemci.beta.messages.create({
      model: M.id,
      max_tokens: 8000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',                                // güvenlik sınıflandırıcısı reddederse sunucu önerilen modelle yeniden dener
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: SEMA } },
      system: [{ type: 'text', text: SISTEM }, { type: 'text', text: b, cache_control: { type: 'ephemeral' } }],   // firma bağlamı önbellekte
      messages: [{ role: 'user', content: 'Bu faturanın kaydını değerlendir:\n' + i }],
    });
    if (r.stop_reason === 'refusal') throw new Error('Yapay zekâ bu faturayı değerlendirmedi (güvenlik reddi).');
    if (r.stop_reason === 'max_tokens') throw new Error('Yapay zekânın yanıtı yarım kaldı; yeniden deneyin.');
    const metin = (r.content || []).filter(x => x.type === 'text').map(x => x.text).join('');
    let s; try { s = JSON.parse(metin); } catch (e) { throw new Error('Yapay zekânın yanıtı okunamadı.'); }
    if (!s || !['uygun', 'supheli', 'uygun_degil'].includes(s.karar)) throw new Error('Yapay zekânın yanıtı beklenen biçimde değil.');
    const u = r.usage || {};
    const maliyet = ((u.input_tokens || 0) * M.girdi + (u.cache_read_input_tokens || 0) * M.onbellek +
                     (u.cache_creation_input_tokens || 0) * M.yazma + (u.output_tokens || 0) * M.cikti) / 1e6;
    return { sonuc: { karar: s.karar, guven: Math.max(0, Math.min(1, Number(s.guven) || 0)), gerekce: String(s.gerekce || '').slice(0, 600),
                      onerilen_hesap: String(s.onerilen_hesap || '').slice(0, 40) },
             model: r.model || M.id, kullanim: { girdi: u.input_tokens || 0, onbellek: u.cache_read_input_tokens || 0,
                                                 onbellek_yazma: u.cache_creation_input_tokens || 0, cikti: u.output_tokens || 0 },
             maliyet: Math.round(maliyet * 10000) / 10000 };
  }
  // gönderimden önce kullanıcıya gösterilecek metin (aynı maskeleme)
  const gosterim = ({ baglam, istek } = {}) => ({ sistem: SISTEM, baglam: maskele(baglam),
    istek: maskele(typeof istek === 'string' ? istek : JSON.stringify(istek || {}, null, 1)) });
  return { durum, ayarla, anahtarKaydet, anahtarSil, degerlendir, gosterim };
}

function varsayilanIstemci(apiKey) {
  const Anthropic = require('@anthropic-ai/sdk');
  const A = Anthropic.default || Anthropic;
  return new A({ apiKey, maxRetries: 2, timeout: 120000 });
}

module.exports = { makeYz, maskele, MODELLER, SEMA, SISTEM };
