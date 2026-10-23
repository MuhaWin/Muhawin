#!/usr/bin/env node
/* MuhaWin tanıtım sitesi: web/site/surum.json dosyasını üretir.
   Sürüm ve indirme deposu package.json'dan, sürüm notları OKUBENI.txt'deki "x.y.z YENİLİKLER" bölümlerinden alınır.
   Kullanım:  node tools/site_uret.js [kaç sürüm, varsayılan 8] */
'use strict';
const fs = require('fs');
const path = require('path');

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

function modulleriOku(metin) {
  const ilk = metin.split(/\r?\n/)[0] || '';
  const m = /Modüller:\s*(.*)$/.exec(ilk);
  if (!m) return { moduller: [], yakinda: [] };
  const yakindaM = /\(yakında:\s*([^)]*)\)/.exec(m[1]);
  const ayir = s => s.split('·').map(x => x.trim()).filter(Boolean);
  return { moduller: ayir(m[1].replace(/\(yakında:[^)]*\)/, '')), yakinda: yakindaM ? ayir(yakindaM[1]) : [] };
}

function uret(adet = 8) {
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
    notlar: notlariOku(okubeni, adet),
    uretildi: new Date().toISOString().slice(0, 10),
  };
}

module.exports = { notlariOku, modulleriOku, uret };

if (require.main === module) {
  const veri = uret(parseInt(process.argv[2], 10) || 8);
  const hedef = path.join(KOK, 'web', 'site', 'surum.json');
  fs.writeFileSync(hedef, JSON.stringify(veri, null, 2) + '\n');
  console.log(`${path.relative(KOK, hedef)} yazıldı: MuhaWin ${veri.surum}, ${veri.notlar.length} sürüm notu.`);
}
