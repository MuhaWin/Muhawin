#!/usr/bin/env node
/* MuhaWin sitesi: web/site/surum.json dosyasını ve (--denetim ile) web/site/denetim/ klasörünü üretir.
   Sürüm ve indirme deposu package.json'dan; sürüm notu OKUBENI.txt'deki en üstteki "x.y.z YENİLİKLER" bölümünden alınır
   (sitede yalnız en son yayınlanan sürümün notları görünür; önceki sürümler listelenmez — kullanıcı kararı).
   Denetim: sayfalar fk/fatura_kontrol/web/static'ten kopyalanır (tek kaynak), Python paketi zip'lenir, Pyodide ve
   wheel'ler web/denetim'den alınır (önce: cd web/denetim && npm ci && pip download --no-deps -r wheels.txt -d wheels).
   Kullanım:  node tools/site_uret.js [--denetim] */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const KOK = path.join(__dirname, '..');

function notlariOku(metin, adet) {
  const satirlar = metin.replace(/\r\n?/g, '\n').split('\n');
  const notlar = [];
  let bolum = null, madde = null;
  for (const satir of satirlar) {
    const b = /^(\d+\.\d+\.\d+) YENİLİKLER\s*$/.exec(satir);
    if (b) { bolum = { surum: b[1], maddeler: [] }; notlar.push(bolum); madde = null; continue; }
    if (!bolum) continue;
    if (/^\S/.test(satir) && !satir.startsWith('- ')) { bolum = null; madde = null; continue; }   // başka bir başlık
    if (satir.startsWith('- ')) { madde = { metin: satir.slice(2).trim(), alt: [] }; bolum.maddeler.push(madde); continue; }
    const alt = /^\s+·\s+(.*)$/.exec(satir);
    if (alt && madde) { madde.alt.push(alt[1].trim()); continue; }
    if (/^\s+\S/.test(satir) && madde) {                                                   // önceki satırın devamı
      if (madde.alt.length) madde.alt[madde.alt.length - 1] += ' ' + satir.trim();
      else madde.metin += ' ' + satir.trim();
    }
  }
  return notlar.filter(n => n.maddeler.length).slice(0, adet);
}

// Sitede önceki sürümler listelenmediği için "aşağıdaki 2.9.13 yenilikleri …" gibi o listeye gönderme yapan madde çıkarılır
const sitedeGoster = n => ({ ...n, maddeler: n.maddeler.filter(m => !/aşağıdaki\b.*\d+\.\d+\.\d+.*yenilik/i.test(m.metin)) });

function modulleriOku(metin) {
  const ilk = metin.split(/\r?\n/)[0] || '';
  const m = /Modüller:\s*(.*)$/.exec(ilk);
  if (!m) return { moduller: [], yakinda: [] };
  const yakindaM = /\(yakında:\s*([^)]*)\)/.exec(m[1]);
  const ayir = s => s.split('·').map(x => x.trim()).filter(Boolean);
  return { moduller: ayir(m[1].replace(/\(yakında:[^)]*\)/, '')), yakinda: yakindaM ? ayir(yakindaM[1]) : [] };
}

function uret() {
  const pkg = JSON.parse(fs.readFileSync(path.join(KOK, 'package.json'), 'utf8'));
  const okubeni = fs.readFileSync(path.join(KOK, 'OKUBENI.txt'), 'utf8');
  const yay = ((pkg.build && pkg.build.publish) || []).find(p => p.provider === 'github') || {};
  const dosya = String((pkg.build && pkg.build.nsis && pkg.build.nsis.artifactName) || 'MuhaWin-Kurulum-${version}.exe')
    .replace('${version}', pkg.version);
  const depo = yay.owner && yay.repo ? `${yay.owner}/${yay.repo}` : null;
  return {
    surum: pkg.version,
    dosya,
    depo,
    indir: depo ? `https://github.com/${depo}/releases/download/v${pkg.version}/${dosya}` : null,
    ...modulleriOku(okubeni),
    notlar: notlariOku(okubeni, 1).map(sitedeGoster),   // yalnız son sürüm
    uretildi: new Date().toISOString().slice(0, 10),
  };
}

