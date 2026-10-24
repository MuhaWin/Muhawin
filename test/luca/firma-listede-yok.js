// Görev 45: firma Luca'nın firma / dönem listesinde (sirket_donem_listesi.jq) yoksa da dönemi varsa iş sürer (mizan çekmedeki gibi);
// kod tablosu, fiş hazırlığı aynı yoldan (prepareFis) geçer. Gerçek Luca'ya gidilmez.
const Module = require('module'); const orig = Module._load; const path = require('path');
let tum = [], istekler = [], liste = [], donemler = {}, combo = [], ust = 'combo', oturum = false;
class W {
  constructor() { this.url = ''; this.d = false; this.h = {}; this.wh = {}; this.oturum = { firma: null, donem: null }; tum.push(this); const self = this;
    this.webContents = { getURL: () => this.url, on: (e, f) => { (self.wh[e] = self.wh[e] || []).push(f); }, once: (e, f) => { (self.wh[e] = self.wh[e] || []).push(f); },
      setWindowOpenHandler: () => {}, executeJavaScript: async s => self.calistir(s), session: { webRequest: { onBeforeRequest() {}, onCompleted() {} } }, mainFrame: { framesInSubtree: [] } }; }
  async calistir(s) {
    if (/\/\*MW_OTURUM\*\//.test(s)) return oturum && this.oturum.firma ? JSON.stringify({ SIRKET_ID: this.oturum.firma, DONEM_ID: this.oturum.donem }) : null;
    const m = s.match(/fetch\(base \+ ("(?:[^"\\]|\\.)*")/); if (!m) return null; const yol = JSON.parse(m[1]);
    if (/sirket_donem_listesi/.test(yol)) return { status: 200, text: JSON.stringify(liste) };
    if (/genel\/donem\.jq/.test(yol)) { const id = yol.match(/sirket_id=([^&]+)/)[1]; return { status: 200, text: JSON.stringify(donemler[decodeURIComponent(id)] || []) }; }
    if (/TopFrameAction/.test(yol)) {   // Luca üst çubuğu: firma açılır listesi seçili firmayla (ust = 'yoksay': Luca seçimi uygulamaz)
      const id = yol.match(/SIRKET_ID=(\w+)/)[1];
      if (ust !== 'yoksay') { this.oturum.firma = id; this.oturum.donem = yol.match(/DONEM_ID=(\w+)/)[1]; }
      const html = ust === 'bos' ? '<div>üst</div>' : `<select name="SirketCombo" id="SirketCombo">${combo.map(([v, a]) => `<option value="${v}"${v === this.oturum.firma ? ' selected' : ''}>${a}</option>`).join('')}</select>`;
      return { status: 200, text: html }; }
    if (/kdv_hesap_listesi/.test(yol)) { istekler.push({ firma: this.oturum.firma, donem: this.oturum.donem }); return { status: 200, text: JSON.stringify({ KDV_20_1: { hesap_kodu: '191.01.20', hesap_adi: 'X' } }) }; }
    return { status: 200, text: '[]' }; }
  removeMenu() {} setTitle() {} on(e, f) { this.h[e] = f; } once(e, f) { this.h[e] = f; } loadURL(u) { this.url = u; } isDestroyed() { return this.d; }
  destroy() { this.d = true; } close() { this.d = true; } isMinimized() { return false; } restore() {} show() {} focus() {} isVisible() { return true; }
}
Module._load = function (r, ...a) { if (r === 'electron') return { BrowserWindow: W, session: { fromPartition: () => ({}) } }; return orig.call(this, r, ...a); };
const L = require(path.join(__dirname, '..', '..', 'luca.js')); L.init({ parent: null, notify: () => {} });
L.openLogin(); const app = new W(); app.url = 'https://auygs.luca.com.tr/Luca/luca.do'; (tum[0].wh['did-create-window'] || []).forEach(f => f(app));
let ok = true; const t = (ad, v) => { console.log((v ? '✓ ' : '✗ ') + ad); ok = ok && !!v; };
const hata = async f => { try { await f(); return null; } catch (e) { return e; } };
(async () => {
  L._sayfaAyar({ kiraMs: 0 });
  combo = [['1', 'ALFA'], ['77', 'INNOCAP'], ['99', 'BAŞKA']];   // üst çubuktaki açılır liste (Toplu Kontrol bunu kullanır) firmayı içerir
  // 1) firma listede: eskisi gibi
  liste = [{ label: 'ALFA', value: '1' }]; donemler = { 1: [{ label: '2025', value: 'A25' }, { label: '2026', value: 'A26' }] };
  let r = await L.kdvHesaplari({ lucaId: '1', year: '2026' });
  t('listedeki firma: firma ve doğru dönem (2026) seçildi, kod tablosu geldi', istekler.pop().donem === 'A26' && r.tablo['1']['20'].kod === '191.01.20');
  // 2) firma listede YOK ama Luca dönemlerini veriyor (listenin her firmayı döndürmediği durum): iş sürer
  liste = [{ label: 'ALFA', value: '1' }]; donemler = { 1: [{ label: '2026', value: 'A26' }], 77: [{ label: '2025', value: 'B25' }, { label: '2026', value: 'B26' }] };
  r = await L.kdvHesaplari({ lucaId: '77', year: '2025' });
  const x = istekler.pop();
  t('listede olmayan firma (dönemi var): firma 77, dönem 2025 seçildi, kod tablosu geldi', x.firma === '77' && x.donem === 'B25' && r.tablo['1']['20']);
  const p = await L.prepareFis({ lucaId: '77', year: '2026' });
  t('fiş hazırlığı da aynı yoldan: dönem 2026, firma adı üst çubuktan (INNOCAP)', p.donemId === 'B26' && p.firmLabel === 'INNOCAP');
  // 3) ne listede ne dönemi var: açık hata (firma no, liste sayısı)
  const e3 = await hata(() => L.kdvHesaplari({ lucaId: '99', year: '2026' }));
  t('hiç bulunamayan firma: NO_FIRM, iletide firma no ve liste sayısı (' + (e3 && e3.message) + ')', e3 && e3.code === 'NO_FIRM' && /99/.test(e3.message) && /1 firma/.test(e3.message));
  // 4) firmanın istenen yılı yok: dönemleri sayar
  const e4 = await hata(() => L.kdvHesaplari({ lucaId: '77', year: '2024' }));
  t('istenen yıl yok: NO_PERIOD, var olan dönemler yazıyor', e4 && e4.code === 'NO_PERIOD' && /2025, 2026/.test(e4.message));
  // 5) Luca karşılığı olmayan firma
  const e5 = await hata(() => L.kdvHesaplari({ lucaId: '', year: '2026' }));
  t('Luca karşılığı yok: ARG', e5 && e5.code === 'ARG');
  // 6) firma listesi okunamazsa (dizi değil) ama dönemi varsa yine sürer
  liste = { hata: 'x' }; r = await L.kdvHesaplari({ lucaId: '77', year: '2026' });
  t('firma listesi okunamasa da (dönemi varsa) iş sürer', istekler.pop().donem === 'B26');
  // 7) Luca seçimi uygulamazsa (seçili firma başka kalır): fiş / kod tablosu isteği gitmez
  ust = 'yoksay'; const once = istekler.length;
  const e7 = await hata(() => L.kdvHesaplari({ lucaId: '1', year: '2026' }));
  donemler[99] = [{ label: '2026', value: 'C26' }];   // listede olmayan, dönemi olan başka firma
  const e7b = await hata(() => L.prepareFis({ lucaId: '99', year: '2026' }));
  t('seçim doğrulaması: Luca başka firmada kaldıysa FIRMA_SECIM, istek gitmedi (' + (e7 && e7.message) + ')', e7 && e7.code === 'FIRMA_SECIM' && e7b && e7b.code === 'FIRMA_SECIM' && istekler.length === once);
  // 8) üst çubukta liste yoksa __SESSION'dan doğrulanır; hiçbiri okunamazsa listede olmayan firma için iş durur, listedeki için eskisi gibi sürer
  ust = 'bos'; oturum = true; delete donemler[99];
  t('üst çubuk listesi yoksa __SESSION ile doğrulandı (listede olmayan firma)', (await L.prepareFis({ lucaId: '77', year: '2026' })).donemId === 'B26');
  oturum = false;
  const e8 = await hata(() => L.prepareFis({ lucaId: '77', year: '2026' }));
  t('listede yok ve seçim doğrulanamıyor: FIRMA_SECIM', e8 && e8.code === 'FIRMA_SECIM');
  liste = [{ label: 'ALFA', value: '1' }];
  t('listedeki firma: doğrulanamasa da eskisi gibi sürer', (await L.prepareFis({ lucaId: '1', year: '2026' })).donemId === 'A26');
  t('üst çubuk ayrıştırma: seçili değer ve ad; liste yoksa null', JSON.stringify(L._sirketSecimi('<SELECT id=SirketCombo class=x><option value=1>A<option value="77" selected>INNOCAP</select>')) === JSON.stringify({ secili: '77', ad: 'INNOCAP' }) && L._sirketSecimi('<p>').secili === null);
  process.exit(ok ? 0 : 1);
})().catch(e => { console.log('HATA', e); process.exit(1); });
