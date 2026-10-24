// Site için program ekran görüntüleri (YALNIZ SAHTE VERİ: test/sahte_sb.js, uydurma firmalar ve VKN'ler; Luca bağlantısı taklit).
//   xvfb-run -a -s "-screen 0 3840x2160x24" node tools/site-gorsel.js [çıkış klasörü]
// Pencere 1440×900 (CSS px), %200 ölçekle çekilir: <ad>@2x.webp (2880×1800) ve küçültülmüş <ad>.png (1440×900).
// Varsayılan çıkış: web/site/gorsel/  (program-anasayfa, program-banka, program-toplu, program-mizan, program-kaydet)
const { _electron: electron } = require('playwright');
const path = require('path'), fs = require('fs'), os = require('os'), cp = require('child_process');
const APP = path.resolve(__dirname, '..');
const sb = require(path.join(APP, 'test', 'sahte_sb'));
const OUT = path.resolve(process.argv[2] || path.join(APP, 'web', 'site', 'gorsel'));
const PY = fs.existsSync(path.join(APP, 'fk', '.venv', 'bin', 'python')) ? path.join(APP, 'fk', '.venv', 'bin', 'python') : 'python3';
// Görev 54: GORSEL_BOY=1366x768 GORSEL_OLCEK=1 ile başka boyda; GORSEL_EK=<dosya.js> çekimden önce sayfada (ve Fatura Kontrol
// çerçevesinde) çalıştırılır (önce/sonra taslakları); GORSEL_ONEK dosya adlarının önüne eklenir; GORSEL_PNG=1 yalnız PNG (küçültmeden)
const [GEN, YUK] = (process.env.GORSEL_BOY || '1440x900').split('x').map(Number), OLCEK = +(process.env.GORSEL_OLCEK || 2);
const EK = process.env.GORSEL_EK ? fs.readFileSync(path.resolve(process.env.GORSEL_EK), 'utf8') : '', ONEK = process.env.GORSEL_ONEK || '';
fs.mkdirSync(OUT, { recursive: true });
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mw-gorsel-'));
const py = kod => cp.execFileSync(PY, ['-c', kod], { stdio: ['ignore', 'pipe', 'inherit'] }).toString();

// çekilen 2x görüntüden: 2x WebP ve 1x PNG (boyut sınırı ~400 KB)
function kaydet(ham, ad) {
  ad = ONEK + ad;
  if (process.env.GORSEL_PNG) { py(`
from PIL import Image
Image.open(${JSON.stringify(ham)}).convert('RGB').save(${JSON.stringify(path.join(OUT, ad + '.png'))}, optimize=True)
`); console.log('  ' + ad + '.png  ' + Math.round(fs.statSync(path.join(OUT, ad + '.png')).size / 1024) + ' KB'); return; }
  py(`
from PIL import Image
im = Image.open(${JSON.stringify(ham)}).convert('RGB')
im.save(${JSON.stringify(path.join(OUT, ad + '@2x.webp'))}, 'WEBP', quality=82, method=6)
k = im.resize((${GEN}, ${YUK}), Image.LANCZOS)
k.quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(${JSON.stringify(path.join(OUT, ad + '.png'))}, optimize=True)
`);
  for (const f of [ad + '.png', ad + '@2x.webp']) console.log('  ' + f + '  ' + Math.round(fs.statSync(path.join(OUT, f)).size / 1024) + ' KB');
}

