// Görev 29: Luca sayfa yönetimi – ortak sayfa, kilit, Luca'nın "yeni pencere" düğmesiyle ek sayfa, ayrılık sınaması.
// Gerçek Luca'ya gidilmez: taklit pencereler ve taklit Luca sunucusu (oturum başına seçili firma).
const Module = require('module'); const orig = Module._load; const path = require('path');
let tum = [], dugmeVar = true, ayriOturumlu = true, kayit = [];
class W {
  constructor(o) {
    this.o = o || {}; this.url = ''; this.d = false; this.h = {}; this.wh = {}; this.oturum = null; tum.push(this); const self = this;
    const js = async s => self.calistir(s);
    this.webContents = { getURL: () => this.url, on: (e, f) => { (self.wh[e] = self.wh[e] || []).push(f); }, once: (e, f) => { (self.wh[e] = self.wh[e] || []).push(f); },
      setWindowOpenHandler: f => { self.acilis = f; }, executeJavaScript: js, session: { webRequest: { onBeforeRequest() {}, onCompleted() {} } },
      mainFrame: { get framesInSubtree() { return [{ executeJavaScript: async s => self.cerceve(s) }]; } } };
  }
  async calistir(s) {
    const o = this.oturum;
    if (/\/\*MW_OTURUM\*\//.test(s)) return o && o.firma ? JSON.stringify({ SIRKET_ID: o.firma, DONEM_ID: o.donem }) : null;
    const m = s.match(/fetch\(base \+ ("(?:[^"\\]|\\.)*")/); if (!m) return null;
    const yol = JSON.parse(m[1]);
    await new Promise(r => setTimeout(r, 20));
    if (/sirket_donem_listesi/.test(yol)) return { status: 200, text: JSON.stringify([{ label: 'ALFA', value: '1' }, { label: 'BETA', value: '2' }]) };
    if (/genel\/donem\.jq/.test(yol)) { const id = yol.match(/sirket_id=(\d+)/)[1]; return { status: 200, text: JSON.stringify([{ label: '2026', value: 'D' + id }]) }; }
    if (/TopFrameAction/.test(yol)) { o.firma = yol.match(/SIRKET_ID=(\d+)/)[1]; o.donem = yol.match(/DONEM_ID=(\w+)/)[1]; await new Promise(r => setTimeout(r, 30)); return { status: 200, text: '' }; }
    if (/fis_kes/.test(yol)) { const b = JSON.parse(JSON.parse(s.match(/opt\.body = ("(?:[^"\\]|\\.)*")/)[1])); await new Promise(r => setTimeout(r, 60));
      kayit.push({ istenen: b.donem_id, secili: 'D' + o.firma, sayfa: tum.indexOf(this) }); return { status: 200, text: JSON.stringify({ success: 'ok', fisNo: String(kayit.length) }) }; }
    return { status: 200, text: '[]' };
  }
  cerceve(s) {
    if (!/yeni\[/.test(s) && !/newwin|yenipencere/i.test(s)) return '';
    if (!dugmeVar) return '';
    setTimeout(() => {
      const gizli = this.acilis ? this.acilis({}).overrideBrowserWindowOptions.show === false : null;
      const c = new W({}); c.gizli = gizli; c.oturum = ayriOturumlu ? { firma: this.oturum.firma, donem: this.oturum.donem } : this.oturum;
      c.url = 'https://auygs.luca.com.tr/Luca/luca.do';
      (this.wh['did-create-window'] || []).forEach(f => f(c));
      setTimeout(() => (c.wh['did-finish-load'] || []).forEach(f => f()), 30);
    }, 30);
    return '<a class="yeniPencere">';
  }
  removeMenu() {} setTitle() {} on(e, f) { this.h[e] = f; } once(e, f) { this.h[e] = f; } loadURL(u) { this.url = u; } isDestroyed() { return this.d; }
  destroy() { if (this.d) return; this.d = true; (this.h.closed || (() => {}))(); } close() { this.destroy(); }
  isMinimized() { return false; } restore() {} show() {} focus() {} maximize() {} setAlwaysOnTop() {} moveTop() {} minimize() {} isVisible() { return true; }
}
Module._load = function (r, ...a) { if (r === 'electron') return { BrowserWindow: W, session: { fromPartition: () => ({ clearStorageData: async () => {}, on() {}, removeListener() {} }) } }; return orig.call(this, r, ...a); };
const yukle = () => { delete require.cache[require.resolve(path.join(__dirname, '..', '..', 'luca.js'))]; tum = []; kayit = [];
  const L = require(path.join(__dirname, '..', '..', 'luca.js')); L.init({ parent: null, notify: () => {} });
  // giriş penceresi → Luca ana ekranı (ortak sayfa)
  L.openLogin(); const g = tum[0]; const app = new W({}); app.url = 'https://auygs.luca.com.tr/Luca/luca.do'; app.oturum = { firma: null };
  (g.wh['did-create-window'] || []).forEach(f => f(app));
  return { L, app };
};
let ok = true; const t = (ad, v) => { console.log((v ? '✓ ' : '✗ ') + ad); ok = ok && !!v; };
const fis = { detaylar: [{ hesap: '100', borc: 1 }] };

(async () => {
  // 1) Ayrı oturumlu Luca: başka firmanın işi ek sayfada yürür
  { const { L, app } = yukle(); L._sayfaAyar({ kiraMs: 400 });
    const a = await L.prepareFis({ lucaId: '1', year: '2026' });
    t('ilk iş ortak sayfada (ALFA seçildi)', a.donemId === 'D1' && app.oturum.firma === '1');
    const [b] = await Promise.all([L.prepareFis({ lucaId: '2', year: '2026' })]);
    const bilgi = L.sayfaBilgisi();
    t('ALFA kirası sürerken BETA işi için Luca\'nın yeni pencere düğmesiyle ek sayfa açıldı', b.donemId === 'D2' && bilgi.ek.length === 1);
    t('ek sayfa ayrı çalışıyor (sınama: ortak sayfada ALFA korundu)', bilgi.ayriOturum === true && app.oturum.firma === '1');
    t('program sorgu sayfası (status) ortak sayfa, ek değil', (await L.status()).url === app.url && L.sayfaBilgisi().ortak);
    await Promise.all([L.fisKes({ donemId: 'D1', fis }), L.fisKes({ donemId: 'D2', fis }), L.fisKes({ donemId: 'D1', fis }), L.fisKes({ donemId: 'D2', fis })]);
    t('aynı anda kesilen fişler doğru firmada (' + JSON.stringify(kayit) + ')', kayit.length === 4 && kayit.every(k => k.istenen === k.secili));
    t('ALFA fişleri ortak, BETA fişleri ek sayfada', kayit.filter(k => k.istenen === 'D1').every(k => k.sayfa === tum.indexOf(app)) && kayit.filter(k => k.istenen === 'D2').every(k => k.sayfa !== tum.indexOf(app)));
    const ek = tum.find(w => w !== app && w.url && /luca\.do/.test(w.url) && w !== tum[0]);
    t('ek sayfa gizli açıldı; sonra açılan Luca pencereleri yine görünür', ek && ek.gizli === true && app.acilis({}).overrideBrowserWindowOptions.show === true);
    L._sayfaAyar({ ekBosMs: 0 }); }

  // 2) Aynı Luca oturumunu paylaşan sayfalar: sınama yakalar, ortak sayfanın firması geri seçilir, iş sıraya girer
  { ayriOturumlu = false; const { L, app } = yukle(); L._sayfaAyar({ kiraMs: 300 });
    await L.prepareFis({ lucaId: '1', year: '2026' });
    const b = await L.prepareFis({ lucaId: '2', year: '2026' });
    const bilgi = L.sayfaBilgisi();
    t('paylaşılan oturum fark edildi; ek sayfa kullanılmıyor', bilgi.ayriOturum === false && b.donemId === 'D2');
    t('BETA işi ortak sayfada, ALFA kirası bittikten sonra yürüdü', app.oturum.firma === '2');
    await Promise.all([L.fisKes({ donemId: 'D1', fis }), L.fisKes({ donemId: 'D2', fis }), L.fisKes({ donemId: 'D1', fis })]);
    t('paylaşılan oturumda da fişler doğru firmada (sırayla, gerekirse firma yeniden seçilerek): ' + JSON.stringify(kayit), kayit.length === 3 && kayit.every(k => k.istenen === k.secili));
    const once = tum.length; await L.prepareFis({ lucaId: '1', year: '2026' }); await new Promise(r => setTimeout(r, 50));
    t('ayrı olmadığı anlaşılınca yeni ek sayfa açılmaz', tum.length === once); }

  // 3) Aynı firmanın işleri aynı sayfayı paylaşır (ek sayfa açılmaz); yeni pencere düğmesi yoksa iş sıraya girer
  { ayriOturumlu = true; const { L } = yukle(); L._sayfaAyar({ kiraMs: 300 });
    await Promise.all([L.prepareFis({ lucaId: '1', year: '2026' }), L.prepareFis({ lucaId: '1', year: '2026' }), L.fisKes({ donemId: 'D1', fis })]);
    t('aynı firma: ek sayfa yok', L.sayfaBilgisi().ek.length === 0);
    dugmeVar = false; const t0 = Date.now();
    const b = await L.prepareFis({ lucaId: '2', year: '2026' });
    t('yeni pencere düğmesi bulunamazsa iş ortak sayfada sıraya girer (' + (Date.now() - t0) + ' ms)', b.donemId === 'D2' && L.sayfaBilgisi().ek.length === 0);
    await L.fisKes({ donemId: 'D1', fis });
    t('sonraki ALFA fişi için firma yeniden seçildi', kayit.every(k => k.istenen === k.secili));
    dugmeVar = true; }

  // 4) Firma seçmeyen işler (firma listesi) kilit beklemez
  { const { L } = yukle(); L._sayfaAyar({ kiraMs: 5000 });
    await L.prepareFis({ lucaId: '1', year: '2026' });
    const t0 = Date.now(); const f = await L.listFirms();
    t('firma listesi ALFA kirası sürerken beklemeden geldi', f.length === 2 && Date.now() - t0 < 1000 && L.sayfaBilgisi().ek.length === 0); }

  process.exit(ok ? 0 : 1);
})().catch(e => { console.log('HATA', e); process.exit(1); });
