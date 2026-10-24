// Görev 41: ekranda görsel çakışma ölçümü. Sayfanın (ya da çerçevenin) içinde çalışır: page.evaluate(cakisma, kok)
// - görünür öğeler: düğme, bağlantı, giriş kutusu, resim ve doğrudan metni olan her öğe
// - her öğenin "mürekkep" dikdörtgeni: metinde metnin kendisi (Range), düğme / kutu / resimde kutusu;
//   taşmayı kesen (overflow) üst öğelere ve pencereye göre kırpılır
// - çakışma: DOM'da biri ötekini içermeyen iki görünür öğenin dikdörtgenleri 2 px'ten fazla kesişirse
// - taşma: sayfa yatay kaydırılabiliyorsa (scrollWidth > clientWidth) ya da bir öğe pencerenin sağından / solundan çıkıyorsa
// - kesik metin: metin, kaydırılamayan (overflow:hidden / clip) bir üst öğenin kenarında yarım kalıyorsa (… ile kısaltılan hariç)
// Kasıtlı üst üste binme için öğeye data-ust-ok konur.
function cakisma(kok) {
  const R = kok ? document.querySelector(kok) : document.body;
  const vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
  const sonuc = { cakisan: [], tasan: [], kesik: [], sayfaTasma: null, n: 0 };
  if (!R) return sonuc;
  const de = document.scrollingElement || document.documentElement;
  if (de.scrollWidth > de.clientWidth + 1) sonuc.sayfaTasma = de.scrollWidth + ' > ' + de.clientWidth;
  const kes = (a, b) => ({ l: Math.max(a.l, b.l), t: Math.max(a.t, b.t), r: Math.min(a.r, b.r), b: Math.min(a.b, b.b) });
  const bos = (a) => a.r - a.l <= 0 || a.b - a.t <= 0;
  const kutu = (r) => ({ l: r.left, t: r.top, r: r.right, b: r.bottom });
  const ad = (e) => { let s = e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
    const t = (e.innerText || e.value || e.getAttribute('aria-label') || e.getAttribute('alt') || '').replace(/\s+/g, ' ').trim().slice(0, 40); return t ? s + ' "' + t + '"' : s; };
  const gorunur = (e) => { if (!e.getClientRects().length) return false; for (let x = e; x && x.nodeType === 1; x = x.parentElement) { const c = getComputedStyle(x); if (c.visibility === 'hidden' || c.display === 'none' || +c.opacity === 0) return false; if (x.hasAttribute('data-ust-ok')) return false; } return true; };
  // öğenin görünebileceği alan: pencere ∩ taşmayı kesen üst öğeler
  const klip = (e) => { let a = { l: 0, t: 0, r: vw, b: vh }; for (let x = e.parentElement; x && x !== document.documentElement; x = x.parentElement) { const c = getComputedStyle(x); if (c.overflowX !== 'visible' || c.overflowY !== 'visible' || c.contain.includes('paint')) a = kes(a, kutu(x.getBoundingClientRect())); if (c.position === 'fixed') break; } return a; };
  const KUTU = 'button,a[href],input:not([type=hidden]),select,textarea,img,svg,[role=button],[role=tab],.chip,.btn';
  const adaylar = [];
  for (const e of R.querySelectorAll('*')) {
    if (e.closest('svg') && e.tagName.toLowerCase() !== 'svg') continue;
    if (/^(script|style|template|option|datalist|br|tbody|thead|tr|table|colgroup|col)$/i.test(e.tagName)) continue;
    const kutuMu = e.matches(KUTU);
    const metinler = [...e.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim());
    if (!kutuMu && !metinler.length) continue;
    if (!gorunur(e)) continue;
    const parcalar = [];
    if (kutuMu) parcalar.push(kutu(e.getBoundingClientRect()));
    else for (const n of metinler) { const rg = document.createRange(); rg.selectNodeContents(n); for (const r of rg.getClientRects()) if (r.width > 0.5 && r.height > 0.5) parcalar.push(kutu(r)); }
    const k = klip(e);
    // kaydırılamayan bir kutunun kenarında yarım kalan metin
    if (!kutuMu && getComputedStyle(e).textOverflow !== 'ellipsis') {
      let vis = parcalar;   // kaydırılabilen kutunun dışında kalan kısım kesik sayılmaz (kaydırınca görünür)
      for (let x = e.parentElement; x && x !== document.documentElement && vis.length; x = x.parentElement) { const c = getComputedStyle(x), o = c.overflowX + c.overflowY, z = kutu(x.getBoundingClientRect());
        if (/auto|scroll/.test(o)) vis = vis.map(p => kes(p, z)).filter(p => !bos(p));
        else if (/hidden|clip/.test(o)) { if (vis.some(p => p.r > z.r + 2 || p.l < z.l - 2 || p.b > z.b + 2 || p.t < z.t - 2) && vis.some(p => !bos(kes(p, z)))) { sonuc.kesik.push(ad(e) + ' ⊄ ' + ad(x).split(' "')[0]); break; } vis = vis.map(p => kes(p, z)).filter(p => !bos(p)); }
        if (c.position === 'fixed') break; } }
    const kp = parcalar.map(p => kes(p, k)).filter(p => !bos(p));
    if (!kp.length) continue;
    // pencere dışına taşma (kırpılmayan öğe sağdan / soldan çıkıyor)
    for (const p of parcalar) if (p.r > vw + 1 || p.l < -1) { const c = kes(p, klip(e)); if (c.r >= vw - 1 || c.l <= 1) { sonuc.tasan.push(ad(e) + ' [' + Math.round(p.l) + '…' + Math.round(p.r) + ' / ' + vw + ']'); break; } }
    adaylar.push({ e, kp, kutuMu });
  }
  // gerçekten görünüyor mu (üstünü başka bir katman örtmüyor mu): içindeki birkaç noktadan biri öğenin kendisine düşmeli
  const ustte = (a) => a.kp.some(p => { const xs = [p.l + 2, (p.l + p.r) / 2, p.r - 2], ys = [(p.t + p.b) / 2]; return xs.some(x => ys.some(y => { const h = document.elementFromPoint(x, y); return h && (h === a.e || a.e.contains(h) || h.contains(a.e)); })); });
  const gor = adaylar.filter(ustte);
  sonuc.n = gor.length;
  for (let i = 0; i < gor.length; i++) for (let j = i + 1; j < gor.length; j++) {
    const A = gor[i], B = gor[j];
    if (A.e.contains(B.e) || B.e.contains(A.e)) continue;
    for (const p of A.kp) { let bulundu = false; for (const q of B.kp) { const c = kes(p, q); if (c.r - c.l > 2 && c.b - c.t > 2) { sonuc.cakisan.push(ad(A.e) + ' ⟷ ' + ad(B.e) + ' (' + Math.round(c.r - c.l) + '×' + Math.round(c.b - c.t) + ')'); bulundu = true; break; } } if (bulundu) break; }
  }
  return sonuc;
}
module.exports = { cakisma };
