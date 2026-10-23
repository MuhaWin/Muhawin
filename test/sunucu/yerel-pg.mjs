// Sunucu SQL testleri için geçici yerel PostgreSQL (Supabase'e bağlanılmaz).
// yerelPg() kümeyi açar ve { sql, kullanici, sonuc, dosya } döndürür; PostgreSQL yoksa null döner (test atlanır).
// root olarak çalışılıyorsa PostgreSQL postgres kullanıcısıyla başlatılır (initdb root'u reddeder).
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function pgBin() {
  const adaylar = [];
  try { for (const v of fs.readdirSync('/usr/lib/postgresql').sort().reverse()) adaylar.push(`/usr/lib/postgresql/${v}/bin`); } catch (e) {}
  for (const d of (process.env.PATH || '').split(path.delimiter)) adaylar.push(d);
  return adaylar.find(d => fs.existsSync(path.join(d, 'initdb')) && fs.existsSync(path.join(d, 'postgres')));
}

export async function yerelPg() {
  const BIN = pgBin();
  if (!BIN) return null;
  const root = process.getuid && process.getuid() === 0;
  const kos = (cmd, args, o = {}) => root ? execFileSync('runuser', ['-u', 'postgres', '--', cmd, ...args], o) : execFileSync(cmd, args, o);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mw-pg-'));
  if (root) execFileSync('chown', ['postgres', dir]);
  const data = path.join(dir, 'data');
  kos(path.join(BIN, 'initdb'), ['-D', data, '-U', 'postgres', '-A', 'trust', '--no-sync'], { stdio: 'ignore' });
  const pgArgs = ['-D', data, '-k', dir, '-c', 'listen_addresses=', '-c', 'fsync=off'];
  const pg = root ? spawn('runuser', ['-u', 'postgres', '--', path.join(BIN, 'postgres'), ...pgArgs], { stdio: 'ignore' })
                 : spawn(path.join(BIN, 'postgres'), pgArgs, { stdio: 'ignore' });
  process.on('exit', () => { try { pg.kill('SIGINT'); } catch (e) {} try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {} });

  const psqlYol = fs.existsSync(path.join(BIN, 'psql')) ? path.join(BIN, 'psql') : 'psql';
  // SQL'i çalıştırır; çıktıyı döndürür. hataDur=false ise NOTICE / ERROR (stderr) da çıktıya katılır.
  const sql = (metin, hataDur = true) => {
    const args = ['-h', dir, '-U', 'postgres', '-d', 'postgres', '-X', '-q', '-t', '-A', '-v', `ON_ERROR_STOP=${hataDur ? 1 : 0}`, '-f', '-'];
    const r = spawnSync(psqlYol, args, { input: metin, encoding: 'utf8' });
    if (hataDur && r.status !== 0) throw new Error(r.stderr + r.stdout);
    return hataDur ? r.stdout.trim() : (r.stdout + r.stderr).trim();
  };
  // kullanıcı olarak (auth.uid() = uid) tek ifade çalıştır; "OK" ya da hata metni döner
  const kullanici = (uid, ifade) => sql(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);
do $t$ begin ${ifade}; raise notice 'SONUC:OK'; exception when others then raise notice 'SONUC:%', sqlerrm; end $t$;`, false);
  const sonuc = cikti => (/SONUC:(.*)/.exec(cikti) || [])[1] || cikti;
  const dosya = p => fs.readFileSync(path.join(KOK, p), 'utf8');

  for (let i = 0; i < 60; i++) { try { sql('select 1'); break; } catch (e) { await new Promise(r => setTimeout(r, 250)); } }
  return { sql, kullanici, sonuc, dosya };
}