// ---------------------------------------------------------------- Denetim (tarayıcıda, Pyodide)
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = b => { let c = 0xFFFFFFFF; for (const x of b) c = CRC[(c ^ x) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };

/** Basit zip yazıcı (deflate). girdiler: [{ad, veri: Buffer}] → Buffer. Tarih sabit: aynı kaynak aynı zip'i verir. */
function zipYaz(girdiler) {
  const yerel = [], merkez = []; let konum = 0;
  for (const { ad, veri } of girdiler) {
    const adB = Buffer.from(ad, 'utf8'), sik = zlib.deflateRawSync(veri, { level: 9 }), crc = crc32(veri);
    const bas = Buffer.alloc(30);
    bas.writeUInt32LE(0x04034b50, 0); bas.writeUInt16LE(20, 4); bas.writeUInt16LE(0x0800, 6); bas.writeUInt16LE(8, 8);
    bas.writeUInt16LE(0, 10); bas.writeUInt16LE(0x21, 12); bas.writeUInt32LE(crc, 14);
    bas.writeUInt32LE(sik.length, 18); bas.writeUInt32LE(veri.length, 22); bas.writeUInt16LE(adB.length, 26);
    const m = Buffer.alloc(46);
    m.writeUInt32LE(0x02014b50, 0); m.writeUInt16LE(20, 4); m.writeUInt16LE(20, 6); m.writeUInt16LE(0x0800, 8); m.writeUInt16LE(8, 10);
    m.writeUInt16LE(0, 12); m.writeUInt16LE(0x21, 14); m.writeUInt32LE(crc, 16); m.writeUInt32LE(sik.length, 20);
    m.writeUInt32LE(veri.length, 24); m.writeUInt16LE(adB.length, 28); m.writeUInt32LE(konum, 42);
    yerel.push(bas, adB, sik); merkez.push(m, adB); konum += 30 + adB.length + sik.length;
  }
  const mz = Buffer.concat(merkez), son = Buffer.alloc(22);
  son.writeUInt32LE(0x06054b50, 0); son.writeUInt16LE(girdiler.length, 8); son.writeUInt16LE(girdiler.length, 10);
  son.writeUInt32LE(mz.length, 12); son.writeUInt32LE(konum, 16);
  return Buffer.concat([...yerel, mz, son]);
}

function dosyalar(kok, alt = '') {
  const out = [];
  for (const a of fs.readdirSync(path.join(kok, alt)).sort()) {
    if (a === '__pycache__' || a.endsWith('.pyc')) continue;
    const y = path.join(alt, a);
    if (fs.statSync(path.join(kok, y)).isDirectory()) out.push(...dosyalar(kok, y)); else out.push(y);
  }
  return out;
}

/** fk/.../static'teki sayfayı siteye uyarlar: kök adresler göreliye, Luca captcha betiği çıkar, köprü eklenir. */
function sayfaUyarla(html) {
  const once = html;
  html = html.replace(/(href|src)="\/(simge\.ico|tema\.js|tema\.css|imlec\.css)"/g, '$1="$2"')
    .replace(/<script src="\/captcha\.js"[^>]*><\/script>\s*/g, '')
    .replace(/location\.href = (?=[`"']\/api\/)/g, 'MW_KOPRU.git = ')
    .replace(/(<title>|<h1[^>]*>)Mikro Denetim(?=<\/)/g, '$1Muhasebe Denetimi');   // sitedeki adı (kullanıcı kararı)
  const i = html.search(/<script>\s*\n/);
  if (i < 0 || html === once) throw new Error('Denetim sayfası beklenen biçimde değil (fk/.../static değişmiş olabilir).');
  return html.slice(0, i) + '<script src="/ortak/ayar.js"></script>\n<script src="/ortak/oturum.js"></script>\n<script src="kopru.js"></script>\n' + html.slice(i);
}

function denetimUret() {
  const KAYNAK = path.join(KOK, 'web', 'denetim'), STATIK = path.join(KOK, 'fk', 'fatura_kontrol', 'web', 'static');
  const HEDEF = path.join(KOK, 'web', 'site', 'denetim'), PY = path.join(HEDEF, 'py'), PYO = path.join(HEDEF, 'pyodide');
  const pyodide = path.join(KAYNAK, 'node_modules', 'pyodide'), wheels = path.join(KAYNAK, 'wheels');
  if (!fs.existsSync(pyodide)) throw new Error('Pyodide yok: cd web/denetim && npm ci');
  const istenen = fs.readFileSync(path.join(KAYNAK, 'wheels.txt'), 'utf8').split(/\r?\n/).map(x => x.trim()).filter(x => x && !x.startsWith('#'));
  const whl = fs.existsSync(wheels) ? fs.readdirSync(wheels).filter(x => x.endsWith('.whl')).sort() : [];
  for (const w of istenen) {
    const [ad, surum] = w.split('==');
    if (!whl.some(x => x.toLowerCase().startsWith(ad.toLowerCase().replace(/-/g, '_') + '-' + surum + '-'))) throw new Error(`Wheel yok: ${w} (cd web/denetim && pip download --no-deps -r wheels.txt -d wheels)`);
  }
  fs.rmSync(HEDEF, { recursive: true, force: true });
  fs.mkdirSync(PY, { recursive: true }); fs.mkdirSync(PYO, { recursive: true });
  for (const a of ['pyodide.js', 'pyodide.asm.js', 'pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json']) fs.copyFileSync(path.join(pyodide, a), path.join(PYO, a));
  for (const w of whl) fs.copyFileSync(path.join(wheels, w), path.join(PY, w));
  const fkKok = path.join(KOK, 'fk');
  const paketDosyalari = dosyalar(fkKok, 'fatura_kontrol').filter(y => !y.includes(path.join('web', 'static') + path.sep));
  const zip = zipYaz(paketDosyalari.map(y => ({ ad: y.split(path.sep).join('/'), veri: fs.readFileSync(path.join(fkKok, y)) })));
  fs.writeFileSync(path.join(PY, 'fatura_kontrol.zip'), zip);
  fs.copyFileSync(path.join(KAYNAK, 'kopru.py'), path.join(PY, 'kopru.py'));
  const ozet = require('crypto').createHash('sha256').update(zip).update(fs.readFileSync(path.join(KAYNAK, 'kopru.py'))).update(whl.join()).digest('hex').slice(0, 12);
  fs.writeFileSync(path.join(PY, 'paket.json'), JSON.stringify({ surum: ozet, paket: 'fatura_kontrol.zip', wheels: whl }, null, 2) + '\n');
  for (const a of ['kopru.js', 'calisan.js']) fs.copyFileSync(path.join(KAYNAK, a), path.join(HEDEF, a));
  for (const a of ['tema.css', 'tema.js', 'imlec.css', 'simge.ico']) fs.copyFileSync(path.join(STATIK, a), path.join(HEDEF, a));
  fs.writeFileSync(path.join(HEDEF, 'index.html'), sayfaUyarla(fs.readFileSync(path.join(STATIK, 'denetim.html'), 'utf8')));
  fs.writeFileSync(path.join(HEDEF, 'beyanname.html'), sayfaUyarla(fs.readFileSync(path.join(STATIK, 'beyanname.html'), 'utf8')));
  return { ozet, dosya: paketDosyalari.length, wheels: whl.length, boyut: zip.length };
}

module.exports = { notlariOku, modulleriOku, sitedeGoster, uret, zipYaz, sayfaUyarla, denetimUret };

if (require.main === module) {
  const arg = process.argv.slice(2);
  const veri = uret();
  const hedef = path.join(KOK, 'web', 'site', 'surum.json');
  fs.writeFileSync(hedef, JSON.stringify(veri, null, 2) + '\n');
  console.log(`${path.relative(KOK, hedef)} yazıldı: MuhaWin ${veri.surum} (${veri.notlar.length ? veri.notlar[0].surum + ' sürüm notu' : 'sürüm notu yok'}).`);
  if (arg.includes('--denetim')) {
    const d = denetimUret();
    console.log(`web/site/denetim/ yazıldı: ${d.dosya} Python dosyası (${(d.boyut / 1024).toFixed(0)} KB zip), ${d.wheels} wheel, paket ${d.ozet}.`);
  }
}
