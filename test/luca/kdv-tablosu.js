// Görev 36: Luca KDV kod tablosu (kdv/kdv_hesap_listesi.jq) – ayrıştırma ve istek. Gerçek Luca'ya gidilmez.
const Module = require('module'); const orig = Module._load; const path = require('path');
let tum = [], istekler = [];
const YANIT = { KDV_20_1: { hesap_kodu: '191.01.20', hesap_adi: '%20 İNDİRİLECEK KDV', hesap_id: 5 }, KDV_10_1: { hesap_kodu: '191.01.10', hesap_adi: '%10 İND. KDV' },
  KDV_20_11: { hesap_kodu: '153.01.20', hesap_adi: 'TİCARİ MAL %20' }, KDV_20_3: { hesap_kodu: '391.01.20', hesap_adi: '%20 HES. KDV' }, KDV_0_0: { hesap_kodu: '600.01.00', hesap_adi: 'YURTİÇİ SATIŞ %0' },
  KDV_1_11: { hesap_kodu: '', hesap_adi: '' }, KDV_8_11: null, BASKA: { hesap_kodu: '100' }, KDV_20_4: { hesap_kodu: 'yanlış kod' } };
class W {
  constructor() { this.url = ''; this.d = false; this.h = {}; this.wh = {}; this.oturum = { firma: null }; tum.push(this); const self = this;
    this.webContents = { getURL: () => this.url, on: (e, f) => { (self.wh[e] = self.wh[e] || []).push(f); }, once: (e, f) => { (self.wh[e] = self.wh[e] || []).push(f); },
      setWindowOpenHandler: () => {}, executeJavaScript: async s => self.calistir(s), session: { webRequest: { onBeforeRequest() {}, onCompleted() {} } }, mainFrame: { framesInSubtree: [] } }; }
  async calistir(s) {
    const m = s.match(/fetch\(base \+ ("(?:[^"\\]|\\.)*")/); if (!m) return null; const yol = JSON.parse(m[1]);
    if (/sirket_donem_listesi/.test(yol)) return { status: 200, text: JSON.stringify([{ label: 'ALFA', value: '1' }]) };
    if (/genel\/donem\.jq/.test(yol)) return { status: 200, text: JSON.stringify([{ label: '2026', value: 'D1' }]) };
    if (/TopFrameAction/.test(yol)) { this.oturum.firma = '1'; return { status: 200, text: '' }; }
    if (/kdv_hesap_listesi/.test(yol)) { const b = JSON.parse(JSON.parse(s.match(/opt\.body = ("(?:[^"\\]|\\.)*")/)[1])); istekler.push({ yol, b, firma: this.oturum.firma }); return { status: 200, text: JSON.stringify(YANIT) }; }
    return { status: 200, text: '[]' }; }
  removeMenu() {} setTitle() {} on(e, f) { this.h[e] = f; } once(e, f) { this.h[e] = f; } loadURL(u) { this.url = u; } isDestroyed() { return this.d; }
  destroy() { this.d = true; } close() { this.d = true; } isMinimized() { return false; } restore() {} show() {} focus() {} isVisible() { return true; }
}
Module._load = function (r, ...a) { if (r === 'electron') return { BrowserWindow: W, session: { fromPartition: () => ({}) } }; return orig.call(this, r, ...a); };
const L = require(path.join(__dirname, '..', '..', 'luca.js')); L.init({ parent: null, notify: () => {} });
L.openLogin(); const app = new W(); app.url = 'https://auygs.luca.com.tr/Luca/luca.do'; (tum[0].wh['did-create-window'] || []).forEach(f => f(app));
let ok = true; const t = (ad, v) => { console.log((v ? '✓ ' : '✗ ') + ad); ok = ok && !!v; };
(async () => {
  const r = await L.kdvHesaplari({ lucaId: '1', year: '2026' });
  t('istek: firma seçildikten sonra, POST kdv/kdv_hesap_listesi.jq', istekler.length === 1 && istekler[0].firma === '1');
  t('gövde: map 1, oranlar ve yalnız anlamı bilinen işlem kodları', istekler[0].b.map === 1 && istekler[0].b.oranlar === '0,1,8,10,18,20' && istekler[0].b.islemler === '0,1,2,3,4,11,20,50');
  t('ayrıştırma: işlem → oran → {kod, ad}', r.tablo['1']['20'].kod === '191.01.20' && r.tablo['1']['10'].kod === '191.01.10' && r.tablo['11']['20'].ad === 'TİCARİ MAL %20' && r.tablo['0']['0'].kod === '600.01.00');
  t('boş / geçersiz / tanınmayan anahtarlar atlanır', !(r.tablo['11'] || {})['1'] && !(r.tablo['11'] || {})['8'] && !(r.tablo['4']) && Object.keys(r.tablo).sort().join() === '0,1,11,3');
  let hata = ''; try { L._kdvTablosuCoz([1, 2]); } catch (e) { hata = e.code; }
  t('beklenmeyen biçimde anlaşılır hata', hata === 'FORMAT');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.log('HATA', e); process.exit(1); });
