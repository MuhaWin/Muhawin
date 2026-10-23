// Lisans ve ofis sıkılaştırma (Görev 15) – yerel PostgreSQL ile: node test/lisans-sunucu.mjs
// Supabase taklidi + depodaki supabase-moduller / ofis / yonetim SQL'leri, ardından sunucu/yama-15-lisans.sql (iki kez).
// Supabase'e bağlanmaz. PostgreSQL yoksa test "atlandı" yazar.
import { yerelPg } from './sunucu/yerel-pg.mjs';

const ok = [], bad = [];
const check = (c, m) => { (c ? ok : bad).push(m); console.log((c ? '  ✓ ' : '  ✗ ') + m); };
const PG = await yerelPg();
if (!PG) { console.log('PostgreSQL (initdb) bulunamadı: test atlandı.'); process.exit(0); }
const { sql, kullanici, sonuc, dosya } = PG;

// kullanıcı olarak tek değer döndüren sorgu
const deger = (uid, ifade) => sql(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);
select ${ifade};`, false).split('\n').pop();
const kisi = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const KOD = 'A'.repeat(50);                                   // biçimce geçerli, kayıtlı olmayan lisans kodu

sql(dosya('test/sunucu/supabase-kurulum-taklit.sql'));
for (const f of ['supabase-moduller.sql', 'supabase-ofis.sql', 'supabase-yonetim.sql']) sql(dosya('sunucu/' + f));
const kullanicilar = Array.from({ length: 12 }, (_, i) => kisi(i + 1));
sql(`insert into auth.users(id, email) values ${kullanicilar.map((u, i) => `('${u}', 'k${i + 1}@ornek.com')`).join(', ')};
insert into public.profiles(id, email) select id, email from auth.users;
update public.profiles set trial_start = now() - interval '10 days' where id = '${kisi(1)}';
update public.modules set active = true;`);
const modul = sql("select id from public.modules where id <> 'ekstre' order by id limit 1");

console.log('Yama öncesi (depodaki SQL)');
kullanici(kisi(1), `perform public.app_status('pc-1', 'PC', '2.9.13', '${modul}')`);
check(sql(`select public._module_status('${kisi(1)}', '${modul}')->>'valid'`) === 'true', `AÇIK (O4): denemesi bitmiş hesap yeni modül (${modul}) açınca yeniden deneme alıyor`);

console.log('Yama (iki kez)');
sql(dosya('sunucu/yama-15-lisans.sql')); sql(dosya('sunucu/yama-15-lisans.sql'));
check(sql("select value #>> '{}' from public.settings where key = 'ofis_kullanici_siniri'") === '10', 'ofis kullanıcı sınırı ayarı 10');

console.log('O4 – tek deneme');
const modul2 = sql(`select id from public.modules where id not in ('ekstre', '${modul}') order by id limit 1`);
sql(`delete from public.module_trials where user_id = '${kisi(1)}'`);
kullanici(kisi(1), `perform public.app_status('pc-1', 'PC', '2.9.13', '${modul2}')`);
check(sql(`select public._module_status('${kisi(1)}', '${modul2}')->>'valid'`) === 'false', `denemesi bitmiş hesap yeni modül (${modul2}) açınca deneme almaz`);
kullanici(kisi(2), `perform public.app_status('pc-2', 'PC', '2.9.13', '${modul2}')`);
check(sql(`select public._module_status('${kisi(2)}', '${modul2}')->>'valid'`) === 'true', 'yeni hesabın denemesi sürüyor');
sql(`update public.module_trials set trial_days = 30 where user_id = '${kisi(1)}' and module = '${modul2}'`);
check(sql(`select public._module_status('${kisi(1)}', '${modul2}')->>'valid'`) === 'true', 'yönetimin uzattığı deneme (module_trials) yine geçerli');

console.log('D8 – uzunluk sınırları, E5');
kullanici(kisi(3), `perform public.app_status('${'d'.repeat(300)}', '${'n'.repeat(300)}', '${'v'.repeat(80)}', null)`);
check(sql(`select max(length(device_id)) || '/' || max(length(name)) from public.devices where user_id = '${kisi(3)}'`) === '100/100'
  && sql(`select length(app_version) from public.profiles where id = '${kisi(3)}'`) === '30', 'cihaz kimliği / adı 100, sürüm 30 karakterle sınırlı');
check(/çok büyük/.test(sonuc(kullanici(kisi(3), `perform public.save_registration(jsonb_build_object('x', repeat('a', 30000)))`))), 'save_registration 20 KB üstünü reddeder');
check(sonuc(kullanici(kisi(3), `perform public.save_registration('{"unvan": "ÖRNEK"}'::jsonb)`)) === 'OK', 'normal kayıt bilgisi yazılır');

console.log('D2 – hatalı kod denemesi sınırı');
const gecersiz = [];
for (let i = 0; i < 10; i++) gecersiz.push(deger(kisi(4), `public.activate_code('${KOD}')->>'reason'`));
check(gecersiz.every(r => /geçersiz/.test(r)), '10 hatalı lisans kodu: "geçersiz"');
check(/Çok fazla hatalı deneme/.test(sonuc(kullanici(kisi(4), `perform public.activate_code('${KOD}')`))), '11. denemede 15 dakika bekleme');
check(/geçersiz/.test(deger(kisi(5), `public.activate_code('${KOD}')->>'reason'`)), 'sınır kullanıcı başına (başka hesap etkilenmez)');
sql(`update public.kod_denemeleri set zaman = zaman - interval '16 minutes' where user_id = '${kisi(4)}'`);
check(/geçersiz/.test(deger(kisi(4), `public.activate_code('${KOD}')->>'reason'`)), '15 dakika sonra yeniden denenebilir');
for (let i = 0; i < 10; i++) deger(kisi(6), `public.office_join('MW-AAAA-BBBB-CCCC')->>'reason'`);
check(/Çok fazla hatalı deneme/.test(sonuc(kullanici(kisi(6), `perform public.office_join('MW-AAAA-BBBB-CCCC')`))), 'davet kodunda da 10 hatalı deneme sınırı');

console.log('D3, O7 – davet ve ofis sınırı');
const y = kisi(7);
check(sonuc(kullanici(y, `perform public.office_create('Örnek Ofis', '12345')`)) === 'OK', 'ofis kuruldu (yönetici)');
const davet = e => deger(y, `public.office_invite('${e}', 'calisan')->>'code'`);
const kod8 = davet('k8@ornek.com');
const d3 = deger(kisi(9), `public.office_join('${kod8}')->>'reason'`);
check(!/k8@ornek\.com/.test(d3) && /başka bir e-posta/.test(d3), 'başka hesapta denenen davet kodu e-postayı açıklamaz (' + d3 + ')');
sql(`update public.settings set value = '3' where key = 'ofis_kullanici_siniri'`);
check(deger(kisi(8), `public.office_join('${kod8}')->>'ok'`) === 'true', '2. kullanıcı katıldı');
const kod9 = davet('k9@ornek.com'), kod10 = davet('k10@ornek.com');
check(deger(kisi(9), `public.office_join('${kod9}')->>'ok'`) === 'true', '3. kullanıcı katıldı (sınır 3)');
check(/sınırına \(3\)/.test(deger(kisi(10), `public.office_join('${kod10}')->>'reason'`)), 'sınır dolunca önceden üretilmiş davetle de katılınamaz');
check(/sınırına \(3\) ulaştınız/.test(sonuc(kullanici(y, `perform public.office_invite('k11@ornek.com', 'calisan')`))), 'sınır doluyken yeni davet üretilmez');
check(sql(`select count(*) from public.office_members where office_id = (select office_id from public.office_members where user_id = '${y}')`) === '3', 'ofiste 3 kullanıcı');

console.log('Yetkiler');
for (const f of ['_kod_deneme_kontrol(uuid, text)', '_kod_deneme_yaz(uuid, text)', '_ofis_siniri()'])
  check(sql(`select has_function_privilege('authenticated', 'public.${f}', 'execute') or has_function_privilege('anon', 'public.${f}', 'execute')`) === 'f', `public.${f} istemciye kapalı`);
for (const f of ['app_status(text, text, text, text)', 'activate_code(text)', 'office_join(text)', 'office_invite(text, text)', 'save_registration(jsonb)'])
  check(sql(`select has_function_privilege('anon', 'public.${f}', 'execute')`) === 'f' && sql(`select has_function_privilege('authenticated', 'public.${f}', 'execute')`) === 't', `public.${f}: anon kapalı, authenticated açık`);
check(sql("select has_table_privilege('authenticated', 'public.kod_denemeleri', 'select')") === 'f', 'kod_denemeleri tablosu doğrudan okunamaz');

console.log(`\n${ok.length} geçti, ${bad.length} başarısız`);
process.exit(bad.length ? 1 : 0);
