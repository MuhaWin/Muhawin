// Görev 41: ekran boyu × Windows ölçeklemesi matrisinde görsel çakışma ve yatay taşma ölçümü (sahte veri).
//   xvfb-run -a -s "-screen 0 3840x2160x24" node test/ekran.js            → tüm matris, özet ve görüntüler OUT klasörüne
//   EKRAN_OLCEK=1,1.5 EKRAN_EKRAN=moduller,banka node test/ekran.js       → yalnız seçilen ölçek / ekranlar
// Ölçekleme: Electron --force-device-scale-factor ile; pencere içi boyu CSS piksel (fiziksel ÷ ölçek).
// Çıkış kodu: çakışma ya da taşma varsa 1.
const { _electron: electron } = require('playwright');
const path = require('path'), fs = require('fs'), os = require('os');
const APP = process.env.MUHAWIN_APP || path.resolve(__dirname, '..');
const sb = require(path.join(APP, 'test', 'sahte_sb'));
const { cakisma } = require('./cakisma');
const OUT = process.env.OUT || path.join(os.tmpdir(), 'muhawin-ekran');
fs.mkdirSync(OUT, { recursive: true });

// [ad, CSS genişlik, CSS yükseklik] ölçeğe göre; ad fiziksel çözünürlüğü ve ölçeği söyler
const MATRIS = {
  1: [['1280x720', 1280, 720], ['1366x768', 1366, 768], ['1440x900', 1440, 900], ['1920x1080', 1920, 1080], ['2560x1440', 2560, 1440], ['980x640 (en küçük pencere)', 980, 640]],
  1.25: [['1920x1080@125%', 1536, 864]],
  1.5: [['1920x1080@150%', 1280, 720], ['3840x2160@150%', 2560, 1440]],
  2: [['3840x2160@200%', 1920, 1080]]
};
const SEC_OLCEK = (process.env.EKRAN_OLCEK || '').split(',').filter(Boolean).map(Number);
const SEC_EKRAN = (process.env.EKRAN_EKRAN || '').split(',').filter(Boolean);
const PY = fs.existsSync(path.join(APP, 'fk', '.venv', 'bin', 'python')) ? path.join(APP, 'fk', '.venv', 'bin', 'python') : 'python3';

async function ac(olcek, lisans) {
  const fake = await sb.start({ fatura: lisans ? 'bitti' : 'deneme', ekstre: lisans ? 'bitti' : 'lisansli' });
  const cfg = fs.mkdtempSync(path.join(os.tmpdir(), 'mw-'));
  const app = await electron.launch({ executablePath: require(path.join(APP, 'node_modules/electron')), args: [APP, '--no-sandbox', '--force-device-scale-factor=' + olcek],
    env: { ...process.env, EKSTRE_TEST_SB: fake.url, XDG_CONFIG_HOME: cfg, MUHAWIN_NO_SPLASH: '1' } });
  const w = await app.firstWindow();
  await w.waitForSelector('#authGate:not([hidden]) input[type=email]', { timeout: 20000 });
  return { app, w, fake, cfg };
}
async function giris(w) {
  const gb = await w.$('#authGate >> text=Zaten üyeyim, giriş yap'); if (gb) { await gb.click(); await w.waitForTimeout(300); }
  await w.fill('#authGate input[type=email]', 'test@ornek.com'); await w.fill('#authGate input[type=password]', 'Sifre1234');
  await w.click('#authGate .btn.primary'); await w.waitForSelector('#modGate:not([hidden]) .modcard', { timeout: 20000 });
}
const kapatDiyalog = async (w) => { for (const sel of ['#chooseModal:not([hidden]) #chBtns .btn:last-child', '#regModal:not([hidden]) [data-rgclose]']) { const b = await w.$(sel); if (b) { await b.click().catch(() => {}); await w.waitForTimeout(300); } } };
const modulAc = async (w, mod) => { if (!(await w.isVisible('#modGate'))) { await w.click('#modulesBtn'); await w.waitForSelector('#modGate:not([hidden])'); } await w.click(`.modcard[data-mod=${mod}]`); await w.waitForSelector('#modGate', { state: 'hidden' }); await w.waitForTimeout(600); await kapatDiyalog(w); };
const fkFrame = async (w) => (await w.waitForSelector('#fkFrame:not([hidden])', { timeout: 40000 })).contentFrame();

