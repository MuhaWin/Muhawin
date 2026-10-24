'use strict';
// Luca bağlantısı: kullanıcı kendi bilgileriyle Luca'ya program içindeki pencerede girer.
// Şifre programda tutulmaz; oturum çerezleri yalnızca bu bilgisayardaki "persist:luca" bölümünde kalır.
const { BrowserWindow, session } = require('electron');

const LOGIN_URL = 'https://agiris.luca.com.tr/LUCASSO/giris.erp';
const SSO_ANA_URL = 'https://agiris.luca.com.tr/LUCASSO/main.erp';
const PARTITION = 'persist:luca';
let parent = null, notify = () => {};
const windows = new Set();

let getCreds = null, getRequiredUye = () => '';
function init(opts) { parent = opts.parent; notify = opts.notify || notify; getCreds = opts.getCreds || getCreds; getRequiredUye = opts.getRequiredUye || getRequiredUye; }
const normUye = x => String(x || '').replace(/\D/g, '');
function autofillLogin(wc) {
  try {
    const u = wc.getURL() || '';
    if (!/giris\.erp/i.test(u)) return;
    const c = getCreds && getCreds();
    if (!c || !(c.uyeno || c.kullanici || c.parola)) return;
    const req = normUye(getRequiredUye());
    const js = '(function(){function s(id,v){var e=document.getElementById(id);if(e&&v){e.value=v;e.dispatchEvent(new Event("input",{bubbles:true}));e.dispatchEvent(new Event("change",{bubbles:true}));}}'
      + 's("musteriNo",' + JSON.stringify(c.uyeno || '') + ');'
      + (req ? 'var u=document.getElementById("musteriNo");if(u){u.readOnly=true;u.title="Ofisinizin Luca üye numarası";u.style.background="#eef2f0";}' : '')
      + 's("kullaniciAdi",' + JSON.stringify(c.kullanici || '') + ');'
      + 's("parola",' + JSON.stringify(c.parola || '') + ');'
      // doğrulama kodu (captcha) kutusuna imleç gelir; kodu yazıp Enter'a basınca Giriş düğmesine basılır
      + 'var tum=[].slice.call(document.querySelectorAll("input")).filter(function(e){var r=e.getBoundingClientRect();return r.width>0&&r.height>0&&/^(text|tel|number|)$/i.test(e.type||"");});'
      + 'var cap=tum.filter(function(e){return ["musteriNo","kullaniciAdi","parola"].indexOf(e.id)<0&&/captcha|g[üu]venlik|do[ğg]rulama|kod|code/i.test([e.id,e.name,e.placeholder,e.title,e.getAttribute("aria-label")].join(" "));})[0];'
      + 'if(cap){var a=document.activeElement;if(!a||a===document.body||["musteriNo","kullaniciAdi","parola"].indexOf(a.id)>=0)cap.focus();'
      + 'if(!cap.dataset.mwEnter){cap.dataset.mwEnter="1";cap.addEventListener("keydown",function(ev){if(ev.key!=="Enter")return;'
      + 'var kap=cap.form||document;var ad=function(x){return (x.innerText||x.value||"").trim();};'
      + 'var L=[].slice.call(kap.querySelectorAll("button,input[type=submit],input[type=button],a")).filter(function(x){return x.getBoundingClientRect().width>0;});'
      + 'var b=L.filter(function(x){return /^g[iİı]r[iİı][şs]( yap)?$/i.test(ad(x));})[0]||L.filter(function(x){return x.type==="submit";})[0];'
      + 'if(b){ev.preventDefault();b.click();}});}}'
      + '})()';
    wc.executeJavaScript(js, true).catch(function(){});
  } catch (e) {}
}

// Luca boşta kalınca "Zaman Aşımı – Parola Girişi" kutusu çıkar ve ekranı kilitler. Ayarlarda parola kayıtlıysa
// parola yazılıp Giriş'e basılır (kullanıcı adı kutuda zaten yazılı). Parola kayıtlı değilse kullanıcı kendisi girer.
async function zamanAsimiGec(w) {
  try {
    const c = getCreds && getCreds();
    if (!w || w.isDestroyed() || !c || !c.parola) return false;
    const js = '(function(p){var R=/zaman\\s*a[şs][ıi]m/i;var ds=document.querySelectorAll("div,table,form");'
      + 'for(var i=ds.length-1;i>=0;i--){var d=ds[i];if(!d.offsetParent&&getComputedStyle(d).position!=="fixed")continue;'
      + 'if(!R.test(d.innerText||""))continue;var pw=d.querySelector("input[type=password]");if(!pw||!pw.offsetParent)continue;'
      + 'pw.value=p;pw.dispatchEvent(new Event("input",{bubbles:true}));pw.dispatchEvent(new Event("change",{bubbles:true}));'
      + 'var bs=d.querySelectorAll("button,input[type=button],input[type=submit],a");for(var j=0;j<bs.length;j++){var t=(bs[j].innerText||bs[j].value||"");'
      + 'if(/g[iİı]r[iİı][şs]/i.test(t)){bs[j].click();return true;}}'
      + 'pw.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",keyCode:13,bubbles:true}));return true;}return false;})(' + JSON.stringify(c.parola) + ')';
    for (const f of w.webContents.mainFrame.framesInSubtree) {
      try { if (await f.executeJavaScript(js)) { notify('page', { timeout: true }); return true; } } catch (e) {}
    }
  } catch (e) {}
  return false;
}
const _zt = setInterval(() => { for (const w of windows) zamanAsimiGec(w); }, 15000); if (_zt.unref) _zt.unref();

// Girişten sonra: Luca'nın ürün seçim sayfasında (LUCASSO/main.erp) ilk "Mali Müşavir Paketi" kutusuna basılır (yalnız bir kez);
// Mali Müşavir Paketi açılınca Luca pencereleri küçültülür ve MuhaWin öne gelir. Başka hiçbir düğmeye basılmaz.
const paketBasildi = new WeakSet(), geriDonuldu = new WeakSet();
const PAKET_JS = `(() => { const R = /MAL[İI]\\s*M[ÜU].{0,2}AV[İI]R\\s*PAKET/i;
  const gor = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
  const L = [...document.querySelectorAll('a,button,input[type=button],input[type=submit],div,span,li,td,img')]
    .filter(el => R.test(el.innerText || el.value || el.alt || el.title || '') && gor(el));
  if (!L.length) return '';
  const enKucuk = L.filter(el => !L.some(x => x !== el && el.contains(x)));      // metni taşıyan en içteki öğe
  const hedef = enKucuk[0]; const tik = hedef.closest('a,button,[onclick]') || hedef; tik.click(); return (hedef.innerText || hedef.value || hedef.alt || '').trim().slice(0, 60); })()`;
async function paketSec(w) {
  try {
    if (!w || w.isDestroyed() || paketBasildi.has(w) || appWindow()) return;
    if (!/\/LUCASSO\/main\.erp/i.test(w.webContents.getURL() || '')) return;
    paketBasildi.add(w);
    for (let i = 0; i < 80; i++) {                 // ürün seçim sayfası gelir gelmez (150 ms aralıkla, en çok 12 sn)
      if (w.isDestroyed() || appWindow()) return;
      for (const f of w.webContents.mainFrame.framesInSubtree) {
        try { const t = await f.executeJavaScript(PAKET_JS, true); if (t) { notify('page', { paket: t }); return; } } catch (e) {}
      }
      await new Promise(r => setTimeout(r, 150));
    }
  } catch (e) {}
}
async function programaDon(w) {
  try {
    if (!w || w.isDestroyed() || geriDonuldu.has(w) || w === calismaW || !APP_RE.test(w.webContents.getURL() || '')) return;
    geriDonuldu.add(w); gizliGiris = false;
    // Luca içinden açılan ek pencereler (ör. firma / dönem altındaki "yeni pencere" düğmesi) programa döndürmez; yalnız girişteki ilk ana ekran
    if ([...windows].some(x => x !== w && !x.isDestroyed() && APP_RE.test(x.webContents.getURL() || ''))) return;
    if (w.isDestroyed()) return;
    // Hemen programa dönülür (Luca ana ekranının yüklenmesi beklenmez); üye numarası arkadan denetlenir, yanlışsa Luca öne gelir
    checkUye(w).then(c => { if (c && !c.ok && !w.isDestroyed()) { goster(w); notify('page', { wrongUye: true }); durumKontrol(); } }).catch(() => {});
    if (calismaBekliyor) {                                              // "Luca'da Çalış" ile giriş yapıldı: çalışma ekranı açılır
      calismaBekliyor = false;
      for (const x of windows) { try { if (x !== w && !x.isDestroyed() && x.isVisible()) x.minimize(); } catch (e) {} }
      notify('loggedIn', { url: w.webContents.getURL() }); calismaAc(w); return;
    }
    for (const x of windows) { try { if (!x.isDestroyed() && x.isVisible()) x.minimize(); } catch (e) {} }
    if (parent && !parent.isDestroyed()) { if (parent.isMinimized()) parent.restore(); parent.show(); parent.focus(); }
    notify('loggedIn', { url: w.webContents.getURL() });
  } catch (e) {}
}
function sayfaYuklendi(w) { autofillLogin(w.webContents); notify('page', { url: w.webContents.getURL() }); paketSec(w); programaDon(w); durumKontrol();
  if (gizliGiris && /giris\.erp/i.test(w.webContents.getURL() || '')) setTimeout(() => captchaGonder(w), 500); }
// Adres değişir değişmez (sayfanın yüklenmesi beklenmeden): ürün seçim sayfasında paket düğmesi aranır, Luca ana ekranına
// geçilince programa dönülür. did-finish-load yine de çağrılır (ikinci kez çalışmaz).
function sayfaGecti(w) { try { paketSec(w); programaDon(w); } catch (e) {} }
function hizliBagla(w) {
  w.webContents.on('did-navigate', () => sayfaGecti(w));
  w.webContents.on('dom-ready', () => { autofillLogin(w.webContents); sayfaGecti(w); });
}