(async () => {
  const fake = await sb.start({ fatura: 'lisansli', ekstre: 'lisansli' });
  const cfg = fs.mkdtempSync(path.join(os.tmpdir(), 'mw-'));
  const app = await electron.launch({ executablePath: require(path.join(APP, 'node_modules/electron')), args: [APP, '--no-sandbox', '--force-device-scale-factor=' + OLCEK],
    env: { ...process.env, EKSTRE_TEST_SB: fake.url, XDG_CONFIG_HOME: cfg, MUHAWIN_NO_SPLASH: '1' } });
  const w = await app.firstWindow();
  const cek = async ad => {
    if (EK) { const r = await w.evaluate(EK).catch(e => console.error('ek: ' + e.message)); if (typeof r === 'string' && r) console.log(r); const fe = await w.$('#fkFrame:not([hidden])'); const f = fe && await fe.contentFrame(); if (f) await f.evaluate(EK).catch(e => console.error('ek (çerçeve): ' + e.message)); }
    await w.waitForTimeout(700); const ham = path.join(TMP, ad + '.png'); await w.screenshot({ path: ham }); console.log(ad); kaydet(ham, ad); };
  try {
    await app.evaluate(({ BrowserWindow }, [g, y]) => { const b = BrowserWindow.getAllWindows()[0]; if (b.isMaximized()) b.unmaximize(); b.setContentSize(g, y); }, [GEN, YUK]);
    // Luca bağlı görünsün (taklit; gerçek Luca'ya bağlanılmaz)
    await app.evaluate(({ ipcMain }) => { for (const ch of ['luca-status']) ipcMain.removeHandler(ch); ipcMain.handle('luca-status', () => ({ loggedIn: true })); });
    await w.waitForSelector('#authGate:not([hidden]) input[type=email]', { timeout: 20000 });
    const gb = await w.$('#authGate >> text=Zaten üyeyim, giriş yap'); if (gb) { await gb.click(); await w.waitForTimeout(300); }
    await w.fill('#authGate input[type=email]', 'ornek@ornek-musavirlik.com'); await w.fill('#authGate input[type=password]', 'Sifre1234');
    await w.click('#authGate .btn.primary'); await w.waitForSelector('#modGate:not([hidden]) .modcard', { timeout: 20000 });
    await w.waitForFunction(() => innerWidth === 1440, null, { timeout: 5000 }).catch(() => {});

    // ---- sahte firmalar ----
    await w.evaluate(async () => { const { Store } = window.__app; const now = new Date().toISOString();
      const firmalar = [['f1', 'DEMO TİCARET A.Ş.'], ['f2', 'ÖRNEK GIDA LTD. ŞTİ.'], ['f3', 'DENEME YAPI İNŞAAT LTD.'], ['f4', 'MAVİ TEKSTİL A.Ş.'], ['f5', 'KUZEY OTOMOTİV LTD.']];
      for (const [id, name] of firmalar) await Store.saveFirm({ id, name, lucaId: String(900 + +id.slice(1)), createdAt: now,
        banks: id === 'f1' ? [{ label: 'ÖRNEK BANK TL', code: '102.01.001' }] : [], askiIn: '399.99', askiOut: '199.99', mizanInfo: { source: 'luca', year: '2026', at: now, parts: 1 } });
      await Store.saveMizan('f1', [['100', 'KASA', 48250, 31120], ['100.01', 'MERKEZ KASA', 48250, 31120], ['102', 'BANKALAR', 812400, 655300], ['102.01.001', 'ÖRNEK BANK TL', 812400, 655300],
        ['120', 'ALICILAR', 640500, 512000], ['120.01', 'ALFA MAĞAZACILIK', 240500, 190000], ['120.02', 'BETA MARKET', 400000, 322000], ['153', 'TİCARİ MALLAR', 420000, 0], ['153.01', 'TİCARİ MALLAR', 420000, 0],
        ['191', 'İNDİRİLECEK KDV', 84000, 0], ['191.10.20', '%20 İNDİRİLECEK KDV', 84000, 0], ['320', 'SATICILAR', 380000, 455000], ['320.01', 'GAMA TOPTAN', 180000, 230000], ['320.02', 'DELTA LOJİSTİK', 200000, 225000], ['320.03', 'ÖRNEK ELEKTRİK PERAKENDE', 9800, 9800], ['320.04', 'ÖRNEK İLETİŞİM HİZMETLERİ', 4200, 4200], ['320.05', 'YOL AKARYAKIT', 10000, 10000],
        ['335', 'PERSONELE BORÇLAR', 96000, 96000], ['335.01', 'PERSONEL ÜCRETLERİ', 96000, 96000], ['360', 'ÖDENECEK VERGİ VE FONLAR', 18000, 21400], ['360.01', 'MUHTASAR', 18000, 21400],
        ['391', 'HESAPLANAN KDV', 0, 128100], ['391.10.20', '%20 HESAPLANAN KDV', 0, 128100], ['600', 'YURTİÇİ SATIŞLAR', 0, 640500], ['600.01', 'YURTİÇİ SATIŞLAR', 0, 640500],
        ['760', 'PAZARLAMA SATIŞ DAĞITIM GİDERLERİ', 12600, 0], ['760.01', 'NAKLİYE GİDERLERİ', 12600, 0], ['770', 'GENEL YÖNETİM GİDERLERİ', 61800, 0], ['770.01', 'KİRA GİDERLERİ', 36000, 0], ['770.02', 'ELEKTRİK SU DOĞALGAZ', 9800, 0], ['770.03', 'HABERLEŞME', 4200, 0], ['770.04', 'BANKA MASRAFLARI', 1800, 0], ['770.05', 'AKARYAKIT', 10000, 0]]);
      for (const r of [{ k: 'KİRA', dir: 'out', acc: '770.01', ld: 'Kira ödemesi' }, { k: 'ELEKTRİK', dir: 'out', acc: '770.02' }, { k: 'GSM', dir: 'out', acc: '770.03' },
        { k: 'MASRAF', dir: 'out', acc: '770.04' }, { k: 'ALFA MAĞAZA', dir: 'in', acc: '120.01' }, { k: 'BETA MARKET', dir: 'in', acc: '120.02' }, { k: 'GAMA TOPTAN', dir: 'out', acc: '320.01' },
        { k: 'DELTA LOJ', dir: 'out', acc: '320.02' }, { k: 'MAAŞ', dir: 'out', acc: '335.01' }, { k: 'MUHTASAR', dir: 'out', acc: '360.01' }, { k: 'AKARYAKIT', dir: 'out', acc: '770.05' }])
        await Store.addRule('f1', { id: 'r' + Math.random().toString(36).slice(2, 8), ...r, createdAt: now });
    });

    // 1) ana sayfa / modül seçimi
    await w.evaluate(() => { const p = document.getElementById('modWho'); if (p) p.textContent = 'Çalışmak istediğiniz modülü seçin.'; });
    await cek('program-anasayfa');

    // 2) Banka: ekstre (Excel) yüklenmiş, kurallarla eşleşmiş satırlar
    const ex = path.join(TMP, 'Ornek_Bank_1234567_Eylul.xlsx');
    py(`from openpyxl import Workbook
wb = Workbook(); ws = wb.active; ws.append(['Tarih', 'Açıklama', 'Tutar', 'Bakiye']); b = 125000.0
for d, a, t in [('01.09.2026', 'EFT GELEN ALFA MAĞAZACILIK FT 2026-118', 48500.00), ('02.09.2026', 'KİRA ÖDEMESİ EYLÜL MERKEZ OFİS', -18000.00),
                ('03.09.2026', 'HAVALE GELEN BETA MARKET A.Ş.', 72250.00), ('04.09.2026', 'ELEKTRİK FATURASI OTOMATİK ÖDEME', -4920.40),
                ('05.09.2026', 'EFT GAMA TOPTAN GIDA SAN. TİC.', -36400.00), ('08.09.2026', 'GSM FATURA ÖDEMESİ', -1180.25),
                ('09.09.2026', 'HESAP İŞLETİM MASRAFI', -95.00), ('10.09.2026', 'MAAŞ ÖDEMESİ EYLÜL 2026', -48000.00),
                ('12.09.2026', 'EFT GELEN ALFA MAĞAZACILIK FT 2026-131', 31200.00), ('15.09.2026', 'DELTA LOJİSTİK NAKLİYE BEDELİ', -12600.00),
                ('16.09.2026', 'AKARYAKIT POS ÖDEMESİ', -3450.80), ('18.09.2026', 'GELEN HAVALE ZETA DANIŞMANLIK', 9600.00),
                ('22.09.2026', 'MUHTASAR VE SGK ÖDEMESİ', -21400.00), ('25.09.2026', 'HAVALE GELEN BETA MARKET A.Ş.', 54800.00),
                ('29.09.2026', 'EFT MASRAFI', -12.50), ('30.09.2026', 'POS TAHSİLAT VALÖR', 18420.00)]:
    b += t; ws.append([d, a, t, round(b, 2)])
wb.save(${JSON.stringify(ex)})`);
    await w.evaluate(async () => { await window.__app.selectFirm('f1'); });
    await w.click('.modcard[data-mod=ekstre]'); await w.waitForSelector('#modGate', { state: 'hidden' }); await w.waitForTimeout(800);
    for (const sel of ['#chooseModal:not([hidden]) #chBtns .btn:last-child', '#regModal:not([hidden]) [data-rgclose]']) { const b = await w.$(sel); if (b) { await b.click().catch(() => {}); await w.waitForTimeout(300); } }
    await w.evaluate(async () => { await window.__app.selectFirm('f1'); }); await w.waitForTimeout(500);
    await w.setInputFiles('#fileIn', ex); await w.waitForTimeout(2000);
    for (const sel of ['#chooseModal:not([hidden]) #chBtns .btn:last-child']) { const b = await w.$(sel); if (b) { await b.click().catch(() => {}); await w.waitForTimeout(300); } }
    // tabloyu göster: "Hareketler ve Karşı Hesaplar" kartı üstte
    await w.evaluate(() => { const st = document.getElementById('storeState'); if (st) st.textContent = '';
      const h = [...document.querySelectorAll('h2,h3,.card *')].find(x => /Hareketler ve Karşı Hesaplar/.test(x.textContent) && x.children.length < 3);
      const k = h && (h.closest('section,.card') || h); if (k) { k.scrollIntoView({ block: 'start' }); window.scrollBy(0, -12); } });
    await w.mouse.move(5, 5);
    await cek('program-banka');

    // 3) Muhasebe › Toplu Kontrol: birkaç firmanın sonuçları (sahte özet)
    await w.click('#modulesBtn'); await w.waitForSelector('#modGate:not([hidden])'); await w.click('.modcard[data-mod=fatura]');
    const fe = await w.waitForSelector('#fkFrame:not([hidden])', { timeout: 40000 }); let fr = await fe.contentFrame(); await fr.waitForSelector('#sekmeler', { timeout: 20000 });
    const hd = fs.readdirSync(path.join(cfg, 'MuhaWin', 'hesaplar')).map(d => path.join(cfg, 'MuhaWin', 'hesaplar', d, 'fatura_kontrol')).find(d => fs.existsSync(d));
    const tk = path.join(hd, 'toplu', '2026-09'); fs.mkdirSync(tk, { recursive: true });
    const adim = d => [['giris', 'Luca girişi'], ['firma', 'Firma seçimi'], ['muavin', 'Muavin indirme'], ['fatura', 'E-fatura indirme'], ['kontrol', 'Kontrol']].map(([kod, ad]) => ({ kod, ad, durum: d, ayrinti: '' }));
    const satir = (id, ad, vkn, durum, fatura, sorunlar) => ({ ad, id, vkn, durum, fatura, sorunlar, indirme_hatasi: [], rapor: null, rapor_id: null, sure: 40 + fatura % 30, zaman: '2026-10-03T09:' + String(10 + fatura % 40).padStart(2, '0') + ':00', adimlar: adim('tamam') });
    fs.writeFileSync(path.join(tk, 'ozet.json'), JSON.stringify({ bas: '2026-09-01', bit: '2026-09-30', sonuclar: [
      satir('901', 'DEMO TİCARET A.Ş.', '1111111114', 'Sorun var', 142, { 'Muavinde yok': 3, 'Tutar farkı': 1 }),
      satir('902', 'ÖRNEK GIDA LTD. ŞTİ.', '2222222224', 'Temiz', 87, {}),
      satir('903', 'DENEME YAPI İNŞAAT LTD.', '3333333339', 'Sorun var', 64, { 'Muavinde yok': 2, 'Yanlış KDV oranı hesabı': 1, 'Mükerrer kayıt': 1 }),
      satir('904', 'MAVİ TEKSTİL A.Ş.', '4444444444', 'Temiz', 118, {}),
      satir('905', 'KUZEY OTOMOTİV LTD.', '5555555553', 'Temiz', 53, {})] }, null, 1));
    await w.click('#fkNav [data-fksayfa=tek]'); await w.waitForTimeout(800); await w.click('#fkNav [data-fksayfa=toplu]');
    fr = await (await w.waitForSelector('#fkFrame:not([hidden])')).contentFrame(); await fr.waitForSelector('#sekmeler', { timeout: 20000 }); await w.waitForTimeout(2500);
    await w.mouse.move(5, 5);
    await cek('program-toplu');

    // 4) Mizan / Muavin / Hesap Planı (muavin açık): sahte Luca muavin dökümü
    const mk = path.join(hd, 'firmalar', 'DEMO TİCARET A.Ş.', '2026', '09'); fs.mkdirSync(mk, { recursive: true });
    fs.writeFileSync(path.join(hd, 'firmalar', 'DEMO TİCARET A.Ş.', 'firma.json'), JSON.stringify({ ad: 'DEMO TİCARET A.Ş.', vkn: '1111111114', luca_id: '901' }));
    py(`from datetime import datetime as D
import openpyxl
wb = openpyxl.Workbook(); ws = wb.active
for r in [("MUAVİN DEFTER",), ("DEMO TİCARET A.Ş.",), ("Dönem :", "01/01/2026-31/12/2026"), ("Tarih Aralığı :", "01/09/2026-30/09/2026")]: ws.append(r)
def hesap(baslik, satirlar):
    ws.append((baslik,)); ws.append(("TARİH", "TİP", "FİŞ NO", "AÇIKLAMA", "BORÇ", "ALACAK", "BAKİYE", "B/A")); b = 0
    for t, tip, no, ac, bo, al in satirlar:
        b += (bo or 0) - (al or 0); ws.append((D(2026, 9, t), tip, no, ac, bo, al, abs(b), "B" if b >= 0 else "A"))
hesap("320.01 GAMA TOPTAN", [(3, "Mahsup", "112", "03/09/2026-GTA2026000000418-GAMA TOPTAN", None, 21600), (5, "Mahsup", "118", "EFT GAMA TOPTAN GIDA", 36400, None),
    (11, "Mahsup", "131", "11/09/2026-GTA2026000000452-GAMA TOPTAN", None, 14880), (19, "Mahsup", "147", "19/09/2026-GTA2026000000477-GAMA TOPTAN", None, 9420), (26, "Mahsup", "162", "26/09/2026-GTA2026000000501-GAMA TOPTAN", None, 18240)])
hesap("120.01 ALFA MAĞAZACILIK", [(1, "Mahsup", "101", "EFT GELEN ALFA MAĞAZACILIK", None, 48500), (8, "Mahsup", "124", "08/09/2026-DMT2026000000231-ALFA MAĞAZACILIK", 37800, None),
    (12, "Mahsup", "133", "EFT GELEN ALFA MAĞAZACILIK", None, 31200), (17, "Mahsup", "144", "17/09/2026-DMT2026000000247-ALFA MAĞAZACILIK", 52440, None), (24, "Mahsup", "158", "24/09/2026-DMT2026000000260-ALFA MAĞAZACILIK", 29160, None)])
hesap("770.01 KİRA GİDERLERİ", [(2, "Mahsup", "104", "KİRA ÖDEMESİ EYLÜL MERKEZ OFİS", 18000, None), (30, "Mahsup", "171", "DEPO KİRASI EYLÜL", 6000, None)])
wb.save(${JSON.stringify(path.join(mk, 'muavin.xlsx'))})`);
    await w.evaluate(async () => { await window.__app.selectFirm('f1'); }); await w.waitForTimeout(500);
    await w.click('#mmBtn'); await w.waitForSelector('#mmPanel:not([hidden])'); await w.waitForTimeout(800);
    await w.click('[data-mmtab=muavin]'); await w.waitForTimeout(1500);
    await w.mouse.move(5, 5);
    await cek('program-mizan');
    await w.click('#mmClose').catch(() => {});

    // 5) Faturaları Luca'ya kaydet: sahte e-faturalar (kurallı / kuralsız)
    if (!process.env.KAYDET_YOK) {
      const fk = path.join(hd, 'firmalar', 'DEMO TİCARET A.Ş.', '2026', '09');
      py(`import sys, zipfile; sys.path.insert(0, ${JSON.stringify(path.join(APP, 'fk', 'tests'))}); sys.path.insert(0, ${JSON.stringify(path.join(APP, 'fk'))})
from test_luca_otomasyon import ubl
from pathlib import Path
F = [('GTA2026000000418', '2026-09-03', '6111111110', 'GAMA TOPTAN GIDA SAN. TİC. A.Ş.', '18000.00', 'Gıda ürünleri (koli)'),
     ('DLJ2026000001203', '2026-09-06', '6222222228', 'DELTA LOJİSTİK TAŞIMACILIK LTD. ŞTİ.', '10500.00', 'Nakliye hizmet bedeli'),
     ('EPS2026000077120', '2026-09-08', '6333333332', 'ÖRNEK ELEKTRİK PERAKENDE SATIŞ A.Ş.', '4100.33', 'Elektrik tüketim bedeli'),
     ('TCL2026000452210', '2026-09-10', '6444444446', 'ÖRNEK İLETİŞİM HİZMETLERİ A.Ş.', '983.54', 'Mobil hat kullanım bedeli'),
     ('AKY2026000019876', '2026-09-16', '6555555554', 'YOL AKARYAKIT PETROL ÜRÜNLERİ LTD.', '2875.67', 'Motorin'),
     ('GTA2026000000452', '2026-09-11', '6111111110', 'GAMA TOPTAN GIDA SAN. TİC. A.Ş.', '12400.00', 'Gıda ürünleri (koli)')]
# GORSEL_FATURA=n: liste uzun görünsün diye aynı satıcılardan uydurma ek faturalar (Görev 54 görselleri)
for k in range(len(F), ${+(process.env.GORSEL_FATURA || 0)}):
    no, t, vkn, ad, mat, kalem = F[k % 6]
    F.append((no[:3] + '20260000%05d' % (900 + k), '2026-09-%02d' % (k % 28 + 1), vkn, ad, '%.2f' % (float(mat) * (1 + k % 5 / 10)), kalem))
with zipfile.ZipFile(Path(${JSON.stringify(fk)}) / 'faturalar.zip', 'w') as z:
    for no, t, vkn, ad, mat, kalem in F:
        kdv = '%.2f' % (float(mat) * 0.2)
        x = ubl(no, t, vkn, '1111111114', mat, kdv, 20).decode().replace('<cbc:Name>SATICI %s</cbc:Name>' % vkn, '<cbc:Name>%s</cbc:Name>' % ad)
        x = x.replace('</Invoice>', '<cac:InvoiceLine><cbc:ID>1</cbc:ID><cbc:InvoicedQuantity unitCode="C62">1</cbc:InvoicedQuantity><cbc:LineExtensionAmount currencyID="TRY">%s</cbc:LineExtensionAmount><cac:Item><cbc:Name>%s</cbc:Name></cac:Item></cac:InvoiceLine></Invoice>' % (mat, kalem))
        z.writestr('gib_efatura_alis/%s.xml' % no, x.encode())`);
      fr = await (await w.waitForSelector('#fkFrame:not([hidden])')).contentFrame();
      await fr.evaluate(() => window.top.postMessage({ fk: true, tip: 'faturaKaydet', id: 'DEMO TİCARET A.Ş./2026/09' }, '*'));
      await w.waitForSelector('#fkKayit:not([hidden]) #fkkTable tbody tr[data-i]', { timeout: 30000 });
      if (await w.isVisible('#mwBusy')) await w.click('#mwBusyIptal').catch(() => {});
      // gider hesapları (kullanıcının yazacağı gibi)
      const H = { GTA: '153.01', DLJ: '760.01', EPS: '770.02', TCL: '770.03', AKY: '770.05' };
      for (const i of await w.$$eval('#fkkTable tbody tr[data-i]', t => t.map(x => x.dataset.i))) {
        const belge = await w.$eval(`#fkkTable tr[data-i="${i}"] .fk-tb .note`, x => x.textContent.trim()); const h = H[belge.slice(0, 3)]; if (!h) continue;
        await w.fill(`[data-h="${i}"]`, h); await w.dispatchEvent(`[data-h="${i}"]`, 'change'); await w.waitForTimeout(250); }
      await w.evaluate(() => { document.activeElement && document.activeElement.blur(); const m = document.querySelector('#fkKayit .mmwrap'); if (m) m.scrollTop = 0; });
      await w.waitForTimeout(1200); await w.mouse.move(5, 5);
      await cek('program-kaydet');
    }
  } catch (e) { console.error('HATA', e.message.split('\n')[0]); await w.screenshot({ path: path.join(TMP, 'hata.png') }).catch(() => {}); console.error('hata görüntüsü: ' + path.join(TMP, 'hata.png')); process.exitCode = 1; }
  finally { await app.close().catch(() => {}); fake.server.close(); }
})();
