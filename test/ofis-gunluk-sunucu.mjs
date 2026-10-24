// Yama 51 (Görev 51) – yerel PostgreSQL ile: node test/ofis-gunluk-sunucu.mjs
// Silme yetkisi herkese açık; işlem günlüğü (ofis_gunluk) ofis bazında, yalnız ekleme, silinemez. Supabase'e bağlanmaz.
import { yerelPg } from './sunucu/yerel-pg.mjs';

const ok = [], bad = [];
const check = (c, m) => { (c ? ok : bad).push(m); console.log((c ? '  ✓ ' : '  ✗ ') + m); };
const PG = await yerelPg();
if (!PG) { console.log('PostgreSQL (initdb) bulunamadı: test atlandı.'); process.exit(0); }
const { sql, kullanici, sonuc, dosya } = PG;

const A = '00000000-0000-0000-0000-0000000000a1', C = '00000000-0000-0000-0000-0000000000c1';   // Ofis A: yönetici A, çalışan C
const B = '00000000-0000-0000-0000-0000000000b1', D = '00000000-0000-0000-0000-0000000000d1';   // Ofis B yöneticisi B; ofissiz D
const OA = '00000000-0000-0000-0000-00000000aaaa', OB = '00000000-0000-0000-0000-00000000bbbb';
const js = v => `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
const oku = (uid, suz = {}, lim = 200) => JSON.parse(sql(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);
select public.ofis_gunluk_liste(${js(suz)}, ${lim});`).split('\n').pop());

sql(dosya('test/sunucu/supabase-taklit.sql'));
sql(`insert into auth.users(id, email) values ('${A}','a@o.com'),('${B}','b@o.com'),('${C}','c@o.com'),('${D}','d@o.com');
insert into public.profiles(id, email, disabled) select id, email, false from auth.users;
insert into public.offices(id, name, owner) values ('${OA}', 'Ofis A', '${A}'), ('${OB}', 'Ofis B', '${B}');
insert into public.office_members(user_id, office_id, role) values ('${A}','${OA}','yonetici'),('${C}','${OA}','calisan'),('${B}','${OB}','yonetici');`);
sql(dosya('sunucu/supabase-ofis-veri.sql'));

console.log('Yama 51 (iki kez çalıştırılır)');
sql(dosya('sunucu/yama-51-ofis-veri.sql')); sql(dosya('sunucu/yama-51-ofis-veri.sql'));
check(sql("select value #>> '{}' from public.settings where key = 'ofis_veri_silme'") === 'herkes', "silme ayarı 'herkes'");
const yaz = s => `perform public.ofis_veri_yaz(${js(s)})`;
check(sonuc(kullanici(A, yaz([{ tur: 'kural', firma: 'f1', anahtar: 'k1', veri: { k: 'KİRA' } }]))) === 'OK', 'yönetici kural yazar');
check(sonuc(kullanici(C, yaz([{ tur: 'kural', firma: 'f1', anahtar: 'k1', silindi: true }]))) === 'OK'
  && sql("select silindi from public.ofis_veri where anahtar = 'k1'") === 't', 'çalışan kural silebilir');

console.log('İşlem günlüğü');
const g = (uid, kayitlar) => sonuc(kullanici(uid, `perform public.ofis_gunluk_yaz(${js(kayitlar)})`));
check(g(C, [{ id: 'c-1', tur: 'kural_ekle', firma: 'DEMO A.Ş.', ozet: 'KİRA → 770.01', zaman: '2026-10-24T10:00:00Z', cihaz: 'OFIS-PC' },
  { id: 'c-2', tur: 'luca_kayit', firma: 'DEMO A.Ş.', ozet: '3 fiş', ayrinti: { fis: [101, 102, 103] } }]) === 'OK', 'çalışan iki kayıt yazar');
check(g(C, [{ id: 'c-1', tur: 'kural_ekle', firma: 'DEMO A.Ş.', ozet: 'tekrar' }]) === 'OK' && sql("select count(*) from public.ofis_gunluk where istemci_id = 'c-1'") === '1', 'aynı kayıt kuyruktan iki kez gelirse tek kayıt');
check(g(A, [{ id: 'a-1', tur: 'fis_sil', firma: 'ÖRNEK LTD.', ozet: 'Fiş 0143 silindi' }]) === 'OK', 'yönetici kayıt yazar');
check(g(B, [{ id: 'b-1', tur: 'sorgu', firma: 'B FİRMA', ozet: 'Eylül' }]) === 'OK', 'başka ofis kayıt yazar');
check(/Geçersiz/.test(g(A, [{ tur: 'Kötü Tür!' }])), 'geçersiz tür reddedilir');
let L = oku(C);
check(L.kayitlar.length === 3 && L.kayitlar[0].tur === 'fis_sil' && L.kayitlar.every(x => x.eposta), 'ofisteki herkes ofisin kayıtlarını görür (yeniden eskiye, e-postalı): ' + L.kayitlar.map(x => x.tur).join(','));
check(oku(B).kayitlar.length === 1 && oku(B).kayitlar[0].firma === 'B FİRMA', 'başka ofis A ofisinin günlüğünü göremez');
check(oku(A, { eposta: 'c@o.com' }).kayitlar.length === 2 && oku(A, { tur: 'fis_sil' }).kayitlar.length === 1 && oku(A, { firma: 'demo' }).kayitlar.length === 2 && oku(A, { ara: '0143' }).kayitlar.length === 1,
  'süzgeçler: kullanıcı, işlem türü, firma, arama');
check(oku(A, {}, 2).devam === true && oku(A, {}, 2).kayitlar.length === 2, 'sayfalama (devam)');
check(oku(A).kayitlar.find(x => x.tur === 'kural_ekle').yerel_zaman && oku(A).kayitlar.find(x => x.tur === 'luca_kayit').ayrinti.fis.length === 3, 'yerel zaman ve ayrıntı saklanır');

console.log('Silinemez');
check(/değiştirilemez ve silinemez/.test(sql(`delete from public.ofis_gunluk`, false)), 'tablo sahibi (yönetici paneli) bile silemez');
check(/değiştirilemez ve silinemez/.test(sql(`update public.ofis_gunluk set ozet = 'x'`, false)), 'güncellenemez');
check(sql("select has_table_privilege('authenticated', 'public.ofis_gunluk', 'select') or has_table_privilege('authenticated', 'public.ofis_gunluk', 'delete')") === 'f', 'tablo istemciye kapalı (yalnız RPC)');
for (const f of ['ofis_gunluk_yaz(jsonb)', 'ofis_gunluk_liste(jsonb, integer, bigint)'])
  check(sql(`select has_function_privilege('anon', 'public.${f}', 'execute')`) === 'f' && sql(`select has_function_privilege('authenticated', 'public.${f}', 'execute')`) === 't', `public.${f}: yalnız giriş yapmış kullanıcı`);

console.log('Görünüm ayarı');
sql(`update public.settings set value = '"yonetici"' where key = 'ofis_gunluk_gorunum'`);
check(oku(C).kayitlar.length === 2 && oku(C).kayitlar.every(x => x.eposta === 'c@o.com') && oku(A).kayitlar.length === 3, "'yonetici' ayarında çalışan yalnız kendi kayıtlarını, yönetici tümünü görür");
check(g(D, [{ id: 'd-1', tur: 'banka', ozet: 'ofissiz' }]) === 'OK' && oku(D).kayitlar.length === 1, 'ofissiz kullanıcı kendi günlüğünü görür');

console.log(`\n${ok.length} geçti, ${bad.length} başarısız`);
process.exit(bad.length ? 1 : 0);
