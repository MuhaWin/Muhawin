// Ofis ortak verisi (Görev 07) – yerel PostgreSQL ile: node test/ofis-veri-sunucu.mjs
// sunucu/supabase-ofis-veri.sql'in 1. bölümü (canlıdaki hâl) ve tamamı (güvenlik yaması) sınanır. Supabase'e bağlanmaz.
import { yerelPg } from './sunucu/yerel-pg.mjs';

const ok = [], bad = [];
const check = (c, m) => { (c ? ok : bad).push(m); console.log((c ? '  ✓ ' : '  ✗ ') + m); };
const PG = await yerelPg();
if (!PG) { console.log('PostgreSQL (initdb) bulunamadı: test atlandı.'); process.exit(0); }
const { sql, kullanici, sonuc, dosya } = PG;

const A = '00000000-0000-0000-0000-0000000000a1', C = '00000000-0000-0000-0000-0000000000c1';   // Ofis A: yönetici A, çalışan C
const B = '00000000-0000-0000-0000-0000000000b1', D = '00000000-0000-0000-0000-0000000000d1';   // Ofis B yöneticisi B; ofissiz D
const E = '00000000-0000-0000-0000-0000000000e1';                                                 // Ofis A'da devre dışı çalışan
const OA = '00000000-0000-0000-0000-00000000aaaa', OB = '00000000-0000-0000-0000-00000000bbbb';
const yaz = satirlar => `perform public.ofis_veri_yaz('${JSON.stringify(satirlar).replace(/'/g, "''")}'::jsonb)`;
const satir = (anahtar, ek = {}) => ({ tur: 'kural', firma: 'luca:12', anahtar, veri: { k: anahtar }, ...ek });
const durum = anahtar => sql(`select silindi from public.ofis_veri where anahtar = '${anahtar}'`);

const tum = dosya('sunucu/supabase-ofis-veri.sql');
const bolum1 = tum.split('-- ---------- 2. BÖLÜM')[0];

sql(dosya('test/sunucu/supabase-taklit.sql'));
sql(`insert into auth.users(id, email) values ('${A}','a@o.com'),('${B}','b@o.com'),('${C}','c@o.com'),('${D}','d@o.com'),('${E}','e@o.com');
insert into public.profiles(id, email, disabled) select id, email, id = '${E}' from auth.users;
insert into public.offices(id, name, owner) values ('${OA}', 'Ofis A', '${A}'), ('${OB}', 'Ofis B', '${B}');
insert into public.office_members(user_id, office_id, role) values ('${A}','${OA}','yonetici'),('${C}','${OA}','calisan'),('${E}','${OA}','calisan'),('${B}','${OB}','yonetici');`);

console.log('1. bölüm: canlıdaki hâl (yama öncesi)');
sql(bolum1);
check(sonuc(kullanici(A, yaz([satir('k1')]))) === 'OK', 'yönetici yazar');
check(sonuc(kullanici(C, yaz([satir('k1', { silindi: true })]))) === 'OK' && durum('k1') === 't', 'AÇIK: çalışan ofisin verisini silebiliyor (yama öncesi)');

console.log('Yama (iki kez çalıştırılır)');
sql(tum); sql(tum);
check(sql("select value #>> '{}' from public.settings where key = 'ofis_veri_silme'") === 'yonetici', "varsayılan silme ayarı 'yonetici'");

console.log('Okuma / yazma ve ofis ayrımı');
check(sonuc(kullanici(A, yaz([satir('k2'), satir('k3')]))) === 'OK', 'yönetici iki satır yazar');
check(sonuc(kullanici(C, yaz([satir('k2', { veri: { k: 'çalışan' } })]))) === 'OK', 'çalışan değiştirebilir (son yazan kazanır)');
const okunan = sql(`set role authenticated; select set_config('request.jwt.claim.sub', '${C}', false);
select jsonb_array_length(public.ofis_veri_degisenler(0, 1000)->'satirlar');`).split('\n').pop();
check(okunan === '3', 'çalışan ofisin satırlarını okur (k1, k2, k3)');
const bOkur = sql(`set role authenticated; select set_config('request.jwt.claim.sub', '${B}', false);
select jsonb_array_length(public.ofis_veri_degisenler(0, 1000)->'satirlar');`).split('\n').pop();
check(bOkur === '0', 'başka ofis (B) A ofisinin verisini göremez');
check(/Yetkisiz/.test(sonuc(kullanici(E, yaz([satir('k9')])))), 'devre dışı kullanıcı yazamaz');

