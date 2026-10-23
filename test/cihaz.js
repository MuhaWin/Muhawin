// Cihaz kimliği (Görev 15, rapor-02 O6): cihaz.json bilgisayara bağlı. node test/cihaz.js
// Sahte Supabase (test/sahte_sb.js) app_status'a gelen p_device değerlerini kaydeder.
const fs = require('fs');
const os = require('os');
const path = require('path');
const sb = require('./sahte_sb');
const { makeCloud } = require('../cloud');

const ok = [], bad = [];
const check = (c, m) => { (c ? ok : bad).push(m); console.log((c ? '  ✓ ' : '  ✗ ') + m); };

(async () => {
  const fake = await sb.start();
  const giris = async dir => { const c = makeCloud(dir, { _testUrl: fake.url }); await c.login({ email: 'test@ornek.com', password: 'Sifre1234' }); return fake.state.cihazlar[fake.state.cihazlar.length - 1]; };
  const oku = dir => JSON.parse(fs.readFileSync(path.join(dir, 'cihaz.json'), 'utf8'));
  try {
    const a = fs.mkdtempSync(path.join(os.tmpdir(), 'mw-cihaz-'));
    const id1 = await giris(a);
    const d1 = oku(a);
    check(id1 && id1 === d1.id && /^[0-9a-f]{32}$/.test(d1.makine), 'ilk girişte cihaz kimliği ve bilgisayar özeti yazıldı');
    check(await giris(a) === id1, 'aynı bilgisayarda kimlik değişmez');

    const b = fs.mkdtempSync(path.join(os.tmpdir(), 'mw-cihaz-'));
    fs.writeFileSync(path.join(b, 'cihaz.json'), JSON.stringify({ id: 'eski-surum-kimligi', created: '2026-01-01T00:00:00Z' }));
    check(await giris(b) === 'eski-surum-kimligi' && oku(b).makine === d1.makine, 'eski sürümün dosyası bu bilgisayarı benimser, kimlik korunur (cihaz sınırına takılmaz)');

    const c = fs.mkdtempSync(path.join(os.tmpdir(), 'mw-cihaz-'));
    fs.writeFileSync(path.join(c, 'cihaz.json'), JSON.stringify({ id: 'baska-bilgisayardan-kopya', makine: '0'.repeat(32) }));
    const id3 = await giris(c);
    check(id3 && id3 !== 'baska-bilgisayardan-kopya' && oku(c).makine === d1.makine, 'başka bilgisayardan kopyalanan dosya: yeni cihaz kimliği üretilir');
    check(!JSON.stringify(oku(a)).includes(fs.existsSync('/etc/machine-id') ? fs.readFileSync('/etc/machine-id', 'utf8').trim() || '§' : '§'), 'bilgisayar kimliğinin kendisi değil yalnız özeti saklanır');
  } catch (e) { bad.push('HATA: ' + e.message); console.error(e); }
  finally { fake.server.close(); }
  console.log(`\n${ok.length} geçti, ${bad.length} başarısız`);
  process.exit(bad.length ? 1 : 0);
})();
