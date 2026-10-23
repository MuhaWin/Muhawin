// Modül lisans kodu üretici.
//   node tools/kod_uret.js <modül> <adet> [gün] [parti] [çıktı klasörü]
//   örn: node tools/kod_uret.js fatura 1000 365 fatura-ilk-1000 ./gizli
// Çıktı:
//   GIZLI-<modül>-lisans-kodlari-<adet>.csv   → kodların kendisi (yalnız sizde kalır, müşteriye tek tek verilir)
//   <modül>-kodlari-<adet>.sql                → yalnız SHA-256 özetleri; Supabase SQL Editor'da çalıştırılır
// Kod 50 karakterdir (I, L, O, U kullanılmaz; sunucu bunları 1/1/0/V sayar), 5'erli gruplarla yazılır.
'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const [mod, adetS, gunS, parti, out] = process.argv.slice(2);
if (!/^[a-z]+$/.test(mod || '') || !(+adetS > 0)) { console.error('Kullanım: node tools/kod_uret.js <modül> <adet> [gün=365] [parti] [klasör=.]'); process.exit(1); }
const adet = +adetS, gun = +(gunS || 365), batch = parti || `${mod}-${adet}`, dir = out || '.';
const ALFABE = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';          // 32 karakter
function kod() {
  const b = crypto.randomBytes(50); let s = '';
  for (let i = 0; i < 50; i++) s += ALFABE[b[i] & 31];
  return s;
}
const kodlar = new Set();
while (kodlar.size < adet) kodlar.add(kod());
fs.mkdirSync(dir, { recursive: true });
const grupla = k => k.match(/.{5}/g).join('-');
const csv = ['sira;modul;gun;kod', ...[...kodlar].map((k, i) => `${i + 1};${mod};${gun};${grupla(k)}`)].join('\r\n');
const sql = [`-- ${mod} modülü: ${adet} lisans kodu (${gun} gün), parti ${batch}. Yalnız özetler; kodların kendisi CSV'de.`,
  'insert into public.license_codes(code_hash, days, batch, module) values',
  [...kodlar].map(k => `('${crypto.createHash('sha256').update(k).digest('hex')}', ${gun}, '${batch}', '${mod}')`).join(',\n'),
  'on conflict (code_hash) do nothing;',
  `select module, count(*) as kod_sayisi from public.license_codes group by module order by module;`].join('\n');
const csvF = path.join(dir, `GIZLI-${mod}-lisans-kodlari-${adet}.csv`), sqlF = path.join(dir, `${mod}-kodlari-${adet}.sql`);
fs.writeFileSync(csvF, '﻿' + csv); fs.writeFileSync(sqlF, sql + '\n');
console.log('Yazıldı:', csvF, sqlF);