async function boyutla(app, w, cw, ch) {
  await app.evaluate(({ BrowserWindow }, [cw, ch]) => { const b = BrowserWindow.getAllWindows().find(x => x.getTitle() === 'MuhaWin') || BrowserWindow.getAllWindows()[0];
    if (b.isFullScreen()) b.setFullScreen(false); if (b.isMaximized()) b.unmaximize(); b.setContentSize(cw, ch); }, [cw, ch]);
  await w.waitForFunction(([cw, ch]) => Math.abs(innerWidth - cw) <= 2 && Math.abs(innerHeight - ch) <= 2, [cw, ch], { timeout: 5000 }).catch(() => {});
  await w.waitForTimeout(450);
}
async function olc(w, ekran) {
  // yatay kaydırma denetimi 1280 px ve üstü için (en küçük pencerede, 980 px, geniş tablolar kaydırılabilir)
  const yatay = ekran.yatay && await w.evaluate(() => innerWidth >= 1280);
  const ana = await w.evaluate(cakisma, yatay ? { kok: ekran.kok || null, yatay: ekran.yatay } : (ekran.kok || null));
  const sonuc = { cakisan: ana.cakisan, tasan: [...ana.tasan, ...ana.kesik.map(x => 'kesik metin: ' + x)], sayfaTasma: ana.sayfaTasma ? ['sayfa ' + ana.sayfaTasma] : [], n: ana.n, boy: await w.evaluate(() => innerWidth + '×' + innerHeight + ' @' + devicePixelRatio) };
  if (ekran.cerceve && await w.isVisible('#fkFrame')) {
    const fr = await fkFrame(w); const c = await fr.evaluate(cakisma, null);
    sonuc.cakisan.push(...c.cakisan.map(x => 'çerçeve: ' + x)); sonuc.tasan.push(...c.tasan.map(x => 'çerçeve: ' + x), ...c.kesik.map(x => 'çerçeve: kesik metin: ' + x)); if (c.sayfaTasma) sonuc.sayfaTasma.push('çerçeve ' + c.sayfaTasma); sonuc.n += c.n;
  }
  return sonuc;
}

