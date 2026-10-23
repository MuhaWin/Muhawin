// ÖKC fiş / Z raporu fotoğrafı için OCR ön işleme (Electron nativeImage ile, ek paket yok):
// kağıdı bul ve kırp (ahşap / masa gibi renkli zemin atılır) → büyüt → gri ton → renkli pikselleri beyazla → kontrast.
'use strict';
function onIsle(nativeImage, dosya) {
  let img = nativeImage.createFromPath(dosya);
  if (img.isEmpty()) return null;
  let { width: W, height: H } = img.getSize();
  if (W > 2000) { img = img.resize({ width: 2000, quality: 'best' }); ({ width: W, height: H } = img.getSize()); }
  const bm = img.toBitmap();                      // BGRA
  // 1) kağıt: açık renkli ve renksiz pikseller; kağıt oranı yüksek satır / sütunlarla sınır kutusu
  const satir = new Float32Array(H), sutun = new Float32Array(W);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4, b = bm[i], g = bm[i + 1], r = bm[i + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx > 150 && mx - mn < 45) { satir[y]++; sutun[x]++; }
  }
  const sinir = (a, n, esik) => { let s = 0, e = a.length - 1; while (s < e && a[s] / n < esik) s++; while (e > s && a[e] / n < esik) e--; return [s, e]; };
  let [y0, y1] = sinir(satir, W, 0.22), [x0, x1] = sinir(sutun, H, 0.22);
  if (x1 - x0 < W * 0.15 || y1 - y0 < H * 0.15) { x0 = 0; y0 = 0; x1 = W - 1; y1 = H - 1; }   // kağıt bulunamadı: tamamı
  const pay = 6; x0 = Math.max(0, x0 - pay); y0 = Math.max(0, y0 - pay); x1 = Math.min(W - 1, x1 + pay); y1 = Math.min(H - 1, y1 + pay);
  let c = img.crop({ x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 });
  // 2) yazı yüksekliği için büyüt (dar fişlerde 2 kat, en fazla 2400 px genişlik)
  const cw = x1 - x0 + 1, hedefW = Math.min(2400, Math.max(cw, Math.round(cw * (cw < 1200 ? 2 : 1))));
  if (hedefW !== cw) c = c.resize({ width: hedefW, quality: 'best' });
  const { width: w, height: h } = c.getSize(); const b2 = c.toBitmap();
  // 3) gri ton; renkli (doymuş) pikseller zemin sayılıp beyaz; %1–%99 aralığına göre kontrast germe
  const gri = new Uint8Array(w * h), hist = new Uint32Array(256);
  for (let p = 0, i = 0; p < w * h; p++, i += 4) {
    const b = b2[i], g = b2[i + 1], r = b2[i + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const v = mx - mn > 50 ? 255 : Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    gri[p] = v; hist[v]++;
  }
  let lo = 0, hi = 255, say = 0; const n = w * h;
  for (let v = 0; v < 256; v++) { say += hist[v]; if (say > n * 0.01) { lo = v; break; } }
  say = 0; for (let v = 255; v >= 0; v--) { say += hist[v]; if (say > n * 0.01) { hi = v; break; } }
  if (hi - lo < 40) { lo = 0; hi = 255; }
  const out = Buffer.alloc(w * h * 4);
  for (let p = 0, i = 0; p < n; p++, i += 4) {
    let v = Math.round((gri[p] - lo) * 255 / (hi - lo)); v = v < 0 ? 0 : v > 255 ? 255 : v;
    out[i] = out[i + 1] = out[i + 2] = v; out[i + 3] = 255;
  }
  return nativeImage.createFromBitmap(out, { width: w, height: h }).toPNG();
}
// Tek fotoğrafta yan yana / alt alta birden çok fiş: kağıt profiline göre parçalara ayır. Dönüş: PNG buffer dizisi (tek fişte []).
function parcala(nativeImage, dosya) {
  let img = nativeImage.createFromPath(dosya);
  if (img.isEmpty()) return [];
  let { width: W, height: H } = img.getSize();
  if (W > 1600) { img = img.resize({ width: 1600, quality: 'good' }); ({ width: W, height: H } = img.getSize()); }
  const bm = img.toBitmap();
  const sutun = new Float32Array(W), satir = new Float32Array(H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4, b = bm[i], g = bm[i + 1], r = bm[i + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx > 150 && mx - mn < 45) { sutun[x]++; satir[y]++; }
  }
  // profil → kağıt bölütleri: oran > 0.18 olan ardışık bölgeler; aralarındaki boşluk (oran < 0.07) en az %2.5
  const bolut = (a, n, L) => {
    const out = []; let s = -1, bosluk = 0;
    for (let i = 0; i <= a.length; i++) {
      const dolu = i < a.length && a[i] / n > 0.18, bos = i >= a.length || a[i] / n < 0.07;
      if (dolu && s < 0) { s = i; bosluk = 0; }
      else if (s >= 0 && bos) { bosluk++; if (bosluk >= L * 0.025 || i >= a.length) { const e = i - bosluk; if (e - s > L * 0.12) out.push([s, e]); s = -1; bosluk = 0; } }
      else if (s >= 0 && !bos) bosluk = 0;
    }
    return out;
  };
  const yatay = bolut(sutun, H, W), dikey = bolut(satir, W, H);
  let parcalar = [];
  if (yatay.length >= 2) parcalar = yatay.map(([x0, x1]) => ({ x: Math.max(0, x0 - 4), y: 0, width: Math.min(W, x1 + 4) - Math.max(0, x0 - 4), height: H }));
  else if (dikey.length >= 2) parcalar = dikey.map(([y0, y1]) => ({ x: 0, y: Math.max(0, y0 - 4), width: W, height: Math.min(H, y1 + 4) - Math.max(0, y0 - 4) }));
  if (parcalar.length < 2) return [];
  // kırpma özgün çözünürlükte
  const orj = nativeImage.createFromPath(dosya); const { width: OW, height: OH } = orj.getSize(); const k = OW / W;
  return parcalar.map(p => orj.crop({ x: Math.round(p.x * k), y: Math.round(p.y * k), width: Math.min(OW, Math.round(p.width * k)), height: Math.min(OH, Math.round(p.height * k)) }).toPNG());
}
module.exports = { onIsle, parcala };