console.log('Silme yetkisi');
check(/Silme yetkiniz yok/.test(sonuc(kullanici(C, yaz([satir('k2', { silindi: true })])))) && durum('k2') === 'f', "çalışan silemez ('yonetici' ayarında)");
check(/Silme yetkiniz yok/.test(sonuc(kullanici(C, yaz([satir('k3'), satir('k2', { silindi: true })])))), 'karışık istekte silme varsa istek bütünüyle reddedilir');
check(sonuc(kullanici(A, yaz([satir('k2', { silindi: true })]))) === 'OK' && durum('k2') === 't', 'yönetici siler');
check(sonuc(kullanici(D, yaz([satir('d1')]))) === 'OK' && sonuc(kullanici(D, yaz([satir('d1', { silindi: true })]))) === 'OK', 'ofissiz kullanıcı kendi verisini siler');
sql(`update public.settings set value = '"herkes"' where key = 'ofis_veri_silme'`);
check(sonuc(kullanici(C, yaz([satir('k3', { silindi: true })]))) === 'OK' && durum('k3') === 't', "'herkes' ayarında çalışan da siler");
sql(tum);
check(sql("select value #>> '{}' from public.settings where key = 'ofis_veri_silme'") === 'herkes', 'yama yeniden çalıştırılınca kullanıcının ayarı korunur');
sql(`update public.settings set value = '"yonetici"' where key = 'ofis_veri_silme'`);

console.log('Sınırlar');
const buyuk = Array.from({ length: 8 }, (_, i) => `{"tur":"kural","firma":"","anahtar":"b${i}","veri":"' || repeat('x', 2900000) || '"}`).join(',');
const r = sql(`set role authenticated; select set_config('request.jwt.claim.sub', '${A}', false);
do $t$ begin perform public.ofis_veri_yaz(('[${buyuk}]')::jsonb); raise notice 'SONUC:OK'; exception when others then raise notice 'SONUC:%', sqlerrm; end $t$;`, false);
check(/İstek çok büyük/.test(sonuc(r)), 'istek başına 20 MB sınırı (8 × 2,9 MB reddedilir)');
// A ofisinde k1–k3 var; 3 + 199.996 = 199.999 satır
sql(`insert into public.ofis_veri(sahip, tur, firma, anahtar, veri) select '${OA}', 'kural', 'doldur', g::text, '1' from generate_series(1, 199996) g`);
check(sonuc(kullanici(A, yaz([satir('s1')]))) === 'OK', 'sınırın altında yeni satır eklenir (200.000. satır)');
check(/veri sınırı doldu/.test(sonuc(kullanici(A, yaz([satir('s2')])))), 'sahip başına 200.000 satır sınırı');
check(sonuc(kullanici(A, yaz([satir('k1', { veri: { k: 'güncel' } })]))) === 'OK', 'sınır dolsa da mevcut satır güncellenir');

console.log('Yetkiler');
for (const f of ['ofis_veri_yaz(jsonb)', 'ofis_veri_degisenler(bigint, integer)']) {
  check(sql(`select has_function_privilege('anon', 'public.${f}', 'execute')`) === 'f', `anon public.${f} çağıramaz`);
  check(sql(`select has_function_privilege('authenticated', 'public.${f}', 'execute')`) === 't', `authenticated public.${f} çağırabilir`);
}
for (const f of ['_veri_sahibi(uuid)', '_veri_yetkili(uuid)', '_veri_silebilir(uuid)'])
  check(sql(`select has_function_privilege('authenticated', 'public.${f}', 'execute') or has_function_privilege('anon', 'public.${f}', 'execute')`) === 'f', `public.${f} istemciye kapalı`);
check(sql("select has_table_privilege('authenticated', 'public.ofis_veri', 'select')") === 'f', 'ofis_veri tablosu doğrudan okunamaz');

console.log(`\n${ok.length} geçti, ${bad.length} başarısız`);
process.exit(bad.length ? 1 : 0);