// ekranlar; git() ekranı açar, kok yalnız o katmanı ölçer (açık pencere / tam ekran panel)
const EKRANLAR = [
  { ad: 'giris', kok: '#authGate', git: async () => {} },
  { ad: 'moduller', kok: '#modGate', git: async ({ w }) => { await giris(w); } },
  { ad: 'ayarlar', kok: '#regModal', git: async ({ w }) => { await w.click('#modSettings'); await w.waitForSelector('#regModal:not([hidden])'); await w.waitForTimeout(500); }, son: async ({ w }) => { await w.click('#regModal [data-rgclose]'); } },
  { ad: 'banka', git: async ({ w }) => { await modulAc(w, 'ekstre'); } },
  { ad: 'mizan', kok: '#mmPanel', git: async ({ w }) => { await w.click('#mmBtn'); await w.waitForSelector('#mmPanel:not([hidden])'); await w.waitForTimeout(400); }, son: async ({ w }) => { await w.click('#mmClose'); } },
  { ad: 'belgeden-fis', git: async ({ w }) => { await modulAc(w, 'okc'); } },
  { ad: 'muhasebe-toplu', cerceve: true, git: async ({ w }) => { await modulAc(w, 'fatura'); const fr = await fkFrame(w); await fr.waitForSelector('#sekmeler', { timeout: 20000 }); await w.waitForTimeout(800); } },
  { ad: 'muhasebe-tek', cerceve: true, git: async ({ w }) => { await w.click('#fkNav [data-fksayfa=tek]'); const fr = await fkFrame(w); await fr.waitForSelector('#program', { timeout: 20000 }); await w.waitForTimeout(800); } },
  { ad: 'muhasebe-kdv', cerceve: true, git: async ({ w }) => { await w.click('#fkNav [data-fksayfa=kdv]'); await fkFrame(w); await w.waitForTimeout(1200); } },
  { ad: 'luca-kaydet', kok: '#fkKayit', yatay: ['#fkKayit .mmwrap'], git: async ({ w, cfg }) => {
    await w.click('#fkNav [data-fksayfa=toplu]'); const fr = await fkFrame(w); await fr.waitForSelector('#sekmeler', { timeout: 20000 });
    const hd = fs.readdirSync(path.join(cfg, 'MuhaWin', 'hesaplar')).map(d => path.join(cfg, 'MuhaWin', 'hesaplar', d, 'fatura_kontrol')).find(d => fs.existsSync(d));
    const k = path.join(hd, 'firmalar', 'EXPO İNŞ', '2026', '09'); fs.mkdirSync(k, { recursive: true });
    fs.writeFileSync(path.join(hd, 'firmalar', 'EXPO İNŞ', 'firma.json'), JSON.stringify({ ad: 'EXPO İNŞ', vkn: '3810463613', luca_id: '11' }));
    require('child_process').execFileSync(PY, ['-c', `
import sys, zipfile; sys.path.insert(0, ${JSON.stringify(path.join(APP, 'fk', 'tests'))}); sys.path.insert(0, ${JSON.stringify(path.join(APP, 'fk'))})
from test_luca_otomasyon import muavin_yaz, ubl, FIRMA_VKN
from pathlib import Path
k = Path(${JSON.stringify(k)}); muavin_yaz(k / 'muavin.xlsx')
with zipfile.ZipFile(k / 'faturalar.zip', 'w') as z:
    UZUN = ['ÖRNEK İNŞAAT TAAHHÜT SANAYİ VE TİCARET LİMİTED ŞİRKETİ', 'ANTALYA AKARYAKIT OTOMOTİV TURİZM GIDA PAZARLAMA ANONİM ŞİRKETİ', 'KISA LTD']
    KALEM = ['Ofis kırtasiye malzemesi, A4 fotokopi kağıdı 80 gr (koli) ve toner', 'Motorin (Euro Diesel) — araç yakıt alımı', 'Danışmanlık hizmet bedeli']
    for i in range(1, 9):
        no = 'YYY2026%09d' % (100 + i)
        mat = '1234567.89' if i % 3 == 0 else '500.00'; kdv = '246913.58' if i % 3 == 0 else '100.00'
        x = ubl(no, '2026-09-%02d' % i, str(10000000000 + i) if i % 2 else str(1000 + i), FIRMA_VKN, mat, kdv, 20).decode()
        sat = str(10000000000 + i) if i % 2 else str(1000 + i)
        x = x.replace('<cbc:Name>SATICI %s</cbc:Name>' % sat, '<cbc:Name>%s</cbc:Name>' % UZUN[i % 3])
        x = x.replace('</Invoice>', '<cac:InvoiceLine><cbc:ID>1</cbc:ID><cbc:InvoicedQuantity unitCode="C62">1</cbc:InvoicedQuantity><cbc:LineExtensionAmount currencyID="TRY">%s</cbc:LineExtensionAmount><cac:Item><cbc:Name>%s</cbc:Name></cac:Item></cac:InvoiceLine></Invoice>' % (mat, KALEM[i % 3]))
        z.writestr('gib_efatura_alis/%s.xml' % no, x.encode())
`]);
    await w.evaluate(async () => { const { Store } = window.__app;
      await Store.saveFirm({ id: 'kf1', name: 'EXPO İNŞ', lucaId: '11', banks: [], mizanInfo: { source: 'luca', year: '2026', at: new Date().toISOString(), parts: 1 } });
      await Store.saveMizan('kf1', [['191', 'İNDİRİLECEK KDV'], ['191.10.20', '%20 İndirilecek KDV'], ['320', 'SATICILAR'], ['320.01', 'SATICI 1'], ['770', 'GENEL YÖNETİM GİDERLERİ'], ['770.01', 'KIRTASİYE']]); });
    await fr.evaluate(() => window.top.postMessage({ fk: true, tip: 'faturaKaydet', id: 'EXPO İNŞ/2026/09' }, '*'));
    await w.waitForSelector('#fkKayit:not([hidden]) #fkkTable tbody tr[data-i]', { timeout: 30000 });
    if (await w.isVisible('#mwBusy')) await w.click('#mwBusyIptal').catch(() => {});
    await w.waitForTimeout(800); } },
  { ad: 'lisans', kok: '#licGate', lisans: true, git: async ({ w }) => { await giris(w); await w.click('.modcard[data-mod=fatura]'); await w.waitForSelector('#licGate:not([hidden])'); await w.waitForTimeout(300); } }
];

