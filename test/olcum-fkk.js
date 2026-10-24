// Görev 34: "Faturaları Luca'ya kaydet" ekranında üst bölüm ve fatura listesi yüksekliği (1366×768). Sahte veri.
// xvfb-run -a node test/olcum-fkk.js <çıktı.png>    (MUHAWIN_APP ile başka bir çalışma kopyası ölçülebilir)
const { _electron: electron } = require('playwright');
const path = require('path'), fs = require('fs'), os = require('os');
const APP = process.env.MUHAWIN_APP || path.resolve(__dirname, '..');
const sb = require(path.join(APP, 'test', 'sahte_sb'));
const PNG = process.argv[2] || path.join(os.tmpdir(), 'fkk.png');
(async () => {
  const fake = await sb.start({ fatura: 'deneme', ekstre: 'lisansli' });
  const cfg = fs.mkdtempSync(path.join(os.tmpdir(), 'mw-'));
  const app = await electron.launch({ executablePath: require(path.join(APP, 'node_modules/electron')), args: [APP, '--no-sandbox'],
    env: { ...process.env, EKSTRE_TEST_SB: fake.url, XDG_CONFIG_HOME: cfg, MUHAWIN_NO_SPLASH: '1' } });
  let sonuc = null;
  try {
    const w = await app.firstWindow();
    await app.evaluate(({ BrowserWindow }) => { const b = BrowserWindow.getAllWindows()[0]; b.setContentSize(1366, 768); });
    await w.waitForSelector('#authGate:not([hidden]) input[type=email]', { timeout: 15000 });
    const gb = await w.$('#authGate >> text=Zaten üyeyim, giriş yap'); if (gb) { await gb.click(); await w.waitForTimeout(300); }
    await w.fill('#authGate input[type=email]', 'test@ornek.com'); await w.fill('#authGate input[type=password]', 'Sifre1234');
    await w.click('#authGate .btn.primary'); await w.waitForSelector('#modGate:not([hidden]) .modcard', { timeout: 15000 });
    await w.click('.modcard[data-mod=fatura]');
    const fe = await w.waitForSelector('#fkFrame:not([hidden])', { timeout: 40000 });
    const fr = await fe.contentFrame(); await fr.waitForSelector('#sekmeler', { timeout: 20000 });
    const hd = fs.readdirSync(path.join(cfg, 'MuhaWin', 'hesaplar')).map(d => path.join(cfg, 'MuhaWin', 'hesaplar', d, 'fatura_kontrol')).find(d => fs.existsSync(d));
    const k = path.join(hd, 'firmalar', 'EXPO İNŞ', '2026', '09'); fs.mkdirSync(k, { recursive: true });
    fs.writeFileSync(path.join(hd, 'firmalar', 'EXPO İNŞ', 'firma.json'), JSON.stringify({ ad: 'EXPO İNŞ', vkn: '3810463613', luca_id: '11' }));
    require('child_process').execFileSync(path.join(__dirname, '..', 'fk', '.venv', 'bin', 'python'), ['-c', `
import sys, zipfile; sys.path.insert(0, ${JSON.stringify(path.join(APP, 'fk', 'tests'))}); sys.path.insert(0, ${JSON.stringify(path.join(APP, 'fk'))})
from test_luca_otomasyon import muavin_yaz, ubl, FIRMA_VKN
from pathlib import Path
k = Path(${JSON.stringify(k)}); muavin_yaz(k / 'muavin.xlsx')
with zipfile.ZipFile(k / 'faturalar.zip', 'w') as z:
    for i in range(1, 31):
        no = 'YYY2026%09d' % (100 + i)
        z.writestr('gib_efatura_alis/%s.xml' % no, ubl(no, '2026-09-%02d' % min(i, 28), str(1000 + i), FIRMA_VKN, '500.00', '100.00', 20))
`]);
    // mizanda gider / cari hesabı yok: öneriler boş gelir, "hesaplar boş" uyarısı görünür
    await w.evaluate(async () => { const { Store } = window.__app;
      await Store.saveFirm({ id: 'kf1', name: 'EXPO İNŞ', lucaId: '11', banks: [], mizanInfo: { source: 'luca', year: '2026', at: new Date().toISOString(), parts: 1 } });
      await Store.saveMizan('kf1', [['191', 'İNDİRİLECEK KDV'], ['191.10.20', '%20 İndirilecek KDV']]); });
    await fr.evaluate(() => window.top.postMessage({ fk: true, tip: 'faturaKaydet', id: 'EXPO İNŞ/2026/09' }, '*'));
    await w.waitForSelector('#fkKayit:not([hidden]) #fkkTable tbody tr[data-i]', { timeout: 30000 });
    if (await w.isVisible('#mwBusy')) { await w.click('#mwBusyIptal').catch(() => {}); }
    await w.waitForTimeout(800);
    sonuc = await w.evaluate(() => { const h = s => { const e = document.querySelector(s); return e ? Math.round(e.getBoundingClientRect().height) : 0; };
      return { pencere: innerHeight, ust: h('#fkKayit .mmtop'), cubuk: h('#fkkBar'), liste: h('#fkKayit .mmwrap'), satir: document.querySelectorAll('#fkkTable tbody tr[data-i]').length,
        uyari: !!document.querySelector('.fkk-hatir, .fkk-ipucu'), dugme: !!document.getElementById('fkkCek') }; });
    await w.screenshot({ path: PNG });
  } catch (e) { console.error('HATA', e.message); }
  finally { await app.close().catch(() => {}); fake.server.close(); }
  console.log(JSON.stringify(sonuc));
  process.exit(sonuc ? 0 : 1);
})();
