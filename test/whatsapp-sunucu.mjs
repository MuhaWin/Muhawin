// WhatsApp sunucu güvenliği (Görev 06) – yerel PostgreSQL ile: node test/whatsapp-sunucu.mjs
// Supabase'e bağlanmaz. Geçici bir PostgreSQL kümesi açılır; auth.uid() ve roller taklit edilir (test/sunucu/supabase-taklit.sql),
// ardından depodaki sunucu/supabase-whatsapp.sql ve sunucu/yama-06-whatsapp.sql yüklenir.
// PostgreSQL (initdb) bulunamazsa test "atlandı" yazar ve 0 ile çıkar.
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ok = [], bad = [];
const check = (c, m) => { (c ? ok : bad).push(m); console.log((c ? '  ✓ ' : '  ✗ ') + m); };

function pgBin() {
  const adaylar = [];
  try { for (const v of fs.readdirSync('/usr/lib/postgresql').sort().reverse()) adaylar.push(`/usr/lib/postgresql/${v}/bin`); } catch (e) {}
  for (const d of (process.env.PATH || '').split(path.delimiter)) adaylar.push(d);
  return adaylar.find(d => fs.existsSync(path.join(d, 'initdb')) && fs.existsSync(path.join(d, 'postgres')));
}
const BIN = pgBin();
if (!BIN) { console.log('PostgreSQL (initdb) bulunamadı: test atlandı.'); process.exit(0); }

// root olarak çalışıyorsak PostgreSQL'i postgres kullanıcısıyla başlat (initdb root'u reddeder)
const root = process.getuid && process.getuid() === 0;
const kos = (cmd, args, o = {}) => root ? execFileSync('runuser', ['-u', 'postgres', '--', cmd, ...args], o) : execFileSync(cmd, args, o);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mw-pg-'));
if (root) execFileSync('chown', ['postgres', dir]);
const data = path.join(dir, 'data');
kos(path.join(BIN, 'initdb'), ['-D', data, '-U', 'postgres', '-A', 'trust', '--no-sync'], { stdio: 'ignore' });
const pgArgs = ['-D', data, '-k', dir, '-c', 'listen_addresses=', '-c', 'fsync=off'];
const pg = root ? spawn('runuser', ['-u', 'postgres', '--', path.join(BIN, 'postgres'), ...pgArgs], { stdio: 'ignore' })
               : spawn(path.join(BIN, 'postgres'), pgArgs, { stdio: 'ignore' });
const kapat = () => { try { pg.kill('SIGINT'); } catch (e) {} };
process.on('exit', () => { kapat(); try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {} });