(async () => {
  const rapor = []; let hata = 0;
  for (const olcek of Object.keys(MATRIS).map(Number).filter(o => !SEC_OLCEK.length || SEC_OLCEK.includes(o))) {
    for (const lisans of [false, true]) {
      const ekr = EKRANLAR.filter(e => !!e.lisans === lisans && (!SEC_EKRAN.length || SEC_EKRAN.includes(e.ad)));
      if (!ekr.length) continue;
      const s = await ac(olcek, lisans);
      try {
        for (const e of EKRANLAR.filter(e => !!e.lisans === lisans)) {
          const sec = ekr.includes(e);
          try { await e.git(s); } catch (x) { rapor.push({ olcek, ekran: e.ad, hata: 'açılamadı: ' + x.message.split('\n')[0] }); hata++; continue; }
          if (!sec) { if (e.son) await e.son(s).catch(() => {}); continue; }
          const boylar = [...MATRIS[olcek]];
          for (const [bad, cw, ch] of boylar) {
            await boyutla(s.app, s.w, cw, ch);
            const r = await olc(s.w, e); const sorun = r.cakisan.length + r.tasan.length + r.sayfaTasma.length;
            if (sorun) hata++;
            const dosya = `${e.ad}_${bad.replace(/[^0-9a-z@x%]+/gi, '-').replace(/-+$/, '')}.png`;
            if (sorun || process.env.EKRAN_FOTO) await s.w.screenshot({ path: path.join(OUT, dosya) }).catch(() => {});
            rapor.push({ olcek, ekran: e.ad, boy: bad, css: r.boy, n: r.n, cakisan: r.cakisan, tasan: r.tasan, sayfaTasma: r.sayfaTasma, foto: sorun ? dosya : undefined });
          }
          // büyütülmüş (ekranı kaplayan) ve tam ekran pencere
          const ekranBoy = await s.app.evaluate(({ screen }) => screen.getPrimaryDisplay().size);
          for (const bad of ekranBoy.width >= 1536 && ekranBoy.height >= 864 ? ['büyütülmüş', 'tam ekran'] : []) {   // küçük sanal ekranda anlamsız
            await s.app.evaluate(({ BrowserWindow, screen }, bad) => { const b = BrowserWindow.getAllWindows()[0];
              if (bad === 'tam ekran') b.setFullScreen(true); else { b.maximize(); if (!b.isMaximized()) b.setBounds(screen.getPrimaryDisplay().workArea); } }, bad);
            await s.w.waitForTimeout(700);
            const r = await olc(s.w, e); const sorun = r.cakisan.length + r.tasan.length + r.sayfaTasma.length; if (sorun) hata++;
            const dosya = `${e.ad}_${olcek}_${bad.replace(/\s+/g, '-')}.png`;
            if (sorun || process.env.EKRAN_FOTO) await s.w.screenshot({ path: path.join(OUT, dosya) }).catch(() => {});
            rapor.push({ olcek, ekran: e.ad, boy: bad + ' @' + olcek, css: r.boy, n: r.n, cakisan: r.cakisan, tasan: r.tasan, sayfaTasma: r.sayfaTasma, foto: sorun ? dosya : undefined });
          }
          await s.app.evaluate(({ BrowserWindow }) => { const b = BrowserWindow.getAllWindows()[0]; if (b.isFullScreen()) b.setFullScreen(false); });
          await s.w.waitForTimeout(500);
          if (e.son) await e.son(s).catch(() => {});
        }
      } finally { await s.app.close().catch(() => {}); s.fake.server.close(); }
    }
  }
  fs.writeFileSync(path.join(OUT, 'ozet.json'), JSON.stringify(rapor, null, 1));
  for (const r of rapor) {
    const sorun = (r.cakisan || []).length + (r.tasan || []).length + (r.sayfaTasma || []).length;
    console.log((r.hata ? '✗ ' : sorun ? '✗ ' : '✓ ') + r.ekran + ' · ' + (r.boy || '') + (r.css ? ' (' + r.css + ', ' + r.n + ' öğe)' : '') + (r.hata ? ' ' + r.hata : ''));
    for (const x of [...(r.sayfaTasma || []), ...(r.tasan || []).map(t => 'taşma: ' + t), ...(r.cakisan || []).slice(0, 12).map(c => 'çakışma: ' + c)]) console.log('    ' + x);
    if ((r.cakisan || []).length > 12) console.log('    … ' + (r.cakisan.length - 12) + ' çakışma daha');
  }
  console.log(hata ? `\n${hata} ölçümde sorun var · ${OUT}` : `\nsorun yok · ${OUT}`);
  process.exit(hata ? 1 : 0);
})();