function makeWindow(url, o = {}) {
  const w = new BrowserWindow({
    width: 1280, height: 860, parent: undefined, title: 'Luca', show: o.show !== false,
    webPreferences: { partition: PARTITION, contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  w.removeMenu();
  windows.add(w); kayitBagla(w);
  w.on('closed', () => { windows.delete(w); notify('windows', { open: windows.size }); durumKontrol(); });
  // Luca girişten sonra ana ekranı açılır pencerede açıyor; programın içinde yeni bir Luca penceresi olarak aç.
  w.webContents.setWindowOpenHandler(({ url: u }) => ({
    action: 'allow',
    overrideBrowserWindowOptions: { width: 1280, height: 860, autoHideMenuBar: true, show: !gizliGiris && !ekBekleniyor(), webPreferences: { partition: PARTITION, contextIsolation: true, sandbox: true } }
  }));
  cocukBagla(w); hizliBagla(w);
  w.webContents.on('did-finish-load', () => sayfaYuklendi(w));
  // gizli girişte sayfa yüklenemezse (ağ hatası) pencere gizli kalmasın: kullanıcı Luca'nın hata sayfasını görür
  w.webContents.on('did-fail-load', (e, kod, aciklama, adres, anaCerceve) => { if (anaCerceve && gizliGiris && !w.isDestroyed() && !w.isVisible()) { gizliGiris = false; goster(w); } });
  w.loadURL(url);
  return w;
}
// Luca'nın açtığı her pencere (ve onun açtıkları) izlenir: aynı oturum, zaman aşımı, durum. "Luca'da Çalış" beklerken açılan
// pencere çalışma penceresi olur.
function cocukBagla(w) {
  w.webContents.on('did-create-window', child => {
    windows.add(child); try { child.removeMenu(); } catch (e) {} kayitBagla(child);
    const calisma = calismaSahiplen(child);
    if (!calisma && ekBekleniyor()) ekSahiplen(child);
    child.on('closed', () => { windows.delete(child); if (calismaW === child) calismaW = null; notify('windows', { open: windows.size }); durumKontrol(); });
    child.webContents.setWindowOpenHandler(() => ({ action: 'allow', overrideBrowserWindowOptions: { width: 1280, height: 860, autoHideMenuBar: true, show: !ekBekleniyor(), webPreferences: { partition: PARTITION, contextIsolation: true, sandbox: true } } }));
    cocukBagla(child);
    if (!calisma) hizliBagla(child);
    child.webContents.on('did-finish-load', () => { if (calisma) { autofillLogin(child.webContents); durumKontrol(); } else sayfaYuklendi(child); });
  });
}

function goster(w) { try { if (w.isMinimized()) w.restore(); w.show(); w.focus(); } catch (e) {} }
// "Luca'ya bağlan": oturum açıksa yeni giriş sayfası açılmaz, açık Luca ana ekranı öne gelir (SSO ürün seçim sayfası değil).
function openLogin() {
  const a = appWindow();
  if (a) { goster(a); durumKontrol(); return { opened: true, bagli: true }; }
  // Ayarlarda Luca bilgileri kayıtlıysa giriş arka planda yapılır: Luca penceresi ekrana gelmez, doğrulama kodu programda sorulur
  const c = getCreds && getCreds();
  gizliGiris = !!(c && c.uyeno && c.kullanici && c.parola);
  const existing = [...windows].find(w => !w.isDestroyed() && w !== calismaW);
  if (existing) {
    if (gizliGiris && /giris\.erp/i.test(existing.webContents.getURL() || '')) { captchaGonder(existing); return { opened: true, gizli: true }; }
    gizliGiris = false; goster(existing); return { opened: true };
  }
  makeWindow(LOGIN_URL, { show: !gizliGiris });
  return { opened: true, gizli: gizliGiris };
}
// ---- Doğrulama kodu (captcha) programda: kodu her zaman kullanıcı okur ve yazar; program yalnız Luca'ya yazıp Giriş'e basar
let gizliGiris = false;
const CAPTCHA_BUL_JS = `(() => { const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const ins = [...document.querySelectorAll('input')].filter(e => vis(e) && /^(text|tel|number|)$/i.test(e.type || ''));
  const cap = ins.find(e => !['musteriNo','kullaniciAdi','parola'].includes(e.id) && /captcha|g[üu]venlik|do[ğg]rulama|kod|code/i.test([e.id, e.name, e.placeholder, e.title, e.getAttribute('aria-label')].join(' ')));
  const hata = [...document.querySelectorAll('.error,.hata,.alert,.alert-danger,[class*=error],[class*=hata],[id*=error],[id*=hata]')].filter(vis)
    .map(e => (e.innerText || '').trim()).filter(Boolean).join(' ').slice(0, 200);
  const giris = !!document.getElementById('parola') || !!document.querySelector('input[type=password]');
  if (!cap) return { cap: false, giris, hata };
  const imgs = [...document.querySelectorAll('img, canvas')].filter(vis);
  let img = imgs.find(i => /captcha|kaptcha|guvenlik|g[üu]venlik|dogrulama|jcaptcha|kod|code|image\\.(do|erp|jsp)/i.test((i.src || '') + ' ' + i.id + ' ' + i.className));
  if (!img) { const all = [...document.querySelectorAll('img, canvas, input')]; const k = all.indexOf(cap);
    for (let j = k; j >= 0 && !img; j--) if (all[j].tagName !== 'INPUT' && vis(all[j])) img = all[j];
    for (let j = k; j < all.length && !img; j++) if (all[j].tagName !== 'INPUT' && vis(all[j])) img = all[j]; }
  let resim = '';
  if (img) { try { if (img.tagName === 'CANVAS') resim = img.toDataURL('image/png'); else { const c = document.createElement('canvas'); c.width = img.naturalWidth || img.width; c.height = img.naturalHeight || img.height; c.getContext('2d').drawImage(img, 0, 0); resim = c.toDataURL('image/png'); } } catch (e) {} }
  const r = img ? img.getBoundingClientRect() : null;
  return { cap: true, giris, hata, resim, rect: r ? { x: Math.floor(r.x), y: Math.floor(r.y), width: Math.ceil(r.width), height: Math.ceil(r.height) } : null };
})()`;
const GIRIS_BAS_JS = kod => `((kod) => { const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const ins = [...document.querySelectorAll('input')].filter(e => vis(e) && /^(text|tel|number|)$/i.test(e.type || ''));
  const cap = ins.find(e => !['musteriNo','kullaniciAdi','parola'].includes(e.id) && /captcha|g[üu]venlik|do[ğg]rulama|kod|code/i.test([e.id, e.name, e.placeholder, e.title, e.getAttribute('aria-label')].join(' ')));
  if (kod != null) { if (!cap) return 'kod-kutusu-yok'; cap.focus(); cap.value = kod; cap.dispatchEvent(new Event('input', { bubbles: true })); cap.dispatchEvent(new Event('change', { bubbles: true })); }
  const kap = (cap && cap.form) || document; const ad = x => (x.innerText || x.value || '').trim();
  const L = [...kap.querySelectorAll('button,input[type=submit],input[type=button],a')].filter(vis);
  const b = L.find(x => /^g[iİı]r[iİı][şs]( yap)?$/i.test(ad(x))) || L.find(x => x.type === 'submit');
  if (b) { b.click(); return 'basildi'; }
  if (cap && cap.form) { cap.form.requestSubmit ? cap.form.requestSubmit() : cap.form.submit(); return 'gonderildi'; }
  return 'dugme-yok'; })(${JSON.stringify(kod)})`;
function girisPenceresi() { return [...windows].find(w => !w.isDestroyed() && w !== calismaW && /giris\.erp/i.test(w.webContents.getURL() || '')) || null; }
let captchaSuruyor = false;
async function captchaGonder(w) {
  if (!w || w.isDestroyed() || !gizliGiris || captchaSuruyor) return;
  captchaSuruyor = true;
  try {
    let r = null;
    for (let i = 0; i < 20 && !(r && (r.cap || r.giris)); i++) { try { r = await w.webContents.executeJavaScript(CAPTCHA_BUL_JS, true); } catch (e) {} if (!(r && (r.cap || r.giris))) await new Promise(x => setTimeout(x, 500)); }
    if (!r || !r.giris) {
      // giriş formu yok: yönlendiriliyorsa bir şey yapılmaz; hâlâ giriş sayfasındaysa (Luca sayfası değişmiş) pencere gizli kalmasın
      if (!w.isDestroyed() && gizliGiris && /giris\.erp/i.test(w.webContents.getURL() || '')) { gizliGiris = false; goster(w); notify('captcha', { yok: true }); }
      return;
    }
    if (!r.cap) {                                                       // doğrulama kodu istenmiyor: bilgiler dolu, Giriş'e basılır
      await new Promise(x => setTimeout(x, 300)); try { await w.webContents.executeJavaScript(GIRIS_BAS_JS(null), true); } catch (e) {} return; }
    let resim = r.resim || '';
    if (!resim && r.rect && r.rect.width > 0) { try { const img = await w.webContents.capturePage(r.rect); if (!img.isEmpty()) resim = img.toDataURL(); } catch (e) {} }
    if (!resim) { gizliGiris = false; goster(w); notify('captcha', { yok: true }); return; }   // resim alınamadı: Luca penceresinde girilir
    notify('captcha', { resim, hata: r.hata || '' });
  } finally { captchaSuruyor = false; }
}
async function captchaGir(kod) {
  const w = girisPenceresi(); if (!w) fail('NO_LOGIN', 'Luca giriş sayfası açık değil.');
  kod = String(kod || '').replace(/\s+/g, '').slice(0, 20); if (!kod) fail('ARG', 'Kodu yazın.');
  autofillLogin(w.webContents); await new Promise(x => setTimeout(x, 150));     // bilgiler dolu kalsın
  const r = await w.webContents.executeJavaScript(GIRIS_BAS_JS(kod), true);
  if (r === 'kod-kutusu-yok') fail('NO_CAPTCHA', 'Luca doğrulama kodu kutusu bulunamadı.');
  return { ok: true, sonuc: r };
}
function captchaYenile() { const w = girisPenceresi(); if (w) { try { w.webContents.reload(); } catch (e) {} } return { ok: !!w }; }
function girisGoster() { gizliGiris = false; const w = girisPenceresi() || [...windows].find(x => !x.isDestroyed() && x !== calismaW); if (w) goster(w); else makeWindow(LOGIN_URL); return { ok: true }; }

// Luca ana ekranı (Mali Müşavir Paketi) açık olan pencere. Kullanıcının "Luca'da Çalış" penceresi programın
// sorgularında kullanılmaz (kullanıcı orada istediği ekrana geçebilir); yalnız başka Luca penceresi yoksa yedek olarak.
const APP_RE = /^https:\/\/[a-z0-9.-]+\.luca\.com\.tr\/Luca\/(luca|jqMain|jqIndex)\.do/i;
// Oturum açık sayılan her Luca sayfası (ana ekran içinde başka bir sayfaya geçilse de bağlantı görülsün); giriş sayfaları hariç
const LUCA_RE = /^https:\/\/[a-z0-9.-]+\.luca\.com\.tr\/Luca\/(?!giris)/i;
function appWindow() {
  const L = [...windows].filter(w => !w.isDestroyed());
  const url = w => { try { return w.webContents.getURL() || ''; } catch (e) { return ''; } };
  const ana = w => w !== calismaW && !ekSayfalar.has(w);
  return L.find(w => ana(w) && APP_RE.test(url(w))) || L.find(w => ana(w) && LUCA_RE.test(url(w)))
    || L.find(w => ekSayfalar.has(w) && APP_RE.test(url(w)))           // ortak sayfa kapandıysa ek sayfa
    || L.find(w => w === calismaW && LUCA_RE.test(url(w))) || null;    // yalnız çalışma penceresi açık kaldıysa onunla
}
// ---------- Luca sayfaları (Görev 29) ----------
// - "Luca'da Çalış" penceresi (calismaW): kullanıcının; program bu pencerede hiçbir istek yapmaz.
// - Ortak sayfa (appWindow): programın Luca işleri (mizan / muavin / hesap planı / fiş aktarma) burada sırayla yürür.
// - Ek sayfa: ortak sayfa başka firmanın işiyle meşgulken yeni bir iş gelirse Luca'nın kendi "yeni pencere" düğmesiyle
//   (firma / dönem çubuğunun altındaki beyaz düğme; luca.do doğrudan açılırsa boş sayfa gelir) gizli bir sayfa açılır.
//   İlk ek sayfada iki sayfanın Luca'da gerçekten ayrı çalıştığı sınanır (ayrilikSina); ayrı değilse ek sayfa kullanılmaz,
//   işler ortak sayfada sıraya girer. Boşta kalan ek sayfa kapanır.
// Aynı firmanın işleri aynı sayfayı paylaşabilir; farklı firmanın işi, sayfa boşalıp kısa kira süresi (fiş aktarımı
// sürerken aradaki boşluklar) dolmadan o sayfada firma değiştiremez.
const { AsyncLocalStorage } = require('async_hooks');
const isBaglami = new AsyncLocalStorage();
const sayfaDurum = new WeakMap();
const ekSayfalar = new Set();
const donemFirma = new Map();                    // dönem kimliği → {lucaId, year, donemId} (fiş kesmede yeniden seçim için)
let EK_EN_COK = 2, KIRA_MS = 60 * 1000, EK_BOS_MS = 2 * 60 * 1000, BEKLE_EN_COK_MS = 15 * 60 * 1000;   // testte kısaltılır (_sayfaAyar)
let ayriOturum = null;                           // null: henüz sınanmadı · true: ek sayfa ayrı çalışıyor · false: kullanılmaz
let ekBekle = 0, ekAciliyor = null;
const bekleyenler = [];
const firmaAnahtari = (lucaId, year) => String(lucaId) + '|' + String(year);
const firmaSecAdresi = s => 'TopFrameAction.do?time=' + Date.now() + '&SIRKET_ID=' + encodeURIComponent(s.lucaId) + '&DONEM_ID=' + encodeURIComponent(s.donemId)
  + '&DONEM_TXT=' + encodeURIComponent('01/01/' + s.year + ' - 31/12/' + s.year);
function durumAl(w) { let d = sayfaDurum.get(w); if (!d) { d = { aktif: 0, firma: '', secim: null, kira: 0, bosZaman: Date.now(), yuklendi: false }; sayfaDurum.set(w, d); } return d; }
function isSayfasi() { const b = isBaglami.getStore(); return b && b.w && !b.w.isDestroyed() ? b.w : appWindow(); }
const ekBekleniyor = () => ekBekle > Date.now();
function ekSahiplen(child) {
  ekBekle = 0; ekSayfalar.add(child); geriDonuldu.add(child); paketBasildi.add(child);   // programa dönme / paket seçme yok
  try { child.setTitle('Luca – program sayfası'); } catch (e) {}
  child.webContents.once('did-finish-load', () => { durumAl(child).yuklendi = true; });
  child.on('closed', () => { ekSayfalar.delete(child); bekleyenleriUyandir(); });
}
function bekleyenleriUyandir() { for (const r of bekleyenler.splice(0)) r(); }
function sayfaUygun(w, firma) {
  if (!w || w.isDestroyed()) return false;
  const d = durumAl(w);
  if (!firma || d.firma === firma) return true;            // firma seçmeyen iş ya da aynı firma
  return d.aktif === 0 && d.kira < Date.now();
}
async function ekSayfaAc(kaynak) {
  if (ekAciliyor) return ekAciliyor;
  ekAciliyor = (async () => {
    if (calismaBekle && Date.now() < calismaBekle) return null;            // "Luca'da Çalış" açılıyor
    const once = new Set(ekSayfalar);
    ekBekle = Date.now() + 20 * 1000;
    try {
      if (!(await yeniPencereDugmesi(kaynak))) return null;
      for (let i = 0; i < 100; i++) {
        const y = [...ekSayfalar].find(w => !once.has(w) && !w.isDestroyed());
        if (y && durumAl(y).yuklendi && APP_RE.test(y.webContents.getURL() || '')) { notify('sayfalar', { ek: ekSayfalar.size }); return y; }
        await new Promise(r => setTimeout(r, 200));
      }
      return null;
    } finally { ekBekle = 0; }
  })();
  try { return await ekAciliyor; } finally { ekAciliyor = null; }
}
// iş için sayfa: ortaksa yalnız ortak sayfa (gizli yardımcı pencere açan işler: muavin, işletme listeleri)
async function sayfaAl(firma, yalnizOrtak) {
  const t0 = Date.now();
  for (;;) {
    const ortak = appWindow();
    if (!ortak) fail('NO_SESSION', 'Luca oturumu açık değil. Önce üst şeritteki "Luca\'ya giriş" ile bağlanın.');
    const adaylar = [ortak, ...(yalnizOrtak ? [] : [...ekSayfalar].filter(w => w !== ortak && !w.isDestroyed()))];
    const w = adaylar.find(x => sayfaUygun(x, firma));
    if (w) { const d = durumAl(w); d.aktif++; if (firma) { d.firma = firma; d.kira = Date.now() + KIRA_MS; } return w; }
    if (!yalnizOrtak && firma && ayriOturum !== false && ekSayfalar.size < EK_EN_COK && ekSayfalar.has(ortak) === false) {
      if (await ekSayfaAc(ortak).catch(() => null)) continue;
    }
    if (Date.now() - t0 > BEKLE_EN_COK_MS) fail('MESGUL', 'Luca başka bir işle meşgul; biraz sonra yeniden deneyin.');
    await new Promise(r => { bekleyenler.push(r); setTimeout(r, 1000); });
  }
}
function sayfaBirak(w, firma) {
  const d = sayfaDurum.get(w);
  if (d) { d.aktif = Math.max(0, d.aktif - 1); if (firma) d.kira = Date.now() + KIRA_MS; if (!d.aktif) d.bosZaman = Date.now(); }
  bekleyenleriUyandir();
}
// Luca işi: bir sayfa alınır, iş o sayfada yürür (iç içe çağrılar aynı sayfayı kullanır), bitince sayfa bırakılır
async function isle(firma, fn, yalnizOrtak = false) {
  const b = isBaglami.getStore();
  if (b && b.w && !b.w.isDestroyed()) return fn();
  for (let deneme = 0; ; deneme++) {
    const w = await sayfaAl(firma, yalnizOrtak);
    try { return await isBaglami.run({ w }, fn); }
    catch (e) { if (e.code !== 'PAYLASIMLI' || deneme) throw e; }   // sayfalar ayrı değilmiş: iş ortak sayfada sıraya girer
    finally { sayfaBirak(w, firma); }
  }
}
// Sayfanın Luca'da seçili firma / dönem bilgisi (__SESSION'daki firma ve dönem alanları); okunamazsa null
const OTURUM_JS = `/*MW_OTURUM*/(async () => { try {
  const r = await fetch(location.origin + '/Luca/YMFrameAction.do?modul=10&time=' + Date.now(), { credentials: 'include' });
  const m = (await r.text()).match(/__SESSION\\s*=\\s*(\\{[^<]*?\\})\\s*<\\/script>/); if (!m) return null;
  const s = JSON.parse(m[1]), o = {}; for (const k of Object.keys(s).sort()) if (/SIRKET|FIRMA|DONEM|UNVAN/i.test(k)) o[k] = s[k];
  return Object.keys(o).length ? JSON.stringify(o) : null; } catch (e) { return null; } })()`;
async function oturumOku(w) { try { return await w.webContents.executeJavaScript(OTURUM_JS, true); } catch (e) { return null; } }
// İlk ek sayfada firma seçildikten sonra: ortak sayfanın seçimi değişmediyse ve ek sayfanınki farklıysa sayfalar ayrıdır.
// Değiştiyse (aynı Luca oturumu) ortak sayfanın firması geri seçilir, ek sayfalar kapanır ve iş ortak sayfada yeniden yürür.
async function ayrilikSina(ek, ortak, s0) {
  const s1 = await oturumOku(ortak), e1 = await oturumOku(ek);
  if (s0 != null && s1 === s0 && e1 != null && e1 !== s1) { ayriOturum = true; notify('sayfalar', { ayriOturum: true }); return; }
  ayriOturum = false;
  const neden = s0 == null || s1 == null || e1 == null ? 'Luca seçili firma bilgisi okunamadı' : s1 !== s0 ? 'ek sayfadaki firma seçimi ortak sayfayı da değiştirdi' : 'ek sayfada firma seçimi görünmedi';
  notify('sayfalar', { ayriOturum: false, neden });
  const od = durumAl(ortak);
  if (od.secim && s1 !== s0) { try { await isBaglami.run({ w: ortak }, () => request(firmaSecAdresi(od.secim), { raw: true })); } catch (e) {} }
  for (const w of [...ekSayfalar]) { try { if (!durumAl(w).aktif || w === ek) setTimeout(() => { try { if (!w.isDestroyed()) w.destroy(); } catch (x) {} }, 0); } catch (e) {} }
  fail('PAYLASIMLI', 'Luca sayfaları ayrı çalışmıyor; iş sıraya alındı (' + neden + ').');
}
// boşta kalan ek sayfalar kapanır
const _et = setInterval(() => {
  for (const w of [...ekSayfalar]) {
    try { const d = durumAl(w); if (w.isDestroyed()) { ekSayfalar.delete(w); continue; }
      if (!d.aktif && d.kira < Date.now() && (Date.now() - d.bosZaman > EK_BOS_MS || ayriOturum === false)) w.destroy(); } catch (e) {}
  }
}, 30 * 1000); if (_et.unref) _et.unref();
function sayfaBilgisi() {
  const ortak = appWindow();
  const ozet = w => { const d = durumAl(w); return { aktif: d.aktif, firma: d.firma, kira: d.kira > Date.now() }; };
  return { ortak: ortak ? ozet(ortak) : null, ek: [...ekSayfalar].filter(w => !w.isDestroyed()).map(ozet), ayriOturum, calisma: !!(calismaW && !calismaW.isDestroyed()) };
}

// Bağlantı durumu değiştikçe (giriş, çıkış, pencere kapanması, oturum düşmesi) programın tüm ekranlarına bildirilir
let sonDurum = '', durumSuruyor = false;
async function durumKontrol() {
  if (durumSuruyor) return; durumSuruyor = true;
  try {
    const r = await status();
    const k = JSON.stringify([r.loggedIn, !!r.wrongUye, r.windows]);
    if (k !== sonDurum) { sonDurum = k; notify('durum', r); }
  } catch (e) {} finally { durumSuruyor = false; }
}
const _dt = setInterval(durumKontrol, 4000); if (_dt.unref) _dt.unref();

// "Luca'da Çalış": aynı oturumla, programın sorgu yapmadığı ayrı bir Luca penceresi; ekranı kaplar ve MuhaWin'in önüne gelir.
let calismaW = null, calismaBekliyor = false;
function oneGetir(w) {
  try {
    if (w.isMinimized()) w.restore();
    w.maximize(); w.show(); w.setAlwaysOnTop(true); w.moveTop(); w.focus();
    setTimeout(() => { try { if (!w.isDestroyed()) w.setAlwaysOnTop(false); } catch (e) {} }, 1200);
  } catch (e) {}
}
// Luca'nın kendi "yeni pencere" düğmesi (sol üstte firma / dönem seçiminin altındaki beyaz düğme): aynı oturumla yeni
// bir Luca ekranı açar. Luca ana ekranının adresini doğrudan açmak boş sayfa verir; bu yüzden düğmeye basılır.
const YENI_PENCERE_JS = `(() => {
  const gor = e => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const tikla = e => { const t = e.closest('a,button,[onclick],input[type=button],input[type=image]') || e; t.click(); return (t.outerHTML || '').slice(0, 160); };
  const ozn = e => [e.title, e.alt, e.id, typeof e.className === 'string' ? e.className : '', e.getAttribute('onclick'), e.getAttribute('href'),
    e.getAttribute('aria-label'), e.getAttribute('data-original-title'), e.getAttribute('data-title')].join(' ');
  const L = [...document.querySelectorAll('a,button,img,i,span,div,input[type=button],input[type=image],li,td')].filter(gor);
  let c = L.filter(e => /yeni[\\s_-]*(pencere|sekme|taray)|new[\\s_-]*(window|tab)|newwin|yenipencere|yenisekme|openNewWindow|window-restore|fa-clone/i.test(ozn(e)));
  const ust = !!document.querySelector('#SirketCombo, select[name*=irket i]');      // firma / dönem seçiminin olduğu çerçeve
  if (!c.length && ust) {            // "FİRMA 2026" başlık çubuğundaki yazısız tıklanabilir öğe
    const yazisiz = e => [...e.querySelectorAll('*')].filter(x => gor(x) && !(x.innerText || x.value || '').trim() && !/^(SELECT|OPTION|INPUT|TEXTAREA|BR|HR)$/.test(x.tagName) || /^(IMG|I|SVG)$/.test(x.tagName) && gor(x));
    const bar = L.filter(e => { const t = (e.innerText || '').trim(); return t.length < 90 && /\\b20\\d\\d\\s*$/.test(t) && !e.querySelector('select') && yazisiz(e).length; })
      .sort((a, b) => a.querySelectorAll('*').length - b.querySelectorAll('*').length)[0];
    if (bar) { const y = yazisiz(bar); const tik = x => /^(A|BUTTON|IMG|I|SVG)$/.test(x.tagName) || x.hasAttribute('onclick') || getComputedStyle(x).cursor === 'pointer';
      c = y.filter(tik); if (!c.length) c = y; }
  }
  return c.length ? tikla(c[0]) : '';
})()`;
let calismaBekle = 0;
// Beklerken açılan pencere yalnız Luca ANA EKRANI (luca.do / jqMain / jqIndex) ise çalışma penceresi olur; Luca'nın açtığı
// başka bir sayfa (indirme, rapor, yardım…) sahiplenilmez ve tam ekran yapılmaz.
function calismaSahiplen(child) {
  if (!calismaBekle || Date.now() > calismaBekle || (calismaW && !calismaW.isDestroyed())) return false;
  geriDonuldu.add(child); paketBasildi.add(child);
  const al = () => {
    if ((calismaW && !calismaW.isDestroyed()) || !calismaBekle || Date.now() > calismaBekle || child.isDestroyed()) return;
    calismaBekle = 0; calismaW = child;
    try { child.setTitle('Luca – çalışma'); } catch (e) {}
    donDugmesiBagla(child);
    oneGetir(child);
    child.once('ready-to-show', () => oneGetir(child));
    child.webContents.once('did-finish-load', () => oneGetir(child));
    notify('calisma', { acik: true });
  };
  let u = ''; try { u = child.webContents.getURL() || ''; } catch (e) {}
  if (APP_RE.test(u)) al();
  else child.webContents.once('did-navigate', (e, url) => { if (APP_RE.test(url || child.webContents.getURL() || '')) al(); });
  return true;
}
async function yeniPencereDugmesi(w) {
  for (let i = 0; i < 6; i++) {
    for (const f of w.webContents.mainFrame.framesInSubtree) {
      try { const t = await f.executeJavaScript(YENI_PENCERE_JS, true); if (t) return t; } catch (e) {}
    }
    await new Promise(r => setTimeout(r, 500));
  }
  return '';
}
async function calismaAc(kaynak) {
  if (calismaW && !calismaW.isDestroyed()) { oneGetir(calismaW); return { ok: true, mevcut: true }; }
  calismaBekle = Date.now() + 15 * 1000;
  const t = await yeniPencereDugmesi(kaynak);
  if (t) {
    for (let i = 0; i < 40 && !(calismaW && !calismaW.isDestroyed()); i++) await new Promise(r => setTimeout(r, 200));
    if (calismaW && !calismaW.isDestroyed()) return { ok: true };
  }
  // Düğme bulunamadı: programın sorgu yaptığı pencere gösterilmeden, Luca'nın ürün seçim sayfası gizli pencerede açılıp
  // Mali Müşavir Paketi'ne basılır; Luca'nın açtığı yeni ana ekran çalışma penceresi olur (Luca iki oturuma izin verir).
  if (await ssoIleCalisma()) return { ok: true, yol: 'sso' };
  // o da olmazsa kullanıcı basar; yalnız sonraki 60 sn içinde açılan ilk pencere çalışma penceresi olur
  calismaBekle = Date.now() + 60 * 1000;
  goster(kaynak);
  return { ok: true, elle: true };
}
// Çalışma penceresine "Muavine dön" düğmesi: basınca Luca küçülür, MuhaWin öne gelip muavin ekranı açılır.
// Düğme Luca'nın içerik çerçevesine (frm3; yoksa ana sayfaya) sayfanın sağ altına eklenir; Luca'nın kendi öğelerine dokunulmaz.
const DON_JS = `(() => { try {
  if (!document.body || document.body.tagName === 'FRAMESET') return '';
  if (document.getElementById('mwMuavineDon')) return 'var';
  const b = document.createElement('button'); b.id = 'mwMuavineDon'; b.type = 'button'; b.textContent = '↩ Muavine dön';
  b.title = "MuhaWin'e ve muavin ekranına dön (Luca bu pencerede açık kalır)";
  b.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:2147483647;padding:7px 13px;border-radius:18px;border:1px solid #1f4aa8;background:#1f4aa8;color:#fff;font:600 12px Arial,sans-serif;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.25);opacity:.93';
  b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); console.log('__MUHAWIN_MUAVINE_DON__');
    try { const t = top.document.title; top.document.title = '__MW_DON__' + Date.now(); setTimeout(() => { try { top.document.title = t; } catch (x) {} }, 400); } catch (x) {} }, true);
  document.body.appendChild(b); return 'eklendi'; } catch (e) { return ''; } })()`;
let sonDon = 0;
function muavineDon(w) {
  if (Date.now() - sonDon < 1000) return; sonDon = Date.now();
  try { if (w && !w.isDestroyed()) w.minimize(); } catch (e) {}
  try { if (parent && !parent.isDestroyed()) { if (parent.isMinimized()) parent.restore(); parent.show(); parent.focus(); } } catch (e) {}
  notify('muavineDon', {});
}
async function donDugmesiEkle(w) {
  try {
    if (!w || w.isDestroyed()) return;
    const F = w.webContents.mainFrame.framesInSubtree;
    const hedef = F.find(f => f.name === 'frm3');
    for (const f of hedef ? [hedef] : [w.webContents.mainFrame, ...F.filter(f => f !== w.webContents.mainFrame)]) {
      try { const r = await f.executeJavaScript(DON_JS, true); if (r) return; } catch (e) {}
    }
  } catch (e) {}
}
function donDugmesiBagla(w) {
  try {
    w.webContents.on('console-message', (e, level, mesaj) => { const m = typeof mesaj === 'string' ? mesaj : (e && e.message) || ''; if (m === '__MUHAWIN_MUAVINE_DON__') muavineDon(w); });
    w.on('page-title-updated', (e, baslik) => { if (String(baslik || '').startsWith('__MW_DON__')) { e.preventDefault(); muavineDon(w); } });
    w.webContents.on('did-frame-finish-load', () => donDugmesiEkle(w));
    w.webContents.on('did-finish-load', () => donDugmesiEkle(w));
    setTimeout(() => donDugmesiEkle(w), 1500);
  } catch (e) {}
}
let ssoW = null;
async function ssoIleCalisma() {
  const sso = new BrowserWindow({ show: false, width: 1280, height: 860, webPreferences: { partition: PARTITION, contextIsolation: true, nodeIntegration: false, sandbox: true } });
  try { sso.removeMenu(); } catch (e) {}
  sso.webContents.setWindowOpenHandler(() => ({ action: 'allow', overrideBrowserWindowOptions: { width: 1280, height: 860, autoHideMenuBar: true, webPreferences: { partition: PARTITION, contextIsolation: true, sandbox: true } } }));
  cocukBagla(sso);                                   // açılan Luca ana ekranı calismaSahiplen ile çalışma penceresi olur
  calismaBekle = Date.now() + 25 * 1000;
  const kapat = () => { try { if (!sso.isDestroyed()) sso.destroy(); } catch (e) {} };
  try {
    await Promise.race([sso.loadURL(SSO_ANA_URL), new Promise((_, rj) => setTimeout(() => rj(new Error('zaman aşımı')), 20000))]);
    if (!/\/LUCASSO\/main\.erp/i.test(sso.webContents.getURL() || '')) { kapat(); return false; }   // oturum yok: giriş sayfasına döndü
    let basildi = false;
    for (let i = 0; i < 80 && !basildi; i++) {
      for (const f of sso.webContents.mainFrame.framesInSubtree) { try { if (await f.executeJavaScript(PAKET_JS, true)) { basildi = true; break; } } catch (e) {} }
      if (!basildi) await new Promise(r => setTimeout(r, 150));
    }
    if (!basildi) { kapat(); return false; }
    for (let i = 0; i < 60 && !(calismaW && !calismaW.isDestroyed()); i++) await new Promise(r => setTimeout(r, 200));
    if (!(calismaW && !calismaW.isDestroyed())) { kapat(); return false; }
    ssoW = sso; const cw = calismaW; cw.once('closed', () => { if (ssoW === sso) ssoW = null; kapat(); });   // ürün seçim sayfası gizli kalır
    return true;
  } catch (e) { kapat(); return false; }
}
async function calis() {
  if (calismaW && !calismaW.isDestroyed()) { oneGetir(calismaW); return { ok: true, mevcut: true }; }
  const w = appWindow();
  if (w) {
    const c = await checkUye(w);
    if (!c.ok) { oneGetir(w); return { ok: false, error: uyeErr(c) }; }
    return calismaAc(w);
  }
  // oturum yok: giriş penceresi açılır; giriş tamamlanınca MuhaWin'e dönmek yerine çalışma penceresi açılır
  calismaBekliyor = true;
  openLogin();
  const g = [...windows].find(x => !x.isDestroyed() && x !== calismaW);
  if (g) oneGetir(g);
  return { ok: true, giris: true };
}

// Açık Luca oturumunun üye numarası (menü/çalışma alanı çerçevelerindeki c_musteri_id)
const uyeCache = new WeakMap();
async function sessionUye(w) {
  const url = w.webContents.getURL();
  const c = uyeCache.get(w); if (c && c.url === url && (c.uye || Date.now() - c.zaman < 30000)) return c.uye || (c.bekle ? c.bekle : null);
  if (c && c.url === url && c.bekle) return c.bekle;
  const js = `(function(){for(const n of ['frm2','frm5','frm3','frm4']){try{const f=window.frames[n];if(!f)continue;const m=f.document.documentElement.innerHTML.match(/c_musteri_id=(\\d+)/);if(m)return m[1];}catch(e){}}
    const m=document.documentElement.innerHTML.match(/c_musteri_id=(\\d+)/);return m?m[1]:null;})()`;
  const bekle = (async () => {
    let uye = null;
    for (let i = 0; i < 10 && !uye; i++) { try { uye = await w.webContents.executeJavaScript(js, true); } catch (e) {} if (!uye) await new Promise(r => setTimeout(r, 500)); }
    uyeCache.set(w, { url, uye, zaman: Date.now() });          // bulunamadıysa da 30 sn hatırlanır (durum yoklaması her seferinde 5 sn beklemesin)
    return uye;
  })();
  uyeCache.set(w, { url, uye: null, zaman: 0, bekle });
  return bekle;
}
// Ofis üyesi yalnız ofisin üye numarasıyla çalışabilir
async function checkUye(w) {
  const req = normUye(getRequiredUye());
  if (!req) return { ok: true };
  const uye = normUye(await sessionUye(w));
  if (!uye) return { ok: true, unknown: true };          // okunamadıysa engellenmez (ekran değişmiş olabilir)
  return uye === req ? { ok: true, uye } : { ok: false, uye, required: req };
}
function uyeErr(c) { return 'Bu Luca oturumu ' + c.uye + ' üye numarasıyla açılmış. Ofisiniz yalnız ' + c.required + ' üye numarasıyla çalışabilir. Luca\'dan çıkıp ofisin üye numarasıyla girin.'; }
async function status() {
  const w = appWindow();
  const r = { loggedIn: !!w, url: w ? w.webContents.getURL() : null, windows: [...windows].filter(x => !x.isDestroyed()).length };
  if (w) { const c = await checkUye(w); if (!c.ok) { r.loggedIn = false; r.wrongUye = true; r.error = uyeErr(c); } }
  return r;
}
function recheck() { for (const w of windows) { try { uyeCache.delete(w); } catch (e) {} } notify('page', {}); }

function fail(code, msg) { const e = new Error(msg); e.code = code; throw e; }

// Luca penceresinin içinde (aynı oturumla) çalışan istek. Okuma; fiş kesme yalnızca kullanıcı onayıyla (fisKes).
async function request(path, { method = 'GET', form = null, json = null, raw = false } = {}) {
  const w = isSayfasi();
  if (!w) fail('NO_SESSION', 'Luca oturumu açık değil. Önce "Luca\'ya bağlan" ile giriş yapıp Mali Müşavir Paketi\'ni açın.');
  if (await zamanAsimiGec(w)) await new Promise(r => setTimeout(r, 2500));
  const cu = await checkUye(w);
  if (!cu.ok) fail('UYE', uyeErr(cu));
  const js = `(async () => {
    const base = location.origin + '/Luca/';
    const opt = { method: ${JSON.stringify(method)}, credentials: 'include' };
    ${form ? `opt.body = new URLSearchParams(${JSON.stringify(form)});` : ''}
    ${json ? `opt.body = ${JSON.stringify(JSON.stringify(json))}; opt.headers = { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' };` : ''}
    const r = await fetch(base + ${JSON.stringify(path)}, opt);
    const t = await r.text();
    return { status: r.status, text: t };
  })()`;
  const res = await w.webContents.executeJavaScript(js, true);
  if (/top\.location\s*=\s*"giris\.do"/.test(res.text)) fail('NO_SESSION', 'Luca oturumu kapanmış. Luca\'ya yeniden giriş yapın.');
  if (res.status >= 400) fail('HTTP', 'Luca isteği başarısız oldu (' + res.status + ').');
  if (raw) return res.text;
  let data;
  try { data = JSON.parse(res.text); } catch (e) { fail('FORMAT', 'Luca beklenmeyen bir yanıt verdi.'); }
  if (data && data.error) fail('LUCA', 'Luca: ' + data.error);
  return data;
}

// Firma listesi: [{label, value(sirket_id)}]
async function listFirms() {
  const list = await request('genel/sirket_donem_listesi.jq?_=' + Date.now());
  if (!Array.isArray(list)) fail('FORMAT', 'Luca firma listesi okunamadı.');
  return list.map(x => ({ label: x.label, value: String(x.value) }));
}

// Mizan: firmanın istenen yıl dönemindeki tüm hesaplar
async function fetchMizan({ lucaId, year }) {
  if (!lucaId) fail('ARG', 'Firmanın Luca karşılığı yok.');
  const donemler = await request('genel/donem.jq?sirket_id=' + encodeURIComponent(lucaId) + '&_=' + Date.now());
  if (!Array.isArray(donemler) || !donemler.length) fail('NO_PERIOD', 'Firmanın Luca\'da dönemi yok.');
  let d = donemler.find(x => String(x.label) === String(year));
  if (!d) fail('NO_PERIOD', year + ' dönemi Luca\'da yok (var olanlar: ' + donemler.map(x => x.label).join(', ') + ').');
  const rows = await request('muhasebe/mizan_listesi.jq', { method: 'POST', form: { donem_id: String(d.value), params: '{}' } });
  if (!Array.isArray(rows)) fail('FORMAT', 'Mizan okunamadı.');
  return {
    year: String(d.label), donemId: String(d.value),
    rows: rows.filter(r => r && r.hesap_kodu).map(r => [String(r.hesap_kodu).trim(), String(r.hesap_adi || '').trim(), r.tipi || '', +r.borc || 0, +r.alacak || 0])
  };
}

// Fatura Kontrol'ün Luca otomasyonu (ayrı Chrome) bu oturumla açılsın diye: *.luca.com.tr çerezleri Playwright biçiminde.
// Yalnız ana süreçten yerel Fatura Kontrol modülüne verilir; diske yazılmaz.
async function oturumCerezleri() {
  const L = await session.fromPartition(PARTITION).cookies.get({});
  const ss = { strict: 'Strict', lax: 'Lax', no_restriction: 'None' };
  return L.filter(c => /(^|\.)luca\.com\.tr$/i.test(String(c.domain || '').replace(/^\./, ''))).map(c => {
    const host = String(c.domain).replace(/^\./, '');
    const o = { name: c.name, value: c.value, httpOnly: !!c.httpOnly, secure: !!c.secure,
      expires: c.session || !c.expirationDate ? -1 : Math.floor(c.expirationDate) };
    const s0 = ss[c.sameSite]; if (s0 && !(s0 === 'None' && !o.secure)) o.sameSite = s0;
    if (c.hostOnly) { const p0 = c.path || '/'; o.url = (o.secure ? 'https://' : 'http://') + host + (p0.endsWith('/') ? p0 : p0 + '/'); }
    else { o.domain = '.' + host; o.path = c.path || '/'; }
    return o;
  });
}
async function logout() {
  for (const w of windows) if (!w.isDestroyed()) w.close();
  await session.fromPartition(PARTITION).clearStorageData();
  sonDurum = ''; durumKontrol();
  return true;
}

// Fiş aktarımı için hazırlık: firmanın ilgili yıl dönemini bul ve Luca'da etkin firma/dönem yap
// (kullanıcının üst çubuktan firma seçmesiyle aynı istek). Dönen donemId fiş kesmede kullanılır.
async function prepareFis({ lucaId, year }) {
  if (!lucaId) fail('ARG', 'Firmanın Luca karşılığı yok. Firmayı "Luca\'dan firma ekle" ile ekleyin.');
  const firms = await request('genel/sirket_donem_listesi.jq?_=' + Date.now());
  const firm = Array.isArray(firms) && firms.find(x => String(x.value) === String(lucaId));
  if (!firm) fail('NO_FIRM', 'Bu firma bağlı olduğunuz Luca hesabında bulunamadı.');
  const donemler = await request('genel/donem.jq?sirket_id=' + encodeURIComponent(lucaId) + '&_=' + Date.now());
  const d = Array.isArray(donemler) && donemler.find(x => String(x.label) === String(year));
  if (!d) fail('NO_PERIOD', year + ' dönemi Luca\'da yok (var olanlar: ' + (donemler || []).map(x => x.label).join(', ') + ').');
  const secim = { lucaId: String(lucaId), year: String(year), donemId: String(d.value) };
  const w = isSayfasi(), ortak = appWindow();
  const sina = w && ortak && w !== ortak && ekSayfalar.has(w) && ayriOturum === null;
  const s0 = sina ? await oturumOku(ortak) : null;
  await request(firmaSecAdresi(secim), { raw: true });
  if (w) { const dd = durumAl(w); dd.secim = secim; dd.firma = firmaAnahtari(lucaId, year); }
  donemFirma.set(secim.donemId, secim);
  if (sina) await ayrilikSina(w, ortak, s0);
  return { donemId: String(d.value), year: String(d.label), firmLabel: String(firm.label) };
}
// Firmanın defter türü: Luca üst/menü çerçevesindeki __SESSION.SINIF (1 = bilanço) ve menüdeki "İşletme Defteri" / "Ser.Mes.Defteri"
async function defterTuru({ lucaId, year }) {
  const p = await prepareFis({ lucaId, year });
  const w = isSayfasi();
  const js = `(async () => {
    const base = location.origin + '/Luca/'; const coz = (buf, r) => { const ct = (r && r.headers.get('content-type') || '').toLowerCase(); if (/utf-?8/.test(ct)) return new TextDecoder('utf-8').decode(buf); try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch (e) { return new TextDecoder('windows-1254').decode(buf); } }; const oku = async (u) => { const r = await fetch(base + u + '?time=' + Date.now(), { credentials: 'include' }); return coz(await r.arrayBuffer(), r); };
    const h = await oku('headerFrame.do'); const m = await oku('menu.do');
    const s = (h + m).match(/"SINIF"\s*:\s*"(\d)"/); const metin = (h + '\n' + m).replace(/<[^>]+>/g, ' ');
    return { sinif: s ? s[1] : '', serbest: /Ser\.?\s*Mes(lek)?\.?\s*Def(t(eri)?)?\.?|Serbest\s*Meslek/i.test(metin), isletme: /(İ|I|i)şl(etme)?\.?\s*Def(t(eri)?)?\.?|Isletme\s*Def/i.test(metin) };
  })()`;
  const r = await w.webContents.executeJavaScript(js, true);
  let defter = 'bilanco';
  if (r && r.sinif && r.sinif !== '1') defter = r.serbest ? 'serbest' : 'isletme';
  else if (r && !r.sinif && (r.serbest || r.isletme)) defter = r.serbest ? 'serbest' : 'isletme';
  return { defter, sinif: (r && r.sinif) || '', firma: p.firmLabel, year: p.year };
}
// Tek fiş kes (Luca'nın "Excel'den fiş aktarımı → Fiş Kes" ile gönderdiği istek)
async function fisKes({ donemId, fis }) {
  if (!donemId || !fis || !Array.isArray(fis.detaylar) || !fis.detaylar.length) fail('ARG', 'Fiş bilgisi eksik.');
  const w = isSayfasi();
  if (!w) fail('NO_SESSION', 'Luca oturumu açık değil.');
  // bu sayfada başka firma / dönem seçildiyse (ör. kira süresi dolup başka iş geldiyse) fişin dönemi yeniden seçilir
  const sec = donemFirma.get(String(donemId)), dd = durumAl(w);
  if (sec && (!dd.secim || dd.secim.donemId !== String(donemId))) await prepareFis({ lucaId: sec.lucaId, year: sec.year });
  let res;
  try { res = await request('muhasebe/fis_kes.jq', { method: 'POST', json: { donem_id: String(donemId), params: fis } }); }
  catch (e) { if (e.code === 'LUCA') return { ok: false, error: e.message.replace(/^Luca: /, '') }; throw e; }
  if (res && res.success) return { ok: true, fisNo: String(res.fisNo || ''), fisId: String(res.fisId || ''), message: String(res.success).replace(/<[^>]+>/g, '') };
  if (res && res.warning) return { ok: false, error: String(res.warning).replace(/<[^>]+>/g, '') };
  return { ok: false, error: 'Luca beklenmeyen bir yanıt verdi.' };
}

// ---------- Hesap planı: Luca'daki tam liste (Muhasebe → Hesap Planı İşlemleri → Hesap Planı Listesi) ve hesap ekleme
// (aynı ekrandaki "+Yeni Hesap → Kaydet": addHesapPlaniAction.do). Önce firma ve dönem etkin yapılır (prepareFis).
// Raporlar → Excel Hesap Planı (Luca "hesap_plani_listesi" raporu, 2.9.1 — kullanıcının istek kaydından):
//  1) POST jasper.jq?rapor_tur=hesap_plani_listesi  {donem: JSON metni, form: JSON metni, donem_id}  → "Rapor talebi başarıyla alındı"
//  2) POST genel/rapor_takip.jq {donem_id, params:{raporTur}} → durum 100 (hazırlanıyor) … 150 (hazır)
//  3) POST genel/rapor_indir.jq (form) donem_id, raporTur, filename → XLSX
async function hesapPlaniRapor({ lucaId, year }) {
  const p = await prepareFis({ lucaId, year });
  const w = isSayfasi();
  if (!w) fail('NO_SESSION', 'Luca oturumu açık değil.');
  const js = `(async () => {
    const base = location.origin + '/Luca/';
    const coz = (buf, r) => { const ct = (r && r.headers.get('content-type') || '').toLowerCase(); if (/utf-?8/.test(ct)) return new TextDecoder('utf-8').decode(buf); try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch (e) { return new TextDecoder('windows-1254').decode(buf); } };
    const jq = async (u, body) => { const r = await fetch(base + u, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest' }, body: JSON.stringify(body) });
      const t = coz(await r.arrayBuffer(), r); if (/top\\.location\\s*=\\s*"giris\\.do"/.test(t)) return { __oturum: true }; try { return JSON.parse(t); } catch (e) { return { __metin: t.slice(0, 300) }; } };
    // dönem bilgisi: Luca'nın ekranlarındaki __SESSION + dönem listesi kaydı
    let ses = {}; try { const r = await fetch(base + 'YMFrameAction.do?modul=10&time=' + Date.now(), { credentials: 'include' }); const h = coz(await r.arrayBuffer(), r);
      const m = h.match(/__SESSION\\s*=\\s*(\\{[^<]*?\\})\\s*<\\/script>/); if (m) ses = JSON.parse(m[1]); } catch (e) {}
    let dk = {}; try { const r = await fetch(base + 'genel/donem.jq?sirket_id=' + encodeURIComponent(${JSON.stringify(String(lucaId))}) + '&_=' + Date.now(), { credentials: 'include' });
      const L = JSON.parse(coz(await r.arrayBuffer(), r)); dk = (L || []).find(x => String(x.value) === ${JSON.stringify(p.donemId)}) || {}; } catch (e) {}
    const yil = ${JSON.stringify(p.year)}, donemId = ${JSON.stringify(p.donemId)}, sirketId = ${JSON.stringify(String(lucaId))}, ad = ${JSON.stringify(p.firmLabel)};
    const donem = { donem_bas: ses.DONEM_BAS || '01/01/' + yil, donem_bit: ses.DONEM_BIT || '31/12/' + yil, kurulus_tarihi: dk.kurulus_tarihi || '', cari_donem_bas: ses.CARI_DONEM_BAS || '01/01/' + yil,
      beyan_sekli: dk.beyan_sekli != null ? dk.beyan_sekli : 2, sistem_doviz_kod: dk.sistem_doviz_kod != null ? dk.sistem_doviz_kod : 0, sm: dk.sm != null ? dk.sm : 0, kesinlesme_tarihi: dk.kesinlesme_tarihi || '',
      hesap_plani_yontem: dk.hesap_plani_yontem != null ? dk.hesap_plani_yontem : 0, doviz_kullan: dk.doviz_kullan != null ? dk.doviz_kullan : 1, e_defter: dk.e_defter != null ? dk.e_defter : 1,
      sirket_id: +sirketId, donem_id: +donemId, uzun_ad: dk.uzun_ad || ad, sinif: +(ses.SINIF || dk.sinif || 1), donem: yil, kisa_ad: dk.kisa_ad || ad };
    for (const k of Object.keys(dk)) if (!(k in donem) && !/^(value|label)$/.test(k)) donem[k] = dk[k];
    const form = { ilk_tarih: '', hesap_bas: '', hesap_boyu_bas: '', hesap_tipi: null, dil: 'tr', bakiye_goster: '1', hesap_adi_kes: '0', son_tarih: '', hesap_bit: '', hesap_boyu_bit: '',
      doviz: ['tl'], sistem_doviz_sembol: 'TL', tarih_yazdir: 'H', sayfa_numarasi_yazdir: 'H', report_type: 'XLSX', font: 'Arial', alt_bilgi_yazdir: 'H',
      donem_id: donemId, sirket_id: sirketId, tur: 'hesap_plani_listesi', email_hesap: null };
    const t = await jq('jasper.jq?rapor_tur=hesap_plani_listesi', { donem: JSON.stringify(donem), form: JSON.stringify(form), donem_id: donemId });
    if (t.__oturum) return { hata: 'NO_SESSION' };
    if (!t.success) return { hata: 'Luca raporu başlatmadı: ' + (t.warning || t.error || t.__metin || JSON.stringify(t)).toString().replace(/<[^>]+>/g, '').slice(0, 200) };
    let d = null;
    for (let i = 0; i < 90; i++) {
      await new Promise(r => setTimeout(r, i < 5 ? 700 : 1500));
      d = await jq('genel/rapor_takip.jq', { donem_id: donemId, params: { raporTur: 'hesap_plani_listesi' } });
      if (d.__oturum) return { hata: 'NO_SESSION' };
      if (d.durum == null || +d.durum >= 150 || +d.durum < 100) break;     // 100: hazırlanıyor, 150: hazır
    }
    if (!d || +d.durum !== 150) return { hata: 'Luca raporu hazırlanamadı: ' + ((d && d.durumAciklama) || 'zaman aşımı') };
    const r = await fetch(base + 'genel/rapor_indir.jq', { method: 'POST', credentials: 'include',
      body: new URLSearchParams({ donem_id: donemId, raporTur: 'hesap_plani_listesi', filename: 'hesap_plani_listesi_' + (donem.kisa_ad || ad) }) });
    const buf = new Uint8Array(await r.arrayBuffer());
    if (buf.length < 4 || buf[0] !== 0x50 || buf[1] !== 0x4b) return { hata: 'Luca rapor dosyası Excel değil (' + buf.length + ' bayt).' };
    let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return { b64: btoa(s) };
  })()`;
  const r = await w.webContents.executeJavaScript(js, true);
  if (r && r.hata === 'NO_SESSION') fail('NO_SESSION', 'Luca oturumu kapanmış. Luca\'ya yeniden giriş yapın.');
  if (!r || !r.b64) fail('RAPOR', (r && r.hata) || 'Luca hesap planı raporu alınamadı.');
  const hesaplar = hesapPlaniExcelOku(Buffer.from(r.b64, 'base64'));
  if (!hesaplar.length) fail('RAPOR', 'Luca hesap planı raporunda hesap bulunamadı.');
  return { year: p.year, firma: p.firmLabel, hesaplar, kaynak: 'rapor' };
}
// Muavin (Muavin Defter → Excel Liste): açık Luca oturumuyla, görünmeyen bir pencerede (ayrı Chrome / yeniden giriş yok).
// Fatura Kontrol'ün Luca otomasyonuyla aynı ekran: raporMizanDetayHazirla.do, hesap 100–999, rapor türü "Excel Liste", "Rapor".
async function muavinIndir({ lucaId, year, sureSn = 300 }) {
  const p = await prepareFis({ lucaId, year });
  const w0 = isSayfasi();
  if (!w0) fail('NO_SESSION', 'Luca oturumu açık değil.');
  const uye = await sessionUye(w0);
  if (!uye) fail('UYE', 'Luca üye numarası okunamadı.');
  const base = new URL(w0.webContents.getURL()).origin + '/Luca/';
  const ses = session.fromPartition(PARTITION);
  const hw = new BrowserWindow({ show: false, width: 1280, height: 860, webPreferences: { partition: PARTITION, contextIsolation: true, nodeIntegration: false, sandbox: true } });
  const hwler = new Set([hw.webContents]);
  hw.webContents.setWindowOpenHandler(() => ({ action: 'allow', overrideBrowserWindowOptions: { show: false, webPreferences: { partition: PARTITION, contextIsolation: true, sandbox: true } } }));
  hw.webContents.on('did-create-window', c => { hwler.add(c.webContents); });
  const sessizlik = `window.alert=function(){};window.confirm=function(){return true;};window.print=function(){};`;
  hw.webContents.on('dom-ready', () => { hw.webContents.executeJavaScript(sessizlik, true).catch(() => {}); });
  let bitir, hata;
  const indirme = new Promise((res, rej) => { bitir = res; hata = rej; });
  const onDl = (ev, item, wc) => {
    if (wc && !hwler.has(wc) && !(wc.hostWebContents && hwler.has(wc.hostWebContents))) return;
    const ch = []; const tmp = require('path').join(require('os').tmpdir(), 'muhawin-muavin-' + Date.now() + '.xlsx');
    item.setSavePath(tmp);
    item.once('done', (e, state) => {
      if (state !== 'completed') { hata(new Error('Muavin indirilemedi (' + state + ').')); return; }
      try { const buf = require('fs').readFileSync(tmp); require('fs').unlink(tmp, () => {}); bitir({ buf, ad: item.getFilename() }); } catch (x) { hata(x); }
    });
  };
  ses.on('will-download', onDl);
  try {
    await hw.loadURL(base + 'raporMizanDetayHazirla.do?c_musteri_id=' + encodeURIComponent(uye) + '&time=' + Date.now(), { httpReferrer: base + 'menu.do' });
    const js = `(async () => {
      ${sessizlik}
      const bekle = ms => new Promise(r => setTimeout(r, ms));
      if (/top\\.location\\s*=\\s*"giris\\.do"/.test(document.documentElement.innerHTML)) return { hata: 'NO_SESSION' };
      let ilk = null; for (let i = 0; i < 60 && !(ilk = document.querySelector('#hesap_kodu_ilk')); i++) await bekle(500);
      if (!ilk) return { hata: 'FORM', metin: (document.body && document.body.innerText || '').slice(0, 200) };
      const yaz = (el, v) => { el.focus(); el.value = v; for (const t of ['input', 'change', 'blur']) el.dispatchEvent(new Event(t, { bubbles: true })); };
      yaz(ilk, '100'); const son = document.querySelector('#hesap_kodu_son'); if (son) yaz(son, '999');
      let excel = null;
      for (const s of document.querySelectorAll('select')) { const i = [...s.options].findIndex(o => /excel\\s*liste/i.test(o.text));
        if (i >= 0) { s.selectedIndex = i; s.dispatchEvent(new Event('change', { bubbles: true })); excel = s.options[i].text; break; } }
      if (!excel) return { hata: 'FORM', metin: "Muavin formunda 'Excel Liste' rapor türü bulunamadı" };
      await bekle(400);
      const btn = [...document.querySelectorAll('button, input[type=button], input[type=submit], a')].filter(b => /^\\s*rapor\\s*$/i.test(b.innerText || b.value || '') && b.offsetParent !== null).pop();
      if (!btn) return { hata: 'FORM', metin: 'Rapor düğmesi bulunamadı' };
      btn.click(); return { ok: true };
    })()`;
    const r = await hw.webContents.executeJavaScript(js, true);
    if (r && r.hata === 'NO_SESSION') fail('NO_SESSION', 'Luca oturumu kapanmış. Luca\'ya yeniden giriş yapın.');
    if (!r || !r.ok) fail('MUAVIN_FORM', 'Luca muavin ekranı açılamadı' + (r && r.metin ? ': ' + r.metin : '') + '.');
    const zaman = new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error('Luca muavin dosyasını ' + Math.round(sureSn / 60) + ' dakikada hazırlamadı.'), { code: 'ZAMAN' })), sureSn * 1000));
    const d = await Promise.race([indirme, zaman]);
    const b = d.buf;
    if (b.length < 4 || b[0] !== 0x50 || b[1] !== 0x4b) {
      // eski Excel (.xls) ya da HTML de gelebilir: .xls başlığı D0 CF 11 E0
      if (!(b[0] === 0xD0 && b[1] === 0xCF)) fail('MUAVIN_DOSYA', 'Luca muavin dosyası Excel değil (' + b.length + ' bayt).');
      return { year: p.year, firma: p.firmLabel, veri: b, uzanti: '.xls' };
    }
    return { year: p.year, firma: p.firmLabel, veri: b, uzanti: '.xlsx' };
  } finally {
    ses.removeListener('will-download', onDl);
    for (const wc of hwler) { try { const bw = BrowserWindow.fromWebContents(wc); if (bw && !bw.isDestroyed()) bw.destroy(); } catch (e) {} }
  }
}
// Excel Hesap Planı raporu: başlık satırında "Hesap Kodu" ve "Hesap Adı" aranır; yoksa kod biçimindeki ilk hücre + yanındaki metin
function hesapPlaniExcelOku(buf) {
  const XLSX = require('xlsx');
  const wb = XLSX.read(buf, { type: 'buffer' });
  const norm = x => String(x == null ? '' : x).toLocaleUpperCase('tr-TR').replace(/İ/g, 'I').replace(/Ş/g, 'S').replace(/Ğ/g, 'G').replace(/Ü/g, 'U').replace(/Ö/g, 'O').replace(/Ç/g, 'C').replace(/\s+/g, ' ').trim();
  const KOD = /^\d{3}([.\-][0-9A-Za-zÇĞİÖŞÜçğıöşü]+)*$/;
  const out = [], gor = new Set();
  for (const ad of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[ad], { header: 1, defval: '', raw: false });
    let ck = -1, ca = -1;
    for (let i = 0; i < Math.min(rows.length, 40) && ck < 0; i++) {
      const r = rows[i].map(norm);
      const k = r.findIndex(x => /^HESAP KODU$|^HESAP NO$|^KOD$/.test(x)), a = r.findIndex(x => /^HESAP ADI$|^HESAP ISMI$|^ACIKLAMA$|^AD$/.test(x));
      if (k >= 0 && a >= 0) { ck = k; ca = a; }
    }
    for (const row of rows) {
      let k, a;
      if (ck >= 0) { k = String(row[ck] || '').trim(); a = String(row[ca] || '').trim(); }
      else { const i = row.findIndex(x => KOD.test(String(x).trim())); if (i < 0) continue; k = String(row[i]).trim(); a = String(row.slice(i + 1).find(x => String(x).trim() && !/^[\d.,\-\s]+$/.test(String(x))) || '').trim(); }
      if (!KOD.test(k) || gor.has(k)) continue;
      gor.add(k); out.push([k, a.replace(/\s+/g, ' ')]);
    }
    if (out.length) break;
  }
  return out;
}
async function hesapPlani({ lucaId, year }) {
  // Önce Raporlar → Excel Hesap Planı; olmazsa Hesap Planı Listesi ekranı
  try { return await hesapPlaniRapor({ lucaId, year }); }
  catch (e) { if (e.code === 'NO_SESSION' || e.code === 'UYE' || e.code === 'ARG' || e.code === 'NO_FIRM' || e.code === 'NO_PERIOD') throw e; hesapPlaniRapor.sonHata = e.message; }
  const r = await hesapPlaniListe({ lucaId, year });
  return { ...r, kaynak: 'liste', raporHata: hesapPlaniRapor.sonHata || '' };
}
async function hesapPlaniListe({ lucaId, year }) {
  const p = await prepareFis({ lucaId, year });
  const w = isSayfasi();
  const js = `(async () => {
    const base = location.origin + '/Luca/'; const out = []; const gor = new Set(); const coz = (buf, r) => { const ct = (r && r.headers.get('content-type') || '').toLowerCase(); if (/utf-?8/.test(ct)) return new TextDecoder('utf-8').decode(buf); try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch (e) { return new TextDecoder('windows-1254').decode(buf); } };
    for (let sayfa = 1; sayfa <= 200; sayfa++) {
      const body = new URLSearchParams({ sayfaNo: String(sayfa), sayfaBasinaKayitSayisi: '150', kebirDeger: '1', hesapKodu: '', hesapAdi: '', tcNo: '', vergiNo: '',
        vergiDairesi: '', vergiDairesiAd: '', hesapKodu1: '', hesapKodu2: '', ay: '', tarih1: '', tarih2: '', calismayanHesap: '0' });
      const r = await fetch(base + 'hesapPlaniSearchAction.do?time=' + Date.now(), { method: 'POST', credentials: 'include', body });
      const buf = await r.arrayBuffer(); const html = coz(buf, r);
      if (/top\\.location\\s*=\\s*"giris\\.do"/.test(html)) return { hata: 'NO_SESSION' };
      const doc = new DOMParser().parseFromString(html, 'text/html');
      let yeni = 0, sayfada = 0;      // sayfada: bu sayfadaki satır sayısı (150 ise sonraki sayfa da okunur)
      // Luca listesinde td#td<HESAP_KODU> hücresi hesap ADINI taşır (duzenle(): HESAP_ADI = $("#td"+kod).html()); kod id'den alınır
      for (const td of doc.querySelectorAll('td[id^="td"]')) {
        sayfada++; const kod = td.id.slice(2).trim(); if (!/^\\d/.test(kod)) continue; if (gor.has(kod)) continue;
        let ad = (td.textContent || '').replace(/\\s+/g, ' ').trim();
        if (!ad) { const tr = td.closest('tr'); const tds = tr ? [...tr.querySelectorAll('td')] : []; const i = tds.indexOf(td); ad = (tds[i + 1] ? tds[i + 1].textContent : '').replace(/\\s+/g, ' ').trim(); }
        gor.add(kod); out.push([kod, ad]); yeni++;
      }
      if (!yeni) {   // yedek: sec(this,'id','KOD',...) tıklama satırları
        for (const m of html.matchAll(/sec\\(this,\\s*'\\d*',\\s*'([0-9][0-9.]*)'/g)) { const kod = m[1]; sayfada++; if (gor.has(kod)) continue; gor.add(kod); out.push([kod, '']); yeni++; }
      }
      // Luca sayfa sonunu bildirmez: yeni satır gelmediği ya da sayfa belirgin biçimde kısa olduğu ilk sayfada durulur
      if (!yeni || sayfada < 100) break;
    }
    return { satirlar: out };
  })()`;
  const r = await w.webContents.executeJavaScript(js, true);
  if (r && r.hata === 'NO_SESSION') fail('NO_SESSION', 'Luca oturumu kapanmış. Luca\'ya yeniden giriş yapın.');
  return { year: p.year, firma: p.firmLabel, hesaplar: (r && r.satirlar) || [] };
}
// Vergi / TC kimlik numarasıyla hesap planında arama (cari zaten açılmış mı?)
async function hesapAraVkn({ lucaId, year, vkn }) {
  const v = String(vkn || '').replace(/\D/g, ''); if (v.length < 10) return [];
  await prepareFis({ lucaId, year });
  const w = isSayfasi();
  const js = `(async () => {
    const body = new URLSearchParams({ sayfaNo: '1', sayfaBasinaKayitSayisi: '150', kebirDeger: '1', hesapKodu: '', hesapAdi: '', tcNo: ${JSON.stringify(v.length === 11 ? v : '')},
      vergiNo: ${JSON.stringify(v.length === 10 ? v : '')}, vergiDairesi: '', vergiDairesiAd: '', hesapKodu1: '', hesapKodu2: '', ay: '', tarih1: '', tarih2: '', calismayanHesap: '0' });
    const r = await fetch(location.origin + '/Luca/hesapPlaniSearchAction.do?time=' + Date.now(), { method: 'POST', credentials: 'include', body });
    const coz = (buf, r) => { const ct = (r && r.headers.get('content-type') || '').toLowerCase(); if (/utf-?8/.test(ct)) return new TextDecoder('utf-8').decode(buf); try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch (e) { return new TextDecoder('windows-1254').decode(buf); } }; const html = coz(await r.arrayBuffer(), r);
    const doc = new DOMParser().parseFromString(html, 'text/html'); const out = [];
    for (const td of doc.querySelectorAll('td[id^="td"]')) { const kod = td.id.slice(2).trim(); if (!/^\\d{3}\\./.test(kod)) continue;
      out.push([kod, (td.textContent || '').replace(/\\s+/g, ' ').trim()]); }
    return out; })()`;
  try { return await w.webContents.executeJavaScript(js, true); } catch (e) { return []; }
}
async function hesapEkle({ lucaId, year, hesaplar }) {
  if (!Array.isArray(hesaplar) || !hesaplar.length) fail('ARG', 'Eklenecek hesap yok.');
  await prepareFis({ lucaId, year });
  const sonuc = [];
  for (const h of hesaplar) {
    const kod = String(h.kod || '').trim(), ad = String(h.ad || '').trim();
    if (!/^\d{3}([.][0-9A-Za-zÇĞİÖŞÜçğıöşü]+)*$/.test(kod) || !ad || /[<>]/.test(kod)) { sonuc.push({ kod, ad, ok: false, hata: 'Geçersiz hesap kodu ya da adı' }); continue; }
    try {
      const r = await request('addHesapPlaniAction.do', { method: 'POST', form: { json: '1', N: kod.includes('.') ? 'B' : 'K', UST_HESAP_KODU: '', islem: 'yeni', HESAP_KODU: kod, HESAP_ADI: ad, BIRIM: '', BAKIYE_SEKLI: '', AKTIF: '1' } });
      if (r && r.success) {
        // Luca bazı yanıtlarda hesabın kesinleşen kodunu result alanında döndürür (ör. alt hesap numarası Luca verdiyse)
        const rk = r.result && typeof r.result !== 'object' ? String(r.result).trim() : (r.result && (r.result.HESAP_KODU || r.result.hesapKodu)) || '';
        const lucaKod = /^\d{3}([.][0-9A-Za-z]+)*$/.test(rk) ? rk : kod;
        sonuc.push({ kod, lucaKod, ad, ok: true, mesaj: String(r.success).replace(/<[^>]+>/g, '') });
      }
      else sonuc.push({ kod, ad, ok: false, hata: String((r && (r.warning || r.error)) || 'Luca beklenmeyen bir yanıt verdi.').replace(/<[^>]+>/g, '') });
    } catch (e) {
      if (e.code === 'NO_SESSION' || e.code === 'UYE') throw e;
      sonuc.push({ kod, ad, ok: false, hata: String(e.message || e).replace(/^Luca: /, '') });
    }
  }
  return sonuc;
}

// ---------- Döviz kodları: Luca'nın fiş ekranlarındaki döviz listesinden (TL = 0). Yalnız okuma: açık Luca çerçeveleri
// taranır; bulunamazsa menüdeki fiş giriş ekranları (GET) okunur. Silme / kaydetme / kesme adresleri açılmaz.
// İşletme / serbest meslek defteri fiş ekranındaki açılır listeler (kayıt alt türü, KDV istisnası, stopaj kodu, vergi dairesi…).
// Kullanıcı Luca penceresinde ekranı açar; açık tüm Luca pencerelerinin tüm çerçevelerindeki <select>'ler okunur. Hiçbir şeye basılmaz.
async function isletmeListeleri(o) {
  const js = `(() => {
    const out = [];
    const etiket = s => { try { if (s.id) { const l = s.ownerDocument.querySelector('label[for="' + s.id + '"]'); if (l) return l.innerText.trim(); }
        const td = s.closest('td'); let p = td && td.previousElementSibling; while (p && !(p.innerText || '').trim()) p = p.previousElementSibling;
        if (p) return (p.innerText || '').trim().slice(0, 80);
        let x = s.previousSibling; for (let i = 0; i < 4 && x; i++, x = x.previousSibling) { const t = (x.textContent || '').trim(); if (t) return t.slice(0, 80); } } catch (e) {} return ''; };
    const tara = doc => { for (const s of doc.querySelectorAll('select')) { const ops = [...s.options].map(o => (o.text || '').replace(/\\s+$/, '')).filter(t => t.trim());
        if (ops.length < 2) continue; out.push({ ad: s.name || '', id: s.id || '', etiket: etiket(s), secenekler: ops.slice(0, 3000), adres: doc.location ? doc.location.pathname : '' }); } };
    const gez = win => { try { tara(win.document); } catch (e) {} try { for (let i = 0; i < win.frames.length; i++) gez(win.frames[i]); } catch (e) {} };
    gez(window); return out; })()`;
  const L = []; const gor = new Set();
  const ekle = arr => { for (const x of arr || []) { const k = x.ad + '|' + x.id + '|' + x.secenekler.length; if (!gor.has(k)) { gor.add(k); L.push(x); } } };
  for (const w of windows) {
    if (!w || w.isDestroyed()) continue;
    try { ekle(await w.webContents.executeJavaScript(js)); } catch (e) {}
  }
  if (!windows.size) fail('NO_SESSION', 'Luca penceresi açık değil. Luca\'yı açıp işletme defteri fiş giriş ekranına gidin.');
  if (o && o.lucaId && isSayfasi()) {
    // Luca'da ekranı açmak gerekmesin: gelir / gider listesi ve oradan açılan fiş giriş ekranları gizli pencerede okunur.
    // Yalnız GET ile açılır; kaydet / sil / güncelle / onay / aktar adreslerine gidilmez, hiçbir düğmeye basılmaz.
    const { base } = await isletmeKok(o.lucaId, o.year || new Date().getFullYear());
    const hw = gizliPencere();
    const adresJS = `(() => { const h = document.documentElement.innerHTML; const s = new Set();
      for (const m of h.matchAll(/["'(]\\/?(?:Luca\\/)?([A-Za-z0-9_]*(?:[Ii]sletme|[Ff]is)[A-Za-z0-9_]*\\.do(?:\\?[^"')\\s]*)?)/g)) s.add(m[1].replace(/&amp;/g, '&'));
      return [...s].filter(a => !/list|sil|delete|kaydet|save|guncelle|update|onay|iptal|kes|aktar|rapor|yazdir|print|excel/i.test(a.split('?')[0])).slice(0, 8); })()`;
    try {
      const gezilen = new Set();
      for (const tur of [1, 0]) {
        const yk = yuklenince(hw); await hw.loadURL(base + 'listIsletmeFisFilitreAction.do?time=' + Date.now() + '&TUR=' + tur, { httpReferrer: base + 'menu.do' }); await yk.catch(() => {});
        try { ekle(await hw.webContents.executeJavaScript(js, true)); } catch (e) {}
        let adresler = []; try { adresler = await hw.webContents.executeJavaScript(adresJS, true) || []; } catch (e) {}
        for (const a of adresler) {
          if (gezilen.has(a)) continue; gezilen.add(a);
          try { const yk2 = yuklenince(hw, 30000); await hw.loadURL(base + a + (a.includes('?') ? '&' : '?') + 'time=' + Date.now() + (/TUR=/.test(a) ? '' : '&TUR=' + tur), { httpReferrer: base + 'menu.do' });
            await yk2.catch(() => {}); await new Promise(r => setTimeout(r, 1500));        // ekranın açılır listeleri arkadan dolabilir
            ekle(await hw.webContents.executeJavaScript(js, true)); } catch (e) {}
        }
      }
    } finally { try { hw.destroy(); } catch (e) {} }
  }
  return L;
}

// ---------- İşletme / serbest meslek defteri (Luca menüsünde "İşletme Defteri" ya da "Ser.Meslek Deft."; ekranlar aynı)
const SESSIZ_JS = 'window.alert=function(){};window.confirm=function(){return true;};window.print=function(){};';
function gizliPencere() {
  const hw = new BrowserWindow({ show: false, width: 1280, height: 860, webPreferences: { partition: PARTITION, contextIsolation: true, nodeIntegration: false, sandbox: true } });
  hw.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  hw.webContents.on('dom-ready', () => { hw.webContents.executeJavaScript(SESSIZ_JS, true).catch(() => {}); });
  return hw;
}
function yuklenince(hw, ms = 60000) {
  return new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('Luca sayfası yüklenemedi (zaman aşımı).')), ms);
    hw.webContents.once('did-finish-load', () => { clearTimeout(t); res(); }); });
}
async function isletmeKok(lucaId, year) {
  const p = await prepareFis({ lucaId, year });                 // firma / dönem Luca'da etkin olur
  const w0 = isSayfasi(); if (!w0) fail('NO_SESSION', 'Luca oturumu açık değil.');
  return { p, base: new URL(w0.webContents.getURL()).origin + '/Luca/' };
}
const ISLETME_LISTE_JS = `(() => {
  const tb = document.querySelector('tbody.data-table') || document.querySelector('tbody.form_table'); if (!tb) return null;
  const sayi = t => (t || '').replace(/\\s+/g, ' ').trim();
  return [...tb.querySelectorAll('tr[id^=tr]')].map(tr => { const td = [...tr.querySelectorAll('td')].map(x => sayi(x.innerText || x.textContent));
    const m = (tr.getAttribute('onclick') || '').match(/sec\\(this,\\s*'(\\d+)'/);
    return { fid: m ? m[1] : '', tarih: td[1], evrak_no: td[2], kategori: td[3], belge_turu: td[4], aciklama: td[5], cari: td[6], tutar: td[7], kdv: td[8], toplam: td[9] }; })
    .filter(r => r.tarih); })()`;
// Gelir (TUR=0) ve Gider (TUR=1) listeleri: muavin yerine (toplu kontroldeki Gelir ve Gider Listesi ile aynı)
async function isletmeListesiIndir({ lucaId, year }) {
  const { p, base } = await isletmeKok(lucaId, year);
  const y = String(year || p.year); const bas = '01/01/' + y, bit = '31/12/' + y;
  const hw = gizliPencere(); const out = { firma: p.firmLabel, bas: y + '-01-01', bit: y + '-12-31', gelir: [], gider: [] };
  try {
    for (const tur of [0, 1]) {
      const yk = yuklenince(hw);
      await hw.loadURL(base + 'listIsletmeFisFilitreAction.do?time=' + Date.now() + '&TUR=' + tur, { httpReferrer: base + 'menu.do' }); await yk.catch(() => {});
      const var_ = await hw.webContents.executeJavaScript('!!document.forms.isletmeFisParametreForm', true).catch(() => false);
      if (!var_) fail('ISLETME', 'Luca işletme / serbest meslek defteri listesi açılamadı (firma işletme ya da serbest meslek defteri tutmuyor olabilir).');
      const yk2 = yuklenince(hw);
      await hw.webContents.executeJavaScript(`(() => { const f = document.forms.isletmeFisParametreForm; const s = (n, v) => { if (f[n]) f[n].value = v; };
        s('evrakTarih1', ${JSON.stringify(bas)}); s('evrakTarih2', ${JSON.stringify(bit)}); s('evrakNo1', ''); s('evrakNo2', ''); s('kategori', ''); s('durum', ''); f.submit(); })()`, true);
      await yk2;
      const L = await hw.webContents.executeJavaScript(ISLETME_LISTE_JS, true);
      if (L == null) fail('ISLETME', (tur ? 'Gider' : 'Gelir') + ' Listesi tablosu bulunamadı.');
      out[tur ? 'gider' : 'gelir'] = L;
    }
  } finally { try { hw.destroy(); } catch (e) {} }
  return out;
}

async function dovizKodlari() {
  const w = isSayfasi();
  if (!w) fail('NO_SESSION', 'Luca oturumu açık değil.');
  const js = `(async () => {
    const out = {};
    const kod = t => { t = String(t || '').toLocaleUpperCase('tr-TR').replace(/\\s+/g, ' ').trim();
      const m = t.match(/(^|[^A-Z])(TL|TRY|USD|EUR|GBP|CHF|JPY|SAR|AUD|CAD|SEK|NOK|DKK|RUB|CNY|AZN|KWD|QAR|RON|BGN)([^A-Z]|$)/); if (m) return m[2] === 'TL' ? 'TRY' : m[2];
      if (/DOLAR/.test(t)) return 'USD'; if (/EURO|AVRO/.test(t)) return 'EUR'; if (/STERL/.test(t)) return 'GBP'; if (/TÜRK L[İI]RASI|TURK LIRASI/.test(t)) return 'TRY'; return null; };
    const tara = doc => { for (const s of doc.querySelectorAll('select')) { const ops = [...s.options]; const ks = ops.map(o => kod(o.text));
        if (ks.filter(Boolean).length < 2 || (!ks.includes('USD') && !ks.includes('EUR'))) continue;
        ops.forEach((o, i) => { if (ks[i] && o.value !== '' && out[ks[i]] == null) out[ks[i]] = o.value; }); } };
    const gez = win => { try { tara(win.document); } catch (e) {} try { for (let i = 0; i < win.frames.length; i++) gez(win.frames[i]); } catch (e) {} };
    gez(window);
    if (out.USD == null && out.EUR == null) {
      const base = location.origin + '/Luca/';
      const coz = (buf, r) => { const ct = (r && r.headers.get('content-type') || '').toLowerCase(); if (/utf-?8/.test(ct)) return new TextDecoder('utf-8').decode(buf); try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch (e) { return new TextDecoder('windows-1254').decode(buf); } };
      let menu = ''; try { const r = await fetch(base + 'menu.do?time=' + Date.now(), { credentials: 'include' }); menu = coz(await r.arrayBuffer(), r); } catch (e) {}
      const adr = [...new Set([...menu.matchAll(/["'(]\\/?(?:Luca\\/)?([A-Za-z0-9_\\/]*[Ff][Ii][Ss][A-Za-z0-9_\\/]*\\.(?:do|jsp))(?:\\?[^"')]*)?/g)].map(m => m[1]))]
        .filter(a => !/sil|delete|kes|kaydet|onay|guncelle|update|aktar|iptal/i.test(a)).slice(0, 15);
      for (const a of adr) { try { const r = await fetch(base + a + '?time=' + Date.now(), { credentials: 'include' }); const h = coz(await r.arrayBuffer(), r);
          tara(new DOMParser().parseFromString(h, 'text/html')); if (out.USD != null || out.EUR != null) break; } catch (e) {} }
    }
    return out;
  })()`;
  let kodlar = {};
  try { kodlar = await w.webContents.executeJavaScript(js, true) || {}; } catch (e) { kodlar = {}; }
  return { kodlar };
}

// ---------- Luca istek kaydı (keşif): Luca'da elle yapılan bir işlemin hangi isteklerle yapıldığını öğrenmek için.
// Yalnız *.luca.com.tr/Luca/ adreslerine giden isteklerin adresi, yöntemi, gönderilen alanlar ve .jq/.do yanıtları
// (kısaltılmış) tutulur. Çerez / başlık / giriş sayfası kaydedilmez; parola geçen alanlar silinir.
const kayit = { acik: false, olaylar: [], bekleyen: new Map(), bagli: new Set(), atlanan: new Map(), zaman: null, sureDoldu: false };
// Kayıt fatura / muavin yanıtlarını düz metin tutar (rapor-02 D16): en çok 30 dakika açık kalır, sonra kendiliğinden durur
const KAYIT_SURE_MS = 30 * 60 * 1000;
// Luca'nın tüm uygulamaları (bilanço /Luca/, işletme defteri ve diğer modüller farklı yollarda olabilir)
const KAYIT_URL = /^https:\/\/[a-z0-9.-]+\.luca\.com\.tr\//i;
const KAYIT_HARIC = /\.(js|css|png|gif|jpe?g|svg|ico|woff2?|ttf|map)(\?|$)|LUCASSO|giris\.(do|erp)/i;
function gizle(t, sinir = 20000) {
  t = String(t || '');
  return t.replace(/((?:parola|sifre|şifre|password|pass)[^=&":]*["']?\s*[:=]\s*["']?)[^&"',}]*/gi, '$1***').slice(0, sinir);
}
function kayitBagla(w) {
  if (!kayit.acik || !w || w.isDestroyed() || kayit.bagli.has(w)) return;
  const dbg = w.webContents.debugger;
  try { if (!dbg.isAttached()) dbg.attach('1.3'); } catch (e) { return; }
  kayit.bagli.add(w);
  dbg.sendCommand('Network.enable').catch(() => {});
  dbg.on('message', async (ev, method, p) => {
    if (!kayit.acik) return;
    try {
      if (method === 'Network.requestWillBeSent') {
        const u = p.request.url;
        if (!KAYIT_URL.test(u) || KAYIT_HARIC.test(u)) {    // kaydedilmeyen istek: yalnız alan adı + ilk yol parçası sayılır (kayıt neden boş, görmek için)
          if (!/^(data|blob|devtools|chrome)/.test(u)) { const m = u.match(/^(https?:\/\/[^/?#]+)(\/[^/?#]*)?/); const k = m ? m[1] + (m[2] || '') : '?'; kayit.atlanan.set(k, (kayit.atlanan.get(k) || 0) + 1); }
          return; }
        const o = { t: new Date().toISOString(), yontem: p.request.method, adres: u.replace(/([?&])(time|_)=\d+/g, '$1$2=…'), govde: gizle(p.request.postData || (p.request.hasPostData ? '(gövde: dosya / çok parçalı)' : '')), tur: p.type };
        kayit.olaylar.push(o); kayit.bekleyen.set(p.requestId, o);
      } else if (method === 'Network.responseReceived') {
        const o = kayit.bekleyen.get(p.requestId); if (o) { o.durum = p.response.status; o.icerik = p.response.mimeType; }
      } else if (method === 'Network.loadingFinished') {
        const o = kayit.bekleyen.get(p.requestId); if (!o) return; kayit.bekleyen.delete(p.requestId);
        // .jq / .do yanıtları ve HTML / JSON / XML sayfalar (açılır listeler sayfanın içinde gelir: kısaltmadan 300 bin karaktere kadar)
        if (!/\.(jq|do|jsp|erp)(\?|$)/i.test(o.adres) && !/html|json|xml|text\/plain/i.test(o.icerik || '')) return;
        try { const r = await dbg.sendCommand('Network.getResponseBody', { requestId: p.requestId }); o.yanit = gizle(r.base64Encoded ? '(ikili)' : r.body, 300000); } catch (e) {}
      }
    } catch (e) {}
  });
  w.on('closed', () => kayit.bagli.delete(w));
}
function kayitBaslat() {
  kayit.acik = true; kayit.sureDoldu = false; kayit.olaylar = []; kayit.bekleyen.clear(); kayit.atlanan.clear();
  for (const w of windows) kayitBagla(w);
  clearTimeout(kayit.zaman);
  kayit.zaman = setTimeout(() => { kayit.sureDoldu = true; kayitKapat(); }, KAYIT_SURE_MS);
  if (kayit.zaman.unref) kayit.zaman.unref();
  return { acik: true, pencere: windows.size, sureDk: KAYIT_SURE_MS / 60000,
    uyari: 'Kayıt, Luca\'dan gelen fatura ve muavin içeriklerini düz metin olarak tutar; en çok 30 dakika açık kalır.' };
}
// dinlemeyi bırakır; toplanan olaylar "Kaydı Durdur"a kadar saklanır
function kayitKapat() {
  kayit.acik = false; clearTimeout(kayit.zaman);
  for (const w of kayit.bagli) { try { if (!w.isDestroyed()) { w.webContents.debugger.sendCommand('Network.disable').catch(() => {}); w.webContents.debugger.detach(); } } catch (e) {} }
  kayit.bagli.clear();
}
function kayitDurdur() {
  kayitKapat();
  const olaylar = kayit.olaylar; kayit.olaylar = [];
  olaylar.atlanan = Object.fromEntries(kayit.atlanan); olaylar.pencere = windows.size;
  return olaylar;
}
function kayitDurumu() { return { acik: kayit.acik, adet: kayit.olaylar.length, sureDoldu: kayit.sureDoldu }; }

// Dışa açılan Luca işleri sayfa havuzundan geçer (Görev 29): firma seçen işler firma anahtarıyla, gizli yardımcı pencere
// açanlar (muavin, işletme listeleri) yalnız ortak sayfada
const fk = o => (o && o.lucaId ? firmaAnahtari(o.lucaId, o.year) : null);
const IS = {
  listFirms: () => isle(null, listFirms),
  fetchMizan: o => isle(null, () => fetchMizan(o)),
  prepareFis: o => isle(fk(o), () => prepareFis(o)),
  defterTuru: o => isle(fk(o), () => defterTuru(o)),
  fisKes: o => { const sec = o && donemFirma.get(String(o.donemId)); return isle(sec ? firmaAnahtari(sec.lucaId, sec.year) : null, () => fisKes(o)); },
  hesapPlani: o => isle(fk(o), () => hesapPlani(o)),
  hesapPlaniRapor: o => isle(fk(o), () => hesapPlaniRapor(o)),
  hesapAraVkn: o => isle(fk(o), () => hesapAraVkn(o)),
  hesapEkle: o => isle(fk(o), () => hesapEkle(o)),
  muavinIndir: o => isle(fk(o), () => muavinIndir(o), true),
  isletmeListesiIndir: o => isle(fk(o), () => isletmeListesiIndir(o), true),
  isletmeListeleri: o => isle(fk(o), () => isletmeListeleri(o), true),
  dovizKodlari: () => isle(null, dovizKodlari),
};
module.exports = { calis, captchaGir, captchaYenile, girisGoster, oturumCerezleri, hesapPlaniExcelOku, kayitBaslat, kayitDurdur, kayitDurumu, init, openLogin, status,
  logout, recheck, LOGIN_URL, ...IS, sayfaBilgisi, _normUye: normUye, _zamanAsimiGec: zamanAsimiGec,
  _sayfaAyar: o => { if (o.kiraMs != null) KIRA_MS = o.kiraMs; if (o.ekBosMs != null) EK_BOS_MS = o.ekBosMs; if (o.bekleMs != null) BEKLE_EN_COK_MS = o.bekleMs; } };