const psqlYol = fs.existsSync(path.join(BIN, 'psql')) ? path.join(BIN, 'psql') : 'psql';
// SQL'i çalıştırır; çıktı satırlarını döndürür. hataDur=false ise hata da çıktıya katılır.
function sql(metin, hataDur = true) {
  const args = ['-h', dir, '-U', 'postgres', '-d', 'postgres', '-X', '-q', '-t', '-A', '-v', `ON_ERROR_STOP=${hataDur ? 1 : 0}`, '-f', '-'];
  const r = spawnSync(psqlYol, args, { input: metin, encoding: 'utf8' });
  if (hataDur && r.status !== 0) throw new Error(r.stderr + r.stdout);
  return hataDur ? r.stdout.trim() : (r.stdout + r.stderr).trim();      // NOTICE / ERROR stderr'e yazılır
}
const dosya = p => fs.readFileSync(path.join(KOK, p), 'utf8');
// kullanıcı olarak (auth.uid() = uid) tek ifade çalıştır; "OK" ya da hata metni döner
function kullanici(uid, ifade) {
  return sql(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);
do $t$ begin ${ifade}; raise notice 'SONUC:OK'; exception when others then raise notice 'SONUC:%', sqlerrm; end $t$;`, false);
}
const sonuc = cikti => (/SONUC:(.*)/.exec(cikti) || [])[1] || cikti;

const A = '00000000-0000-0000-0000-0000000000a1', B = '00000000-0000-0000-0000-0000000000b1', C = '00000000-0000-0000-0000-0000000000c1';
const OA = '00000000-0000-0000-0000-00000000aaaa', OB = '00000000-0000-0000-0000-00000000bbbb';

(async () => {
  for (let i = 0; i < 60; i++) { try { sql('select 1'); break; } catch (e) { await new Promise(r => setTimeout(r, 250)); } }

  console.log('Kurulum (WhatsApp yokken yama)');
  sql(dosya('test/sunucu/supabase-taklit.sql'));
  const y0 = sql(dosya('sunucu/yama-06-whatsapp.sql'), false);
  check(!/ERROR/.test(y0), 'WhatsApp kurulu değilken yama hatasız çalışır (WhatsApp kısmı atlanır)');
  check(sql("select has_function_privilege('anon', 'public._is_admin()', 'execute')") === 'f', '_is_admin anon için kapalı (D1)');

  sql(dosya('sunucu/supabase-whatsapp.sql'));
  sql(`insert into auth.users(id, email) values ('${A}', 'a@ornek.com'), ('${B}', 'b@ornek.com'), ('${C}', 'c@ornek.com');
insert into public.offices(id, name, owner) values ('${OA}', 'Ofis A', '${A}'), ('${OB}', 'Ofis B', '${B}');
insert into public.office_members(user_id, office_id, role) values ('${A}', '${OA}', 'yonetici'), ('${B}', '${OB}', 'yonetici'), ('${C}', '${OA}', 'calisan');`);

  for (const [ad, yukle] of [['supabase-whatsapp.sql', false], ['yama-06 (iki kez)', true]]) {
    console.log(`Y2 – numara bağlama (${ad})`);
    if (yukle) { sql(dosya('sunucu/yama-06-whatsapp.sql')); sql(dosya('sunucu/yama-06-whatsapp.sql')); sql('truncate public.wa_numaralar'); }
    check(sonuc(kullanici(A, "perform public.wa_numara_bagla('105550001', '+90 555 000 01')")) === 'OK', 'A ofisi numarasını bağlar');
    const r = sonuc(kullanici(B, "perform public.wa_numara_bagla('105550001', 'saldırgan')"));
    check(/başka bir ofise bağlı/.test(r), 'B ofisi A\'nın numarasını taşıyamaz → hata');
    check(sql("select office_id || '|' || display_phone from public.wa_numaralar where phone_number_id = '105550001'") === `${OA}|+90 555 000 01`, 'numara A ofisinde kaldı, adı değişmedi');
    check(sonuc(kullanici(A, "perform public.wa_numara_bagla('105550001', '+90 555 000 99')")) === 'OK', 'aynı ofis yeniden bağlayabilir');
    check(sql("select display_phone from public.wa_numaralar where phone_number_id = '105550001'") === '+90 555 000 99', 'yeniden bağlamada görünen ad güncellendi');
    check(/Yalnız ofis yöneticisi/.test(sonuc(kullanici(C, "perform public.wa_numara_bagla('105550002', 'x')"))), 'çalışan numara bağlayamaz');
    check(/Geçersiz Phone number ID/.test(sonuc(kullanici(A, "perform public.wa_numara_bagla('abc''; --', 'x')"))), 'geçersiz Phone number ID reddedilir');
  }

  console.log('D1 – yetkiler');
  for (const f of ['wa_bekleyenler()', 'wa_alindi(uuid[])', 'wa_numara_bagla(text, text)', 'wa_numaram()']) {
    check(sql(`select has_function_privilege('anon', 'public.${f}', 'execute')`) === 'f', `anon public.${f} çağıramaz`);
    check(sql(`select has_function_privilege('authenticated', 'public.${f}', 'execute')`) === 't', `authenticated public.${f} çağırabilir`);
  }
  check(sql("select has_function_privilege('anon', 'public._is_admin()', 'execute')") === 'f', '_is_admin anon için kapalı (yama sonrası)');

  console.log(`\n${ok.length} geçti, ${bad.length} başarısız`);
  process.exit(bad.length ? 1 : 0);
})().catch(e => { console.error('✗ HATA', e.message); process.exit(1); });
