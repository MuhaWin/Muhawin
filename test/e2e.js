// MuhaWin uçtan uca (Linux, xvfb):  xvfb-run -a node test/e2e.js
// giriş → modül seçimi → Ekstre / Fatura Kontrol (ayrı lisans, deneme, kod) → firma eşitleme → çıkış
const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const sb = require('./sahte_sb');

const APP = process.env.MUHAWIN_APP || path.resolve(__dirname, '..');
const OUT = process.env.OUT || path.join(os.tmpdir(), 'muhawin-e2e');
fs.mkdirSync(OUT, { recursive: true });
const get = (url, headers = {}) => new Promise(res => { http.get(url, { headers }, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => res({ status: r.statusCode, body: b })); }).on('error', e => res({ status: 0, body: String(e) })); });

async function oturum(fatura, o = {}) {
  const fake = await sb.start({ fatura, admin: !!o.admin, ekstre: o.ekstre || 'lisansli' });
  const cfg = fs.mkdtempSync(path.join(os.tmpdir(), 'mw-'));
  fs.mkdirSync(path.join(cfg, 'Ekstre Luca', 'hesaplar', 'x'), { recursive: true });
  fs.writeFileSync(path.join(cfg, 'Ekstre Luca', 'hesaplar', 'x', 'hesap.txt'), 'eski@ornek.com');
  const app = await electron.launch({
    executablePath: require(path.join(APP, 'node_modules/electron')),
    args: [APP, '--no-sandbox'],
    env: { ...process.env, EKSTRE_TEST_SB: fake.url, XDG_CONFIG_HOME: cfg, MUHAWIN_NO_SPLASH: '1' }
  });
  const w = await app.firstWindow();
  global.__csp = global.__csp || []; w.on('console', m => { if (/Content Security Policy|Refused to (execute|load)/i.test(m.text())) global.__csp.push(m.text().slice(0, 160)); });
  await w.waitForLoadState('domcontentloaded');
  await w.waitForSelector('#authGate:not([hidden]) input[type=email]', { timeout: 15000 });
  if (!global.__authFoto) { global.__authFoto = 1; await w.waitForTimeout(600); await w.screenshot({ path: OUT + '/0-giris.png' }); global.__authUpd = await w.isVisible('#updBtnAuth'); }
  const gb = await w.$('#authGate >> text=Zaten üyeyim, giriş yap'); if (gb) { await gb.click(); await w.waitForTimeout(300); }
  await w.fill('#authGate input[type=email]', o.email || 'test@ornek.com');
  await w.fill('#authGate input[type=password]', 'Sifre1234');
  await w.click('#authGate .btn.primary');
  await w.waitForSelector('#modGate:not([hidden]) .modcard', { timeout: 15000 });
  return { app, w, fake, cfg };
}

(async () => {
  const ok = [], bad = [];
  const check = (c, m) => (c ? ok : bad).push(m);
  // ---------------- 1. senaryo: yeni Fatura modülü (deneme başlar) ----------------
  let s = await oturum('yeni');
  let { app, w, fake, cfg } = s;
  try {
    check(await w.title() === 'MuhaWin', 'pencere başlığı MuhaWin');
    check(global.__authUpd, 'giriş ekranında Güncellemeleri Denetle düğmesi');
    check(fs.existsSync(path.join(cfg, 'MuhaWin', 'hesaplar', 'x', 'hesap.txt')), 'Ekstre Luca verisi MuhaWin klasörüne aktarıldı');
    await w.waitForTimeout(500);
    await w.screenshot({ path: OUT + '/1-moduller.png' });
    const kartlar = await w.$$eval('.modcard', b => b.map(x => [x.dataset.mod, x.disabled, (x.querySelector('.ms') || {}).textContent || '']));
    check(kartlar.length === 6, '6 modül kartı (Ofisinize Özel Çözümler ofise tanımlı değil): ' + kartlar.map(k => k[0]).join(','));
    check(!kartlar.some(k => k[0] === 'ozel'), 'özel çözüm tanımlanmamış ofiste "Ofisinize Özel Çözümler" görünmüyor');
    check(!kartlar.some(k => k[0] === 'yonetim'), 'program sahibi olmayan üyeye Yönetim kartı görünmüyor');
    check(/yetkiniz yok/i.test(await w.evaluate(() => window.desktop.admin('admin_users').then(() => 'açıldı', e => String(e.message)))), 'üye yönetim işlemi çağıramıyor (ana süreç reddeder)');
    check(kartlar.filter(k => k[1]).map(k => k[0]).join(',') === 'denetim,gecici,personel', 'Denetim, Geçici Vergi ve Personel pasif (Yakında)');
    check(kartlar.map(k => k[0]).join(',') === 'fatura,ekstre,okc,denetim,gecici,personel', 'modül sırası: Muhasebe, Banka, ÖKC, Denetim, Geçici Vergi');
    check(['fatura', 'ekstre', 'okc'].every(m => !kartlar.find(k => k[0] === m)[2]) && /Lisanslı/.test(await w.textContent('#modLisDurum')), 'tek lisans: lisans durumu modül kartlarında değil, alttaki tek lisans notunun yanında');
    check(/Luca/.test(await w.textContent('#modLuca')) && !(await w.$('#modLucaBag')), 'modül ekranında Luca durumu yazıyor, ayrı bağlan düğmesi yok');
    // Ekstre modülü
    await w.click('.modcard[data-mod=ekstre]');
    await w.waitForSelector('#modGate', { state: 'hidden' });
    await w.waitForTimeout(800);
    for (const sel of ['#chooseModal:not([hidden]) #chBtns .btn:last-child', '#regModal:not([hidden]) [data-rgclose]']) {
      const b = await w.$(sel); if (b) { await b.click().catch(() => {}); await w.waitForTimeout(300); }
    }
    check(await w.isVisible('.app'), 'Ekstre modülü açıldı');
    // menü düzeni B: üstte kalıcı modül sekmeleri; Yeni firma ve Luca'dan firma ekle üst şeritte / araç çubuğunda değil
    { const ms = await w.$$eval('#modSekme [data-modsekme]', b => b.map(x => [x.dataset.modsekme, x.disabled, x.getAttribute('aria-selected'), x.textContent.trim()]));
      check(ms.map(x => x[0]).join(',') === 'fatura,ekstre,okc', 'modül sekmeleri modül seçim ekranıyla aynı sırada: Muhasebe · Banka · Belgeden Fiş (' + ms.map(x => x[3]).join(' · ') + ')');
      check(!ms.some(x => x[1]) && await w.$$eval('.modcard[disabled]', b => b.length) >= 3, '"Yakında" modüller sekme satırında yok (modül seçim ekranında pasif kartlar duruyor)');
      check(ms.find(x => x[0] === 'ekstre')[2] === 'true' && /^Banka$/.test(ms.find(x => x[0] === 'ekstre')[3]) && /^Belgeden Fiş$/.test(ms.find(x => x[0] === 'okc')[3]), 'Banka sekmesi seçili'); }
    // temalar azaltıldı: birbirine yakın olanlar (Lacivert, Bordo, Zümrüt, Gece) kaldırıldı
    { await w.click('#themeBtn'); const tm = await w.$$eval('#themeMenu [data-skin]', b => b.map(x => x.dataset.skin)); await w.keyboard.press('Escape');
      check(tm.join(',') === 'muhawin,defter,kirmizi,kum,grafit,kontrast', 'tema sayısı 6 (' + tm.join(',') + ')'); }
    { // Esc: metin kutusunda yazarken ekrandan çıkmaz; önce kutudan çıkar, ikinci Esc geri (modül seçimi) götürür
      const odak = await w.evaluate(() => { const i = [...document.querySelectorAll('.app input')].find(x => x.type !== 'checkbox' && x.type !== 'file' && x.getClientRects().length); if (i) i.focus(); return !!i && document.activeElement === i; });
      await w.keyboard.press('Escape'); await w.waitForTimeout(300);
      const s1 = await w.evaluate(() => ({ gate: !document.querySelector('#modGate').hidden, inp: document.activeElement && document.activeElement.tagName === 'INPUT' }));
      await w.keyboard.press('Escape'); await w.waitForSelector('#modGate:not([hidden])', { timeout: 5000 }).catch(() => {});
      check(odak && !s1.gate && !s1.inp && await w.isVisible('#modGate'), 'Esc: metin kutusunda önce kutudan çıkar, ikinci Esc modül seçimine döner (' + JSON.stringify(s1) + ')');
      await w.click('.modcard[data-mod=ekstre]'); await w.waitForSelector('#modGate', { state: 'hidden' }); await w.waitForTimeout(400);
    }
    check(!(await w.$('#newFirmBtn')) && !(await w.$('#toolbar [data-luca="firms"], #bottombar [data-luca="firms"], header.top [data-luca="firms"]')), 'Yeni firma ve Luca\'dan firma ekle üst şeritte / araç çubuğunda yok');
    const sekmeler = await w.$$eval('#modeTabs [data-mode]', b => b.map(x => x.dataset.mode));
    check(sekmeler.join(',') === 'bank,card', 'Ekstre modülünde yalnız banka/kredi kartı sekmeleri');
    { // Görev 21: çok şartlı kural (VE) ve "hiç kaydetme" eylemi; eski tek şartlı kurallar aynen çalışır
      const km = await w.evaluate(() => { const A = window.__app, E = window.__ekstre, S = A.S;
        const f = { askiIn: '399.99', askiOut: '199.99' };
        const R = [{ id: 'k1', k: 'KİRA', dir: 'all', acc: '770.01' },
          { id: 'k2', k: 'KİRA', ek: ['OCAK | ŞUBAT', 'DÜKKAN'], dir: 'out', acc: '770.02' },
          { id: 'k3', k: 'VİRMAN', ek: ['KENDİ HESABIM'], dir: 'all', acc: '', eylem: 'atla' }];
        const m = E.buildMatcher(f, R, null), x = (desc, amt) => { const r = m({ desc, amt }); return r.src + ':' + (r.acc || '-'); };
        const sonuc = [x('OCAK DÜKKAN KİRA ÖDEMESİ', -100), x('MART DÜKKAN KİRASI', -100), x('OCAK DÜKKAN KİRA', 100), x('VİRMAN KENDİ HESABIM', -50), x('VİRMAN ALİ VELİ', -50)];
        // satıra uygulanınca "hiç kaydetme" hareketi fişten çıkar; kullanıcı yeniden işaretlerse kural ezmez
        const eskiR = S.rows, eskiK = S.rules; S.rows = [{ id: 't1', desc: 'VİRMAN KENDİ HESABIM', amt: -50 }, { id: 't2', desc: 'OCAK DÜKKAN KİRA', amt: -100 }]; S.rules = R;
        A.reassign(); const a1 = S.rows.map(r => r.src + ':' + !!r.skip).join(' ');
        S.rows[0].skip = false; S.rows[0].kSkip = false; S.rows[0].kSkipIptal = true; A.reassign(); const a2 = S.rows[0].skip;
        S.rows = eskiR; S.rules = eskiK; A.reassign();
        return { sonuc: sonuc.join(' '), a1, a2 }; });
      check(km.sonuc === 'kural:770.02 kural:770.01 kural:770.01 atla:199.99 aski:199.99', 'kural: tüm şartlar tutarsa (VE) çok şartlı kural, tutmazsa tek şartlı eski kural; "hiç kaydetme" kuralı (' + km.sonuc + ')');
      check(km.a1 === 'atla:true kural:false' && km.a2 === false, '"hiç kaydetme" kuralına uyan hareket fişe alınmaz; elle yeniden işaretlenirse kural ezmez (' + km.a1 + ')');
      // arayüz: + Şart ekle, eylem seçimi, listede okunaklı gösterim (örnek firma: bellekte)
      await w.click('#toolbar [data-open=add]'); await w.waitForSelector('#rulesModal:not([hidden]) #ruleForm');
      await w.fill('#rK', 'HAVALE'); await w.click('#rEkle'); await w.fill('#rEk0', 'KENDİ HESABIM'); await w.click('#rEkle'); await w.fill('#rEk1', 'ZİRAAT | VAKIF');
      check(await w.inputValue('#rK') === 'HAVALE' && await w.inputValue('#rEk0') === 'KENDİ HESABIM', '+ Şart ekle: önceki şartlar korunarak 2. ve 3. şart kutusu açıldı');
      await w.selectOption('#rEylem', 'atla');
      check(await w.isHidden('#rAcc') && await w.isHidden('#rLd'), '"Hiç kaydetme" seçilince karşı hesap ve Luca açıklaması gizlendi');
      await w.click('#ruleForm button[type=submit]'); await w.waitForTimeout(300);
      await w.click('#tabList'); await w.waitForTimeout(200);
      const satir = await w.$$eval('#rulesBody .rule', l => l.map(x => x.textContent.replace(/\s+/g, ' ')).find(t => /HAVALE/.test(t)) || '');
      check(/HAVALE VE KENDİ HESABIM VE ZİRAAT \| VAKIF/.test(satir) && /hiç kaydetme/i.test(satir), 'kural listesi: çok şartlı kural ve eylemi okunaklı (' + satir.trim().slice(0, 90) + ')');
      await w.keyboard.press('Escape'); await w.waitForTimeout(200); }
    { const tb = await w.$$eval('#tabs [data-tab]', b => b.map(x => x.dataset.tab)); check(tb[1] === 'bos' && tb[2] === 'dolu', 'Banka: Boş / Dolu karşı hesap filtresi (' + tb.slice(0, 4).join(',') + ')');
      await w.click('#tabs [data-tab=bos]'); await w.waitForTimeout(150); const nb = await w.$$eval('#tbody tr', t => t.length);
      await w.click('#tabs [data-tab=all]'); await w.waitForTimeout(150); const na = await w.$$eval('#tbody tr', t => t.length);
      check(nb <= na, 'Boş filtresi daraltıyor (' + nb + '/' + na + ')'); }
    // dosya adından banka hesabı eşleştirme (%100 / kontrol edin)
    { const ex = path.join(OUT, 'Garanti_6299874_Ekim.xlsx');
      require('child_process').execFileSync('python3', ['-c', `from openpyxl import Workbook; wb=Workbook(); ws=wb.active; ws.append(['Tarih','Açıklama','Tutar','Bakiye'])
for d,a,t in [('30.09.2026','HAVALE AHMET',1500),('01.10.2026','POS KOMISYON',-25.5),('02.10.2026','EFT KIRA',-9000)]: ws.append([d,a,t,10000+t])
wb.save(${JSON.stringify(ex)})`]);
      await w.evaluate(async () => { const { S, Store } = window.__app; const f = { ...S.firm, banks: [{ label: 'GARANTİ BANKASI 6299874 TL', code: '102.01.001' }, { label: 'GARANTİ BANKASI 6299875 USD', code: '102.01.002' }, { label: 'ZİRAAT BANKASI', code: '102.01.003' }] }; S.firm = f; if (!window.__app.isExample()) await Store.saveFirm(f); });
      await w.setInputFiles('#fileIn', ex); await w.waitForTimeout(1500);
      const esl = await w.evaluate(() => { const f = window.__app.S.files.find(x => /Garanti_6299874/.test(x.name)); return f && { idx: f.bankIdx, esle: f.esle, rozet: (document.querySelector('[data-filebank="' + f.id + '"] + .chip') || {}).textContent }; });
      { const ay = await w.$$eval('#ayBar [data-ay]', b => b.map(x => x.textContent.trim()));
        await w.click('#ayBar [data-ay="2026-09"]'); await w.waitForTimeout(200); const n9 = await w.$$eval('#tbody tr[data-row]', t => t.length);
        await w.click('#ayBar [data-ay=""]'); await w.waitForTimeout(200); const nT = await w.$$eval('#tbody tr[data-row]', t => t.length);
        check(ay.length >= 3 && /Eylül/.test(ay.join(' ')) && /Ekim/.test(ay.join(' ')) && n9 >= 1 && n9 < nT, 'ay düğmeleri (' + ay.join(' / ') + '): Eylül\'e basınca yalnız Eylül hareketleri (' + n9 + ' / ' + nT + ')');
        await w.evaluate(() => { const el = document.querySelector('[data-cf=dateBas]'); el.value = '2026-10-01'; el.dispatchEvent(new Event('input', { bubbles: true })); }); await w.waitForTimeout(400);
        const nA = await w.$$eval('#tbody tr[data-row]', t => t.length);
        await w.evaluate(() => { const el = document.querySelector('[data-cf=dateBas]'); el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true })); }); await w.waitForTimeout(400);
        check(nA < nT && nA >= 1, 'tarih aralığı filtresi (01.10.2026 sonrası ' + nA + ' / ' + nT + ')'); }
      check(esl && esl.idx === 0 && esl.esle && esl.esle.puan === 100 && esl.rozet === '%100', 'dosya adındaki banka + hesap no mizan hesabıyla eşleşti (%100): ' + JSON.stringify(esl));
      const esl2 = await w.evaluate(() => { const f = { name: 'garanti.pdf', ids: [], rows: [] }; window.__app.bankaEsle(f); const g = { name: 'ziraat_ekim.xlsx', ids: [], rows: [] }; window.__app.bankaEsle(g); return [f.esle, g.esle, g.bankIdx]; });
      check(esl2[0].puan < 100 && esl2[1].puan === 100 && esl2[2] === 2, 'iki Garanti hesabı varken yalnız banka adı → "kontrol edin"; Ziraat tek hesap → %100');
      // 2.9.6: para birimi dosyanın içinden; banka başlıktan (hareketlerdeki EFT bankaları az sayılır); USD ekstresi USD hesabına
      const esl3 = await w.evaluate(() => { const A = window.__app;
        const pb = A.pbDosyadan('GARANTİ BBVA HESAP HAREKETLERİ IBAN TR12 0006 2000', 'ekstre.xlsx', 'Tarih Açıklama Tutar Bakiye 01.10.2026 SWIFT GELEN 1.000,00 USD 5.000,00 USD 02.10.2026 MASRAF 10,00 USD');
        const bk = A.bankaTahmin('ekstre.xlsx', 'GARANTİ BBVA HESAP ÖZETİ', 'EFT VAKIFBANK ALICI VAKIFBANK HAVALE VAKIFBANK');
        const f = { name: 'garanti.xlsx', ids: [], rows: [], pbDosya: 'USD' }; A.bankaEsle(f);
        return [pb, bk, f.bankIdx, A.filePB(f)]; });
      check(esl3[0] === 'USD' && esl3[1] === 'Garanti BBVA' && esl3[2] === 1 && esl3[3] === 'USD', 'para birimi ekstrenin içinden (USD), banka başlıktan (Garanti), USD ekstresi USD hesabına eşlendi (' + JSON.stringify(esl3) + ')');
      await w.evaluate(() => { const S = window.__app.S; S.files = S.files.filter(x => !/Garanti_6299874/.test(x.name)); window.__app.renderAll(); }); }
    await w.screenshot({ path: OUT + '/2-ekstre.png' });
    // muavinden fiş: aynı fiş no tek fiş; ayrı aylarda denk olan aynı no ayrı fiş; numarasız (devir) satır fiş değil; dosya tekrarı tek
    const fg = await w.evaluate(() => { const R = (no, t, h, b, a, d) => ({ fis_no: no, tarih: t, fis_tipi: 'Mahsup', hesap_kodu: h, borc: b, alacak: a, aciklama: 'x', belge_no: '', dosya: d || 'm1' });
      return window.__fisGrupla([R('15', '2026-09-01', '120.01', 100, 0), R('15', '2026-09-01', '600.01', 0, 100), R('15', '2026-10-01', '100.01', 50, 0), R('15', '2026-10-01', '600.01', 0, 50),
        R('20', '2026-09-02', '320.01', 0, 80), R('20', '2026-09-05', '770.01', 80, 0), R('', '2026-01-01', '100.01', 999, 0),
        R('30', '2026-09-04', '120.01', 5, 0), R('30', '2026-09-04', '600.01', 0, 5), R('30', '2026-09-04', '120.01', 5, 0, 'm2'), R('30', '2026-09-04', '600.01', 0, 5, 'm2')])
        .map(g => g.no + ':' + g.n + ':' + g.denk).join(' '); });
    check(fg === '15:2:true 15:2:true 20:2:true 30:2:true', 'muavinden fişler fiş numarasına göre doğru toplandı: ' + fg);
    // dövizli banka hesabı: TL = döviz × TCMB alış (önceki iş günü); Luca şablonunda Para Birimi / Kur / Döviz Tutar
    const dv = await w.evaluate(() => { const A = window.__app, S = A.S; const sv = { files: S.files, rows: S.rows, banks: S.firm.banks, kur: S.kur, period: S.period };
      try { S.firm.banks = [{ label: 'GARANTİ USD HESABI', code: '102.02.001' }]; S.period = null;
        const f = { id: 'fxf', name: 'garanti_ekstre.xlsx', bankIdx: 0, rows: [] };
        const r = { id: 'fxr', fileId: 'fxf', date: new Date(2026, 9, 19), amt: 1000, desc: 'SWIFT GELEN ODEME', acc: '120.02.001', doc: '' };
        f.rows = [r]; S.files = [f]; S.rows = [r]; S.kur = { 'USD|2026-10-19': { pb: 'USD', kur: 41.8271, bulten: '2026-10-16' } };
        const { lines } = A.buildLuca(); const aoa = A.toAoa(lines, ['Fiş No', 'Hesap Kodu', 'Borç', 'Alacak', 'Para Birimi', 'Kur', 'Döviz Tutar']);
        return { pb: A.filePB(f), L: lines.map(l => [l.acc, l.b, l.c, l.pb || '', l.kur || '', l.dvz || ''].join(':')), aoa: aoa.slice(1).map(x => x.join(':')),
          t1: A.pbBul('ZİRAAT EURO HESABI'), t2: A.pbDosyadan('Hesap No 123 Para Birimi : USD', 'x.xlsx'), t3: A.pbBul('GARANTİ TL HESABI'), t4: A.pbBul('İŞ BANKASI $ HESAP') };
      } finally { Object.assign(S, { files: sv.files, rows: sv.rows, kur: sv.kur, period: sv.period }); S.firm.banks = sv.banks; } });
    console.log('DOVIZ', JSON.stringify(dv));
    check(dv.pb === 'USD' && dv.L[0] === '102.02.001:41827.1:0:USD:41.8271:1000' && dv.L[1] === '120.02.001:0:41827.1:::', 'dövizli hesap: TL karşılığı kurla, banka satırında para birimi / kur / döviz tutarı');
    // 2.9.6: döviz bozumu (USD → TL) ve arbitraj (USD → EUR): TL tarafı sabit; dövizde döviz tutarı sabit, kur = TL / döviz
    const bz = await w.evaluate(() => { const A = window.__app, S = A.S; const sv = { files: S.files, rows: S.rows, banks: S.firm.banks, kur: S.kur, period: S.period, group: S.group };
      try { S.firm.banks = [{ label: 'GARANTİ TL HESABI', code: '102.01.001' }, { label: 'GARANTİ USD HESABI', code: '102.02.001' }, { label: 'GARANTİ EURO HESABI', code: '102.03.001' }]; S.period = null; S.group = 'row';
        const d = new Date(2026, 9, 19); const mk = (id, i) => ({ id, name: id + '.xlsx', bankIdx: i, rows: [] });
        const fT = mk('fT', 0), fU = mk('fU', 1), fE = mk('fE', 2);
        const rows = [{ id: 'u1', fileId: 'fU', date: d, amt: -500, desc: 'DOVIZ SATIS 500 USD', acc: '', doc: '' }, { id: 't1', fileId: 'fT', date: d, amt: 20500, desc: 'DOVIZ SATIS KARSILIGI', acc: '', doc: '' },
          { id: 'u2', fileId: 'fU', date: d, amt: -1000, desc: 'ARBITRAJ USD EUR', acc: '', doc: '' }, { id: 'e1', fileId: 'fE', date: d, amt: 870, desc: 'ARBITRAJ', acc: '', doc: '' }];
        for (const r of rows) ({ fT, fU, fE })[{ t: 'fT', u: 'fU', e: 'fE' }[r.id[0]]].rows.push(r);
        S.files = [fT, fU, fE]; S.rows = rows; S.kur = { 'USD|2026-10-19': { pb: 'USD', kur: 41.8271 }, 'EUR|2026-10-19': { pb: 'EUR', kur: 48.6512 } };
        const n = A.detectVirman(); const { lines } = A.buildLuca();
        const tb = Math.round(lines.reduce((t, l) => t + l.b, 0) * 100) / 100, tc = Math.round(lines.reduce((t, l) => t + l.c, 0) * 100) / 100;
        return { n, L: lines.map(l => [l.acc, l.b, l.c, l.pb || '', l.kur || '', l.dvz || ''].join(':')), tb, tc, skip: rows.filter(r => r.skip).map(r => r.id).join(',') };
      } finally { Object.assign(S, { files: sv.files, rows: sv.rows, kur: sv.kur, period: sv.period, group: sv.group }); S.firm.banks = sv.banks; } });
    console.log('BOZUM', JSON.stringify(bz));
    check(bz.n === 2 && bz.L.includes('102.01.001:20500:0:::') && bz.L.includes('102.02.001:0:20500:USD:41:500'), 'döviz bozumu: TL hesaptaki 20.500 TL sabit, USD satırı 500 USD ve kur 41 (TL / döviz)');
    check(bz.L.includes('102.02.001:0:41827.1:USD:41.8271:1000') && bz.L.includes('102.03.001:41827.1:0:EUR:48.077126:870') && bz.tb === bz.tc, 'arbitraj USD → EUR: çıkan USD TCMB kuruyla, EUR kuru TL / döviz; fiş borç = alacak (' + bz.tb + ')');
    check(dv.aoa[0] === '1:102.02.001:41827.1:0:USD:41.8271:1000' && dv.aoa[1] === '1:120.02.001:0:41827.1:::', 'Luca şablonu: Para Birimi, Kur, Döviz Tutar sütunları dolu');
    check(dv.t1 === 'EUR' && dv.t2 === 'USD' && dv.t3 === 'TRY' && dv.t4 === 'USD', 'para birimi hesap adından / ekstre başlığından bulunuyor');
    // modüllere dön → Fatura
    // modül sekmesinden geçiş (modül seçim ekranı açılmadan): Belgeden Fiş → Banka
    await w.click('#modSekme [data-modsekme=okc]'); await w.waitForSelector('#okcPanel:not([hidden])', { timeout: 8000 }).catch(() => {});
    check(await w.isVisible('#okcPanel') && await w.isHidden('#modGate') && await w.getAttribute('#modSekme [data-modsekme=okc]', 'aria-selected') === 'true', 'modül sekmesi: Belgeden Fiş açıldı (modül ekranı açılmadan)');
    await w.click('#modSekme [data-modsekme=ekstre]'); await w.waitForTimeout(400);
    check(await w.isHidden('#okcPanel') && await w.isVisible('.app'), 'modül sekmesi: Banka\'ya dönüldü');
    // üst şerit ve modül sekme satırı her ekranda aynı yerde (kayma / zıplama yok): Banka · Belgeden Fiş · Mizan paneli · Muhasebe
    const yer = () => w.evaluate(() => ['#modSekme', '#lucaTopBtn', '#ayarlarBtn', '#firmSel'].map(s => { const r = document.querySelector(s).getBoundingClientRect(); return [s, Math.round(r.top), Math.round(r.left), Math.round(r.width), Math.round(r.height)].join(':'); }).join(' '));
    const yerB = await yer();
    const kutu = sel => w.evaluate(s => { const e = document.querySelector(s); if (!e || !e.getClientRects().length) return null; const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.height)]; }, sel);
    const altB = await kutu('#modeTabs .modetab');
    await w.click('#modSekme [data-modsekme=okc]'); await w.waitForTimeout(500); const yerO = await yer();
    await w.click('#modSekme [data-modsekme=ekstre]'); await w.waitForTimeout(400);
    await w.click('#mmBtn'); await w.waitForSelector('#mmPanel:not([hidden])'); await w.waitForTimeout(300); const yerM = await yer();
    const mmUst = await w.evaluate(() => [document.querySelector('#modSekme').getBoundingClientRect().bottom, document.querySelector('#mmPanel').getBoundingClientRect().top]);
    await w.keyboard.press('Escape'); await w.waitForTimeout(300);
    check(await w.isHidden('#mmPanel') && await w.isHidden('#modGate'), 'Esc: Mizan paneli kapandı, Banka ekranında kalındı');
    check(mmUst[1] >= mmUst[0], 'Mizan paneli üst şeridi ve modül sekmelerini örtmüyor (' + mmUst.map(Math.round).join(' / ') + ')');
    await w.click('#modulesBtn');
    await w.waitForSelector('#modGate:not([hidden])');
    await w.click('.modcard[data-mod=fatura]');
    const frameEl = await w.waitForSelector('#fkFrame:not([hidden])', { timeout: 40000 });
    { await w.waitForTimeout(800); const yerF = await yer();
      check(yerO === yerB && yerM === yerB && yerF === yerB, 'üst şerit / modül sekmeleri her ekranda aynı yerde ve boyda (Banka ' + yerB + (yerO !== yerB ? ' · Belgeden Fiş ' + yerO : '') + (yerM !== yerB ? ' · Mizan ' + yerM : '') + (yerF !== yerB ? ' · Muhasebe ' + yerF : '') + ')'); }
    check(await w.getAttribute('#modSekme [data-modsekme=fatura]', 'aria-selected') === 'true' && await w.isVisible('#modSekme'), 'Muhasebe sekmesi seçili ve görünür');
    { const r = await w.evaluate(() => [document.querySelector('#modSekme').getBoundingClientRect().bottom, document.querySelector('#fkPanel').getBoundingClientRect().top]);
      check(r[1] >= r[0], 'Muhasebe paneli modül sekmelerinin altında başlıyor (' + r.map(Math.round).join(' / ') + ')'); }
    // Görev 33: Muhasebe alt menüsü Banka alt sekmeleriyle aynı hizada ve boyda (ilk alt düğmenin x, y ve yüksekliği)
    { await w.mouse.move(2, 700); const altF = await kutu('#fkNav .btn');
      check(altB && altF && altB.every((v, i) => Math.abs(v - altF[i]) <= 1), 'alt menü hizası: Banka Ekstreleri ve Toplu Kontrol aynı x / y / yükseklikte (Banka ' + JSON.stringify(altB) + ' · Muhasebe ' + JSON.stringify(altF) + ')'); }
    // üst bölümün boyu sonradan değişince (yazı tipi, Luca düğmesi, pencere) Muhasebe paneli yeniden yerleşir; menüler üst üste binmez
    { await w.evaluate(() => { document.querySelector('header.top').style.paddingBottom = '70px'; }); await w.waitForTimeout(250);
      const r1 = await w.evaluate(() => [document.querySelector('#modSekme').getBoundingClientRect().bottom, document.querySelector('#fkPanel').getBoundingClientRect().top]);
      await w.evaluate(() => { document.querySelector('header.top').style.paddingBottom = ''; }); await w.waitForTimeout(250);
      const r2 = await w.evaluate(() => [document.querySelector('#modSekme').getBoundingClientRect().bottom, document.querySelector('#fkPanel').getBoundingClientRect().top]);
      check(r1[1] >= r1[0] && r2[1] >= r2[0] && r2[1] - r2[0] <= 20, 'üst bölüm büyüyüp küçülünce Muhasebe paneli sekmelerin altına yeniden yerleşti (' + [...r1, ...r2].map(Math.round).join(' / ') + ')'); }
    // Muhasebe › Toplu Kontrol'deyken Mizan / Muavin / Hesap Planı açılınca alt menü ve etkin öğesi görünür kalır
    { await w.click('#mmBtn'); await w.waitForSelector('#mmPanel:not([hidden])'); await w.waitForTimeout(300);
      const g = await w.evaluate(() => { const n = document.querySelector('#fkNav'), b = document.querySelector('#fkNav [aria-pressed=true]'), p = document.querySelector('#mmPanel'); const br = b.getBoundingClientRect();
        const ust = document.elementFromPoint(br.left + br.width / 2, br.top + br.height / 2); return { nb: n.getBoundingClientRect().bottom, pt: p.getBoundingClientRect().top, etkin: b.dataset.fksayfa, gorunur: !!ust && (ust === b || b.contains(ust)) }; });
      await w.keyboard.press('Escape'); await w.waitForTimeout(300);
      check(g.pt >= g.nb && g.gorunur && g.etkin === 'toplu', 'Mizan / Muavin açıkken Muhasebe alt menüsü ve etkin öğe (Toplu Kontrol) görünür (' + JSON.stringify(g) + ')'); }
    let fr = await frameEl.contentFrame();
    const fkFrame = async () => { const fe = await w.waitForSelector('#fkFrame:not([hidden])', { timeout: 40000 }); return fe.contentFrame(); };
    await fr.waitForSelector('#sekmeler', { timeout: 20000 });
    await w.waitForTimeout(1200);
    await w.screenshot({ path: OUT + '/3-fatura.png' });
    check(await w.isVisible('#fkFrame'), 'Muhasebe İşlemleri tek lisansla açıldı');
    check(!(await w.isVisible('#modeTabs')), 'Fatura modülünde Ekstre sekmeleri gizli');
    check(/Muhasebe İşlemleri/.test(await w.textContent('#h1Mod')), 'başlık modül adını gösteriyor');
    check(!(await fr.$('[data-s=ayarlar]')), 'Fatura Kontrol içinde Ayarlar sekmesi yok');
    const ust = await fr.evaluate(() => { const h = document.querySelector('header'); return { bg: getComputedStyle(h).backgroundImage + getComputedStyle(h).backgroundColor, logo: getComputedStyle(h.querySelector('.logo')).display }; });
    check(/none/.test(ust.bg) && /rgba\(0, 0, 0, 0\)/.test(ust.bg) && ust.logo === 'none', 'Fatura Kontrol üst bandı açık renkli sekme, "KDV Kontrol" yazmıyor');
    check(await fr.evaluate(() => getComputedStyle(document.querySelector('header nav')).display) === 'none', 'Fatura Kontrol içindeki sayfa bağlantıları gizli (sekmeler MuhaWin üstünde)');
    await w.click('#fkNav [data-fksayfa=tek]'); fr = await fkFrame(); await fr.waitForSelector('#program', { timeout: 20000 }); await w.waitForTimeout(800);
    await w.screenshot({ path: OUT + '/3b-tek-firma.png' });
    check((await w.getAttribute('#fkNav [data-fksayfa=tek]', 'aria-pressed')) === 'true', 'Muhasebe İşlemleri sekmesi: Tek Firma seçili');
    const fsec = await fr.$$eval('#firmaSec option', o => o.map(x => x.textContent));
    check(fsec.some(x => /Yeni firma|YENİ|Örnek|ÖKC|İNKA/i.test(x)) || fsec.length >= 1, 'tek firma kontrol: 1. adım firma listesi MuhaWin firmalarından (' + fsec.length + ')');
    // Fiş girişi sayfası
    await w.click('#fkNav [data-fksayfa=fis]'); await w.waitForSelector('#fgPanel:not([hidden]) #fgTable');
    check(await w.isHidden('#fkFrame'), 'Fiş Girişi: Fatura Kontrol penceresi gizlendi, fiş ekranı açıldı');
    // fiş girişi: tutarlar binlik ayraçlı toplanır, Enter akışı, F8 KDV ayırma, Alt+G denkleştirme
    const onceFirm = await w.evaluate(() => window.__app.S.firmId);
    await w.evaluate(async () => { const { Store } = window.__app; let f = Object.values(Store.local().firms).find(x => x.name === 'FİŞ TEST');
      if (!f) { f = { id: 'fgf', name: 'FİŞ TEST', banks: [], askiIn: '', askiOut: '', createdAt: new Date().toISOString() }; await Store.saveFirm(f); }
      await Store.saveMizan(f.id, [['100', 'KASA'], ['100.01', 'MERKEZ KASA'], ['191', 'İND. KDV'], ['191.10', '%10 İNDİRİLECEK KDV'], ['191.20', '%20 İNDİRİLECEK KDV'], ['320', 'SATICILAR'], ['320.01', 'ABC LTD'], ['770', 'GENEL YÖNETİM'], ['770.01', 'KİRA GİDERİ']]);
      await Store.saveFirm({ ...f, fkFisAyar: { kapat: '320.01' }, mizanInfo: { count: 9, at: new Date().toISOString(), parts: 1 } }); await window.__app.selectFirm(f.id); });
    await w.waitForTimeout(600); await w.click('#fkNav [data-fksayfa=fis]'); await w.waitForTimeout(500);
    check(await w.evaluate(() => !(document.activeElement && document.activeElement.closest && document.activeElement.closest('#fgPanel input'))) && !(await w.isVisible('#hsDrop')), 'fiş girişi açılınca hiçbir kutu seçili değil (hesap listesi açılmadı)');
    check((await w.$$eval('#fgTable thead th', t => t.map(x => x.textContent.trim().toLocaleLowerCase('tr-TR')))).join('|').includes('evrak no|evrak tarihi|belge türü'), 'fiş girişi: sütunlar hesap kodu, evrak no, evrak tarihi, belge türü, açıklama, borç, alacak');
    check(await w.$eval('#fgTip', s => s.value) === '3' && (await w.$$eval('#fgTip option', o => o.map(x => x.textContent))).join(',') === 'Mahsup,Tahsil,Tediye,Açılış,Kapanış', 'fiş tipi: Mahsup varsayılan; Tahsil, Tediye, Açılış, Kapanış seçenekleri');
    await w.fill('[data-fg=kod][data-i="0"]', '770.01'); await w.press('[data-fg=kod][data-i="0"]', 'Enter'); await w.waitForTimeout(150);
    check(await w.evaluate(() => document.activeElement.dataset.fg) === 'evrak', 'Enter: hesap kodundan evrak no alanına geçti');
    await w.press('[data-fg=evrak][data-i="0"]', 'Enter'); await w.press('[data-fg=etarih][data-i="0"]', 'Enter'); await w.press('[data-fg=bt][data-i="0"]', 'Enter'); await w.press('[data-fg=ac][data-i="0"]', 'Enter'); await w.waitForTimeout(150);
    check(await w.evaluate(() => document.activeElement.dataset.fg) === 'b', '770 borç çalışır: Enter borç alanına geldi');
    await w.fill('[data-fg=b][data-i="0"]', '1.100,00'); await w.press('[data-fg=b][data-i="0"]', 'Enter'); await w.waitForTimeout(200);
    const fgTop = await w.evaluate(() => window.__fisg._toplam());
    check(fgTop.b === 1100 && await w.$eval('[data-fg=b][data-i="0"]', i => i.value) === '1.100,00', 'tutar binlik ayraçlı okundu ve toplandı (1.100,00)');
    check(await w.evaluate(() => document.activeElement.dataset.fg + document.activeElement.dataset.i) === 'kod1', 'tutardan sonra Enter yeni satır açtı');
    // Görev 47: kaydedilmemiş satır varken Esc Fiş Girişi'nden çıkarmaz (önce kutudan çıkar, sonra uyarır)
    { await w.keyboard.press('Escape'); await w.waitForTimeout(200); await w.keyboard.press('Escape'); await w.waitForTimeout(400);
      const d = await w.evaluate(() => ({ acik: !document.querySelector('#fgPanel').hidden, kod: (window.__fisg._st.satir[0] || {}).kod, kutu: !!(document.activeElement && document.activeElement.closest && document.activeElement.closest('#fgPanel input')) }));
      check(d.acik && d.kod === '770.01' && !d.kutu, 'Esc: Fiş Girişi\'nde yazılmış satır varken ekrandan çıkmaz, satırlar duruyor (' + JSON.stringify(d) + ')'); }
    await w.focus('[data-fg=b][data-i="0"]'); await w.press('[data-fg=b][data-i="0"]', 'F8'); await w.waitForTimeout(300);
    const fgS = await w.evaluate(() => window.__fisg._st.satir.filter(x => x.kod).map(x => x.kod + ':' + (x.b || '') + '/' + (x.c || '')));
    check(fgS.join(' ') === '770.01:1000/ 191.10:100/ 320.01:/1100', 'F8: %10 KDV ayrıldı (matrah 1.000, KDV 100 → 191.10) ve 320.01 kapat hesabıyla fiş eşitlendi (' + fgS.join(' ') + ')');
    check(!(await w.$eval('#fgKaydet', b => b.disabled)), 'fiş denk: Luca\'ya kaydet düğmesi açıldı');
    await w.click('#fgKisa'); await w.waitForTimeout(150);
    check((await w.textContent('.fg-kisa')).includes('Alt') && (await w.textContent('.fg-kisa')).includes('F7'), 'kısa yollar baloncuğu açıldı');
    await w.click('#fgTemizle'); await w.waitForSelector('#askModal:not([hidden])'); await w.click('#askYes'); await w.waitForTimeout(200);
    // borç doluyken alacak kilitli
    await w.fill('[data-fg=kod][data-i="0"]', '770.01'); await w.press('[data-fg=kod][data-i="0"]', 'Tab'); await w.waitForTimeout(250);
    await w.fill('[data-fg=b][data-i="0"]', '500'); await w.press('[data-fg=b][data-i="0"]', 'Tab'); await w.waitForTimeout(250);
    check(await w.$eval('[data-fg=c][data-i="0"]', i => i.readOnly), 'borç girilince alacak kutusu kilitlendi');
    await w.click('#fgTemizle'); await w.waitForSelector('#askModal:not([hidden])'); await w.click('#askYes'); await w.waitForTimeout(200);
    await w.evaluate(async id => { await window.__app.Store.deleteFirm('fgf', {}); await window.__app.selectFirm(id); }, onceFirm); await w.waitForTimeout(400);
    // Fiş Listesi sekmesi
    await w.click('#fkNav [data-fksayfa=fisl]'); await w.waitForSelector('#flPanel:not([hidden]) #flTable'); await w.waitForTimeout(800);
    check(await w.isHidden('#fkFrame') && await w.isVisible('#flYenile'), 'Fiş Listesi sekmesi açıldı (muavinden fişler)');
    const flN = await w.$$eval('#flTable tbody tr[data-fl]', t => t.length);
    if (flN) { await w.click('#flTable tbody tr[data-fl] >> nth=0'); await w.waitForTimeout(200); await w.screenshot({ path: OUT + '/7b-fis-listesi.png' }); check(await w.isVisible('.fl-detay'), 'fişe tıklayınca içeriği açıldı (' + flN + ' fiş)'); }
    else check(true, 'fiş listesi: bu firmada muavin yok (atlandı)');
    if (flN) await w.click('.fl-detaybas b'); await w.keyboard.press('Escape'); await w.waitForTimeout(500);
    check(await w.getAttribute('#fkNav [data-fksayfa=toplu]', 'aria-pressed') === 'true' && await w.isHidden('#modGate'), 'Esc: Fiş Listesi\'nden Toplu Kontrol\'e dönüldü');
    // Görev 31: KDV Beyannamesi › GİB PDF'i ile karşılaştır ("PDF'ten oku"): çerçevedeki sayfa PDF'i MuhaWin'e gönderir,
    // MuhaWin pdf.js 5 ile metni çıkarır (satırlar y konumuna göre), sunucudaki gib_metin_coz kutuları okur
    { await w.click('#fkNav [data-fksayfa=kdv]'); const kf = await fkFrame();
      await kf.waitForFunction(() => typeof pdfMetin === 'function', null, { timeout: 20000 }).catch(() => {});
      const b64 = fs.readFileSync(path.join(__dirname, 'ornek', 'kdv1_beyanname.pdf')).toString('base64');
      const metin = await kf.evaluate(async b => { const u = Uint8Array.from(atob(b), c => c.charCodeAt(0)); try { return await pdfMetin(u.buffer); } catch (e) { return 'HATA ' + e.message; } }, b64);
      const satirBirlesik = /Toplam Matrah\s+125\.000,00/.test(metin) && /Ödenmesi Gereken Katma Değer Vergisi\s+6\.600,00/.test(metin);
      const kutular = JSON.parse(require('child_process').execFileSync('python3', ['-c', 'import sys,json; sys.path.insert(0, sys.argv[1]); from fatura_kontrol.beyanname import gib_metin_coz; print(json.dumps(gib_metin_coz(sys.stdin.read(), "kdv1")))', path.join(APP, 'fk')], { input: metin }).toString());
      const bek = { toplam_matrah: 125000, hesaplanan_kdv: 25000, toplam_kdv: 25000, bu_donem_indirim: 18400, indirimler_toplami: 18400, odenecek: 6600, devreden: 0, bedel_aylik: 125000 };
      const fark = Object.entries(bek).filter(([k, v]) => kutular[k] !== v).map(([k]) => k + '=' + kutular[k]);
      check(!/^HATA/.test(metin) && satirBirlesik, 'KDV beyannamesi PDF metni pdf.js 5 ile çıkarıldı; etiket ve tutar aynı satırda (' + metin.split('\n').length + ' satır)');
      check(!fark.length && kutular._vkn === '1111111114' && /2026/.test(kutular._donem || ''), 'GİB PDF\'inden KDV1 kutuları okundu (matrah, hesaplanan, indirim, ödenecek, devreden, dönem, VKN)' + (fark.length ? ' · farklı: ' + fark.join(', ') : '')); }
    // KDV Beyannamesi: sorumlu sıfatıyla KDV ödendi mi sorusu; önceki aylarda KDV tahakkuk fişi yoksa uyarı
    { const kf = await fkFrame();
      const g = await kf.evaluate(async () => {
        const k1 = { donem: { yil: 2026, ay: 9, ay_adi: 'Eylül', tip: 'AYLIK' }, matrah: { toplam_matrah: 1000, hesaplanan_kdv: 200, ilave_kdv: 0, toplam_kdv: 200 },
          indirimler: { toplam: 150, onceki_donemden_devreden: 50, bu_donem: 100, satirlar: [], kdv2_odenen: 0 }, istisnalar: { teslim_toplami: 0, iade_edilebilir: 0, satirlar: [] },
          sonuc: { tecil: 0, odenecek: 50, iade_edilecek: 0, sonraki_doneme_devreden: 0 }, diger: { teslim_bedeli_aylik: 0, teslim_bedeli_kumulatif: 0, kredi_karti: 0 },
          teslimler: [], kismi_tevkifat: [], ilave: [], notlar: [], sorumlu: { tutar: 300, cevap: 'odenmedi', indirilmeyen: 300 },
          tahakkuk_kontrol: { bulunan: [], eksik: [{ ay: 7, ad: 'Temmuz', hareket: true }], kapsam_disi: [] } };
        veri = { id: 'X/2026/09', mukellef: {}, uygunluk: { fatura_sayisi: 1 }, kdv1: k1, kdv2: { donem: {}, vergi_bildirimi: {}, kesintiler: [] }, hazirlandi: '' }; kaynak = 'kontrol'; secili = 'X/2026/09'; ciz();
        const sonuc = { kart: !$('#sorumluKart').hidden, tutar: $('#sorumluTutar').textContent, cevap: $('#sorumluCevap').value, uyari: $('#tahakkukUyari').hidden ? '' : $('#tahakkukUyari').textContent,
          satir: /ödenmedi, indirimden çıkarıldı/.test($('#kagit').textContent) };
        const eski = window.fetch; let url = ''; window.fetch = async u => { url = String(u); return { ok: false, json: async () => ({ detail: 'test' }) }; };
        $('#sorumluCevap').value = 'odendi'; $('#sorumluUygula').click(); await new Promise(r => setTimeout(r, 100)); window.fetch = eski;
        sonuc.istek = url; return sonuc; });
      check(g.kart && g.tutar === '300,00' && g.cevap === 'odenmedi' && g.satir, 'KDV Beyannamesi: "sorumlu sıfatıyla indirilen KDV ödendi mi?" sorusu ve ödenmediyse indirimden çıkarılan satır (' + JSON.stringify(g) + ')');
      check(/sorumlu=odendi/.test(g.istek), 'cevap beyanname isteğine gidiyor (sorumlu=odendi)');
      check(/Temmuz ayına ait KDV tahakkuk fişi bulunamamıştır/.test(g.uyari), 'önceki aylarda KDV tahakkuk fişi yoksa ekranda uyarı (Temmuz)');
      await w.screenshot({ path: OUT + '/7c-kdv-sorumlu-tahakkuk.png' }); }
    await w.click('#fkNav [data-fksayfa=toplu]');
    fr = await fkFrame(); await fr.waitForSelector('#sekmeler', { timeout: 20000 });
    // firmalar: MuhaWin'den eşitleme
    const r = await w.evaluate(() => window.desktop.fk.setFirms([{ id: '11', ad: 'EXPO İNŞ' }, { id: '12', ad: 'UKİ MADEN' }], false));
    check(r && r.eklenen === 2, 'MuhaWin firmaları Fatura Kontrol listesine eklendi');
    await w.evaluate(() => { const f = document.querySelector('#fkFrame'); f.contentWindow.postMessage({ muhawin: true, tip: 'firmalarYenile', sekme: true }, '*'); });
    await w.waitForTimeout(800);
    const adlar = await fr.$$eval('#firmaTablo tbody tr', t => t.map(x => x.textContent));
    check(adlar.some(a => a.includes('EXPO İNŞ')) && adlar.some(a => a.includes('UKİ MADEN')), 'Firmalar sekmesinde görünüyor');
    await w.screenshot({ path: OUT + '/4-firmalar.png' });
    // Luca'dan listeyi çek: Luca bağlı değilse giriş penceresi açılır (ayrı Chrome değil)
    await fr.click('#cekBtn');
    await w.waitForTimeout(1500);
    const lucaWin = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().map(x => x.getTitle() + ' ' + x.webContents.getURL()));
    check(lucaWin.length >= 2 && lucaWin.some(u => /luca/i.test(u)), 'Luca\'dan listeyi çek → MuhaWin Luca penceresi açıldı');
    check(/alınıyor/i.test(await fr.textContent('#cekBtn')), 'düğme beklemede');
    // anahtar kapısı
    const base = (await frameEl.getAttribute('src')).replace(/\/toplu$/, '');
    check((await get(base + '/toplu')).status === 403, 'anahtarsız istek reddedildi');
    const dirs = fs.readdirSync(path.join(cfg, 'MuhaWin', 'hesaplar'));
    check(dirs.some(d => fs.existsSync(path.join(cfg, 'MuhaWin', 'hesaplar', d, 'fatura_kontrol', 'muhawin-modul.log'))), 'modül günlüğü hesap klasöründe');
    // Mizan / Muavin sayfası
    const hd = fs.readdirSync(path.join(cfg, 'MuhaWin', 'hesaplar')).map(d => path.join(cfg, 'MuhaWin', 'hesaplar', d, 'fatura_kontrol')).find(d => fs.existsSync(d));
    const mk = path.join(hd, 'firmalar', 'EXPO İNŞ', '2026', '09'); fs.mkdirSync(mk, { recursive: true });
    require('child_process').execFileSync('python3', ['-c', `import sys; sys.path.insert(0, ${JSON.stringify(path.join(APP, 'fk', 'tests'))}); sys.path.insert(0, ${JSON.stringify(path.join(APP, 'fk'))}); from test_luca_otomasyon import muavin_yaz; from pathlib import Path; muavin_yaz(Path(${JSON.stringify(path.join(mk, 'muavin.xlsx'))}))`]);
    await w.evaluate(async () => { const { Store } = window.__app; const f = { id: 'mf1', name: 'EXPO İNŞ', lucaId: '11', banks: [], mizanInfo: { source: 'luca', year: '2026', at: new Date().toISOString(), parts: 1 } };
      await Store.saveFirm(f); await Store.saveMizan('mf1', [['100', 'KASA', 5000, 1200], ['100.01', 'TL KASA', 5000, 1200], ['320', 'SATICILAR', 300, 9000], ['320.01', 'ABC LTD', 300, 9000], ['600', 'YURTİÇİ SATIŞLAR', 0, 25000], ['102', 'BANKALAR', 0, 0], ['335', 'PERSONELE BORÇLAR', 500, 500]]);
      await Store.saveFirm({ id: 'mf2', name: 'YENİ LTD', banks: [] }); });
    const mzx = path.join(OUT, 'mizan-yukle.xlsx'), mvx = path.join(OUT, 'muavin-yukle.xlsx');
    fs.copyFileSync(path.join(mk, 'muavin.xlsx'), mvx);
    require('child_process').execFileSync('python3', ['-c', `import openpyxl; wb=openpyxl.Workbook(); ws=wb.active; ws.append(['MİZAN']); ws.append(['Hesap Kodu','Hesap Adı','Borç','Alacak','Borç Bakiye','Alacak Bakiye'])
for r in [('100','KASA',1000,400,600,0),('100.01','TL KASA',1000,400,600,0),('153','TİCARİ MALLAR',0,0,0,0),('153.01','MAL',0,0,0,0),('600','SATIŞLAR','0,00','2.500,50',0,'2.500,50'),('159','VERİLEN SİPARİŞ AVANSLARI',100,300,0,200)]: ws.append(list(r))
wb.save(${JSON.stringify(mzx)})`]);
    await w.waitForTimeout(800);
    await w.click('#mmBtn'); await w.waitForSelector('#mmPanel:not([hidden])');
    await w.waitForTimeout(800);
    // Mizan sekmesiyle açılır; sekme sırası Mizan → Muavin → Hesap Planı
    check(/Mizan \/ Muavin \/ Hesap Planı/.test(await w.textContent('#mmBtn')), 'üst şerit düğmesi: "Mizan / Muavin / Hesap Planı"');
    check(await w.getAttribute('[data-mmtab=mizan]', 'aria-pressed') === 'true', 'Mizan / Muavin / Hesap Planı penceresi Mizan sekmesiyle açıldı');
    check((await w.$$eval('[data-mmtab]', b => b.map(x => x.dataset.mmtab).join(','))) === 'mizan,muavin,plan', 'sekme sırası: Mizan, Muavin, Hesap Planı');
    // Görev 55: DH (detay hesap) sütunu: E = en alt kırılım, H = altında hesap var (kalın, koyu); yatay kaydırma yok
    { const mz = await w.evaluate(() => {
        const th = [...document.querySelectorAll('#mmTable thead tr:first-child th')].map(x => x.textContent.trim());
        const L = [...document.querySelectorAll('#mmTable tbody tr[data-kod]')].map(r => ({ k: r.dataset.kod, dh: (r.querySelector('td.dh') || {}).textContent, ust: r.classList.contains('ust'), fw: +getComputedStyle(r.cells[0]).fontWeight }));
        const m = window.HesapDH.detayHesaplar(L.map(x => x.k)), wr = document.querySelector('#mmPanel .mmwrap');
        const ornek = Object.fromEntries(window.HesapDH.detayHesaplar(['102', '102.01', '102.01.07', '102.01.07.01']));
        return { dh: th.some(x => /^DH/.test(x)), n: L.length, tutarli: L.every(x => x.dh === m.get(x.k) && x.ust === (x.dh === 'H') && (x.dh === 'H' ? x.fw >= 700 : x.fw < 700)),
                 yatay: !!wr && wr.scrollWidth > wr.clientWidth + 1, ornek }; });
      check(mz.dh && mz.tutarli && !mz.yatay && mz.ornek['102.01.07.01'] === 'E' && ['102', '102.01', '102.01.07'].every(k => mz.ornek[k] === 'H'),
        'Görev 55: mizanda DH sütunu (E / H), H satırları kalın, yatay kaydırma yok (' + mz.n + ' satır)'); }
    // Görev 55: mizandan muavine girince ← / → önceki / sonraki hesap; kutu odaktayken oklar hesap değiştirmez;
    // yürüyen bakiye görünen sıraya göre yeniden hesaplanır (son satır = toplam bakiye)
    { const kodlar = await w.$$eval('#mmTable tbody tr[data-mzhesap]', t => t.map(r => r.dataset.kod));
      if (kodlar.length >= 2) {
        const hf = () => w.evaluate(() => window.__mmui._st.hesapF);
        await w.click(`#mmTable tbody tr[data-kod="${kodlar[0]}"] td >> nth=0`); await w.waitForTimeout(700);
        const ilkH = await hf();
        await w.keyboard.press('ArrowRight'); await w.waitForTimeout(700);
        const ikinci = await hf();
        await w.keyboard.press('ArrowLeft'); await w.waitForTimeout(700);
        const geri = await hf();
        await w.keyboard.press('ArrowLeft'); await w.waitForTimeout(400);
        const basta = await hf();
        await w.focus('#mmQ'); await w.keyboard.press('ArrowRight'); await w.waitForTimeout(400);
        const kutuda = await hf();
        await w.evaluate(() => document.activeElement && document.activeElement.blur());
        const dug = !!(await w.$('[data-mmhgit="1"]'));
        check(ilkH === kodlar[0] && ikinci !== ilkH && ikinci === kodlar[1] && geri === kodlar[0] && basta === kodlar[0] && kutuda === kodlar[0] && dug,
          'Görev 55: muavinde → sonraki, ← önceki hesap; listenin başında durur; kutu odaktayken oklar hesap değiştirmez (' + [ilkH, ikinci, geri, basta, kutuda].join(' · ') + ')');
        // bakiye: örnek hesabın satırları yerine üç hareketli bir hesap konur (açılış 100); alacağa göre azalan sıralanır
        const bk = await w.evaluate(() => { const M = window.__mmui, st = M._st, f = st.f, so = st.sort, ro = st.rows, ac = st.acilis;
          st.rows = [{ tarih: '2026-09-01', fis_no: '1', hesap_kodu: st.hesapF, aciklama: 'a', borc: 500, alacak: 0, _i: 0 },
                     { tarih: '2026-09-02', fis_no: '2', hesap_kodu: st.hesapF, aciklama: 'b', borc: 0, alacak: 300, _i: 1 },
                     { tarih: '2026-09-03', fis_no: '3', hesap_kodu: st.hesapF, aciklama: 'c', borc: 0, alacak: 50, _i: 2 }];
          st.acilis = 100; st.f = {}; st.sort = { k: 'alacak', d: -1 }; M._draw();
          const cols = st.cols.map(c => c[0]), bi = cols.indexOf('bakiye'), ai = cols.indexOf('alacak');
          const tr = [...document.querySelectorAll('#mmTable tbody tr[data-kod]')];
          const sonuc = { alacak: tr.map(x => x.cells[ai].textContent.trim()), bakiye: tr.map(x => x.cells[bi].textContent.trim()),
                          top: document.querySelector('#mmTable tfoot td:nth-child(' + (bi + 1) + ')').textContent.trim() };
          st.rows = ro; st.f = f; st.sort = so; st.acilis = ac; M._draw(); return sonuc; });
        // azalan alacak: 300, 50, 500 (borç) → 100 − 300 = 200 A, 200 A − 50 = 250 A, 250 A + 500 = 250 B
        check(/^300/.test(bk.alacak[0]) && /^200,00 A/.test(bk.bakiye[0]) && /^250,00 A/.test(bk.bakiye[1]) && /^250,00 B/.test(bk.bakiye[2]) && bk.top.startsWith(bk.bakiye[2]),
          'Görev 55: alacağa göre sıralayınca yürüyen bakiye yeni sıraya göre (açılış 100); son satır = toplam bakiye (' + bk.bakiye.join(' · ') + ' / ' + bk.top + ')');
        await w.click('[data-mmgeri]'); await w.waitForTimeout(600);
      } else check(true, 'Görev 55: muavinde ← / → (örnek mizanda tek hesap, atlandı)'); }
    await w.click('[data-mmtab=muavin]'); await w.waitForTimeout(800);
    let n = await w.$$eval('#mmTable tbody tr', t => t.length);
    check(n === 3, 'muavin satırları listelendi (' + n + ')');
    // tarih aralığı: muavin yalnız aralıktaki hareketlerle süzülür
    const mvTarih = await w.$$eval('#mmTable tbody tr td:nth-child(1)', t => t.map(x => x.textContent.trim()));
    if (mvTarih.length >= 2 && mvTarih[0] !== mvTarih[mvTarih.length - 1]) {
      const iso = d => d.split('.').reverse().join('-');
      await w.fill('#mmMvBas', iso(mvTarih[mvTarih.length - 1])); await w.press('#mmMvBas', 'Tab'); await w.waitForTimeout(600);
      const n2 = await w.$$eval('#mmTable tbody tr', t => t.length);
      check(n2 < 3 && n2 >= 1, 'muavin tarih aralığı süzdü (' + n2 + ' / 3)');
      await w.fill('#mmMvBas', ''); await w.press('#mmMvBas', 'Tab'); await w.waitForTimeout(600);
    } else check(true, 'muavin tarih aralığı (örnek veri tek günlü, atlandı)');
    n = await w.$$eval('#mmTable tbody tr', t => t.length);
    check(n === 3, 'muavin satırları listelendi (' + n + ')');
    await w.fill('[data-mmf=borc]', '>160'); await w.waitForTimeout(200);
    n = await w.$$eval('#mmTable tbody tr', t => t.length);
    check(n === 1, 'sütun filtresi (Borç >160) çalışıyor');
    await w.fill('[data-mmf=borc]', '');
    await w.click('[data-mmsort=alacak]'); await w.click('[data-mmsort=alacak]'); await w.waitForTimeout(200);
    const ilk = await w.$eval('#mmTable tbody tr td:nth-child(9)', x => x.textContent);
    check(/400/.test(ilk), 'başlığa tıklayınca sıralama (alacak azalan)');
    await w.click('[data-mmsort=alacak]'); await w.waitForTimeout(150);
    await w.click('#mmTable .fislink >> nth=0'); await w.waitForSelector('#mmFis:not([hidden])');
    const fisT = await w.textContent('#mmFisT'); const fisN = await w.$$eval('#mmFisB tbody tr', t => t.length);
    check(/Fiş 1 /.test(fisT) && fisN === 2, 'fiş no tıklanınca fişin tüm satırları açıldı (' + fisT + ', ' + fisN + ' satır)');
    await w.screenshot({ path: OUT + '/8b-fis.png' });
    // Görev 53: fiş PDF / Excel çıktısı — aynı ana hesap tekrarlanmıyorsa özet yok, imza alanları her durumda en altta
    { await app.evaluate(({ ipcMain }) => { const H = ipcMain._invokeHandlers; global.__g53 = { pdf: H && H.get('html-pdf'), xls: H && H.get('save-file') }; global.__g53c = {};
        ipcMain.removeHandler('html-pdf'); ipcMain.handle('html-pdf', (e, a) => { global.__g53c.pdf = a.html; return { ok: true }; });
        ipcMain.removeHandler('save-file'); ipcMain.handle('save-file', (e, a) => { global.__g53c.xls = Buffer.from(a.data).toString('base64'); return { ok: false }; }); });
      await w.click('#mmFisPdf'); await w.waitForTimeout(600); await w.click('#mmFisXls'); await w.waitForTimeout(600);
      const c53 = await app.evaluate(() => global.__g53c);
      const tekrar = await w.$$eval('#mmFisB tbody tr td:first-child', t => { const a = t.map(x => x.textContent.trim().slice(0, 3)); return a.some((k, i) => a.indexOf(k) !== i); });
      const pdf = c53.pdf || '';
      check(/Hazırlayan[\s\S]*Kontrol Eden[\s\S]*Onaylayan/.test(pdf) && /Ad Soyad/.test(pdf) && pdf.indexOf('Hazırlayan') > pdf.lastIndexOf('Toplam') && /Ana hesap özeti/.test(pdf) === tekrar,
        'muavin fiş PDF: imza alanları (Hazırlayan / Kontrol Eden / Onaylayan) en altta; ana hesap özeti yalnız aynı ana hesap tekrarlanınca (' + (tekrar ? 'var' : 'yok') + ')');
      const aoa = await w.evaluate(b => { const wb = XLSX.read(b, { type: 'base64' }); return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 }).map(r => r.join('|')); }, c53.xls || '');
      const xi = aoa.findIndex(r => /^Hazırlayan/.test(r));
      check(xi > aoa.findIndex(r => /Toplam/.test(r)) && /Kontrol Eden.*Onaylayan/.test(aoa[xi]) && aoa.some(r => /^Ad Soyad/.test(r)) && aoa.some(r => /Ana hesap özeti/.test(r)) === tekrar,
        'muavin fiş Excel: fiş satırlarının altında imza satırları; özet PDF ile aynı kurala göre');
      await app.evaluate(({ ipcMain }) => { ipcMain.removeHandler('html-pdf'); ipcMain.removeHandler('save-file'); if (global.__g53.pdf) ipcMain.handle('html-pdf', global.__g53.pdf); if (global.__g53.xls) ipcMain.handle('save-file', global.__g53.xls); }); }
    // Görev 55: fiş penceresinde "Luca'da aç" PDF / Excel düğmelerinin solunda; mevcut akışla (fisGoster) doğru fiş no / yıl gider
    { const yer = await w.evaluate(() => { const l = document.querySelector('#mmFisLuca'), p = document.querySelector('#mmFisPdf'), x = document.querySelector('#mmFisXls');
        return { var: !!l, solda: !!(l && p && x && (l.compareDocumentPosition(p) & 4) && (l.compareDocumentPosition(x) & 4) && l.getBoundingClientRect().right <= p.getBoundingClientRect().left + 1),
                 pasif: l ? l.disabled : null, ipucu: l ? l.title : '' }; });
      let istek = null;
      if (yer.var && !yer.pasif) {
        // Luca bağlı ve fişi gösteriyormuş gibi (ana süreçte istek yakalanır; gerçek Luca'ya gidilmez), sonra eski hâline
        await app.evaluate(({ ipcMain }) => { const H = ipcMain._invokeHandlers; global.__fgAsil = ['luca-status', 'luca-fis-goster'].map(ch => [ch, H && H.get(ch)]); global.__fgIstek = null;
          for (const [ch] of global.__fgAsil) ipcMain.removeHandler(ch);
          ipcMain.handle('luca-status', () => ({ loggedIn: true })); ipcMain.handle('luca-fis-goster', (e, a) => { global.__fgIstek = a; return { ok: true }; }); });
        await w.click('#mmFisLuca');
        for (let i = 0; i < 40 && !(await app.evaluate(() => global.__fgIstek)); i++) await w.waitForTimeout(150);
        const a = await app.evaluate(({ ipcMain }) => { const a = global.__fgIstek; for (const [ch, h] of global.__fgAsil) { ipcMain.removeHandler(ch); if (h) ipcMain.handle(ch, h); } return a; });
        istek = await w.evaluate(a => { const r = window.__mmui._st.fisAcik.r; return a && { ...a, beklenen: { fisNo: String(r.fis_no), year: String(r.tarih).slice(0, 4) } }; }, a);
        await w.waitForFunction(() => document.querySelector('#mwBusy') ? document.querySelector('#mwBusy').hidden : true, null, { timeout: 8000 }).catch(() => {});
      }
      check(yer.var && yer.solda && (yer.pasif ? /Luca karşılığı yok/.test(yer.ipucu) : !!istek && istek.fisNo === istek.beklenen.fisNo && istek.year === istek.beklenen.year),
        'Görev 55: fiş penceresinde "Luca\'da aç" PDF / Excel düğmelerinin solunda; ' + (yer.pasif ? 'firmanın Luca karşılığı yok: pasif, nedeni ipucunda' : 'Luca\'da aç isteği doğru fiş / yılla gitti (' + JSON.stringify(istek) + ')')); }
    await w.click('#mmFisX');
    // muavini Excel'den yükle: önce program sorulur
    await w.click('[data-mmyukle=muavin]'); await w.waitForSelector('#mmYk:not([hidden])');
    check(await w.isDisabled('#mmYkDosya') && await w.isDisabled('#mmYkTamam'), 'muavin yükleme: program seçilmeden dosya seçilemiyor');
    await w.selectOption('#mmYkProg', 'luca'); await w.selectOption('#mmYkAy', '8'); await w.selectOption('#mmYkYil', '2026');
    await w.setInputFiles('#mmYkDosya', mvx); await w.screenshot({ path: OUT + '/8c-muavin-yukle.png' });
    await w.click('#mmYkTamam'); await w.waitForSelector('#mmYk', { state: 'hidden', timeout: 30000 }); await w.waitForTimeout(800);
    check(/2026/.test(await w.$eval('#mmDonem', s => s.selectedOptions[0].textContent)) && await w.$$eval('#mmTable tbody tr', t => t.length) === 3, 'muavin Excel\'den yüklendi; aynı aylar iki dosyada olsa da birleşik görünümde bir kez (3 satır)');
    check(fs.existsSync(path.join(hd, 'firmalar', 'EXPO İNŞ', '2026', '08', 'muavin.xlsx')), 'yüklenen muavin firmanın dönem klasöründe');
    await w.click('[data-mmcek]'); await w.waitForSelector('#mmYk:not([hidden])');
    check(/EXPO/.test(await w.$eval('#mmYkFirma', s => s.selectedOptions[0].textContent)) && !!(await w.$('#mmYkCek')), 'muavin: Luca\'dan yeniden çek penceresi');
    await w.click('#mmYkIptal');
    // 2.9.6: Dönem = süzgeç (tüm dönemler / yıl / ay); firmanın muavin dosyaları birleştirilir
    { const secs = await w.$$eval('#mmDonem option', o => o.map(x => x.value)); const ay = mvTarih[0] ? mvTarih[0].split('.').reverse().join('-').slice(0, 7) : '2026-09';
      await w.selectOption('#mmDonem', '2026-01'); await w.waitForTimeout(500); const n0 = await w.$$eval('#mmTable .fislink', t => t.length);
      await w.selectOption('#mmDonem', ay); await w.waitForTimeout(500); const n1 = await w.$$eval('#mmTable .fislink', t => t.length);
      await w.selectOption('#mmDonem', '2026'); await w.waitForTimeout(500);
      check(secs.includes('2026') && secs.includes('2026-12') && n0 === 0 && n1 >= 1, 'muavin dönemi: yıl ve aylar seçilebilir; ay seçince yalnız o ayın hareketleri (' + n0 + '/' + n1 + ')'); }
    // 2.9.6: muavin bu ekrandan çıkmadan Luca oturumuyla çekilir; "Tümünü Luca'dan Çek" hesap planı → muavin → mizan
    await app.evaluate(({ ipcMain }) => { global.__cek = [];
      for (const ch of ['luca-status', 'luca-muavin-indir', 'luca-hesap-plani', 'luca-mizan']) ipcMain.removeHandler(ch);
      ipcMain.handle('luca-status', () => ({ loggedIn: global.__lucaBagli !== false }));
      ipcMain.handle('luca-muavin-indir', (e, a) => { global.__cek.push('muavin:' + a.ay); return new Promise(r => setTimeout(() => r({ id: 'EXPO İNŞ/2026/09', satir: 3 }), 2500)); });
      ipcMain.handle('luca-hesap-plani', (e, a) => { global.__cek.push('plan'); return { year: String(a.year), hesaplar: [['100', 'KASA'], ['100.01', 'TL KASA'], ['320', 'SATICILAR'], ['320.01', 'ABC LTD']], kaynak: 'rapor' }; });
      ipcMain.handle('luca-mizan', (e, a) => { global.__cek.push('mizan'); return { year: String(a.year), donemId: '1', rows: [['100', 'KASA', 5000, 1200], ['100.01', 'TL KASA', 5000, 1200], ['320', 'SATICILAR', 300, 9000], ['320.01', 'ABC LTD', 300, 9000], ['600', 'YURTİÇİ SATIŞLAR', 0, 25000], ['102', 'BANKALAR', 0, 0], ['335', 'PERSONELE BORÇLAR', 500, 500]].map(r => [r[0], r[1], '', r[2], r[3]]) }; }); });
    // Luca giriş düğmesi tek: üst şeritte (#lucaTopBtn). Sayfalarda / araç çubuğunda ayrı "Luca'ya bağlan" düğmesi yok
    await w.waitForFunction(() => document.querySelector('#lucaTopBtn').classList.contains('luca-on'), null, { timeout: 8000 }).catch(() => {});
    { const d = await w.evaluate(() => { const L = [...document.querySelectorAll('[data-lucabag],[data-luca="connect"]')]; return { n: L.length, ids: L.map(b => b.id), t: (document.querySelector('#lucaTopBtn') || {}).textContent, on: document.querySelector('#lucaTopBtn').classList.contains('luca-on') }; });
      check(d.n === 1 && d.ids[0] === 'lucaTopBtn' && d.on && /● Luca bağlı/i.test(d.t), 'Luca giriş düğmesi yalnız üst şeritte; bağlıyken "● Luca bağlı" (' + JSON.stringify(d) + ')'); }
    await app.evaluate(({ BrowserWindow }) => { global.__lucaBagli = false; for (const x of BrowserWindow.getAllWindows()) x.webContents.send('luca-event', 'durum', { loggedIn: false, windows: 0 }); });
    await w.waitForTimeout(300);
    { const off = await w.evaluate(() => [...document.querySelectorAll('[data-lucabag],[data-luca="connect"]')].every(b => b.classList.contains('luca-off')));
      check(/^Luca'ya giriş$/i.test((await w.textContent('#lucaTopBtn')).trim()), 'bağlı değilken üst şerit düğmesi "Luca\'ya giriş"');
      // Luca gerektiren işlem bağlantı yokken sessiz kalmaz: açık uyarı + üst şeritteki giriş düğmesi vurgulanır
      await app.evaluate(({ ipcMain }) => { global.__lucaAcildi = 0; const H = ipcMain._invokeHandlers; global.__lucaOpenAsil = H && H.get('luca-open'); ipcMain.removeHandler('luca-open'); ipcMain.handle('luca-open', () => { global.__lucaAcildi++; return {}; }); });
      await w.evaluate(() => { document.querySelector('#toast').textContent = ''; window.__bk = window.__lucaBag.bekle().then(() => 'ok', e => String(e)); });
      await w.waitForFunction(() => /Luca bağlı değil/.test(document.querySelector('#toast').textContent || ''), null, { timeout: 4000 }).catch(() => {});
      const u = await w.evaluate(() => ({ t: document.querySelector('#toast').textContent, v: document.querySelector('#lucaTopBtn').classList.contains('vurgu') }));
      check(/Luca bağlı değil/.test(u.t) && /üst şerit/i.test(u.t) && u.v && await app.evaluate(() => global.__lucaAcildi) === 1, 'Luca yokken Luca gerektiren işlem: uyarı gösterildi, üst şeritteki giriş düğmesi vurgulandı (' + u.t.slice(0, 80) + ')');
      await app.evaluate(() => { global.__lucaBagli = true; });
      await w.evaluate(() => { const b = document.createElement('button'); b.className = 'btn luca-off lucabag'; b.dataset.lucabag = '1'; b.id = 'yeniLB'; document.body.appendChild(b); });
      await w.waitForFunction(() => document.querySelector('#yeniLB').classList.contains('luca-on'), null, { timeout: 7000 }).catch(() => {});
      const yeni = await w.evaluate(() => { const b = document.querySelector('#yeniLB'); const r = b.classList.contains('luca-on'); b.remove(); return r; });
      check(off && yeni, 'ana süreçten gelen durum olayı düğmeleri hemen boyar; sonradan çizilen düğme de son durumu alır');
      const bk = await w.evaluate(() => Promise.race([window.__bk, new Promise(r => setTimeout(() => r('zaman aşımı'), 6000))]));
      check(bk === 'ok' && !(await w.$eval('#lucaTopBtn', b => b.classList.contains('vurgu'))), 'Luca bağlanınca bekleyen işlem devam etti, vurgu kalktı (' + bk + ')');
      await app.evaluate(({ ipcMain }) => { ipcMain.removeHandler('luca-open'); if (global.__lucaOpenAsil) ipcMain.handle('luca-open', global.__lucaOpenAsil); }); }
    await w.click('[data-mmcek]'); await w.waitForSelector('#mmYk:not([hidden])'); await w.click('#mmYkCek');
    await w.waitForFunction(() => { const b = document.querySelector('#mwBusyIptal'); return b && !b.hidden && /arka/i.test(b.textContent) && !document.querySelector('#mwBusy').hidden; }, null, { timeout: 5000 }).catch(() => {});
    const arkaAd = await w.textContent('#mwBusyIptal').catch(() => '');
    await w.waitForFunction(() => /muavin Luca'dan alındı/i.test(document.querySelector('#toast') && document.querySelector('#toast').textContent || ''), null, { timeout: 15000 }).catch(() => {});
    { const tt = await w.textContent('#toast'); const cs = await app.evaluate(() => global.__cek.join(','));
      check(/arka planda bekle/i.test(arkaAd) && await w.isVisible('#mmPanel') && /muavin:2026/.test(cs), 'muavin bu ekrandan çıkmadan çekildi; beklerken "Arka planda bekle" seçeneği var (' + arkaAd + ' | ' + tt + ' | ' + cs + ')'); }
    await w.waitForTimeout(600);
    check(await w.isVisible('#mmTumCek'), '"Tümünü Luca\'dan Çek" düğmesi Luca bağlantısının solunda');
    await w.click('#mmTumCek');
    await w.waitForFunction(() => /hesap planı .*muavin.*mizan/i.test(document.querySelector('#toast') && document.querySelector('#toast').textContent || ''), null, { timeout: 20000 }).catch(() => {});
    const cekSira = await app.evaluate(() => global.__cek.join(','));
    check(/^muavin:2026-\d\d,plan,muavin:2026-\d\d,mizan$/.test(cekSira) && await w.isVisible('#mmPanel'), 'Tümünü Luca\'dan çek: hesap planı → muavin → mizan sırayla (' + cekSira + ')');
    // hesap planında hesaba tıklayınca o hesabın muavini (mizandaki gibi)
    // (Görev 24) sabit beklemeler yerine koşul beklenir: "Tümünü Çek" bitmeden / plan tablosu çizilmeden tıklanınca tıklama boşa gidiyordu
    await w.waitForSelector('#mwBusy', { state: 'hidden', timeout: 20000 }).catch(() => {});
    await w.click('[data-mmtab=plan]');
    await w.waitForSelector('#mmTable tbody tr[data-kod="320.01"]', { timeout: 15000 }).catch(() => {});
    await w.click('#mmTable tbody tr[data-kod="320.01"] td >> nth=1').catch(() => {});
    await w.waitForFunction(() => /320\.01/.test((document.querySelector('#mmBar .mmhesap') || {}).textContent || ''), null, { timeout: 15000 }).catch(() => {});
    { const hb = await w.textContent('#mmBar .mmhesap').catch(() => ''); const geri = await w.textContent('[data-mmgeri]').catch(() => '');
      check(/320\.01/.test(hb) && /hesap planına/i.test(geri) && await w.getAttribute('[data-mmtab=muavin]', 'aria-pressed') === 'true', 'hesap planında hesaba tıklayınca o hesabın muavini açıldı (' + hb.trim() + ')');
      await w.click('[data-mmgeri]').catch(() => {});
      await w.waitForSelector('[data-mmtab=plan][aria-pressed=true]', { timeout: 10000 }).catch(() => {});
      check(await w.getAttribute('[data-mmtab=plan]', 'aria-pressed') === 'true', '"Hesap planına dön" ile plana dönüldü'); }
    await w.click('[data-mmtab=muavin]'); await w.waitForTimeout(700);
    await w.click('[data-mmhx]').catch(() => {}); await w.waitForTimeout(400);
    await w.check('#mmGrup'); await w.waitForTimeout(500);
    check(await w.$$eval('#mmTable tbody tr', t => t.length) === 2, 'hesap bazında toplama (muavinden mizan)');
    await w.screenshot({ path: OUT + '/8-muavin.png' });
    // sekmeler aynı firmayı paylaşır: muavindeki firma → mizan → plan; mizanda firma değişince muavin de o firmaya geçer
    { const mvF = await w.$eval('#mmMvFirm', s => s.value);
      await w.click('[data-mmtab=plan]'); await w.waitForTimeout(500); const plF = await w.$eval('#mmFirm', s => 's:' + s.value);
      await w.click('[data-mmtab=mizan]'); await w.waitForTimeout(500); const mzF = await w.$eval('#mmFirm', s => 's:' + s.value);
      check(mvF === plF && plF === mzF, 'Muavin / Hesap Planı / Mizan aynı firmada (' + mvF + ')');
      const baska = await w.$eval('#mmFirm', s => [...s.options].map(o => o.value).find(v => v !== s.value));
      if (baska) { await w.selectOption('#mmFirm', baska); await w.waitForTimeout(500);
        await w.click('[data-mmtab=muavin]'); await w.waitForTimeout(600);
        check((await w.$eval('#mmMvFirm', s => s.value)) === 's:' + baska && (await w.evaluate(() => window.__app.S.firmId)) === baska, 'mizanda seçilen firma muavine ve programın ana firmasına geçti');
        await w.selectOption('#mmMvFirm', mvF); await w.waitForTimeout(600); }
      await w.click('[data-mmtab=mizan]'); await w.waitForTimeout(600); }
    const mz = await w.$$eval('#mmTable tbody tr', t => t.map(x => x.textContent));
    check(mz.length === 7 && mz.some(x => x.includes('ABC LTD') && x.includes('8.700,00')), 'mizan bakiyeleriyle listelendi');
    // sağ tık: görünüm seçenekleri
    await w.click('#mmTable tbody tr >> nth=0', { button: 'right' }); await w.waitForSelector('.mmmenu:not([hidden])');
    check(await w.$$eval('.mmmenu [data-gor]', b => b.length) === 4, 'sağ tıkta 4 görünüm seçeneği');
    await w.screenshot({ path: OUT + '/9b-mizan-menu.png' });
    await w.click('.mmmenu [data-gor=calisan]'); await w.waitForTimeout(200);
    const cal = await w.$$eval('#mmTable tbody tr', t => t.map(x => x.textContent));
    check(cal.length === 6 && !cal.some(x => x.includes('BANKALAR')), 'sadece çalışan hesaplar (hareketsiz 102 gizli)');
    await w.click('#mmTable tbody tr >> nth=0', { button: 'right' }); await w.click('.mmmenu [data-gor=bakiyeli]'); await w.waitForTimeout(200);
    const bak = await w.$$eval('#mmTable tbody tr', t => t.map(x => x.textContent));
    check(bak.length === 5 && !bak.some(x => x.includes('PERSONELE')), 'bakiyeli hesaplar (bakiyesiz 335 gizli)');
    await w.click('#mmTable tbody tr >> nth=0', { button: 'right' }); await w.click('.mmmenu [data-gor=tumu]'); await w.waitForTimeout(200);
    await w.fill('#mmQ', 'kasa'); await w.waitForTimeout(200);
    check(await w.$$eval('#mmTable tbody tr', t => t.length) === 2, 'mizanda arama');
    await w.fill('#mmQ', ''); await w.selectOption('#mmLevel', '1'); await w.waitForTimeout(200);
    check(await w.$$eval('#mmTable tbody tr', t => t.length) === 5, 'mizanda düzey filtresi (ana hesaplar)');
    await w.selectOption('#mmLevel', 'all');
    await w.screenshot({ path: OUT + '/9-mizan.png' });
    // mizanı olmayan firmaya Excel'den mizan yükle
    await w.selectOption('#mmFirm', 'mf2'); await w.waitForTimeout(400);
    check(/mizan yok/.test(await w.textContent('#mmTable')), 'mizanı olmayan firma listede, uyarıyla');
    await w.click('[data-mmyukle=mizan]'); await w.waitForSelector('#mmYk:not([hidden])');
    check(await w.isDisabled('#mmYkDosya'), 'mizan yükleme: önce program');
    await w.selectOption('#mmYkProg', 'luca'); await w.setInputFiles('#mmYkDosya', mzx); await w.click('#mmYkTamam');
    await w.waitForSelector('#mmYk', { state: 'hidden' }); await w.waitForTimeout(500);
    const ym = await w.$$eval('#mmTable tbody tr', t => t.map(x => x.textContent));
    check(ym.length === 6 && ym.some(x => x.includes('SATIŞLAR') && x.includes('2.500,50')), 'mizan Excel\'den tutarlarıyla yüklendi');
    await w.click('#mmTable tbody tr >> nth=0', { button: 'right' }); await w.click('.mmmenu [data-gor=calisan]'); await w.waitForTimeout(200);
    check(await w.$$eval('#mmTable tbody tr', t => t.length) === 4, 'yüklenen mizanda çalışan hesaplar');
    check(await w.$$eval('#mmTable tbody tr.ters', t => t.map(x => x.textContent)).then(x => x.length === 1 && x[0].includes('159')), 'ters bakiyeli hesap (159 alacak bakiye) kırmızı');
    await w.click('#mmTable tbody tr >> nth=0', { button: 'right' }); await w.click('.mmmenu [data-gor=ters]'); await w.waitForTimeout(200);
    check(await w.$$eval('#mmTable tbody tr', t => t.length === 1 && t[0].classList.contains('ters')), 'sağ tık 4: yalnız ters bakiyeli (kırmızı) hesaplar');
    await w.click('#mmTable tbody tr >> nth=0', { button: 'right' }); await w.click('.mmmenu [data-gor=calisan]'); await w.waitForTimeout(200);
    await w.screenshot({ path: OUT + '/9c-mizan-yukle.png' });
    // Luca hesap planına hesap ekleme (Luca istekleri sahte)
    await app.evaluate(({ ipcMain }) => { global.__hp = [];
      for (const ch of ['luca-status', 'luca-hesap-plani', 'luca-hesap-ekle']) ipcMain.removeHandler(ch);
      ipcMain.handle('luca-status', () => ({ loggedIn: true }));
      ipcMain.handle('luca-hesap-plani', () => ({ year: '2026', firma: 'X', hesaplar: [['320', 'SATICILAR'], ['320.01', 'YURTİÇİ'], ['320.01.001', 'A'], ['320.01.007', 'B']] }));
      ipcMain.handle('luca-hesap-ekle', (e, a) => { global.__hp.push(a); return a.hesaplar.map(h => ({ ...h, ok: true, mesaj: 'Kayıt eklendi' })); }); });
    await w.evaluate(async () => { const f = window.__app.Store.local().firms.mf2; await window.__app.Store.saveFirm({ ...f, lucaId: '55' }); });
    await w.click('#mmHesapEkle'); await w.waitForSelector('#hpPanel:not([hidden]) #hpOku');
    await w.click('#hpOku'); await w.waitForTimeout(600);
    await w.fill('[data-hpk="0"]', '320.01'); await w.waitForTimeout(150);
    const hl1 = await w.$$eval('#hpListe tbody tr', t => t.map(x => x.textContent));
    check(hl1.length >= 3 && hl1.every(x => x.includes('320.01')), 'hesap ekleme: yazılan kodla başlayan hesaplar canlı listelendi (320.01)');
    await w.fill('[data-hpk="0"]', '320.01.00'); await w.waitForTimeout(150);
    const hl2 = await w.$$eval('#hpListe tbody tr', t => t.length);
    check(hl2 >= 2 && hl2 < hl1.length, 'hesap ekleme: kod uzadıkça liste daraldı');
    await w.fill('[data-hpk="0"]', '320.01'); await w.click('[data-hponer="0"]');
    check(await w.inputValue('[data-hpk="0"]') === '320.01.008', 'hesap ekleme: üst hesaptan sıradaki kod önerildi (320.01.008)');
    await w.fill('[data-hpa="0"]', 'YENİ SATICI A.Ş.'); await w.click('#hpYeni'); await w.fill('[data-hpk="1"]', '320.01.007'); await w.fill('[data-hpa="1"]', 'KOPYA');
    check(/planda var/i.test(await w.textContent('[data-hpd="1"]')), 'hesap ekleme: var olan kod uyarısı');
    await w.click('#hpKaydet'); await w.waitForSelector('#askModal:not([hidden])'); await w.click('#askYes'); await w.waitForTimeout(1200);
    const hpg = await app.evaluate(() => global.__hp);
    check(hpg.length === 1 && hpg[0].lucaId === '55' && hpg[0].hesaplar.length === 1 && hpg[0].hesaplar[0].kod === '320.01.008', 'hesap ekleme: yalnız eklenebilir hesap Luca\'ya gönderildi');
    check(await w.evaluate(async () => (await window.__app.Store.getMizan('mf2')).some(r => r[0] === '320.01.008')), 'eklenen hesap programdaki mizana da yazıldı');
    if (await w.isVisible('#hpIptal')) await w.click('#hpIptal');
    if (await w.isVisible('#hpKapat')) await w.click('#hpKapat');
    // Hesap Planı sekmesi + sağ tık → bu hesabın altına ekle
    await w.click('[data-mmtab="plan"]'); await w.waitForTimeout(600);
    const plr = await w.$$eval('#mmTable tbody tr[data-kod]', t => t.map(x => x.dataset.kod));
    check(plr.includes('320.01.008') && plr.includes('320.01.001'), 'Hesap Planı sekmesi Luca planını (eklenen hesapla) gösterdi');
    await w.click('#mmTable tbody tr[data-kod="320.01"]', { button: 'right' }); await w.click('.mmmenu [data-hpek]');
    await w.waitForSelector('#hpPanel:not([hidden])');
    check(await w.inputValue('[data-hpk="0"]') === '320.01.', 'sağ tık: hesap ekle sağ tıklanan hesabın kodunu getirdi');
    await w.click('#hpKapat'); await w.waitForTimeout(200);
    // her hesap kutusunda canlı liste ve "bu hesap yok, eklensin mi?"
    await w.evaluate(() => { const i = document.createElement('input'); i.id = 'hsTest'; i.setAttribute('list', 'cekAccList'); i.dataset.hsad = 'DENEME LTD'; document.querySelector('#mmPanel').appendChild(i); });
    await w.click('#hsTest'); await w.type('#hsTest', '320.01.00'); await w.waitForTimeout(300);
    const hsl = await w.$$eval('#hsDrop [data-hs]', t => t.map(x => x.dataset.hs));
    check(!(await w.isHidden('#hsDrop')) && hsl.includes('320.01.008') && hsl.every(k => k.startsWith('320.01.00')), 'hesap kutusu: yazdıkça plan hesapları açılır listede');
    await w.fill('#hsTest', '320.01.099'); await w.press('#hsTest', 'Tab');
    await w.waitForSelector('#hsSor:not([hidden])');
    check(await w.inputValue('#hsAd') === 'DENEME LTD', 'olmayan kod: "eklensin mi?" soruldu, ad önerildi');
    await w.click('#hsEvet'); await w.waitForTimeout(1200);
    const hpg2 = await app.evaluate(() => global.__hp);
    check(hpg2.length === 2 && hpg2[1].hesaplar[0].kod === '320.01.099' && hpg2[1].hesaplar[0].ad === 'DENEME LTD', 'olmayan kod Luca\'ya hemen eklendi');
    await w.evaluate(() => document.querySelector('#hsTest').remove());
    await w.click('[data-mmtab="mizan"]'); await w.waitForTimeout(300);
    await w.click('#mmClose');
    // muavin sekmesi: Luca'dan yeniden çek → Fatura modülünde yalnız muavin adımı başlar
    await w.click('#mmBtn'); await w.waitForSelector('#mmPanel:not([hidden])'); await w.waitForTimeout(600);
    if (await w.getAttribute('[data-mmtab=muavin]', 'aria-pressed') !== 'true') { await w.click('[data-mmtab=muavin]'); await w.waitForTimeout(600); }
    await w.click('[data-mmcek]'); await w.waitForSelector('#mmYk:not([hidden])');
    await w.selectOption('#mmYkAy', '9'); await w.selectOption('#mmYkYil', '2026'); await w.click('#mmYkCek');
    await w.waitForTimeout(2500);
    { const cs = await app.evaluate(() => global.__cek.join(','));
      check(/muavin:2026-09$/.test(cs) && await w.isVisible('#mmPanel'), 'Muavin sayfasından Luca\'dan yeniden çek: muavin bu ekranda indirildi (Fatura modülüne geçmedi) (' + cs + ')'); }
    await w.click('#mmClose');
    // Veri ve yedek: Fatura Kontrol bölümü
    await w.click('#homeLogo'); await w.waitForSelector('#modGate:not([hidden])');
    check(true, 'sol üstteki MuhaWin logosu modül seçimine götürüyor');
    check(/Lisanslı/.test(await w.textContent('#modLisDurum')), 'modül ekranı tek lisansın bitişini gösteriyor');
    // ÖKC Fiş Girişi: görüntü ekle → oku → fiş → Luca
    check(await w.$eval('.modcard[data-mod=denetim]', b => b.disabled) && await w.$eval('.modcard[data-mod=gecici]', b => b.disabled), 'Denetim ve Geçici Vergi pasif (Yakında)');
    const gorsel = path.join(OUT, 'okc'); fs.mkdirSync(gorsel, { recursive: true });
    require('child_process').execFileSync('python3', ['-c', `
from PIL import Image, ImageDraw, ImageFont
f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf', 22)
def yaz(ad, satirlar, aci=0):
    img = Image.new('L', (560, 40 + len(satirlar) * 30), 255); d = ImageDraw.Draw(img)
    for i, l in enumerate(satirlar): d.text((10, 15 + i * 30), l, font=f, fill=0)
    (img.rotate(aci, expand=True, fillcolor=255) if aci else img).save(${JSON.stringify(gorsel)} + '/' + ad)
yaz('fis1.png', ["      ÖRNEK GIDA SAN. TİC. LTD. ŞTİ.","    KONYAALTI CAD. NO:12 ANTALYA","   ANTALYA KURUMLAR V.D. 1234567890","","TARİH : 14/09/2026     SAAT : 13:42","FİŞ NO : 0057","","EKMEK                  %1     *20,00","SÜT                    %1     *45,50","DETERJAN               %20   *150,00","PİL                    %20    *89,90","------------------------------------","TOPKDV                        *40,59","TOPLAM                       *305,40","KREDİ KARTI                  *305,40","","Z NO : 0412    EKÜ NO : 0001"], 1.2)
yaz('z1.png', ["      ÖRNEK GIDA SAN. TİC. LTD. ŞTİ.","   ANTALYA KURUMLAR V.D. 1234567890","TARİH : 30/09/2026     SAAT : 22:10","             Z RAPORU","Z NO : 0412","FİŞ SAYISI : 0187","%1 KDV                      *41,12","%1 TOPLAM                *4.153,40","%20 KDV                  *2.106,33","%20 TOPLAM              *12.637,98","TOPKDV                    *2.147,45","TOPLAM                   *16.791,38","NAKİT                     *6.791,38","KREDİ KARTI              *10.000,00","KÜMÜLATİF TOPLAM      *1.234.567,89","EKÜ NO : 0001"])
`]);
    await w.evaluate(async () => { const { Store } = window.__app;
      await Store.saveFirm({ id: 'okf', name: 'ÖKC FİRMA', lucaId: '77', banks: [], mizanInfo: { source: 'luca', year: '2026', at: new Date().toISOString(), parts: 1 },
        okcAyar: { fisGider: '770.01', fisNakit: '100.01', fisKredi: '300.01', zSatis: '600.01', zKasa: '100.01', zKredi: '108.01' } });
      await Store.saveMizan('okf', [['100.01', 'KASA'], ['108.01', 'KREDİ KARTI TAHSİLAT'], ['191.01.01', '%1 İndirilecek KDV'], ['191.01.20', '%20 İndirilecek KDV'], ['300.01', 'KREDİ KARTI BORÇLARI'],
        ['391.01.01', '%1 Hesaplanan KDV'], ['391.01.20', '%20 Hesaplanan KDV'], ['600.01', 'YURTİÇİ SATIŞLAR'], ['770.01', 'GENEL YÖNETİM GİDERLERİ']]); });
    await w.click('.modcard[data-mod=okc]'); await w.waitForSelector('#okcPanel:not([hidden])');
    check(/Belgeden Fiş/.test(await w.textContent('#h1Mod')) && await w.isHidden('.app'), 'Belgeden Fiş modülü açıldı');
    await w.selectOption('#firmSel', 'okf'); await w.waitForTimeout(300);
    await w.evaluate(p => window.__okc._ekle([p]), path.join(gorsel, 'fis1.png'));
    await w.waitForSelector('#okcTable tbody tr[data-id]', { timeout: 60000 });
    const okf = await w.evaluate(() => { const b = Object.values(window.__app.Store.local().okc.okf)[0]; const s = window.__okc._satirlar(b);
      return { text: b.text, topkdv: b.topkdv, tarih: b.tarih, no: b.fisNo, vkn: b.vkn, odeme: b.odeme, oran: b.oranlar.map(o => o.oran + ':' + o.matrah + '/' + o.kdv).join(' '), L: s.L.map(x => x.acc + ':' + (x.b ? 'B' + x.b : 'A' + x.c)).join(' '), err: s.err }; });
    console.log('OKC FIS', JSON.stringify(okf));
    check(okf.tarih === '2026-09-14' && okf.no === '0057' && okf.vkn === '1234567890' && okf.odeme === 'kredi', 'ÖKC fişi okundu (tarih, fiş no, VKN, kredi kartı)');
    check(okf.oran === '1:64.85/0.65 20:199.96/39.94', 'fiş KDV oranları ve tutarları (TOPKDV ile kuruş farkı düzeltildi)');
    check(okf.L === '770.01:B264.81 191.01.01:B0.65 191.01.20:B39.94 300.01:A305.4' && !okf.err.length, 'ÖKC fişi muhasebe fişi: gider + KDV borç, kredi kartı alacak');
    await w.screenshot({ path: OUT + '/13-okc-fis.png' });
    // 2.9.6: ÖKC fişinde binek araç kısıtlaması da 950 / 951 nazım kaydına gider
    const okBinek = await w.evaluate(() => { const O = window.__okc, st = O._st;
      for (const [k, v] of [['770.90', 'KKEG BİNEK ARAÇ'], ['770.91', 'İNDİRİLEMEYEN BİNEK ARAÇ KDV'], ['950.15', 'BİNEK ARAÇ GİDER KISITLAMASI'], ['951.15', 'BİNEK ARAÇ GİDER KISITLAMASI'], ['950.01', 'KKEG']]) { st.acc.set(k, v); st.leaf.add(k); }
      const b = { ...Object.values(window.__app.Store.local().okc.okf)[0], binek: true }; const s = O._satirlar(b);
      const r = s.L.map(x => x.acc + ':' + (x.b ? 'B' + x.b : 'A' + x.c)).join(' ');
      for (const k of ['770.90', '770.91', '950.15', '951.15', '950.01']) { st.acc.delete(k); st.leaf.delete(k); } return r; });
    check(/770\.90:B79\.44 .*950\.15:B91\.62 951\.15:A91\.62$/.test(okBinek), 'ÖKC binek araç: KKEG gider + KDV %30 toplamı 950 borç / 951 alacak nazım kaydı (' + okBinek + ')');
    // 2.9.6: Yurt dışı faturaları (Meta vb.): PDF → net ödenen → brüt; %15 stopaj 360, %20 sorumlu KDV 191 / 360
    const ydPdf = path.join(gorsel, 'meta_fatura.pdf');
    require('child_process').execFileSync('python3', ['-c', `
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
pdfmetrics.registerFont(TTFont('DV', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
c = canvas.Canvas(${JSON.stringify(ydPdf)}); c.setFont('DV', 11); y = 800
for l in ['Meta', 'Nurullah Doğru için Fatura', 'Hesap No: 96990967', 'Fatura/Ödeme Tarihi', '15 Kas 2024 01:21', 'Ödeme Yöntemi', 'MasterCard · 0853', 'Referans Numarası: VETJSG48Q2',
          'Ödendi', '₺10.866,00 TRY', 'Ürün Türü', 'Meta reklamlar', 'Kampanyalar', '14 Kas 2024 00:00 - 15 Kas 2024 01:21 arası   ₺10.866,00', 'Reklam seti 409 Gösterim ₺1.203,56',
          'Meta Platforms Ireland Limited', 'Merrion Road', 'Dublin 4', 'Ireland', 'VAT Reg. No. IE9692928F   Türkiye VAT Reg. No. 1234567881', 'Fatura # FBADS-568-103903145']:
    c.drawString(60, y, l); y -= 22
c.save()`]);
    await w.evaluate(async () => { const { Store } = window.__app; const m = await Store.getMizan('okf', 1);
      await Store.saveMizan('okf', [...m, ['300.01', 'KREDİ KARTI BORÇLARI'], ['191.20', 'SORUMLU SIFATIYLA ÖDENEN KDV (10/10 TEVKİFAT)'], ['360.01', 'ÖDENECEK KDV'], ['360.05', 'YURT DIŞI HİZMET ALIMI STOPAJI'], ['360.06', 'SORUMLU SIFATIYLA KDV 10/10'],
        ['760.10', 'YURT DIŞI REKLAM GİDERLERİ'], ['760.11', 'REKLAM GİDERLERİ']]); await window.__okc._yenile(); });
    await w.click('[data-okctur=yd]'); await w.waitForTimeout(200);
    check(/PDF/.test(await w.textContent('#okcEkle')), 'ÖKC: Yurt dışı faturaları bölümü ve PDF / görüntü ekleme düğmesi');
    const ydOnce = await w.evaluate(() => Object.values(window.__app.Store.local().okc.okf).filter(b => b.tur === 'yd').length);
    await w.evaluate(p => window.__okc._ekle([p, p]), ydPdf);
    await w.waitForFunction(n => Object.values(window.__app.Store.local().okc.okf).filter(b => b.tur === 'yd').length >= n + 2, ydOnce, { timeout: 60000 });
    const yd = await w.evaluate(() => { const bs = Object.values(window.__app.Store.local().okc.okf).filter(b => b.tur === 'yd'); const b = bs[bs.length - 1]; const s = window.__okc._satirlar(b);
      return { f: [b.tarih, b.no, b.unvan, b.vkn, b.pb, b.doviz, b.odeme, b.hizmet].join('|'), url: /^file:.*\.png$/.test(b.url || ''), L: s.L.map(x => x.acc + ':' + (x.b ? 'B' + x.b : 'A' + x.c)).join(' '), err: s.err, n: bs.length }; });
    console.log('YD', JSON.stringify(yd));
    check(yd.f === '2024-11-15|FBADS-568-103903145|Meta Platforms Ireland Limited|IE9692928F|TRY|10866|kredi|reklam' && yd.url, 'yurt dışı PDF faturası okundu (tarih, fatura no, satıcı, VAT, tutar, kart) ve ilk sayfa görüntüsü çıkarıldı (' + yd.f + ')');
    // PDF okuyucu güvenliği (Görev 12, CVE-2024-4367): her getDocument çağrısı isEvalSupported:false ile; banka ekstresi PDF'i yine okunur
    { const kaynak = fs.readFileSync(path.join(APP, 'renderer', 'app.js'), 'utf8');   // Görev 28: arayüz betiği index.html'den app.js'e taşındı
      const cagri = kaynak.match(/pdfjsLib\.getDocument\(\{.*?\}\)\.promise/g) || [];
      check(cagri.length >= 3 && cagri.every(c => /isEvalSupported:false/.test(c)), 'pdf.js: her getDocument çağrısında isEvalSupported:false (' + cagri.length + ' çağrı)');
      { const v = path.join(APP, 'renderer', 'vendor'); const surum = (fs.readFileSync(path.join(v, 'pdf.min.mjs'), 'utf8').match(/apiVersion:"(\d+\.\d+\.\d+)"/) || [])[1] || '';
        check(/^5\./.test(surum) && fs.existsSync(path.join(v, 'pdf.worker.min.mjs')) && !fs.existsSync(path.join(v, 'pdf.min.js')), 'pdf.js 5.x (ES modülü + worker), eski 3.11 dosyaları yok (' + surum + ')'); }
      // Görev 28: satır içi betik yok; CSP script-src 'unsafe-inline' içermiyor ve oturum boyunca CSP ihlali yok
      const csp = f => ((fs.readFileSync(path.join(APP, 'renderer', f), 'utf8').match(/Content-Security-Policy" content="([^"]*)"/) || [])[1] || '');
      const satirIci = f => /<script(?![^>]*\bsrc=)[^>]*>/i.test(fs.readFileSync(path.join(APP, 'renderer', f), 'utf8')) || /\son[a-z]+\s*=\s*["']/i.test(fs.readFileSync(path.join(APP, 'renderer', f), 'utf8'));
      check(['index.html', 'splash.html'].every(f => { const c = csp(f); return /script-src 'self'/.test(c) && !/script-src[^;]*unsafe-inline/.test(c) && !satirIci(f); }), "CSP: index.html ve splash.html'de satır içi betik yok, script-src 'unsafe-inline' yok");
      check(!global.__csp.length, 'CSP ihlali yok (' + (global.__csp[0] || '') + ')');
      const ekstrePdf = path.join(gorsel, 'ekstre.pdf');
      require('child_process').execFileSync('python3', ['-c', `
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
pdfmetrics.registerFont(TTFont('DV', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
c = canvas.Canvas(${JSON.stringify(ekstrePdf)}); c.setFont('DV', 10); y = 800
for t, a, tu, b in [('Tarih', 'Açıklama', 'Tutar', 'Bakiye'), ('01.09.2026', 'ÖRNEK KİRA ÖDEMESİ', '-12.500,00', '87.500,00'), ('03.09.2026', 'DEMO A.Ş. EFT GELEN', '25.000,00', '112.500,00')]:
    c.drawString(40, y, t); c.drawString(120, y, a); c.drawString(360, y, tu); c.drawString(460, y, b); y -= 18
c.save()`]);
      const pdfSatir = await w.evaluate(async b64 => { const u = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
        return (await window.__app.readPdfLines(new File([u], 'ekstre.pdf'))).map(l => l.t); }, fs.readFileSync(ekstrePdf).toString('base64'));
      check(pdfSatir.some(t => /01\.09\.2026/.test(t) && /ÖRNEK KİRA ÖDEMESİ/.test(t) && /-12\.500,00/.test(t)) && pdfSatir.some(t => /DEMO A\.Ş\. EFT GELEN/.test(t)),
        'banka ekstresi PDF satırları okundu (isEvalSupported:false ile) (' + pdfSatir.length + ' satır)'); }
    check(yd.L === '760.10:B12783.53 191.20:B2556.71 360.05:A1917.53 360.06:A2556.71 300.01:A10866' && !yd.err.length, 'yurt dışı fişi: brüt gider 760, sorumlu KDV 191 borç / 360 alacak, %15 stopaj 360, ödeme net (' + yd.L + ')');
    const ydUsd = await w.evaluate(() => { const O = window.__okc; const o = O._ydOku('Google Ireland Limited\nInvoice number: 5123456789\nInvoice date Nov 3, 2025\nTotal amount due $1,234.50 USD\nVAT ID IE6388047V');
      return [o.tarih, o.no, o.unvan, o.pb, o.doviz, o.hizmet, O._ydHesap({ ...o, kur: 34.5 }).brut].join('|'); });
    check(ydUsd === '2025-11-03|5123456789|Google Ireland Limited|USD|1234.5|reklam|50106.18', 'yurt dışı dövizli fatura: İngilizce tarih, USD tutar, kurla TL brüt (' + ydUsd + ')');
    // fişte tutar düzeltme ve satır ekleme (yurt dışı bölümünde de)
    const ydEk = await w.evaluate(() => { const bs = Object.values(window.__app.Store.local().okc.okf).filter(b => b.tur === 'yd'); const b = { ...bs[bs.length - 1], ekSatir: [{ id: 'e1', acc: '770.01', b: 10, c: 0, desc: 'banka masrafı' }], tutarElle: { 'gider (brüt)#1': { b: 12780, c: 0 } } };
      return window.__okc._satirlar(b).L.map(x => x.acc + ':' + (x.b ? 'B' + x.b : 'A' + x.c)).join(' '); });
    check(ydEk === '760.10:B12780 191.20:B2556.71 360.05:A1917.53 360.06:A2556.71 770.01:B10 300.01:A10872.47', 'yurt dışı fişi: tutar elle değişir, eklenen satırla ödeme yeniden dengelenir (' + ydEk + ')');
    await w.screenshot({ path: OUT + '/13b-okc-yurtdisi.png' });
    await w.click('[data-okctur=fis]'); await w.waitForTimeout(200);
    // gerçek fiş fotoğrafları (masa üstünde, telefonla çekilmiş)
    for (const [ad, beklenen] of [['okc_fis1.jpg', '2026-10-15|0004|1000|20:833.33/166.67|kredi'], ['okc_fis2.jpg', '2026-10-17|0007|1060|10:963.64/96.36|kredi']]) {
      const once = await w.evaluate(() => Object.keys((window.__app.Store.local().okc || {}).okf || {}).length);
      await w.evaluate(p => window.__okc._ekle([p]), path.join(__dirname, 'ornek', ad));
      await w.waitForFunction(n => Object.keys((window.__app.Store.local().okc || {}).okf || {}).length > n, once, { timeout: 90000 });
      const g = await w.evaluate(() => { const bs = Object.values(window.__app.Store.local().okc.okf); const b = bs[bs.length - 1];
        return [b.tarih, b.fisNo, b.toplam, b.oranlar.map(o => o.oran + ':' + o.matrah + '/' + o.kdv).join(' '), b.odeme].join('|'); });
      console.log('OKC GERCEK', ad, g);
      check(g === beklenen, 'gerçek fiş fotoğrafı okundu: ' + ad + ' (' + g + ')');
    }
    // hesap ayarı olmayan firma: hesaplar mizandan (harcama türü → 770 alt hesabı, %oran → 191, kredi kartı → 331 ortak)
    await w.evaluate(async () => { const { Store } = window.__app;
      await Store.saveFirm({ id: 'okf2', name: 'ÖKC FİRMA 2', lucaId: '78', banks: [], mizanInfo: { source: 'luca', year: '2026', at: new Date().toISOString(), parts: 1 } });
      await Store.saveMizan('okf2', [['100', 'KASA'], ['100.01', 'MERKEZ KASA'], ['191', 'İNDİRİLECEK KDV'], ['191.01', 'İNDİRİLECEK KDV'], ['191.01.10', 'İNDİRİLECEK KDV %10'], ['191.01.20', 'İNDİRİLECEK KDV %20'],
        ['331', 'ORTAKLARA BORÇLAR'], ['331.01', 'MEHMET ORTAK'], ['770', 'GENEL YÖNETİM GİDERLERİ'], ['770.01', 'YEMEK GİDERLERİ'], ['770.02', 'KIRTASİYE GİDERLERİ'], ['770.03', 'ÇEŞİTLİ GİDERLER']]); });
    check((await w.$$eval('[data-okcef]', b => b.length)) === 3, 'ÖKC: Hepsi / Eksik / Dolu filtresi var');
    await w.click('[data-okcf=tumu]'); await w.selectOption('#firmSel', 'okf2'); await w.waitForTimeout(400);
    await w.evaluate(p => window.__okc._ekle([p]), path.join(__dirname, 'ornek', 'okc_fis2.jpg'));
    await w.waitForFunction(() => Object.keys((window.__app.Store.local().okc || {}).okf2 || {}).length > 0, null, { timeout: 90000 });
    const h2 = await w.evaluate(() => { const b = Object.values(window.__app.Store.local().okc.okf2)[0]; const s = window.__okc._satirlar(b);
      return { L: s.L.map(x => x.acc + ':' + (x.b ? 'B' + x.b : 'A' + x.c)).join(' '), err: s.err, kalem: b.kalemler }; });
    console.log('OKC MIZAN', JSON.stringify(h2));
    check(h2.L === '770.01:B963.64 191.01.10:B96.36 331.01:A1060' && !h2.err.length, 'ÖKC: hesaplar mizandan (yiyecek → 770.01 yemek, %10 KDV → 191.01.10, kredi kartı → 331 ortak)');
    const inp = await w.$('#okcTable input[data-okch]'); await inp.fill('770.02'); await inp.press('Tab'); await w.waitForTimeout(600);
    const elle = await w.evaluate(() => { const b = Object.values(window.__app.Store.local().okc.okf2)[0]; const f = window.__app.Store.local().firms.okf2;
      return [b.hesap, Object.values((f.okcAyar || {}).ogren || {})[0], document.querySelector('#okcTable input[data-okch]').value].join('|'); });
    check(elle === '770.02|770.02|770.02', 'ÖKC: gider hesabı elle yazılabiliyor ve harcama türü için öğreniliyor (' + elle + ')');
    await w.selectOption('#firmSel', 'okf'); await w.waitForTimeout(300);
    await w.click('[data-okctur=z]'); await w.evaluate(p => window.__okc._ekle([p]), path.join(gorsel, 'z1.png'));
    await w.waitForSelector('#okcTable tbody tr[data-id]', { timeout: 60000 });
    const zr = await w.evaluate(() => { const b = Object.values(window.__app.Store.local().okc.okf).find(x => x.tur === 'z'); const s = window.__okc._satirlar(b);
      return { no: b.zNo, oran: b.oranlar.map(o => o.oran + ':' + o.matrah + '/' + o.kdv).join(' '), kredi: b.kredi, L: s.L.map(x => x.acc + ':' + (x.b ? 'B' + x.b : 'A' + x.c)).join(' '), err: s.err }; });
    console.log('OKC Z', JSON.stringify(zr));
    check(zr.no === '0412' && zr.oran === '1:4112.28/41.12 20:10531.65/2106.33' && zr.kredi === 10000, 'Z raporu okundu (Z no, oranlar, kredi kartı)');
    check(zr.L === '108.01:B10000 100.01:B6791.38 600.01:A14643.93 391.01.01:A41.12 391.01.20:A2106.33' && !zr.err.length, 'Z raporu fişi: kasa + kredi kartı borç, satış ve KDV alacak');
    // Görev 39: fiş önizlemesinde ＋ Satır ekle görünür ve fişe girer; − satırı çıkarır (otomatik satır soluk + Geri ekle); 0 yazmak çıkarmaz; denge doğru
    const fisSatirDene = async tur => {
      await w.click(`[data-okctur=${tur}]`); await w.waitForTimeout(300);
      const id = await w.evaluate(t => { const b = Object.values(window.__app.Store.local().okc.okf).find(x => x.tur === t && !x.logged); return b && b.id; }, tur);
      if (!id) return { tur, yok: true };
      await w.evaluate(i => { const r = document.querySelector(`#okcTable tr[data-id="${i}"]`); if (r) r.scrollIntoView(); }, id);
      if (!(await w.$(`#okcTable tr[data-id="${id}"] + tr.fisdetay`))) { await w.click(`[data-okcfis="${id}"]`); await w.waitForSelector(`#okcTable tr[data-id="${id}"] + tr.fisdetay`); }
      const D = `#okcTable tr[data-id="${id}"] + tr.fisdetay`;
      const durum = () => w.evaluate(([i, d]) => { const b = Object.values(window.__app.Store.local().okc.okf).find(x => x.id === i); const s = window.__okc._satirlar(b); const e = document.querySelector(d);
        return { ek: e.querySelectorAll('tr.fkek').length, cikan: e.querySelectorAll('tr.fiscikan').length, n: s.L.length, b: Math.round(s.L.reduce((t, x) => t + x.b, 0) * 100), c: Math.round(s.L.reduce((t, x) => t + x.c, 0) * 100), ek770: s.L.some(x => x.ek && x.acc === '770.01' && x.b === 12.5) }; }, [id, D]);
      const s0 = await durum();
      await w.click(`${D} [data-okcekle]`); await w.waitForTimeout(300); const s1 = await durum();
      const yaz = async (alan, v) => { const sec = `${D} tr.fkek >> nth=-1 >> [data-alan=${alan}]`; await w.fill(sec, v); await w.dispatchEvent(sec, 'change'); await w.waitForTimeout(250); };
      await yaz('acc', '770.01'); await yaz('b', '12,50'); const s2 = await durum();
      await w.click(`${D} tr.fkek >> nth=-1 >> [data-okceksil]`); await w.waitForTimeout(300); const s3 = await durum();
      await w.click(`${D} [data-okccikar] >> nth=0`); await w.waitForTimeout(300); const s4 = await durum();
      await w.click(`${D} [data-okcgeri]`); await w.waitForTimeout(300); const s5 = await durum();
      const tutar = `${D} [data-okctut] >> nth=0`; await w.fill(tutar, '0'); await w.dispatchEvent(tutar, 'change'); await w.waitForTimeout(300); const s6 = await durum();
      return { tur, ok: s1.ek === s0.ek + 1 && s1.n === s0.n && s2.ek770 && s2.n === s0.n + 1 && s2.b === s2.c && s3.ek === s0.ek && s3.n === s0.n && s4.cikan === 1 && s4.n === s0.n - 1 && s4.b === s4.c && s5.cikan === 0 && s5.n === s0.n && s6.n === s0.n && s6.cikan === 0, s: [s0, s1, s2, s3, s4, s5, s6].map(x => `${x.ek}/${x.cikan}/${x.n}/${x.b === x.c ? '=' : '≠'}`).join(' ') };
    };
    for (const tur of ['z', 'fis', 'yd']) { const r = await fisSatirDene(tur);
      check(r.yok || r.ok, 'fiş önizlemesi (' + tur + '): ＋ Satır ekle görünür ve fişe girer, − çıkarır, Geri ekle döndürür, 0 yazmak çıkarmaz, denge doğru (' + (r.yok ? 'belge yok' : r.s) + ')'); }
    await w.click('[data-okctur=z]'); await w.waitForTimeout(200);
    await w.click('[data-okcduz]'); await w.waitForSelector('#okcModal:not([hidden]) #okKaydet');
    await w.screenshot({ path: OUT + '/14-okc-duzenle.png' });
    await w.click('#okcModal [data-okx]');
    await app.evaluate(({ ipcMain }) => { global.__ofis = [];
      for (const ch of ['luca-status', 'luca-prepare-fis', 'luca-fis-kes']) ipcMain.removeHandler(ch);
      ipcMain.handle('luca-status', () => ({ loggedIn: true }));
      ipcMain.handle('luca-prepare-fis', (e, a) => ({ donemId: '900', year: String(a.year), firmLabel: 'ÖKC FİRMA' }));
      ipcMain.handle('luca-fis-kes', (e, a) => { global.__ofis.push(a); return { ok: true, fisNo: String(500 + global.__ofis.length), fisId: 'y' }; }); });
    await w.click('#okcGo'); await w.waitForSelector('#askModal:not([hidden])'); await w.click('#askYes'); await w.waitForTimeout(1500);
    const of = await app.evaluate(() => global.__ofis);
    check(of.length === 1 && of[0].fis.fisTarihi === '30/09/2026' && of[0].fis.detaylar.length === 5 && of[0].fis.borc === 16791.38, 'Z raporu Luca\'ya fiş olarak gönderildi');
    check(await w.evaluate(() => !!Object.values(window.__app.Store.local().okc.okf).find(x => x.tur === 'z').logged), 'kaydedilen Z raporu işaretlendi');
    await w.click('#homeLogo'); await w.waitForSelector('#modGate:not([hidden])');
    check(!(await w.$('.modcard[data-mod=oyun]')), 'Dinlenme Alanı (oyunlar) kaldırıldı');
    await w.click('.modcard[data-mod=okc]'); await w.waitForSelector('#okcPanel:not([hidden])');
    // Komut paleti (Ctrl+F) ve yardım (F1)
    // 2.9.6: Ctrl+F çalışma ekranında yazı arar (vurgular), Ctrl+K komut paleti
    await w.keyboard.press('Control+f'); await w.waitForSelector('#mwAra:not([hidden])', { timeout: 5000 });
    await w.fill('#mwAraQ', 'ökc'); await w.waitForTimeout(400);
    { const n = await w.textContent('#mwAraN'); check(/^\d+ \/ \d+$/.test(n.trim()), 'Ctrl+F: açık ekranda (ÖKC) arama, eşleşmeler sayıldı (' + n.trim() + ')'); }
    await w.keyboard.press('Escape'); await w.waitForSelector('#mwAra', { state: 'hidden' });
    await w.keyboard.press('Control+k'); await w.waitForSelector('#komutModal:not([hidden])');
    await w.fill('#komutQ', 'fiş liste'); await w.waitForTimeout(100);
    check(/Fiş Listesi/.test(await w.textContent('#komutL .ki[aria-selected=true]')), 'Ctrl+K komut paleti: arama ilk sonuç Fiş Listesi');
    await w.keyboard.press('Escape'); await w.waitForSelector('#komutModal', { state: 'hidden' });
    await w.keyboard.press('F1'); await w.waitForSelector('#yardimModal:not([hidden])');
    check(/Alt\+K/.test(await w.textContent('#yardimB')), 'F1 yardım: kısayollar listeleniyor');
    await w.click('[data-yardimx]'); await w.waitForTimeout(150);
    // Esc = geri: ÖKC ekranından Modüller'e; Muhasebe İşlemleri alt sayfasından Toplu Kontrol'e
    await w.click('#okcPanel h2'); await w.keyboard.press('Escape'); await w.waitForSelector('#modGate:not([hidden])', { timeout: 5000 });
    check(true, 'Esc: ÖKC ekranından Modüller ekranına dönüldü');
    // Denetim hub: Günün özeti ve banka mutabakatı kartları
    await w.waitForSelector('#modGate:not([hidden])', { timeout: 5000 });
    await w.evaluate(() => { document.querySelector('#modGate').hidden = true; window.__enterModule('denetim'); }); await w.waitForSelector('#hubPanel:not([hidden])');   // modül pasif; içerik test edilir
    const hubK = await w.$$eval('#hubGrid .modcard', l => l.map(b => [b.dataset.hub, b.disabled]));
    check(hubK.map(k => k[0]).join(',') === 'ters,cari,banka,ozet,kdviade' && !hubK.find(k => k[0] === 'banka')[1] && !hubK.find(k => k[0] === 'ozet')[1], 'Denetim: mizan kartı kalktı; banka mutabakatı ve günün özeti açık');
    await w.click('#hubGrid [data-hub=ozet]'); await w.waitForSelector('#ozetModal:not([hidden])');
    check(/Günün [Öö]zeti/.test(await w.textContent('#ozetT')) && (await w.$$eval('#ozetB table', l => l.length)) >= 1, 'Günün özeti: bugün Luca\'ya kaydedilen fişler listelendi');
    await w.screenshot({ path: OUT + '/14d-ozet.png' });
    await w.click('[data-ozetx]');
    // Türkçe tarih kutusu: gg.aa.yyyy yazımı asıl kutuya yyyy-aa-gg yazar
    { const tr = await w.evaluate(() => { const n = document.querySelector('#ozetBas'); return n && n.nextElementSibling && n.nextElementSibling.classList.contains('tr-tarih'); });
      check(tr, 'tarih kutularının yanında gg.aa.yyyy metin kutusu var');
      await w.evaluate(() => { document.querySelector('#ozetModal').hidden = false; });
      const t = await w.$('#ozetBas + .tr-tarih'); await t.click(); await t.fill(''); await w.keyboard.type('15032026'); await w.waitForTimeout(150);
      check((await w.inputValue('#ozetBas')) === '2026-03-15', 'gg.aa.yyyy yazımı → asıl tarih kutusu 2026-03-15');
      await (await w.$('#ozetBas + .tr-tarih')).click(); await w.keyboard.press('ArrowUp'); await w.waitForTimeout(100);
      check((await w.inputValue('#ozetBas')) === '2026-03-16', '↑ bir gün ileri');
      await w.evaluate(() => { document.querySelector('#ozetModal').hidden = true; }); }
    // Özel İşlemler › Çek / Senet: Mikro + Logo örnek dosyaları, mizandan hesaplar, fiş
    // yönetimde bu ofise "Çek / Senet Kayıtları" özel çözümü tanımlandı → kart görünür
    fake.state.office = { id: 'o9', name: 'Test SMMM', luca_uye_no: '', ozel: ['cek', 'mikro'] };
    await w.evaluate(() => window.desktop.license.refresh());
    await w.click('#homeLogo'); await w.waitForSelector('#modGate:not([hidden])');
    check(!!(await w.$('.modcard[data-mod=ozel]')), 'özel çözüm tanımlanan ofiste "Ofisinize Özel Çözümler" görünüyor');
    await w.evaluate(async () => { const { Store } = window.__app; const XLSX = window.XLSX;
      for (const [id, ad] of [['inka', 'İNKA'], ['savor', 'SAVOR']]) await Store.saveFirm({ id, name: ad, lucaId: id === 'inka' ? '81' : '82', banks: [], mizanInfo: { source: 'luca', year: '2026', at: new Date().toISOString(), parts: 1 } }); });
    for (const [id, f] of [['inka', 'mizan_inka.xlsx'], ['savor', 'mizan_savor.xlsx']]) {
      const b64 = fs.readFileSync(path.join(__dirname, 'ornek', f)).toString('base64');
      await w.evaluate(async ([id, b64]) => { const wb = window.XLSX.read(b64, { type: 'base64' }); const rows = window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
        const hi = rows.findIndex(r => r.map(String).some(x => /HESAP KODU/i.test(x)));
        await window.__app.Store.saveMizan(id, rows.slice(hi + 1).filter(r => r[0]).map(r => [String(r[0]).trim(), String(r[1] || '').trim(), r[3], r[4]])); }, [id, b64]);
    }
    await w.click('.modcard[data-mod=ozel]'); await w.waitForSelector('#hubPanel:not([hidden])');
    check(/Ofisinize Özel Çözümler/.test(await w.textContent('#h1Mod')), 'Özel İşlemler modülü açıldı');
    await w.click('#hubPanel >> text=Çek / Senet Kayıtları'); await w.waitForSelector('#cekPanel:not([hidden])');
    await w.selectOption('#firmSel', 'inka'); await w.waitForTimeout(400);
    const dosyaVer = async (ad) => w.evaluate(async ([ad, b64]) => { const u = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      await window.__cek._dosyaEkle([new File([u], ad)]); }, [ad, fs.readFileSync(path.join(__dirname, 'ornek', ad)).toString('base64')]);
    await dosyaVer('mikro_giris.xls'); await w.waitForTimeout(400);
    if (await w.isVisible('#askModal')) { await w.click('#askNo'); await w.waitForTimeout(300); }
    await dosyaVer('mikro_cikis.xls');
    // mizanda olmayan 103.YY.AA vade hesapları kendiliğinden sorulur ve Luca'ya açılır (Luca istekleri sahte)
    await w.waitForSelector('#askModal:not([hidden])', { timeout: 8000 });
    const vadeMetin = await w.textContent('#askText');
    check(/103\.\d\d\.\d\d/.test(vadeMetin) && /Vadeli Verilen Çekler/.test(vadeMetin), 'çek/senet: eksik vade hesapları (103.YY.AA, adıyla) sorgulandı');
    const hpOnce = (await app.evaluate(() => global.__hp)).length;
    await w.click('#askYes'); await w.waitForSelector('#askModal:not([hidden])', { timeout: 15000 });
    check(/Hesaplar açıldı/i.test(await w.textContent('#askTitle')) && (await app.evaluate(() => global.__hp)).length === hpOnce + 1, 'çek/senet: vade hesapları Luca\'ya açıldı ve bildirildi');
    await w.click('#askYes'); await w.waitForTimeout(500);
    const cmk = await w.evaluate(() => { const st = window.__cek._st; const say = {}; st.hareket.forEach(h => say[h.olay] = (say[h.olay] || 0) + 1);
      const eksik = st.hareket.filter(h => { const x = window.__cek._hesaplar(h); return !x.cek || !x.karsi; });
      return { n: st.hareket.length, say, eksik: eksik.length, ornek: eksik.slice(0, 4).map(h => h.olay + ' ' + h.cariAd + ' ' + h.vade + ' ' + h.banka), ilk: st.hareket.slice(0, 3).map(h => [h.olay, h.tur, h.no, h.vade, h.tutar, h.cariAd, JSON.stringify(window.__cek._hesaplar(h))].join(' | ')) }; });
    console.log('CEK MIKRO', JSON.stringify(cmk, null, 1));
    check(cmk.n > 0 && cmk.say.giris > 0, 'Mikro çek giriş/çıkış bordroları okundu (' + cmk.n + ' hareket)');
    check(cmk.eksik <= 4, 'Mikro: çek ve karşı hesaplar mizandan bulundu (kalanlar mizanda gerçekten yok) (eksik ' + cmk.eksik + ')');
    const fl = await w.evaluate(() => window.__cek._fisler().map(f => ({ t: f.json.fisTarihi, n: f.lines.length, b: f.json.borc, a: f.json.alacak })));
    check(fl.length > 0 && fl.every(f => Math.abs(f.b - f.a) < 0.005), 'Mikro fişleri dengeli (' + fl.length + ' fiş)');
    // sıralama, filtre, seçim düğmeleri
    await w.click('#cekTable th[data-cks=tutar]'); await w.waitForTimeout(200);
    const sirali = await w.evaluate(() => window.__cek._gorunen().map(h => h.tutar));
    check(sirali.length > 2 && sirali.every((x, i) => !i || sirali[i - 1] <= x), 'Çek tablosu: tutar başlığına tıklayınca küçükten büyüğe sıralandı');
    await w.click('#cekTable th[data-cks=tutar]'); await w.waitForTimeout(200);
    const ters = await w.evaluate(() => window.__cek._gorunen().map(h => h.tutar));
    check(ters[0] >= ters[ters.length - 1], 'ikinci tıklamada büyükten küçüğe');
    await w.fill('#cekTable input[data-ckf=cari]', 'santur'); await w.waitForTimeout(500);
    const fsat = await w.$$eval('#cekTable tbody tr[data-ci]', t => t.map(r => r.textContent));
    check(fsat.length > 0 && fsat.every(x => /SANTUR/i.test(x)) && /Filtrelenen Toplam/.test(await w.textContent('#cekTable tfoot')), 'Çek tablosu: başlık altı filtre ve filtrelenen toplam');
    await w.fill('#cekTable input[data-ckf=cari]', ''); await w.waitForTimeout(400);
    await w.click('#cekSecYok'); const s0 = await w.evaluate(() => window.__cek._st.hareket.filter(h => h.sec).length);
    await w.click('#cekSecHepsi'); const s1 = await w.evaluate(() => window.__cek._st.hareket.filter(h => h.sec).length);
    const ilkKutu = await w.$('#cekTable tbody input[data-cs]:not([disabled])'); await ilkKutu.uncheck();
    const s2 = await w.evaluate(() => window.__cek._st.hareket.filter(h => h.sec).length);
    check(s0 === 0 && s1 > 0 && s1 <= 78 && s2 === s1 - 1, `seçimi kaldır / tümünü seç / satır tiki kaldırma (${s0}, ${s1}, ${s2})`);
    await w.click('#cekSecHepsi');
    await w.screenshot({ path: OUT + '/15-cek-mikro.png' });
    await app.evaluate(({ ipcMain }) => { global.__cfis = [];
      for (const ch of ['luca-status', 'luca-prepare-fis', 'luca-fis-kes']) ipcMain.removeHandler(ch);
      ipcMain.handle('luca-status', () => ({ loggedIn: true }));
      ipcMain.handle('luca-prepare-fis', (e, a) => ({ donemId: '901', year: String(a.year), firmLabel: 'İNKA' }));
      ipcMain.handle('luca-fis-kes', (e, a) => { global.__cfis.push(a); return { ok: true, fisNo: String(700 + global.__cfis.length), fisId: 'c' }; }); });
    await w.click('#cekGo'); await w.waitForSelector('#askModal:not([hidden])'); await w.click('#askYes'); await w.waitForTimeout(2500);
    const cf = await app.evaluate(() => global.__cfis);
    check(cf.length === fl.length && cf.every(x => Math.abs(x.fis.borc - x.fis.alacak) < 0.005 && x.fis.detaylar.length >= 2), 'Çek fişleri Luca\'ya gönderildi (' + cf.length + ')');
    check(await w.evaluate(() => window.__cek._st.hareket.filter(h => h.logged).length) > 0, 'kaydedilen çekler "MuhaWin ile kaydedilen" olarak işaretlendi');
    // Luca kaydından sonraki arka plan yenilemesi (mizan / hesap planı, 2,5 sn sonra başlar) bitsin; firma değişimi beklenir (sessizce geçilmez)
    await w.waitForFunction(() => !window.__mwMesgul(), null, { timeout: 60000 });
    await w.selectOption('#firmSel', 'savor');
    await w.waitForFunction(() => window.__cek._firma() && window.__cek._firma().id === 'savor', null, { timeout: 30000 }); await w.evaluate(() => window.__cek._yenile());
    await w.evaluate(() => { const st = window.__cek._st; st.hareket.length = 0; st.dosyalar.length = 0; st.logoTarih = '2026-09-30'; });
    await dosyaVer('logo_musteri.xlsx'); await dosyaVer('logo_kendi.xlsx');
    const lg = await w.evaluate(() => { const st = window.__cek._st; const say = {}; st.hareket.forEach(h => say[h.olay] = (say[h.olay] || 0) + 1);
      const eksik = st.hareket.filter(h => h.olay !== 'tahsile' && (() => { const x = window.__cek._hesaplar(h); return !x.cek || !x.karsi; })());
      return { n: st.hareket.length, say, eksik: eksik.length, ornek: eksik.slice(0, 6).map(h => h.olay + ' ' + h.tur + ' ' + h.cariAd + ' ' + h.vade + ' ' + h.banka) }; });
    console.log('CEK LOGO', JSON.stringify(lg, null, 1));
    check(lg.n > 0 && lg.say.giris > 0 && lg.say.verilen > 0, 'Logo müşteri ve kendi çek listeleri okundu (' + lg.n + ' hareket)');
    const t0 = Date.now(); await w.fill('#cekTable input[data-ckf=islem]', 'ciro'); await w.waitForTimeout(250);
    await w.waitForFunction(() => document.querySelectorAll('#cekTable tbody tr[data-ci]').length > 0); const sure = Date.now() - t0;
    check(sure < 2500, 'Logo (1268 hareket): filtre hızlı (' + sure + ' ms)');
    await w.fill('#cekTable input[data-ckf=islem]', ''); await w.waitForTimeout(300);
    check(await w.$$eval('#cekTable tbody tr[data-ci]', t => t.length) <= 300 && !!(await w.$('#cekDaha')), 'uzun liste sayfalı çiziliyor (Daha göster)');
    const lf = await w.evaluate(() => window.__cek._fisler().length);
    check(lf > 0 && lf < 20, 'Logo fişleri işlem türü ve tarihe göre gruplandı (' + lf + ' fiş)');
    await w.screenshot({ path: OUT + '/16-cek-logo.png' });
    await w.click('#cekTemizle'); await w.waitForSelector('#askModal:not([hidden])'); await w.click('#askYes'); await w.waitForTimeout(400);
    check(await w.evaluate(() => window.__cek._st.hareket.length) === 0, 'Tabloyu Temizle: tüm hareketler kaldırıldı');
    // 2.9.6: Ofisinize Özel Çözümler › Muhasebe Denetimi (eski adı Mikro Denetim) — XML + Mikro muavini → KDV / matrah / cari kontrolü, beyanname, muhtasar
    { const md = path.join(OUT, 'mikro'); fs.mkdirSync(md, { recursive: true });
      require('child_process').execFileSync('python3', ['-c', `import sys, io, zipfile; sys.path.insert(0, ${JSON.stringify(path.join(APP, 'fk', 'tests'))}); sys.path.insert(0, ${JSON.stringify(path.join(APP, 'fk'))})
from pathlib import Path
from test_luca_otomasyon import ubl, FIRMA_VKN
from test_denetim import _mikro
zb = io.BytesIO()
with zipfile.ZipFile(zb, 'w') as z:
    z.writestr('a.xml', ubl('AAA2026000000001', '2026-09-05', '1', FIRMA_VKN, '1000.00', '200.00', 20))
    z.writestr('b.xml', ubl('EX02026000000001', '2026-09-10', FIRMA_VKN, '9', '2000.00', '400.00', 20))
Path(${JSON.stringify(md)}, 'faturalar.zip').write_bytes(zb.getvalue())
_mikro(Path(${JSON.stringify(md)}, 'mikro_muavin.xlsx'), satis_matrah=1900, cari_alis=1150)`]);
      await w.click('#homeLogo'); await w.waitForSelector('#modGate:not([hidden])');
      await w.click('.modcard[data-mod=ozel]'); await w.waitForSelector('#hubPanel:not([hidden])');
      // Görev 32: "Sitede aç" bağlantısı (kartların altında; Görev 49: denetim ekranından kaldırıldı); varsayılan tarayıcıda açılır, programdaki denetim aynen sürer
      { const site = 'https://muhawin.com.tr/giris.html?geri=/denetim/';
        await app.evaluate(({ shell }) => { global.__disAcilan = []; global.__eskiAc = global.__eskiAc || shell.openExternal; shell.openExternal = u => { global.__disAcilan.push(u); return Promise.resolve(); }; });
        const hb = await w.$eval('#hubSite', e => ({ g: !e.hidden, t: e.textContent, h: (e.querySelector('a') || {}).href, hd: (e.querySelector('a') || {}).target }));
        await w.click('#hubSite a[data-sitede]'); await w.waitForTimeout(600);
        const acilan = await app.evaluate(() => global.__disAcilan.slice());
        check(hb.g && /sitemizden de kullanılabilir; belgeleriniz bilgisayarınızdan çıkmaz/.test(hb.t) && hb.h === site && hb.hd === '_blank' && acilan.includes(site) && await w.isVisible('#hubPanel'),
          'Muhasebe Denetimi: "Sitede aç" bağlantısı varsayılan tarayıcıda açıldı, program ekranı yerinde (' + acilan.join(',') + ')'); }
      await w.click('#hubPanel [data-hub=mikro]'); await w.waitForSelector('#mdPanel:not([hidden]) #mdFrame', { timeout: 20000 });
      check(!(await w.$('#mdPanel [data-sitede]')), 'Görev 49: Muhasebe Denetimi ekranında "Sitede aç" bandı yok (kartların altındaki bant duruyor); programdaki denetim açıldı');
      await app.evaluate(({ shell }) => { if (global.__eskiAc) shell.openExternal = global.__eskiAc; });
      const mf = await (await w.$('#mdFrame')).contentFrame(); await mf.waitForSelector('#basla', { timeout: 30000 }); await w.waitForTimeout(800);
      const fsec = await mf.$$eval('#firma option', o => o.length);
      await mf.setInputFiles('#xml', path.join(md, 'faturalar.zip')); await mf.setInputFiles('#muavin', path.join(md, 'mikro_muavin.xlsx'));
      await mf.click('#basla'); await mf.waitForSelector('#nav [data-g=Matrah]:not([disabled])', { timeout: 60000 });
      const sor = await mf.evaluate(() => ['#nKDV', '#nMatrah', '#nCari'].map(x => document.querySelector(x).textContent.trim()).join('|'));
      check(fsec > 1 && /temiz/i.test(sor.split('|')[0]) && /1 sorun/i.test(sor.split('|')[1]) && /1 sorun/i.test(sor.split('|')[2]), 'Muhasebe Denetimi: KDV temiz, matrah 1 sorun, cari 1 sorun (' + sor + ')');
      await mf.click('#nav [data-g=muhtasar]'); await w.waitForTimeout(200);
      check(/Serbest meslek/i.test(await mf.textContent('#icerik')) && /2\.500,00/.test(await mf.textContent('#icerik')), 'Muhasebe Denetimi: muhtasar taslağı 360 serbest meslek stopajından (matrah 2.500)');
      await mf.click('#nav [data-g=beyan]'); await w.waitForTimeout(200);
      check(!!(await mf.$('[data-ac^="/beyanname?id="]')) && !!(await mf.$('[data-ac^="/api/rapor/cikti?id="]')), 'Muhasebe Denetimi: KDV 1 / KDV 2 beyannamesi ve çıktı raporu düğmeleri');
      await w.screenshot({ path: OUT + '/15b-mikro-denetim.png' });
      // Görev 49 · 9: başka modüle geçip dönünce denetim ekranı kapanmaz, kaldığı yerde (aynı bölüm) açılır
      if (await w.$('#modSekme [data-modsekme=ozel]')) {
        await w.click('#modSekme [data-modsekme=ekstre]'); await w.waitForTimeout(500);
        const gizli = await w.isHidden('#mdPanel');
        await w.click('#modSekme [data-modsekme=ozel]'); await w.waitForSelector('#mdPanel:not([hidden])', { timeout: 8000 }).catch(() => {});
        check(gizli && await w.isVisible('#mdPanel') && await w.isHidden('#hubPanel') && await mf.getAttribute('#nav [data-g=beyan]', 'aria-pressed') === 'true',
          'Görev 49: Banka\'ya geçip Ofisinize Özel\'e dönünce Muhasebe Denetimi aynı bölümde açık (sayfa yeniden yüklenmedi)');
      } }
    await w.click('#homeLogo'); await w.waitForSelector('#modGate:not([hidden])');
    await w.click('.modcard[data-mod=ekstre]'); await w.waitForTimeout(600);
    check(await w.isHidden('#fkPanel'), 'Ekstre\'ye dönünce Fatura paneli gizli');
    // Ayarlar → Tüm Firmaları Sil (seçenekler + "emin misiniz")
    const once = await w.evaluate(() => Object.keys(window.__app.Store.local().firms || {}).length);
    await w.click('#ayarlarBtn'); await w.waitForSelector('#regModal:not([hidden]) #delAllFirms', { timeout: 8000 });
    check(!!(await w.$('#regFirmEkle [data-luca="firms"]')) && !!(await w.$('#regFirmEkle [data-yenifirma]')), 'Ayarlar › Firmalar: "Luca\'dan firma ekle" ve "Yeni firma" burada');
    const lk = await w.evaluate(async () => { const a = await window.desktop.luca.kayitBaslat(); const d = await window.desktop.luca.kayitDurum(); return a.acik && d.acik; });
    check(lk && await w.$('#lkBaslat') !== null, 'Ayarlar: Luca istek kaydı başlatılabiliyor');
    await app.evaluate(({ shell }) => { shell.showItemInFolder = () => {}; });
    const lkd = await w.evaluate(() => window.desktop.luca.kayitDurdur());
    check(/luca-istek-kaydi-.*\.json$/.test(lkd.dosya) && lkd.adet === 0, 'Luca istek kaydı dosyaya yazıldı');
    const dsel = await w.$('#regModal select[data-defter]'); const dfid = await dsel.getAttribute('data-defter');
    await dsel.selectOption('serbest'); await w.waitForTimeout(400);
    check(await w.evaluate(id => window.__app.Store.local().firms[id].defter, dfid) === 'serbest', 'Ayarlar › Firmalar: defter türü seçilip kaydedildi');
    await w.click('#delAllFirms'); await w.waitForSelector('#delFirmModal:not([hidden]) #dfYes', { timeout: 8000 });
    check(/firma silinsin mi/i.test(await w.textContent('#dfT')) && await w.isVisible('#dfKural'), 'tüm firmaları sil: silinecekler soruluyor');
    await w.click('#dfYes'); await w.waitForSelector('#askModal:not([hidden])'); await w.click('#askYes'); await w.waitForTimeout(2500);
    const sonra = await w.evaluate(() => Object.values(window.__app.Store.local().firms || {}).filter(f => f.id !== window.__app.EXAMPLE_ID).length);
    check(once > 0 && sonra === 0, 'tüm firmalar silindi (' + once + ' → ' + sonra + ')');
    await w.keyboard.press('Escape').catch(() => {});
    await w.evaluate(() => window.desktop.auth.logout());
    await new Promise(r => setTimeout(r, 2500));
    check((await get(base + '/api/saglik')).status === 0, 'çıkışta Python modülü kapandı');
  } catch (e) { bad.push('HATA (1): ' + e.message.split('\n').slice(0,3).join(' | ')); await w.screenshot({ path: OUT + '/hata1.png' }).catch(() => {}); }
  finally { await app.close().catch(() => {}); fake.server.close(); }

  // ---------------- 2. senaryo: Fatura denemesi bitmiş → kod ----------------
  s = await oturum('bitti', { ekstre: 'bitti' }); ({ app, w, fake } = s);
  try {
    check(/süresi doldu/i.test(await w.textContent('#modLisDurum')) && !(await w.$('.modcard:not([disabled]) .ms')), 'tek lisans süresi dolunca bu modül ekranında bir kez belirtiliyor');
    await w.click('.modcard[data-mod=fatura]');
    await w.waitForSelector('#licGate:not([hidden])');
    check(/muhawin lisans/i.test(await w.textContent('#licTitle')), 'lisans ekranı tek lisansı gösteriyor');
    await w.screenshot({ path: OUT + '/5-lisans.png' });
    await w.fill('#licKey', 'EKSTRE-XXXXX');
    await w.click('#licBtn');
    await w.waitForSelector('#fkFrame:not([hidden])', { timeout: 40000 });
    check(true, 'tek lisans kodu (Banka kodu) girilince Muhasebe İşlemleri açıldı');
  } catch (e) { bad.push('HATA (2): ' + e.message.split('\n')[0]); await w.screenshot({ path: OUT + '/hata2.png' }).catch(() => {}); }
  finally { await app.close().catch(() => {}); fake.server.close(); }

  // ---------------- 2b. pencere ve dosya güvenliği (Görev 14; rapor-02 O1, O3, D9, D12) ----------------
  s = await oturum('deneme'); ({ app, w, fake } = s);
  const GECICI = ['MuhaWin-pdf', 'MuhaWin-faturalar', 'MuhaWin-wa'];
  try {
    // dış tarayıcı / dosya gezgini açılmasın: ana süreçteki shell işlevleri kayda alınır
    await app.evaluate(({ shell }) => { global.__dis = []; shell.openExternal = async u => { global.__dis.push(u); }; shell.showItemInFolder = p => { global.__dis.push('goster:' + p); }; });
    const once = w.url();
    await w.evaluate(() => { location.href = 'https://ornek.com/'; }); await w.waitForTimeout(800);
    check(w.url() === once && await w.evaluate(() => !!window.desktop), 'ana pencere başka adrese gitmez (will-navigate engeli)');
    check((await app.evaluate(() => global.__dis)).includes('https://ornek.com/'), 'engellenen https bağlantısı dış tarayıcıya yönlendirildi');
    const om = await w.evaluate(async () => { const r = []; for (const u of ['mailto:a@ornek.com?subject=MuhaWin', 'https://ornek.com/', 'file:///etc/passwd', 'ms-settings:privacy', 'javascript:alert(1)']) {
      try { await window.desktop.openMail(u); r.push('ok'); } catch (e) { r.push('red'); } } return r.join(','); });
    check(om === 'ok,ok,red,red,red', 'open-mail yalnız mailto: ve https: açar (' + om + ')');
    const sf = await w.evaluate(async () => { try { await window.desktop.showInFolder('/etc/passwd'); return 'acildi'; } catch (e) { return 'red'; } });
    check(sf === 'red' && !(await app.evaluate(() => global.__dis)).some(x => /passwd/.test(x)), 'klasörde göster: programın yazmadığı yol reddedilir');
    for (const ad of GECICI) { fs.mkdirSync(path.join(os.tmpdir(), ad), { recursive: true }); fs.writeFileSync(path.join(os.tmpdir(), ad, 'deneme.pdf'), 'x'); }
    // Görev 44: Luca'da Çalış penceresinde "MuhaWin'e git" — üst şeritte; basınca MuhaWin ana penceresi öne gelir / odak alır, Luca açık kalır
    { const sl = await require('./luca/sahte-ust-serit').baslat();
      try {
        await app.evaluate(async ({ BrowserWindow }, url) => { const L = global.__mwTest.luca;
          const lw = new BrowserWindow({ width: 1366, height: 800, show: true, title: 'Luca – çalışma' }); global.__lw = lw; L._git.donDugmesiBagla(lw); await lw.loadURL(url + '/Luca/luca.do'); }, sl.url);
        const lp = await (async () => { for (let i = 0; i < 50; i++) { const p = app.windows().find(x => /\/Luca\/luca\.do/.test(x.url())); if (p) return p; await w.waitForTimeout(100); } return null; })();
        const ust = () => lp.frame('frm4');
        await ust().waitForSelector('#mwMuhaWineGit:not([hidden])', { timeout: 10000 });
        const d = await ust().evaluate(() => { const b = document.getElementById('mwMuhaWineGit'), r = b.getBoundingClientRect(); return { metin: b.textContent, sol: Math.round(r.left), logoSag: Math.round(document.getElementById('lucaLogo').getBoundingClientRect().right), yuk: innerHeight }; });
        check(d.metin === "MuhaWin'e git" && d.sol > d.logoSag && d.yuk < 100, 'Luca penceresinde "MuhaWin\'e git" en üstteki şeritte, logonun sağında (' + JSON.stringify(d) + ')');
        // şerit çerçevesi yenilenince ve içerik sayfası değişince ana süreç düğmeyi yeniden koyar; ikinci düğme oluşmaz
        await ust().evaluate(() => location.reload()); await w.waitForTimeout(400); await ust().waitForSelector('#mwMuhaWineGit:not([hidden])', { timeout: 10000 });
        await lp.frame('frm3').evaluate(() => { location.href = 'bos.do?s=2'; }); await w.waitForTimeout(800);
        const sayi = await Promise.all(lp.frames().map(f => f.evaluate(() => document.querySelectorAll('#mwMuhaWineGit').length).catch(() => 0)));
        check(sayi.reduce((a, b) => a + b, 0) === 1 && await ust().$('#mwMuhaWineGit'), 'şerit yenilenince / sayfa değişince düğme yerinde, tek düğme (' + sayi.join(',') + ')');
        const once = await app.evaluate(({ BrowserWindow }) => { global.__lw.focus(); return new Promise(r => setTimeout(() => r(BrowserWindow.getFocusedWindow() === global.__lw), 300)); });
        await ust().click('#mwMuhaWineGit'); await w.waitForTimeout(700);
        const o = await app.evaluate(({ BrowserWindow }) => { const f = BrowserWindow.getFocusedWindow(); const ana = BrowserWindow.getAllWindows().find(x => x.getTitle() === 'MuhaWin');
          return { odak: f ? f.getTitle() : null, anaOdak: !!ana && ana.isFocused(), lucaAcik: !global.__lw.isDestroyed() && global.__lw.isVisible() && !global.__lw.isMinimized() }; });
        check(once && o.anaOdak && o.odak === 'MuhaWin' && o.lucaAcik, '"MuhaWin\'e git": ana pencere öne geldi ve odak aldı; Luca penceresi açık kaldı (küçültülmedi) (' + JSON.stringify({ oncekiOdakLuca: once, ...o }) + ')');
      } finally { await app.evaluate(() => { try { global.__lw.destroy(); } catch (e) {} }).catch(() => {}); sl.kapat(); } }
  } catch (e) { bad.push('HATA (2b): ' + e.message.split('\n')[0]); await w.screenshot({ path: OUT + '/hata2b.png' }).catch(() => {}); }
  finally { await app.close().catch(() => {}); fake.server.close(); }
  check(GECICI.every(ad => !fs.existsSync(path.join(os.tmpdir(), ad, 'deneme.pdf'))), 'çıkışta geçici fatura / PDF / WhatsApp klasörleri temizlendi');

  // ---------------- 3. senaryo: ofis oluştur, çalışan davet et ----------------
  s = await oturum('deneme'); ({ app, w, fake } = s);
  try {
    await w.evaluate(() => { window.__mail = []; });
    await app.evaluate(({ shell }) => { shell.openExternal = async u => { global.__mail = (global.__mail || []).concat(u); }; });
    await w.click('#modSettings');
    await w.waitForSelector('#ofisSec [data-of=create]', { timeout: 10000 });
    await w.fill('#of_ad', 'Antalya SMMM'); await w.fill('#of_uye', '1212207');
    await w.click('[data-of=create]');
    await w.waitForSelector('#askModal:not([hidden])'); await w.click('#askYes');
    await w.waitForSelector('#of_email', { timeout: 10000 });
    check(/Antalya SMMM/.test(await w.textContent('#ofisSec')) && /1212207/.test(await w.textContent('#ofisSec')), 'ofis oluşturuldu (ad + üye no)');
    const c = await w.evaluate(() => window.desktop.luca.credGet());
    check(c.uyeno === '1212207' && c.uyeKilitli, 'Luca üye no ofisinkine kilitlendi');
    check(await w.$eval('#lg_uyeno', x => x.readOnly), 'Ayarlar\'da üye no alanı değiştirilemez');
    await w.fill('#of_email', 'Calisan@Ofis.com'); await w.click('[data-of=invite]');
    await w.waitForTimeout(1200);
    check(/MW-ABCD-EFGH-JKMN/.test(await w.textContent('#ofisSec')), 'davet kodu gösterildi');
    const mails = await app.evaluate(() => global.__mail || []);
    check(mails.some(u => u.startsWith('mailto:calisan%40ofis.com') && decodeURIComponent(u).includes('MW-ABCD-EFGH-JKMN') && decodeURIComponent(u).includes('1212207')), 'e-posta taslağı kod ve üye no ile açıldı');
    check(/calisan@ofis.com/.test(await w.textContent('#ofisSec')), 'bekleyen davet listede');
    await w.screenshot({ path: OUT + '/6-ofis.png', fullPage: true });
    await w.evaluate(() => document.querySelector('#regBody').scrollIntoView());
    const of = await w.$('#ofisSec'); await of.screenshot({ path: OUT + '/7-ofis-bolum.png' });
  } catch (e) { bad.push('HATA (3): ' + e.message.split('\n')[0]); await w.screenshot({ path: OUT + '/hata3.png' }).catch(() => {}); }
  finally { await app.close().catch(() => {}); fake.server.close(); }

  // ---------------- 5. Fatura → Luca kayıt (kural, fiş, Luca'ya yazma, ardından muavin kontrolü) ----------------
  s = await oturum('deneme'); ({ app, w, fake, cfg } = s);
  try {
    await w.click('.modcard[data-mod=fatura]');
    const fe = await w.waitForSelector('#fkFrame:not([hidden])', { timeout: 40000 });
    const fr = await fe.contentFrame(); await fr.waitForSelector('#sekmeler', { timeout: 20000 });
    const hd = fs.readdirSync(path.join(cfg, 'MuhaWin', 'hesaplar')).map(d => path.join(cfg, 'MuhaWin', 'hesaplar', d, 'fatura_kontrol')).find(d => fs.existsSync(d));
    const k = path.join(hd, 'firmalar', 'EXPO İNŞ', '2026', '09'); fs.mkdirSync(k, { recursive: true });
    fs.writeFileSync(path.join(hd, 'firmalar', 'EXPO İNŞ', 'firma.json'), JSON.stringify({ ad: 'EXPO İNŞ', vkn: '3810463613', luca_id: '11' }));
    require('child_process').execFileSync('python3', ['-c', `
import sys, zipfile; sys.path.insert(0, ${JSON.stringify(path.join(APP, 'fk', 'tests'))}); sys.path.insert(0, ${JSON.stringify(path.join(APP, 'fk'))})
from test_luca_otomasyon import muavin_yaz, ubl, FIRMA_VKN
from pathlib import Path
k = Path(${JSON.stringify(k)}); muavin_yaz(k / 'muavin.xlsx')
with zipfile.ZipFile(k / 'faturalar.zip', 'w') as z:
    z.writestr('gib_efatura_alis/AAA2026000000001.xml', ubl('AAA2026000000001', '2026-09-05', '1', FIRMA_VKN, '1000.00', '200.00', 20))
    z.writestr('gib_efatura_alis/YYY2026000000009.xml', ubl('YYY2026000000009', '2026-09-20', '1', FIRMA_VKN, '500.00', '100.00', 20))
    z.writestr('gib_efatura_alis/ZZZ2026000000010.xml', ubl('ZZZ2026000000010', '2026-09-25', '1', FIRMA_VKN, '50.00', '10.00', 20))
`]);
    await w.evaluate(async () => { const { Store } = window.__app;
      await Store.saveFirm({ id: 'kf1', name: 'EXPO İNŞ', lucaId: '11', banks: [], mizanInfo: { source: 'luca', year: '2026', at: new Date().toISOString(), parts: 1 } });
      await Store.saveMizan('kf1', [['191', 'İNDİRİLECEK KDV'], ['191.10.20', '%20 İndirilecek KDV'], ['320', 'SATICILAR'], ['320.01', 'SATICI 1'], ['770', 'GENEL YÖNETİM GİDERLERİ'], ['770.01', 'KIRTASİYE']]); });
    // Luca'yı taklit et: oturum açık, fiş kesme kaydedilsin
    await app.evaluate(({ ipcMain }) => { global.__fis = [];
      for (const ch of ['luca-status', 'luca-prepare-fis', 'luca-fis-kes', 'luca-mizan']) ipcMain.removeHandler(ch);
      ipcMain.handle('luca-status', () => ({ loggedIn: true }));
      ipcMain.handle('luca-mizan', () => { global.__otoMizan = (global.__otoMizan || 0) + 1; throw new Error('test: Luca mizanı yok'); });
      ipcMain.handle('luca-prepare-fis', (e, a) => ({ donemId: '900', year: String(a.year), firmLabel: 'EXPO İNŞ' }));
      ipcMain.handle('luca-fis-kes', (e, a) => { global.__fis.push(a); return { ok: true, fisNo: String(100 + global.__fis.length), fisId: 'x' }; }); });
    await fr.evaluate(() => window.top.postMessage({ fk: true, tip: 'faturaKaydet', id: 'EXPO İNŞ/2026/09' }, '*'));
    await w.waitForSelector('#fkKayit:not([hidden]) #fkkTable tbody tr[data-i]', { timeout: 30000 });
    let satir = await w.$$eval('#fkkTable tbody tr[data-i]', t => t.map(x => x.textContent));
    check(satir.length === 2 && satir.some(x => x.includes('YYY2026000000009')) && !satir.some(x => x.includes('AAA2026')), 'kayıtsız faturalar listelendi, kayıtlı olan gizli');
    // başlığa tıklayınca sıralama, başlık altında filtre
    await w.click('[data-fksort=toplam]'); await w.click('[data-fksort=toplam]'); await w.waitForTimeout(150);
    check(/YYY/.test(await w.textContent('#fkkTable tbody tr[data-i] >> nth=0')), 'toplam büyükten küçüğe sıralandı');
    await w.click('[data-fksort=tarih]'); await w.waitForTimeout(150);
    check(/YYY/.test(await w.textContent('#fkkTable tbody tr[data-i] >> nth=0')), 'tarih eskiden yeniye sıralandı');
    await w.fill('[data-fkfl=toplam]', '<100'); await w.waitForTimeout(150);
    satir = await w.$$eval('#fkkTable tbody tr[data-i]', t => t.map(x => x.textContent));
    check(satir.length === 1 && satir[0].includes('ZZZ'), 'başlık altındaki filtre (Toplam <100)');
    // kaydetme: işaretle → onayla → kontrolde eksik sayılmaz
    await w.click('[data-haric]'); await w.waitForSelector('#fkkHaricOnay');
    await w.fill('[data-fkfl=toplam]', ''); await w.waitForTimeout(150);
    await w.click('#fkkHaricOnay'); await w.waitForSelector('#askModal:not([hidden])'); await w.click('#askYes'); await w.waitForTimeout(2500);
    const hj = path.join(hd, 'firmalar', 'EXPO İNŞ', 'kaydedilmeyecek.json');
    check(fs.existsSync(hj) && Object.values(JSON.parse(fs.readFileSync(hj, 'utf8'))).some(x => x.belge_no === 'ZZZ2026000000010'), 'kaydedilmeyecek fatura firmaya yazıldı');
    satir = await w.$$eval('#fkkTable tbody tr[data-i]', t => t.map(x => x.textContent));
    check(satir.length === 1 && satir[0].includes('YYY'), 'kaydedilmeyecek fatura kayıtsızlar listesinden çıktı');
    await w.click('[data-fkf=haric]'); await w.waitForTimeout(150);
    check(/kaydedilmeyecek/.test(await w.textContent('#fkkTable tbody')), 'Kaydedilmeyecek sekmesinde görünüyor');
    await w.screenshot({ path: OUT + '/10b-kaydetme.png' });
    await w.click('[data-fkf=kayitsiz]'); await w.waitForTimeout(150);
    check(await w.$eval('#fkkTable [data-c]', x => x.value) === '320.01', 'cari hesap ünvandan bulundu (320.01)');
    { const t = await w.textContent('#fkkSecHaric', { timeout: 3000 }).catch(() => 'YOK'); check(/kaydetme \(1\)/i.test(t), 'toplu: seçilen faturaları tek açıklamayla kaydetme düğmesi (' + t + ')'); }
    check(await w.$eval('#fkkGo', x => x.disabled), 'hesap seçilmeden kayıt düğmesi kapalı');
    { const n0 = await w.$$eval('#fkkTable tbody tr[data-i]', t => t.length);
      await w.click('[data-fkef=dolu]'); await w.waitForTimeout(150); const nd = await w.$$eval('#fkkTable tbody tr[data-i]', t => t.length);
      await w.click('[data-fkef=eksik]'); await w.waitForTimeout(150); const ne = await w.$$eval('#fkkTable tbody tr[data-i]', t => t.length);
      check(nd === 0 && ne === n0 && n0 >= 1, 'Eksik / Dolu filtresi: matrah hesabı boş fatura "Eksik"te, "Dolu" boş (' + ne + '/' + nd + ')');
      await w.click('[data-fkef=""]'); await w.waitForTimeout(150); }
    await w.click('[data-kural]'); await w.waitForSelector('#fkkModal:not([hidden]) #kHesap');
    await w.fill('#kHesap', '770.01'); await w.click('#kKaydet'); await w.waitForTimeout(400);
    check(/kural/.test(await w.textContent('#fkkTable tbody tr[data-i]')), 'kural uygulandı');
    check(/Ünvan içerir/.test(await w.textContent('#fkkTable tbody tr[data-i]')), 'listede uygulanan kural görünüyor (eski tek şartlı kural)');
    // Görev 34 · 7: bu ekranın "Kural yap"ı çoklu şart (VE) ve "Hiç kaydetme"
    { const sec0 = await w.evaluate(() => window.__fkayit._st.rows[0].sec);
      await w.click('#fkkTable tbody tr[data-i] [data-kural]'); await w.waitForSelector('#fkkModal:not([hidden]) #kSartEkle');
      await w.click('#kSartEkle'); const n2 = await w.$$eval('#kSartlar .ksart', l => l.length);
      const ikinci = await w.$eval('#kSartlar .ksart:nth-child(2) [data-kalan]', e => e.value);
      await w.fill('#kSartlar .ksart:nth-child(2) [data-kdeger]', 'BU KALEM YOK'); await w.waitForTimeout(100);
      const say0 = await w.textContent('#kSay');
      await w.click('#kSartEkle'); await w.click('#kSartlar .ksart:nth-child(3) [data-ksil]');
      await w.selectOption('#kSartlar .ksart:nth-child(2) [data-kalan]', 'unvan'); await w.waitForTimeout(100);   // değer ünvanla dolar
      const say1 = await w.textContent('#kSay');
      await w.selectOption('#kEylem', 'atla'); const gizli = await w.isHidden('#kHesaplar');
      await w.click('#kKaydet'); await w.waitForTimeout(400);
      const r = await w.evaluate(() => { const st = window.__fkayit._st; const x = st.rows[0]; const k = Object.values(st.kural).find(y => y.eylem === 'atla');
        return { atla: !!x.kuralAtla, sec: x.sec, k: k && { ek: k.ek, eylem: k.eylem, hesap: k.hesap } }; });
      const metin = await w.textContent('#fkkTable');
      check(n2 === 2 && ikinci === 'icerik' && /^0 fatura/.test(say0) && /^[1-9]\d* fatura/.test(say1) && gizli, '"+ Şart ekle" 2. şart açtı (VE), sayaç şartlarla daralıyor; "Hiç kaydetme"de hesap alanları gizli (' + say0 + ' / ' + say1 + ')');
      check(r.atla && !r.sec && r.k && r.k.ek.length === 1 && r.k.eylem === 'atla' && !r.k.hesap, '"Hiç kaydetme" kuralı: fatura seçilmedi, fişe alınmayacak (' + JSON.stringify(r) + ')');
      check(/kaydedilmeyecek \(kural\)/.test(metin), 'listede "kaydedilmeyecek (kural)" görünüyor');
      await w.click('#fkkKurallar'); await w.waitForSelector('#fkkKuralTablo');
      const kt = await w.textContent('#fkkKuralTablo');
      check(/ VE /.test(kt) && /hiç kaydetme/.test(kt), 'kural listesinde şartlar VE ile ve sonuç "hiç kaydetme"');
      // çok şartlı kuralı sil: eski tek şartlı kural yeniden uygulanır
      const id = await w.evaluate(() => Object.values(window.__fkayit._st.kural).find(y => y.eylem === 'atla').id);
      await w.click(`[data-kdel="${id}"]`); await w.waitForTimeout(400); await w.click('#fkkModal [data-kx]').catch(() => {});
      const geri = await w.evaluate(() => { const x = window.__fkayit._st.rows[0]; return { atla: !!x.kuralAtla, hesap: x.hesap, kaynak: x.kaynak }; });
      check(!geri.atla && geri.hesap === '770.01' && geri.kaynak === 'kural', 'çok şartlı kural silinince eski kural yeniden uygulandı (' + JSON.stringify(geri) + ')');
      check(await w.evaluate(() => window.__fkayit._st.rows[0].sec) === sec0, 'kural kalkınca kullanıcının önceki seçimi geri geldi'); }
    await w.click('[data-fis]'); await w.waitForTimeout(200);
    const fis = await w.$$eval('#fkkTable table.mini tbody tr', t => t.map(x => [...x.children].map(c => { const i = c.querySelector('input'); return i ? i.value : c.textContent.trim(); })));
    check(JSON.stringify(fis.map(r => [r[0], r[3], r[4]])) === JSON.stringify([['770.01', '500,00', ''], ['191.10.20', '100,00', ''], ['320.01', '', '600,00']]), 'fiş: gider borç, KDV borç, cari alacak');
    // Görev 39: fatura fişinde ＋ Satır ekle / − / Geri ekle / 0 kuralı
    { const T = '#fkkTable table.mini';
      const durum = () => w.evaluate((T) => { const i = +document.querySelector('[data-fekle]').dataset.fekle; const r = window.__fkayit._st.rows[i]; const s = window.__fkayit._satirlar(r);
        const top = (k) => Math.round(s.L.reduce((t, x) => t + x[k], 0) * 100) / 100;
        return { L: s.L.length, ek: document.querySelectorAll(T + ' tr.fkek').length, cikan: document.querySelectorAll(T + ' tr.fiscikan').length, b: top('b'), c: top('c'), cari: (s.L.find(x => x.acc === '320.01') || {}).c }; }, T);
      await w.click('[data-fekle]'); await w.waitForTimeout(200); const d1 = await durum();
      await w.fill(`${T} tr.fkek >> nth=-1 >> [data-alan=acc]`, '770.01'); await w.dispatchEvent(`${T} tr.fkek >> nth=-1 >> [data-alan=acc]`, 'change'); await w.waitForTimeout(200);
      await w.fill(`${T} tr.fkek >> nth=-1 >> [data-alan=b]`, '10,00'); await w.dispatchEvent(`${T} tr.fkek >> nth=-1 >> [data-alan=b]`, 'change'); await w.waitForTimeout(300); const d2 = await durum();
      await w.click(`${T} [data-feksil]`); await w.waitForTimeout(200); const d3 = await durum();
      await w.click(`${T} [data-fcikar] >> nth=0`); await w.waitForTimeout(200); const d4 = await durum();
      await w.click(`${T} [data-fgeri]`); await w.waitForTimeout(200); const d5 = await durum();
      await w.fill(`${T} [data-ftut] >> nth=0`, '0'); await w.dispatchEvent(`${T} [data-ftut] >> nth=0`, 'change'); await w.waitForTimeout(300); const d6 = await durum();
      const ok = d1.ek === 1 && d1.L === 3 && d2.ek === 1 && d2.L === 4 && d2.cari === 610 && d2.b === d2.c && d3.ek === 0 && d3.L === 3 && d4.cikan === 1 && d4.L === 2 && d4.cari === 100 && d4.b === d4.c && d5.cikan === 0 && d5.cari === 600 && d6.L === 3 && d6.cikan === 0 && d6.cari === 600;
      check(ok, 'fatura fişi (FKAYIT): ＋ Satır ekle görünür ve fişe girer, − çıkarır, Geri ekle döndürür, 0 yazmak çıkarmaz, cari dengeler' + (ok ? '' : ' ' + JSON.stringify([d1, d2, d3, d4, d5, d6]))); }
    // Görev 47: Faturaları Luca'ya kaydet ekranında Esc ekranı hiç kapatmaz; kutudaysa yalnız kutudan çıkar; küçük pencereyi önce kutudan, sonra kapatır
    { const H = '#fkkTable tbody tr[data-i] >> nth=0 >> [data-h]';
      const v0 = await w.$eval(H, x => x.value); await w.click(H); await w.fill(H, v0);
      await w.keyboard.press('Escape'); await w.waitForTimeout(200);
      const d1 = await w.evaluate(() => ({ acik: !document.querySelector('#fkKayit').hidden, kutu: document.activeElement && document.activeElement.tagName === 'INPUT' }));
      await w.keyboard.press('Escape'); await w.waitForTimeout(200); const d2 = !(await w.isHidden('#fkKayit'));
      const tut = '#fkkTable tr.fisdetay [data-ftut] >> nth=0'; let d3 = true;
      if (await w.$(tut)) { await w.click(tut); await w.keyboard.press('Escape'); await w.waitForTimeout(200); d3 = !(await w.isHidden('#fkKayit')); }
      check(d1.acik && !d1.kutu && d2 && d3 && await w.$eval(H, x => x.value) === v0, 'Esc: Luca\'ya kaydet ekranında kutudan çıkar, ekran kapanmaz (ikinci Esc ve fiş kutusunda da) (' + JSON.stringify({ d1, d2, d3 }) + ')');
      const i0 = await w.$eval('#fkkTable tbody tr[data-i]', t => t.dataset.i);
      await w.click(`[data-kural="${i0}"]`); await w.waitForSelector('#fkkModal:not([hidden]) [data-kdeger]');
      await w.click('#fkkModal [data-kdeger] >> nth=0'); await w.keyboard.press('End'); await w.keyboard.type(' ESC');
      await w.keyboard.press('Escape'); await w.waitForTimeout(200);
      const m1 = await w.evaluate(() => ({ pencere: !document.querySelector('#fkkModal').hidden, deger: document.querySelector('#fkkModal [data-kdeger]').value }));
      await w.keyboard.press('Escape'); await w.waitForTimeout(200);
      const m2 = await w.evaluate(() => ({ pencere: !document.querySelector('#fkkModal').hidden, ekran: !document.querySelector('#fkKayit').hidden }));
      check(m1.pencere && / ESC$/.test(m1.deger) && !m2.pencere && m2.ekran, 'Esc: Kural penceresinde önce yalnız kutudan çıkar (yazı duruyor), ikinci Esc pencereyi kapatır, ekran açık (' + JSON.stringify({ m1, m2 }) + ')'); }
    await w.screenshot({ path: OUT + '/10-fatura-kayit.png' });
    // fiş kuralları: tevkifat, satış, satış tevkifatı, iadeler, ihraç kayıtlı
    const vakalar = await w.evaluate(() => {
      const F = window.__fkayit; const st = F._st;
      st.acc.set('191.10.20', '%20 İndirilecek KDV'); st.acc.set('391.10.20', '%20 Hesaplanan KDV'); st.acc.set('360.01', 'KDV TEVKİFATI'); st.acc.set('191.20.20', '%20 TEVKİFATLI İNDİRİLECEK KDV'); st.acc.set('689.01', 'ÖZEL İLETİŞİM VERGİSİ'); st.acc.set('770.90', 'İNDİRİLEMEYEN BİNEK ARAÇ KDV'); st.acc.set('770.91', 'KKEG BİNEK ARAÇ GİDERLERİ');
      st.leaf.add('391.10.20'); st.leaf.add('360.01'); st.leaf.add('191.20.20'); st.leaf.add('689.01'); st.leaf.add('770.90'); st.leaf.add('770.91'); st.acc.set('950.09', 'ÖİV Nazım Hesabı'); st.acc.set('951.09', 'Özel İletişim Vergisi Nazım'); st.leaf.add('950.09'); st.leaf.add('951.09'); st.data.kdv_hesaplari = { ALIS: { '20': '191.10.20' }, SATIS: { '20': '391.10.20' } }; st.data.tevkifat_hesabi = '360.01';
      const f = (o) => ({ yon: 'ALIS', tip: 'SATIS', matrah: 1000, kdv: 200, odenecek: 1200, tevkifat: 0, oranlar: [{ oran: '20', matrah: 1000, kdv: 200 }], diger_vergiler: {}, kalemler: [], ...o });
      const L = (fa, h, c) => F._satirlar({ f: fa, hesap: h, cari: c }).L.map(x => x.acc + ':' + (x.b ? 'B' + x.b : 'A' + x.c)).join(' ');
      return {
        alisTevk: L(f({ tevkifat: 100, odenecek: 1100 }), '770.01', '320.01'),
        satis: L(f({ yon: 'SATIS' }), '600.01', '120.01'),
        binek: F._satirlar({ f: f({}), hesap: '770.01', cari: '320.01', binek: true }).L.map(x => x.acc + ':' + (x.b ? 'B' + x.b : 'A' + x.c)).join(' '),
        oiv: L(f({ diger_vergiler: { 'ÖZEL İLETİŞİM VERGİSİ': 75 }, odenecek: 1275 }), '770.01', '320.01'),
        gecmis302: F._oner({ yon: 'ALIS', tip: 'SATIS', karsi_unvan: 'SATICI 1', karsi_vkn: '1', kalemler: [], gecmis: { cari: '302.01', hesap: '770.01' } }).cari,
        satisTevk: L(f({ yon: 'SATIS', tevkifat: 100, odenecek: 1100 }), '600.01', '120.01'),
        alisIadesi: L(f({ yon: 'SATIS', tip: 'IADE' }), '153.01', '320.01'),
        satisIadesi: L(f({ tip: 'IADE' }), '610.01', '120.01'),
        fark: (() => { const r = { f: f({ odenecek: 1201 }), hesap: '770.01', cari: '320.01', fark: '689.01' }; return F._satirlar(r).L.map(x => x.acc + ':' + (x.b ? 'B' + x.b : 'A' + x.c)).join(' '); })(),
        ihracKayitli: L(f({ yon: 'SATIS', tip: 'IHRACKAYITLI', ihrac_kayitli: true, odenecek: 1000 }), '601.01', '120.01'),
        elle: (() => { const x = F._satirlar({ f: f({ diger_vergiler: { 'ÖZEL İLETİŞİM VERGİSİ': 75 }, odenecek: 1275 }), hesap: '770.01', cari: '320.01', oiv: '', satirElle: { 'KDV %20#1': '191.99' } }); return x.L.map(x => x.acc).join(' ') + '|' + x.err.length; })(),
      };
    });
    console.log('VAKA', JSON.stringify(vakalar));
    check(vakalar.alisTevk === '770.01:B1000 191.20.20:B100 191.10.20:B100 360.01:A100 320.01:A1100', 'alış tevkifatı: tevkif edilen KDV 191 tevkifatlı hesaba, kalan normal 191\'e; 360 alacak, cari net');
    check(vakalar.binek === '770.01:B700 770.91:B300 770.90:B60 191.10.20:B140 320.01:A1200', 'binek araç: gider %30 KKEG, KDV %30 indirilemeyen binek KDV (' + vakalar.binek + ')');
    check(/^770\.01 689\.01 950\.09 951\.09 191\.99 320\.01\|0$/.test(vakalar.elle), 'fiş satırında elle yazılan hesap (KDV) kullanıldı (' + vakalar.elle + ')');
    check(vakalar.oiv === '770.01:B1000 689.01:B75 950.09:B75 951.09:A75 191.10.20:B200 320.01:A1275', 'telefon faturası: ÖİV 689\'a ve 950 / 951 nazım (' + vakalar.oiv + ')');
    check(vakalar.gecmis302 === '320.01', 'geçmişte cari diye 302 öğrenilmişse kullanılmaz, ünvandan 320 bulunur');
    check(vakalar.satis === '600.01:A1000 391.10.20:A200 120.01:B1200', 'satış: gelir ve 391 alacak, cari borç');
    check(vakalar.satisTevk === '600.01:A1000 391.10.20:A100 120.01:B1100', 'satış tevkifatı: 391 tahsil edilen kısım');
    check(vakalar.alisIadesi === '153.01:A1000 191.10.20:A200 320.01:B1200', 'alış iadesi (satış yönlü iade): 153 ve 191 alacak');
    check(vakalar.satisIadesi === '610.01:B1000 391.10.20:B200 120.01:A1200', 'satış iadesi: 610 ve 391 borç');
    check(vakalar.fark === '770.01:B1000 191.10.20:B200 689.01:B1 320.01:A1201', 'ödenecek farkı seçilen hesaba, cari = ödenecek');
    check(vakalar.ihracKayitli === '601.01:A1000 120.01:B1000', 'ihraç kayıtlı: KDV kayda alınmaz');
    // ---- Görev 38: ÖİV'li fatura fişi (UBL 4080 → 689, 950 / 951 nazım, KDV, cari; fark ayrı satırda hesapsız; ÖİV hesabı yok / iki tane)
    { const ubl = JSON.parse(require('child_process').execFileSync('python3', ['-c', `import sys, json; sys.path.insert(0, ${JSON.stringify(path.join(APP, 'fk', 'tests'))}); sys.path.insert(0, ${JSON.stringify(path.join(APP, 'fk'))})
from test_oiv_fis import oiv_ubl
from fatura_kontrol.fatura_okuyucu import xml_oku
def aday(f):
    return {"yon": "ALIS", "tip": f.tip.upper(), "belge_no": f.belge_no, "tarih": f.tarih.isoformat(), "karsi_unvan": f.karsi_unvan, "karsi_vkn": f.karsi_vkn, "kalemler": [],
            "matrah": float(f.matrah), "kdv": float(f.kdv_toplam), "odenecek": float(f.odenecek), "tevkifat": 0,
            "oranlar": [{"oran": str(int(o)), "matrah": 0, "kdv": float(v)} for o, v in f.kdv_oranlari.items()],
            "diger_vergiler": {a: float(v) for a, v in f.diger_vergiler.items()}, "masraflar": [], "gecmis": {}}
print(json.dumps({"tam": aday(xml_oku(oiv_ubl(), "a.xml")), "fark": aday(xml_oku(oiv_ubl("TEL2026000000002", "1290.03", "öiv"), "b.xml"))}))`]).toString());
      const g = await w.evaluate((u) => { const F = window.__fkayit, st = F._st;
        for (const [k, v] of [['950.09', 'ÖİV Nazım Hesabı'], ['951.09', 'Özel İletişim Vergisi Nazım'], ['679.01', 'DİĞER OLAĞANDIŞI GELİR VE KARLAR']]) { st.acc.set(k, v); st.leaf.add(k); }
        const S = r => { const x = F._satirlar(r); const b = x.L.reduce((t, y) => t + y.b, 0), c = x.L.reduce((t, y) => t + y.c, 0);
          return { L: x.L.map(y => (y.acc || '∅') + ':' + (y.b ? 'B' + y.b : 'A' + y.c)).join(' '), n: x.L.length, denge: Math.abs(b - c) < 0.005, err: x.err, secim: x.secim || [] }; };
        const r = (f, o) => ({ f, hesap: '770.01', cari: '320.01', ...o });
        const out = { tam: S(r(u.tam)), fark: S(r(u.fark)), farkYazildi: S(r(u.fark, { satirElle: { 'fark (ödenecek ile)#1': '679.01' } })) };
        // ÖİV gider hesabı yok
        const ad = st.acc.get('689.01'); st.acc.delete('689.01'); st.leaf.delete('689.01'); out.yok = S(r(u.tam));
        // iki ÖİV hesabı (biri küçük harfli): seçim istenir
        st.acc.set('689.01', ad); st.leaf.add('689.01'); st.acc.set('689.06', 'öiv gideri (telefon)'); st.leaf.add('689.06'); out.iki = S(r(u.tam));
        return out; }, ubl);
      console.log('G38', JSON.stringify(g));
      check(g.tam.L === '770.01:B1000 689.01:B75 950.09:B75 951.09:A75 191.10.20:B215 320.01:A1290' && g.tam.n === 6 && g.tam.denge && !g.tam.err.length,
        'ÖİV\'li UBL (4080): 6 satır — gider, ÖİV 689, 950 / 951 nazım, KDV, cari = ödenecek; fiş dengede (' + g.tam.L + ')');
      check(g.fark.n === 7 && /^∅:B0\.03$/.test(g.fark.L.split(' ').pop()) && g.fark.L.includes('320.01:A1290.03') && g.fark.denge && /hesap kodu boş/.test(g.fark.err[0]) && !/770\.\d+:B0\.03/.test(g.fark.L),
        'yuvarlama farkı (0,03): ayrı satır, hesap kodu boş, borç tarafında; cari = ödenecek; 770\'e atılmadı; gönderim hatası ilk sırada (' + g.fark.L + ')');
      check(!g.farkYazildi.err.length && g.farkYazildi.L.includes('679.01:B0.03'), 'fark satırına hesap yazılınca fiş gönderilebilir');
      check(g.yok.L.includes('∅:B75') && g.yok.err.some(e => /689/.test(e) && /hesap yok/.test(e)), 'ÖİV gider hesabı yok: açık uyarı, hesap uydurulmadı (' + g.yok.err.join(' | ') + ')');
      check(g.iki.err.some(e => /birden fazla/.test(e) && /689\.01/.test(e) && /689\.06/.test(e)) && g.iki.secim.length === 1 && g.iki.secim[0].adaylar.join() === '689.01,689.06',
        'iki ÖİV hesabı (biri küçük harfle "öiv"): uyarı ve seçim istendi');
      // ekranda: boş hesaplı satır varken "Luca'ya kaydet" kapalı; ÖİV hesabı seçimi firmada hatırlanır; fark hesabı yazılınca açılır
      await w.evaluate((u) => { const st = window.__fkayit._st; st._g38 = st.rows.map(r => r.sec);
        for (const r of st.rows) r.sec = false;
        st.rows.push({ f: { ...u.fark, anahtar: 'g38', tip: 'SATIS' }, hesap: '770.01', cari: '320.01', kaynak: 'elle', elle: true, cariElle: true, sec: true, acik: true, logged: null, diger: '', fark: '' }); }, ubl);
      await w.click('[data-fkf=tumu]'); await w.waitForTimeout(200);
      const gi = await w.evaluate(() => window.__fkayit._st.rows.length - 1);
      const ilk = { kapali: await w.$eval('#fkkGo', x => x.disabled), dugme: await w.$$eval(`[data-oivsec="${gi}"]`, l => l.map(x => x.dataset.v)) };
      await w.$eval(`#fkkTable tr[data-i="${gi}"]`, e => e.scrollIntoView({ block: 'start' })); await w.waitForTimeout(150);
      await w.screenshot({ path: OUT + '/10d-oiv-fis.png' });
      await w.click(`[data-oivsec="${gi}"][data-v="689.06"]`); await w.waitForTimeout(200);
      const hat = await w.evaluate(() => window.__fkayit._st.firm.fkOivHesap);
      await w.fill(`[data-fel="${gi}"][data-key="fark (ödenecek ile)#1"]`, '679.01'); await w.press(`[data-fel="${gi}"][data-key="fark (ödenecek ile)#1"]`, 'Tab'); await w.waitForTimeout(500);
      if (await w.isVisible('#hsSor')) await w.click('#hsHayir');   // test hesabı (679.01) listede yok: "Luca'ya eklensin mi?" sorusu kapatılır
      const acik = !(await w.$eval('#fkkGo', x => x.disabled));
      check(ilk.kapali && ilk.dugme.join() === '689.01,689.06', 'ekranda: hesapsız fark ve seçilmemiş ÖİV hesabı varken "Luca\'ya kaydet" kapalı, ÖİV hesabı için seçim düğmeleri var');
      check(hat === '689.06' && acik, 'ÖİV hesabı seçimi firmada hatırlandı; fark hesabı yazılınca kayıt açıldı');
      await w.evaluate(async () => { const st = window.__fkayit._st; const { Store } = window.__app; st.rows.pop(); st.rows.forEach((r, i) => { r.sec = st._g38[i]; }); delete st._g38;
        st.acc.delete('689.06'); st.leaf.delete('689.06'); const f = { ...st.firm }; delete f.fkOivHesap; st.firm = f; await Store.saveFirm(f); });
      await w.click('[data-fkf=kayitsiz]'); await w.waitForTimeout(200); }
    // ---- Görev 35: cari eşleştirme — VKN / TCKN kesin, ünvan, fatura no ön eki; geçersiz VKN kullanılmaz; çakışmada VKN esas + uyarı
    { const g = await w.evaluate(async () => { const F = window.__fkayit, st = F._st; const eskiF = st.firm;
        for (const [k, v] of [['320.01.101', 'SATICI ALFA TİCARET'], ['320.01.102', 'BETA YAPI MALZEME']]) { st.acc.set(k, v); st.leaf.add(k); }
        const f = o => ({ yon: 'ALIS', tip: 'SATIS', karsi_unvan: 'GAMA DELTA', karsi_vkn: '', gecmis: null, onek: null, ...o });
        const k = x => ({ cari: x.cari, kaynak: x.kaynak, uyari: x.uyari });
        const out = {};
        try {
          st.firm = { ...eskiF, cariVkn: {} };
          out.vkn = k(F._cariSec(f({ karsi_vkn: '1234567890', karsi_unvan: 'BETA YAPI MALZEME', gecmis: { cari: '320.01.101', eslesme: 'vkn' } })));
          out.gecersiz = k(F._cariSec(f({ karsi_vkn: '1234567891', gecmis: { cari: '320.01.101', eslesme: 'vkn' } })));
          out.dokuz = F._vknOk('381046361') === false && F._vknOk('10000000146') && !F._vknOk('10000000147');
          st.firm = { ...eskiF, cariVkn: { '1234567890': '320.01.102' } };
          out.yerel = k(F._cariSec(f({ karsi_vkn: '1234567890', karsi_unvan: 'SATICI ALFA TİCARET' })));
          out.unvan = k(F._cariSec(f({ karsi_vkn: '1234567891', karsi_unvan: 'SATICI ALFA TİCARET' })));
          out.onek = k(F._cariSec(f({ onek: { ek: 'ABC', firma: 1, genel: false, cari: '320.01.101' } })));
          out.onekDestek = k(F._cariSec(f({ karsi_unvan: 'SATICI ALFA TİCARET', onek: { ek: 'ABC', firma: 1, genel: false, cari: '320.01.101' } })));
          out.onekCelisir = k(F._cariSec(f({ karsi_unvan: 'SATICI ALFA TİCARET', onek: { ek: 'ABC', firma: 1, genel: false, cari: '320.01.102' } })));
          out.genel = k(F._cariSec(f({ onek: { ek: 'GIB', firma: 1, genel: true, cari: '320.01.101' } })));
          st.firm = { ...eskiF, cariVkn: {} };
          F._cariVknHatirla([{ f: { karsi_vkn: '10000000146' }, cari: '320.01.102' }, { f: { karsi_vkn: '1234567891' }, cari: '320.01.101' }, { f: { karsi_vkn: '1234567890' }, cari: '770.01' }]);
          out.hatirla = st.firm.cariVkn;
        } finally { st.firm = eskiF; await window.__app.Store.saveFirm(eskiF); }
        // ekranda: VKN çipi ve çakışma uyarısı
        st.rows.push({ f: { yon: 'ALIS', tip: 'SATIS', anahtar: 'g35', belge_no: 'ABC2026000000099', tarih: '2026-09-20', karsi_unvan: 'BETA YAPI MALZEME', karsi_vkn: '1234567890', matrah: 100, kdv: 20, odenecek: 120, tevkifat: 0, oranlar: [{ oran: '20', matrah: 100, kdv: 20 }], diger_vergiler: {}, kalemler: [], gecmis: { cari: '320.01.101', eslesme: 'vkn' } },
          hesap: '770.01', kaynak: 'elle', elle: true, sec: false, acik: false, logged: null, diger: '', fark: '', ...(() => { const c = F._cariSec({ yon: 'ALIS', tip: 'SATIS', karsi_unvan: 'BETA YAPI MALZEME', karsi_vkn: '1234567890', gecmis: { cari: '320.01.101', eslesme: 'vkn' } }); return { cari: c.cari, cariKaynak: c.kaynak, cariUyari: c.uyari }; })() });
        return out; });
      console.log('G35', JSON.stringify(g));
      check(g.vkn.cari === '320.01.101' && g.vkn.kaynak === 'VKN' && /VKN esas alındı/.test(g.vkn.uyari) && /320\.01\.102/.test(g.vkn.uyari), 'VKN ile bulunan cari ünvanla bulunandan farklı: VKN esas alındı, uyarı verildi');
      check(!g.gecersiz.cari && /geçersiz/.test(g.gecersiz.uyari) && g.dokuz, 'sağlaması tutmayan VKN eşleştirmede kullanılmadı, uyarı verildi; TCKN sağlaması doğru');
      check(g.yerel.cari === '320.01.102' && g.yerel.kaynak === 'VKN', 'firmada hatırlanan VKN → cari kesin eşleşme (ünvan başka cariyi gösterse de)');
      check(g.unvan.cari === '320.01.101' && g.unvan.kaynak === 'ünvan', 'VKN geçersizse ünvanla eşleşti');
      check(g.onek.cari === '320.01.101' && g.onek.kaynak === 'ön ek' && /kontrol edin/.test(g.onek.uyari), 'yalnız tek firmanın kullandığı ön ekle bulundu, uyarıyla');
      check(g.onekDestek.kaynak === 'ünvan + ön ek' && !g.onekDestek.uyari && /kontrol edin/.test(g.onekCelisir.uyari) && g.onekCelisir.cari === '320.01.101', 'ön ek destekleyici: ünvanla aynıysa güçlendirir, farklıysa uyarır (ünvan geçerli)');
      check(!g.genel.cari, 'genel ön ek (GIB) tek başına cari göstermez');
      check(JSON.stringify(g.hatirla) === JSON.stringify({ '10000000146': '320.01.102' }), 'Luca\'ya kaydedilen cari firmada geçerli VKN / TCKN ile hatırlanır (geçersiz VKN ve cari olmayan hesap hatırlanmaz)');
      await w.click('[data-fkf=tumu]'); await w.waitForTimeout(200);
      const ui = await w.evaluate(() => { const st = window.__fkayit._st; const i = st.rows.length - 1; const tr = document.querySelector(`#fkkTable tr[data-i="${i}"]`);
        const t = tr ? tr.textContent : ''; return { cip: /VKN/.test(t), uyari: !!(tr && tr.querySelector('.fkk-cariuyari')), cari: tr && tr.querySelector('[data-c]').value }; });
      await w.screenshot({ path: OUT + '/10e-cari-vkn.png' });
      check(ui.cip && ui.uyari && ui.cari === '320.01.101', 'ekranda carinin VKN ile bulunduğu ve çakışma uyarısı görünüyor');
      await w.evaluate(() => { window.__fkayit._st.rows.pop(); }); await w.click('[data-fkf=kayitsiz]'); await w.waitForTimeout(200); }
    // ---- Görev 50: "Luca'ya kaydet" pasifken nedeni düğmenin yanında; eksikler gösterilir / seçimden çıkarılır; muavinde kayıtlı faturanın fişi
    { const durum = async () => { await w.click('[data-fkf=tumu]'); await w.waitForTimeout(150);
        return w.evaluate(() => ({ kapali: document.querySelector('#fkkGo').disabled, neden: document.querySelector('#fkkNeden').textContent.replace(/\s+/g, ' ').trim(), ipucu: document.querySelector('#fkkNeden').title,
          satir: document.querySelectorAll('#fkkTable tbody tr[data-i]').length })); };
      await w.evaluate(() => { const st = window.__fkayit._st; st._g50 = { rows: st.rows, firm: st.firm };
        const tam = st.rows.find(r => r.f.belge_no === 'YYY2026000000009');   // hesabı ve carisi dolu, eksiksiz fatura
        const kopya = (o, f) => ({ ...tam, logged: null, haricBekle: false, kuralAtla: false, acik: false, elle: true, cariElle: true, ...o, f: { ...tam.f, haric: null, kayitli: false, muavin_fis: [], ...f } });
        st._kopya = kopya;
        st.rows = [kopya({ sec: false }, { anahtar: 'k1', belge_no: 'MUV2026000000001', kayitli: true, durum: 'Uyumlu', muavin_fis: [{ no: '0012', tarih: '2026-09-30' }] }),
                   kopya({ sec: false }, { anahtar: 'k2', belge_no: 'MUV2026000000002', kayitli: true, durum: 'Uyumlu', muavin_fis: [{ no: '0013', tarih: '2026-09-30' }] })]; });
      const d1 = await durum();
      const cip = await w.$$eval('#fkkTable [data-mfis]', l => l.map(x => x.textContent.trim()));
      check(d1.kapali && /Kaydedilecek fatura yok/.test(d1.neden) && /2 fatura muavinde zaten kayıtlı/.test(d1.ipucu) && /^muavinde var · fiş 0012,muavinde var · fiş 0013$/i.test(cip.join()),
        'düğme pasif: kayıtsız fatura yok → "2 fatura muavinde zaten kayıtlı"; satırda "muavinde var · fiş N" (' + JSON.stringify([d1, cip]) + ')');
      await w.click('#fkkTable [data-mfis="0"]'); await w.waitForSelector('#fkkModal:not([hidden])');
      const fb = await w.textContent('#fkkModalT'); await w.click('#fkkModal [data-kx]');
      check(/Muavindeki fiş 0012/i.test(fb), 'muavinde kayıtlı faturanın fişi çipten açılıyor (' + fb + ')');
      // kayıtsız var ama seçili yok
      await w.evaluate(() => { const st = window.__fkayit._st; st.rows = [st._kopya({ sec: false }, { anahtar: 'k3', belge_no: 'KYT2026000000003' }), st._kopya({ sec: false }, { anahtar: 'k4', belge_no: 'KYT2026000000004' })]; });
      const d2 = await durum();
      check(d2.kapali && /Fatura seçilmedi/.test(d2.neden), 'düğme pasif: fatura seçilmedi (' + d2.neden + ')');
      // biri eksik (cari boş): hepsi durur; "Eksikleri göster" yalnız onu gösterir; "seçimden çıkar" sonra kalanlar kaydedilebilir
      await w.evaluate(() => { const st = window.__fkayit._st; st.rows = [st._kopya({ sec: true }, { anahtar: 'k5', belge_no: 'KYT2026000000005' }), st._kopya({ sec: true, cari: '' }, { anahtar: 'k6', belge_no: 'KYT2026000000006' }), st._kopya({ sec: true, cari: '' }, { anahtar: 'k7', belge_no: 'KYT2026000000007' })]; });
      const d3 = await durum();
      await w.screenshot({ path: OUT + '/10f-kaydet-neden.png' });
      await w.click('#fkkEksikGoster'); await w.waitForTimeout(150); const goster = await w.$$eval('#fkkTable tbody tr[data-i]', t => t.map(x => x.textContent.includes('KYT2026000000006') || x.textContent.includes('KYT2026000000007')));
      await w.click('#fkkEksikCikar'); await w.waitForTimeout(150);
      const d4 = await w.evaluate(() => ({ kapali: document.querySelector('#fkkGo').disabled, neden: document.querySelector('#fkkNeden').textContent.trim(), sec: window.__fkayit._st.rows.filter(r => r.sec).map(r => r.f.belge_no) }));
      check(d3.kapali && /2 faturada eksik var/.test(d3.neden) && /2 faturada “Cari hesabı seçin”/.test(d3.ipucu), 'düğme pasif: seçili faturalardan ikisinde eksik; ipucunda nedeni ve sayısı (' + d3.ipucu.slice(0, 120) + ')');
      check(goster.length === 2 && goster.every(Boolean), '"Eksikleri göster" yalnız eksikli faturaları listeler');
      check(!d4.kapali && d4.neden === '' && d4.sec.join() === 'KYT2026000000005', '"Eksikleri seçimden çıkar": kalan fatura kaydedilebilir, neden kalktı');
      // firma Luca karşılığı yok / işlem sürüyor
      const d5 = await w.evaluate(() => { const st = window.__fkayit._st; st.firm = { ...st.firm, lucaId: '' }; return 0; }).then(durum);
      await w.evaluate(() => { const st = window.__fkayit._st; st.firm = st._g50.firm; st.busy = true; });
      const d6 = await durum();
      await w.evaluate(() => { const st = window.__fkayit._st; st.busy = false; st.rows = st._g50.rows; delete st._g50; delete st._kopya; });
      check(d5.kapali && /Luca karşılığı yok/.test(d5.neden), 'düğme pasif: firmanın Luca karşılığı yok (' + d5.neden + ')');
      check(d6.kapali && /işlem sürüyor/.test(d6.neden), 'düğme pasif: işlem sürüyor (' + d6.neden + ')');
      await w.click('[data-fkf=kayitsiz]'); await w.waitForTimeout(150); }
    // 2.9.4: binek araç ve 689 farkında 950 / 951 nazım kaydı; ödenecek farkı yönüne göre 679 / 689; tutar düzeltme, satır ekleme
    const v4 = await w.evaluate(() => {
      const F = window.__fkayit; const st = F._st;
      for (const [k, v] of [['950.01', 'BİNEK ARAÇ GİDER KISITLAMASI'], ['951.01', 'BİNEK ARAÇ GİDER KISITLAMASI'], ['950.02', 'KKEG KVK 11 GİDERLERİ'], ['951.02', 'KKEG KVK 11 GİDERLERİ'],
        ['679.01', 'DİĞER OLAĞANDIŞI GELİR VE KARLAR'], ['689.02', 'KKEG KVK 11 GİDERLERİ'], ['770.05', 'TELEFON GİDERLERİ']]) { st.acc.set(k, v); st.leaf.add(k); }
      const f = (o) => ({ yon: 'ALIS', tip: 'SATIS', matrah: 1000, kdv: 200, odenecek: 1200, tevkifat: 0, oranlar: [{ oran: '20', matrah: 1000, kdv: 200 }], diger_vergiler: {}, kalemler: [], ...o });
      const L = r => { const x = F._satirlar(r); return x.L.map(y => y.acc + ':' + (y.b ? 'B' + y.b : 'A' + y.c)).join(' ') + (x.err.length ? ' |HATA ' + x.err.join(';') : ''); };
      return {
        binek: L({ f: f({}), hesap: '770.01', cari: '320.01', binek: true }),
        fark679: L({ f: f({ odenecek: 1199.6 }), hesap: '770.01', cari: '320.01' }),
        fark689: L({ f: f({ odenecek: 1201 }), hesap: '770.01', cari: '320.01' }),
        ekSatir: L({ f: f({ odenecek: 1201 }), hesap: '770.01', cari: '320.01', ekSatir: [{ id: 'e1', acc: '770.05', b: 1, c: 0, desc: 'yuvarlama' }] }),
        tutar: L({ f: f({ odenecek: 1210 }), hesap: '770.01', cari: '320.01', tutarElle: { 'matrah#1': { b: 1010, c: 0 } } }),
        dengesiz: L({ f: f({}), hesap: '770.01', cari: '320.01', tutarElle: { 'cari#1': { b: 0, c: 1000 } } })
      }; });
    console.log('V4', JSON.stringify(v4));
    check(v4.binek === '770.01:B700 770.91:B300 770.90:B60 191.10.20:B140 320.01:A1200 950.01:B360 951.01:A360', 'binek araç: faturanın %30\'u (gider + KDV) 950 borç / 951 alacak nazım kaydı (' + v4.binek + ')');
    check(v4.fark679 === '770.01:B1000 191.10.20:B200 679.01:A0.4 320.01:A1199.6', 'ödenecek farkı alacak yönünde: 679 diğer olağandışı gelir, cari = ödenecek (' + v4.fark679 + ')');
    check(v4.fark689 === '770.01:B1000 191.10.20:B200 689.02:B1 320.01:A1201 950.02:B1 951.02:A1', 'ödenecek farkı borç yönünde: 689 KKEG + 950/951 aynı adlı nazım (' + v4.fark689 + ')');
    check(v4.ekSatir === '770.01:B1000 191.10.20:B200 770.05:B1 320.01:A1201', 'fişe elle satır eklendi, fark kalmadı (' + v4.ekSatir + ')');
    check(v4.tutar === '770.01:B1010 191.10.20:B200 320.01:A1210', 'fiş tutarı elle değiştirildi, cari yeniden dengelendi (' + v4.tutar + ')');
    check(/HATA Fiş dengesiz/.test(v4.dengesiz), 'elle tutar fişi dengesiz bırakırsa kayıt engellenir');
    // ---- Görev 36: kod tanımları (KDV oranı × işlem → hesap), doldurma kaynağı, satırda [Kod] [Geçmiş] [Kural], kuralda ana hesap
    { await app.evaluate(({ ipcMain }) => { ipcMain.removeHandler('luca-kdv-hesaplari'); global.__kdvCek = 0;
        ipcMain.handle('luca-kdv-hesaplari', (e, a) => { global.__kdvCek++; global.__kdvArg = a; return { tablo: { '11': { '1': { kod: '153.01.01' }, '20': { kod: '153.01.20' } }, '1': { '20': { kod: '191.01.20' } }, '0': { '20': { kod: '600.01.20' } } } }; }); });
      await w.evaluate(() => { const st = window.__fkayit._st;
        for (const [k, v] of [['153.01.01', '%1 TİCARİ MAL'], ['153.01.10', '%10 TİCARİ MAL'], ['153.01.20', '%20 TİCARİ MAL'], ['153.01.99', 'DİĞER TİCARİ MAL'], ['191.01.20', '%20 İNDİRİLECEK KDV']]) { st.acc.set(k, v); st.leaf.add(k); } });
      const i0 = await w.$eval('#fkkTable tbody tr[data-i]', t => +t.dataset.i);
      // Görev 41: Alış / Satış kod tanımları ve Doldurma tek "Kod tanımları ▾" menüsünde; araç çubuğu 1440 px'de alta taşmaz
      { const ilk = await w.evaluate(() => ({ dugme: document.querySelectorAll('#fkkBar #fkkKod').length, gizli: document.querySelector('#fkkKodMenu').hidden, ayri: !!document.querySelector('#fkkBar > #fkkKodA, #fkkBar > #fkkKodS') }));
        await w.click('#fkkKod'); const acik = await w.evaluate(() => ({ menu: !document.querySelector('#fkkKodMenu').hidden, ogeler: [...document.querySelectorAll('#fkkKodMenu [role=menuitem]')].map(x => x.textContent), exp: document.querySelector('#fkkKod').getAttribute('aria-expanded'), doldurma: !!document.querySelector('#fkkKodMenu #fkkKaynak') && !document.querySelector('#fkkBar > label #fkkKaynak') && (() => { const r = document.querySelector('#fkkKodMenu').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; })(), odak: document.activeElement.id }));
        await w.keyboard.press('ArrowDown'); const odak2 = await w.evaluate(() => document.activeElement.id);
        await w.keyboard.press('Escape'); await w.waitForTimeout(150); const esc = await w.evaluate(() => ({ menu: document.querySelector('#fkkKodMenu').hidden, panel: !document.querySelector('#fkKayit').hidden, odak: document.activeElement.id }));
        await w.click('#fkkKod'); await w.click('#fkkBar .note'); const disari = await w.evaluate(() => document.querySelector('#fkkKodMenu').hidden);
        check(ilk.dugme === 1 && ilk.gizli && !ilk.ayri && acik.menu && acik.ogeler.join('|').toLocaleLowerCase('tr') === 'alış kod tanımları|satış kod tanımları' && acik.doldurma && acik.exp === 'true' && acik.odak === 'fkkKodA' && odak2 === 'fkkKodS' && esc.menu && esc.panel && esc.odak === 'fkkKod' && disari,
          'Kod tanımları ▾ menüsü: Alış / Satış ve Doldurma seçimi (menü pencereye sığıyor); oklarla gezilir, Esc ve dışarı tıklama menüyü kapatır, ekran açık kalır (' + JSON.stringify({ ilk, acik, odak2, esc, disari }) + ')');
        const once = await w.evaluate(() => [innerWidth, innerHeight]);
        await app.evaluate(({ BrowserWindow }) => { const b = BrowserWindow.getAllWindows()[0]; if (b.isMaximized()) b.unmaximize(); b.setContentSize(1440, 900); }); await w.waitForFunction(() => innerWidth === 1440, null, { timeout: 5000 }).catch(() => {}); await w.waitForTimeout(400);
        const satir = await w.evaluate(() => { const t = [...document.querySelector('#fkkBar').children].filter(x => x.getClientRects().length && x.offsetWidth).map(x => x.getBoundingClientRect().top).sort((a, b) => a - b);
          return t.reduce((n, y, i) => n + (i && y - t[i - 1] > 14 ? 1 : 0), t.length ? 1 : 0); });   // aynı satırdaki etiket / düğme birkaç px farklı yükseklikte durabilir
        const ayniSatir = await w.evaluate(() => Math.abs(document.querySelector('#fkkKod').getBoundingClientRect().top - document.querySelector('#fkkKurallar').getBoundingClientRect().top) < 4 && Math.abs(document.querySelector('#fkkKurallar').getBoundingClientRect().top - document.querySelector('#fkkBosDoldur').getBoundingClientRect().top) < 4);
        await w.click('#fkkKod'); await w.waitForTimeout(150); await w.screenshot({ path: OUT + '/41-kod-menu-1440.png' }); await w.keyboard.press('Escape');
        const st = await w.evaluate(() => ({ w: innerWidth, bar: Math.round(document.querySelector('#fkkBar').getBoundingClientRect().height) }));
        await app.evaluate(({ BrowserWindow }, [cw, ch]) => { BrowserWindow.getAllWindows()[0].setContentSize(cw, ch); }, once); await w.waitForTimeout(300);
        check(satir === 2 && ayniSatir, 'Faturaları Luca\'ya kaydet araç çubuğu 1440 px\'de iki satır: süzgeçler + işlemler; Kod tanımları işlem satırında, Doldurma alta düşmüyor (' + JSON.stringify({ ...st, satir, ayniSatir }) + ')'); }
      await w.click('#fkkKod'); await w.click('#fkkKodA'); await w.waitForSelector('#fkkModal:not([hidden]) #fkkKodTablo');
      const baslik = await w.textContent('#fkkModalT');
      await w.fill('[data-kodh="11|10"]', '153.01.10'); await w.press('[data-kodh="11|10"]', 'Tab');
      await w.fill('[data-kodh="11|20"]', '153.01.99'); await w.press('[data-kodh="11|20"]', 'Tab');
      await w.click('#kodCek'); await w.waitForSelector('#askModal:not([hidden])');
      const soru = await w.textContent('#askText'); await w.click('#askNo'); await w.waitForTimeout(200);
      const hucre = await w.evaluate(() => { const v = s => document.querySelector(`[data-kodh="${s}"]`); return { e20: v('11|20').value, e20elle: /elle/.test(v('11|20').parentElement.textContent), e1: v('11|1').value, e10: v('11|10').value, k20: v('1|20').value, satis: !!document.querySelector('[data-kodh="0|20"]') }; });
      check(/Alış kod tanımları/i.test(baslik) && !hucre.satis, 'Alış kod tanımları: alış tablosu (satış işlemleri yok)');
      check(/153\.01\.99/.test(soru) && /153\.01\.20/.test(soru), 'Luca\'dan çek: elle hücre Luca\'dakinden farklı → gösterip sordu (' + soru.slice(0, 80) + ')');
      check(hucre.e20 === '153.01.99' && hucre.e20elle && hucre.e1 === '153.01.01' && hucre.e10 === '153.01.10' && hucre.k20 === '191.01.20', 'elle hücre korundu (153.01.99), boş hücreler Luca\'dan doldu (' + JSON.stringify(hucre) + ')');
      await w.fill('[data-kodh="11|8"]', '999.99'); await w.press('[data-kodh="11|8"]', 'Tab'); await w.click('#kodKaydet'); await w.waitForTimeout(200);
      check(!(await w.isHidden('#fkkModal')) && /999\.99/.test(await w.textContent('#kodDurum')), 'planda olmayan hesap kaydedilmedi, uyarı verildi');
      await w.fill('[data-kodh="11|8"]', ''); await w.press('[data-kodh="11|8"]', 'Tab'); await w.click('#kodKaydet'); await w.waitForTimeout(300);
      const kayit = await w.evaluate(() => window.__fkayit._st.firm.fkKod);
      check(await w.isHidden('#fkkModal') && kayit.ALIS['11']['20'].elle && kayit.ALIS['11']['20'].kod === '153.01.99' && !kayit.ALIS['11']['1'].elle && !kayit.ALIS['11']['8'], 'kod tablosu firmaya kaydedildi (elle işaretiyle)');
      // ikinci çekiş: elle hücre yine ezilmez; "Luca'dakini kullan" denirse değişir
      await w.click('#fkkKod'); await w.click('#fkkKodA'); await w.waitForSelector('#fkkKodTablo'); await w.click('#kodCek'); await w.waitForSelector('#askModal:not([hidden])'); await w.click('#askYes'); await w.waitForTimeout(200);
      const e20b = await w.$eval('[data-kodh="11|20"]', x => x.value); await w.click('#fkkModal [data-kx]');
      check(e20b === '153.01.20' && (await app.evaluate(() => global.__kdvCek)) === 2, 'farkta "Luca\'dakini kullan" denince hücre Luca\'daki oldu (kaydetmeden kapatıldı)');
      // Görev 45: Luca'dan çek firmanın Luca no'su ve raporun yılıyla gider; firma kartında Luca no yoksa rapordaki Luca firma no kullanılır
      { const a1 = await app.evaluate(() => global.__kdvArg);
        const lid = await w.evaluate(() => { const st = window.__fkayit._st; st._lid = st.firm.lucaId; st.firm = { ...st.firm, lucaId: '' }; st.data._lid = st.data.luca_id; st.data.luca_id = '4242'; return st._lid; });
        await w.click('#fkkKod'); await w.click('#fkkKodA'); await w.waitForSelector('#fkkKodTablo'); const acik = !(await w.$eval('#kodCek', b => b.disabled));
        await w.click('#kodCek'); await w.waitForTimeout(300); if (await w.isVisible('#askModal')) await w.click('#askNo'); await w.click('#fkkModal [data-kx]');
        const a2 = await app.evaluate(() => global.__kdvArg);
        await w.evaluate(() => { const st = window.__fkayit._st; st.firm = { ...st.firm, lucaId: st._lid }; st.data.luca_id = st.data._lid; delete st._lid; delete st.data._lid; });
        check(String(a1.lucaId) === String(lid) && a1.year === '2026' && acik && a2.lucaId === '4242', 'Luca\'dan çek: firmanın Luca no\'su ve raporun yılı gidiyor; firma kartında Luca no yoksa rapordaki Luca firma no kullanılıyor (' + JSON.stringify([a1, a2]) + ')'); }
      // kural penceresi: ana hesap açıklaması
      await w.click(`[data-kural="${i0}"]`); await w.waitForSelector('#fkkModal:not([hidden]) #kAnaNot');
      check((await w.textContent('#kAnaNot')).trim() === 'Ana hesap yazarsanız detay hesap kod tablosundan seçilir; detay hesap yazarsanız sizin yazdığınız geçerli olur.', 'kural penceresinde ana / detay hesap açıklaması');
      await w.click('#fkkModal [data-kx]');
      // mantık: ana hesap + KDV oranı → detay; detay öncelikli; boş oran uyarısı; kod tablosuna göre doldurma; KDV kod tablosundan
      const m = await w.evaluate(() => { const F = window.__fkayit, st = F._st; const eskiK = st.kural; const eskiF = st.firm;
        const f = (o) => ({ yon: 'ALIS', tip: 'SATIS', karsi_unvan: 'ANA TEST A.Ş.', karsi_vkn: '9990001112', matrah: 1000, kdv: 200, odenecek: 1200, tevkifat: 0, oranlar: [{ oran: '20', matrah: 1000, kdv: 200 }], diger_vergiler: {}, kalemler: [], ...o });
        const o10 = { oranlar: [{ oran: '10', matrah: 1000, kdv: 100 }], kdv: 100, odenecek: 1100 }, o18 = { oranlar: [{ oran: '18', matrah: 1000, kdv: 180 }], kdv: 180, odenecek: 1180 };
        const sonuc = {};
        try {
          st.kural = { a: { id: 'a', alan: 'unvan', deger: 'ANA TEST', yon: 'ALIS', hesap: '153', cari: '320.01' } };
          sonuc.ana20 = F._oner(f({})); sonuc.ana10 = F._oner(f(o10)); sonuc.ana18 = F._oner(f(o18));
          const r18 = { f: f(o18), ...sonuc.ana18 }; sonuc.err18 = F._satirlar(r18).err;
          st.kural = { a: { id: 'a', alan: 'unvan', deger: 'ANA TEST', yon: 'ALIS', hesap: '153.01.99', cari: '320.01' } };
          sonuc.detay = F._oner(f(o10));
          st.kural = {};
          st.firm = { ...eskiF, fkKaynak: '' }; sonuc.oto = F._oner(f({ gecmis: { hesap: '770.01' } }));
          st.firm = { ...eskiF, fkKaynak: 'kod' }; sonuc.kodSira = F._oner(f({ gecmis: { hesap: '770.01' } })); sonuc.kodBos = F._oner(f(o18));
          const rk = { f: f({}), ...sonuc.kodSira, cari: '320.01' }; sonuc.fisKod = F._satirlar(rk).L.map(x => x.acc).join(' ');
        } finally { st.kural = eskiK; st.firm = eskiF; }
        const k = x => ({ hesap: x.hesap, kaynak: x.kaynak, uyari: x.kodUyari || '', ana: x.kuralAna || '' });
        return { ana20: k(sonuc.ana20), ana10: k(sonuc.ana10), ana18: k(sonuc.ana18), err18: sonuc.err18, detay: k(sonuc.detay), oto: k(sonuc.oto), kodSira: k(sonuc.kodSira), kodBos: k(sonuc.kodBos), fisKod: sonuc.fisKod }; });
      console.log('G36', JSON.stringify(m));
      check(m.ana20.hesap === '153.01.99' && m.ana10.hesap === '153.01.10' && m.ana20.kaynak === 'kural' && m.ana10.ana === '153', 'kuralda ana hesap 153: detay faturanın KDV oranına göre kod tablosundan (%20 → 153.01.99, %10 → 153.01.10)');
      check(m.detay.hesap === '153.01.99' && !m.detay.ana, 'kuralda detay hesap yazılınca o kullanıldı (kod tablosu %10 olsa da)');
      check(!m.ana18.hesap && /%18/.test(m.ana18.uyari) && m.err18.some(e => /%18/.test(e) && /kod tanımlarında/i.test(e)), 'kod tablosunda oran boş: açık uyarı, hesap uydurulmadı (' + m.ana18.uyari + ')');
      check(m.oto.hesap === '770.01' && m.oto.kaynak === 'geçmiş' && m.kodSira.hesap === '153.01.99' && m.kodSira.kaynak === 'kod tablosu', 'doldurma: varsayılan sırada geçmiş, "kod tablosuna göre"de kod tablosu');
      check(!m.kodBos.hesap && /%18/.test(m.kodBos.uyari), '"kod tablosuna göre"de oran boşsa uyarı');
      check(m.fisKod === '153.01.99 191.01.20 320.01', 'kod tablosuyla doldurulan faturada KDV hesabı da kod tablosundan (' + m.fisKod + ')');
      // satırdaki [Kod] [Geçmiş] [Kural] düğmeleri
      const once = await w.evaluate(i => { const r = window.__fkayit._st.rows[i]; return { hesap: r.hesap, kaynak: r.kaynak }; }, i0);
      await w.click(`[data-ks="${i0}"][data-v="kod"]`); await w.waitForTimeout(150);
      const kodR = await w.evaluate(i => { const r = window.__fkayit._st.rows[i]; const tr = document.querySelector(`#fkkTable tr[data-i="${i}"]`);
        return { hesap: r.hesap, kaynak: r.kaynak, basili: tr.querySelector('[data-ks][aria-pressed="true"]').dataset.v, chip: /kod tablosu/.test(tr.textContent), gecmisKapali: tr.querySelector('[data-ks][data-v="gecmis"]').disabled }; }, i0);
      await w.click(`[data-ks="${i0}"][data-v="kural"]`); await w.waitForTimeout(150);
      const kuralR = await w.evaluate(i => { const r = window.__fkayit._st.rows[i]; return { hesap: r.hesap, kaynak: r.kaynak, basili: document.querySelector(`#fkkTable tr[data-i="${i}"] [data-ks][aria-pressed="true"]`).dataset.v }; }, i0);
      check(once.kaynak === 'kural' && kodR.kaynak === 'kod tablosu' && kodR.basili === 'kod' && kodR.chip && kodR.hesap === '153.01.99', '[Kod] düğmesi: hesap kod tablosundan, satırda kaynak "kod tablosu" (' + JSON.stringify(kodR) + ')');
      check(kodR.gecmisKapali, '[Geçmiş] düğmesi geçmiş kayıt yokken kapalı');
      check(kuralR.hesap === once.hesap && kuralR.kaynak === 'kural' && kuralR.basili === 'kural', '[Kural] düğmesi: kuralın hesabına döndü');
      await w.screenshot({ path: OUT + '/10c-kod-tanimlari.png' });
      // temizlik: sonraki testler kod tablosuz firmayla sürer
      await w.evaluate(async () => { const st = window.__fkayit._st; const { Store } = window.__app; const f = { ...st.firm }; delete f.fkKod; delete f.fkKaynak; st.firm = f; await Store.saveFirm(f);
        for (const r of st.rows) delete r.kaynakSec; }); }
    // komisyoncu (HKS) faturası: mal sahibinin satışı + komisyoncu masrafları
    const kom = await w.evaluate(() => { const F = window.__fkayit; const st = F._st;
      for (const [k, v] of [['600.01', '% 1 Lik Hasılat'], ['391.01.01', '%1 lik Hesaplanan KDV'], ['760.05', 'Kom.Giderleri'], ['760.08', 'Navlun Giderleri'], ['120.K.002', 'Kazım Akbulut Yaş Sebze Meyve Kom. Ltd.Şti']]) { st.acc.set(k, v); st.leaf.add(k); }
      const f = { yon: 'ALIS', tip: 'KOMISYONCU', komisyoncu: true, matrah: 17600, kdv: 176, odenecek: 14275.20, vergiler_dahil: 17776, tevkifat: 0, karsi_unvan: 'KAZIM AKBULUT YAŞ SEBZE MEYVE KOM. LTD.ŞTİ.', karsi_vkn: '5411183332',
        oranlar: [{ oran: '1', matrah: 17600, kdv: 176 }], diger_vergiler: {}, kalemler: ['DOMATES'],
        masraflar: [{ ad: 'Komisyon', tutar: 1408, oran: '8', kdv: 281.60, kdv_oran: '20' }, { ad: 'Navlun', tutar: 1600, oran: null, kdv: 0, kdv_oran: null }, { ad: 'Diğer Masraflar', tutar: 176, oran: null, kdv: 35.20, kdv_oran: '20' }] };
      const o = F._oner(f); const x = F._satirlar({ f, hesap: o.hesap, cari: o.cari });
      return { hesap: o.hesap, cari: o.cari, L: x.L.map(l => l.acc + ':' + (l.b ? 'B' + l.b : 'A' + l.c)).join(' '), err: x.err }; });
    check(kom.hesap === '600.01' && kom.cari === '120.K.002' && kom.L === '600.01:A17600 391.01.01:A176 760.05:B1408 191.10.20:B281.6 760.08:B1600 760.05:B176 191.10.20:B35.2 120.K.002:B14275.2' && !kom.err.length,
      'komisyoncu faturası: 600 + 391 alacak, komisyon / navlun / diğer masraf 760 + 191 borç, komisyoncu 120 net borç (' + kom.L + ' ' + kom.err.join(';') + ')');
    // fiş gruplama: ay sonuna tek fiş / 10 günlük (alış ve satış ayrı; satırlar kendi evrak no / tarihiyle)
    const grp = await w.evaluate(() => { const F = window.__fkayit; const st = F._st; const eski = st.rows, eg = st.grup, ed = st.data.donem;
      const f = (no, tarih, yon) => ({ anahtar: no, belge_no: no, tarih, yon, tip: 'SATIS', karsi_unvan: 'FİRMA ' + no, karsi_vkn: '1', matrah: 1000, kdv: 200, odenecek: 1200, tevkifat: 0, oranlar: [{ oran: '20', matrah: 1000, kdv: 200 }], diger_vergiler: {}, kalemler: [] });
      st.data.donem = ['2026-09-01', '2026-09-30'];
      st.rows = [['A1', '2026-09-03', 'ALIS'], ['A2', '2026-09-15', 'ALIS'], ['A3', '2026-09-25', 'ALIS'], ['S1', '2026-09-25', 'SATIS']].map(([n, t, y]) => ({ f: f(n, t, y), hesap: y === 'ALIS' ? '770.01' : '600.01', cari: y === 'ALIS' ? '320.01' : '120.01', sec: true }));
      const ozet = g => { st.grup = g; return F._fisler().map(x => x.json.fisTarihi + ':' + x.rows.map(r => r.f.belge_no).join('+') + ':' + x.json.detaylar.length + ':' + [...new Set(x.json.detaylar.map(d => d.evrakNo))].join('+') + ':' + (x.b === x.c)); };
      const r = { ay: ozet('ay'), on: ozet('on'), ayri: ozet('ayri').length, gt: F._grupTarihi('2026-02-21', 'on') };
      st.rows = eski; st.grup = eg; st.data.donem = ed; return r; });
    check(grp.ay.join(' ') === '30/09/2026:A1+A2+A3:9:A1+A2+A3:true 30/09/2026:S1:3:S1:true' && grp.ayri === 4, 'ay sonuna tek fiş: alışlar bir fiş, satış ayrı fiş; evrak no her satırda korunur (' + grp.ay.join(' ') + ')');
    check(grp.on.join(' ') === '10/09/2026:A1:3:A1:true 20/09/2026:A2:3:A2:true 30/09/2026:A3:3:A3:true 30/09/2026:S1:3:S1:true' && grp.gt === '2026-02-28', '10 günlük fiş: 10, 20 ve ay sonu tarihli fişler (' + grp.on.join(' ') + ')');
    await w.click('#fkkGo'); await w.waitForSelector('#askModal:not([hidden])'); await w.click('#askYes');
    await w.waitForSelector('#fkkModal:not([hidden]) #fkkYenile', { timeout: 15000 });
    const gonderilen = await app.evaluate(() => global.__fis);
    const d0 = gonderilen[0] && gonderilen[0].fis;
    check(gonderilen.length === 1 && d0.fisTarihi === '20/09/2026' && d0.borc === 600 && d0.detaylar.length === 3 && d0.detaylar[0].evrakNo === 'YYY2026000000009'
      && /^20\/09\/2026-YYY2026000000009-/.test(d0.fisAciklama) && !/^\d\d\//.test(d0.detaylar[0].detayAciklama), 'Luca\'ya fiş gönderildi (tarih, tutar, belge no; satır açıklaması yalnız ünvan)');
    await w.screenshot({ path: OUT + '/11-kayit-sonuc.png' });
    const log = await w.evaluate(() => { const d = window.__app.Store.local(); return d.fkayit && d.fkayit.kf1; });
    check(log && Object.keys(log.keys).length === 1, 'kaydedilen fatura işaretlendi (mükerrer koruması)');
    // ---- Görev 34: kaydedilen fişin Luca'daki durumu, fişin muavinden açılması, "daha önce kaydedilenler", tek "Muavini Luca'dan çek"
    await w.click('#fkkModal [data-kx]');           // kayıt sonucu penceresi (sonunda yeniden kaydedilip açık bırakılır)
    check(await w.isVisible('#fkkCek') && !(await w.$('#fkkMiz')) && !(await w.$('#fkkMuavin')), 'tek düğme: "Muavini Luca\'dan çek" var, ayrı mizan / muavin düğmeleri yok');
    { const k = await w.evaluate(() => { const F = window.__fkayit, st = F._st; const r = st.rows.find(x => x.logged);
        const mv = o => ({ bas: '2026-01-01', bit: '2026-12-31', zaman: new Date(Date.now() + 60000).toISOString(), fisler: [['2026-09-30', '1']], ...o });
        const say = m => F._silinenBul(st.rows, m, () => r.f.tarih).length;
        const o = { n: r.logged.n, eskiMuavin: !!st.data.muavin && Date.parse(st.data.muavin.zaman) < Date.parse(r.logged.at), sil: say(mv()),
          eski: say(mv({ zaman: new Date(Date.parse(r.logged.at) - 60000).toISOString() })), kapsamDisi: say(mv({ bit: '2026-08-31' })),
          noVar: say(mv({ fisler: [['2026-09-20', '00' + r.logged.n + '.0']] })), muavinYok: say(null) };
        r.f.kayitli = true; o.faturaMuavinde = say(mv()); r.f.kayitli = false; return o; });
      check(k.n === '101' && k.sil === 1 && k.eski === 0 && k.kapsamDisi === 0 && k.noVar === 0 && k.muavinYok === 0 && k.faturaMuavinde === 0,
        'silinen fiş kararı: yalnız kayıttan sonra çekilen ve fişin tarihini kapsayan muavinde fiş no yoksa ve fatura muavinde değilse (' + JSON.stringify(k) + ')');
      check(k.eskiMuavin && await w.evaluate(() => window.__fkayit._st.rows.some(r => r.logged)), 'kayıttan önce indirilmiş muavin fişi "silinmiş" saymadı'); }
    // Görev 46: durumdaki "Luca fiş N" düz etiket (düğme değil); fiş, satırın Fiş görünümündeki "Fişi aç" ile muavinden açılır
    await w.click('#fkkBar [data-fkf=kaydedilen]');
    { const e = await w.evaluate(() => { const r = document.querySelector('#fkkTable tbody tr[data-i]'); const c = [...r.querySelectorAll('.chip')].find(x => /Luca fiş/.test(x.textContent)); return { etiket: !!c && c.tagName === 'SPAN', dugme: !!r.querySelector('[data-lucafis]') }; });
      check(e.etiket && !e.dugme, 'kaydedilen satırda "Luca fiş N" düz etiket; satırda fiş açma düğmesi yok (' + JSON.stringify(e) + ')'); }
    if (!(await w.$('#fkkTable tr.fisdetay [data-lucafis]'))) await w.click('#fkkTable tbody tr[data-i] [data-fis]');   // fiş görünümü kapalıysa aç (satır önceki adımlardan açık kalmış olabilir)
    await w.click('#fkkTable tr.fisdetay [data-lucafis]'); await w.waitForSelector('#fkkModal:not([hidden])');
    await w.waitForFunction(() => !/hazırlanıyor/.test(document.getElementById('fkkModalB').textContent), null, { timeout: 15000 });
    { const t = await w.textContent('#fkkModalT'), b = await w.textContent('#fkkModalB');
      check(/Luca fiş 101/i.test(t) && /muavinde bulunamadı/.test(b), 'Fiş görünümünde "Fişi aç" ile fiş penceresi açıldı (fiş henüz muavinde yok): ' + t + ' / ' + b.slice(0, 120)); }
    await w.click('#fkkModal [data-kx]');
    await w.evaluate(async () => { const F = window.__fkayit, st = F._st; const r = st.rows.find(x => x.logged); const v = r.logged, t = r.f.tarih;
      r.logged = { ...v, n: '1', b: 'yok' }; r.f.tarih = '2026-09-30'; await F._lucaFisAc(r); r.logged = v; r.f.tarih = t; });
    { const t = await w.$$eval('#fkkFisTablo tbody tr', l => l.map(x => x.textContent));
      check(t.length === 2 && t.every(x => /191\.10\.20/.test(x)) && /Luca fiş 1 · 30\.09\.2026/i.test(await w.textContent('#fkkModalT')), 'muavinde olan fiş satırlarıyla açıldı (' + t.length + ' satır)'); }
    await w.click('#fkkModal [data-kx]');
    // muavin çekildi, fiş Luca'da yok → "Luca'da bulunamadı (silinmiş)", fatura kayıtsıza döner
    const sil = await w.evaluate(async () => { const F = window.__fkayit, st = F._st;
      st.data.muavin = { bas: '2026-01-01', bit: '2026-12-31', zaman: new Date(Date.now() + 60000).toISOString(), fisler: [['2026-09-30', '1'], ['2026-09-30', '2']] };
      await F._silinenleriIsle(); const d = window.__app.Store.local().fkayit[st.firm.id];
      const r = st.rows.find(x => x.f.belge_no === 'YYY2026000000009');
      return { keys: Object.keys(d.keys).length, isaret: d.batches.some(b => b.fisler.some(x => x.silindi && x.silindi.neden === 'muavin')), logged: !!r.logged, sec: r.sec }; });
    await w.click('#fkkBar [data-fkf=kayitsiz]');
    const kay = await w.$$eval('#fkkTable tbody tr[data-i]', l => l.map(x => x.textContent));
    check(sil.keys === 0 && sil.isaret && !sil.logged && sil.sec && kay.some(x => /YYY2026000000009/.test(x) && /Luca'da bulunamadı \(silinmiş\)/.test(x)),
      'silinen fiş: işaret kalktı, rapora not düşüldü, fatura "kayıtsız"da "Luca\'da bulunamadı (silinmiş)" ile (' + JSON.stringify(sil) + ')');
    // tekrar kaydetme
    const once = (await app.evaluate(() => global.__fis.length));
    await w.click('#fkkGo'); await w.waitForSelector('#askModal:not([hidden])'); await w.click('#askYes');
    await w.waitForSelector('#fkkModal:not([hidden]) #fkkYenile', { timeout: 15000 }); await w.click('#fkkModal [data-kx]');
    check((await app.evaluate(() => global.__fis.length)) === once + 1 && await w.evaluate(() => window.__fkayit._st.rows.some(r => r.logged && r.logged.n === '102')), 'silinen fatura tekrar kaydedildi (Luca fiş 102)');
    // daha önce kaydedilenler: liste ve "Luca'dan sildim"
    await w.click('#fkkGecmis'); await w.waitForSelector('#fkkGecmisTablo');
    let gt = await w.$$eval('#fkkGecmisTablo tbody tr', l => l.map(x => x.textContent));
    check(gt.length === 2 && gt.some(x => /101/.test(x) && /Luca'da bulunamadı/.test(x)) && gt.some(x => /102/.test(x) && /kayıtlı/.test(x) && /YYY2026000000009/.test(x)), 'daha önce kaydedilenler: fatura, tarih, tutar, Luca fiş no, kayıt tarihi, durum (' + gt.length + ')');
    await w.click('#fkkGecmisTablo [data-gsil]'); await w.waitForSelector('#askModal:not([hidden])'); await w.click('#askYes'); await w.waitForTimeout(400);
    gt = await w.$$eval('#fkkGecmisTablo tbody tr', l => l.map(x => x.textContent));
    const el = await w.evaluate(() => { const st = window.__fkayit._st; const r = st.rows.find(x => x.f.belge_no === 'YYY2026000000009'); return { logged: !!r.logged, keys: Object.keys(st.log.keys).length }; });
    check(gt.every(x => /silin/.test(x)) && !el.logged && el.keys === 0, '"Luca\'dan sildim" işareti: fatura tekrar kayıtsız (' + JSON.stringify(el) + ')');
    await w.click('#fkkModal [data-kx]');
    check(/Luca'dan silindi · fiş 102/.test(await w.textContent('#fkkTable')), 'elle işaretlenen fatura "Luca\'dan silindi" ile görünüyor');
    // tek düğme: mizan + hesap planı + muavin sırayla; hata veren adım adıyla yazılır
    await app.evaluate(({ ipcMain }) => { ipcMain.removeHandler('luca-hesap-plani');
      ipcMain.handle('luca-hesap-plani', () => ({ year: '2026', firma: 'X', hesaplar: [['320', 'SATICILAR'], ['320.01', 'SATICI 1'], ['770.01', 'KIRTASİYE']] })); });
    await w.evaluate(() => { const F = window.__fkayit; F._beklemeMs(50); window.__muavinOk = false; F._muavinIs.eski = { ...F._muavinIs };
      F._muavinIs.cek = async () => ({ ok: true });
      F._muavinIs.durum = async () => ({ calisiyor: false, sonuclar: [{ id: '11', adimlar: [{ kod: 'muavin', durum: window.__muavinOk ? 'tamam' : 'hata' }] }], gunluk: ['Muavin: test Luca hatası'] }); });
    await w.click('#fkkCek'); await w.waitForFunction(() => /alınamadı|alındı/.test((document.querySelector('#fkkModal .banner') || {}).textContent || ''), null, { timeout: 30000 });
    let ad = await w.$$eval('#fkkCekAdim tr', l => l.map(x => x.dataset.adim + ':' + x.dataset.durum + ':' + x.textContent));
    check(ad.length === 3 && /^mizan:hata:.*Mizan alınamadı: test: Luca mizanı yok/.test(ad[0]) && /^plan:tamam/.test(ad[1]) && /^muavin:hata:.*Muavin \(tüm yıl\) alınamadı: Muavin: test Luca hatası/.test(ad[2]),
      'tek düğme: üç adım sırayla; hata veren adım adıyla yazıldı (' + ad.join(' | ') + ')');
    await w.click('#fkkModal [data-kx]');
    await w.evaluate(() => { window.__muavinOk = true; });
    await w.click('#fkkCek'); await w.waitForFunction(() => /alınamadı|alındı/.test((document.querySelector('#fkkModal .banner') || {}).textContent || ''), null, { timeout: 30000 });
    ad = await w.$$eval('#fkkCekAdim tr', l => l.map(x => x.dataset.adim + ':' + x.dataset.durum));
    check(ad.join(',') === 'mizan:hata,plan:tamam,muavin:tamam' && /Mizan alınamadı; diğerleri alındı/.test(await w.textContent('#fkkModal .banner')) && await w.isVisible('#fkkTable tbody tr[data-i]'),
      'muavin alınınca liste yeniden yüklendi; yalnız mizan hatası bildirildi (' + ad.join(',') + ')');
    await w.click('#fkkModal [data-kx]');
    await w.evaluate(() => { const F = window.__fkayit; Object.assign(F._muavinIs, F._muavinIs.eski); delete F._muavinIs.eski; F._beklemeMs(2500); });
    await w.click('#fkkGo'); await w.waitForSelector('#askModal:not([hidden])'); await w.click('#askYes');
    await w.waitForSelector('#fkkModal:not([hidden]) #fkkYenile', { timeout: 15000 });
    // taslak cari: mizanda / planda olmayan karşı taraf için sıradaki kod; fiş öncesi Luca'ya açılır
    await app.evaluate(({ ipcMain }) => { global.__hp2 = [];
      for (const ch of ['luca-hesap-plani', 'luca-hesap-ekle', 'luca-hesap-ara-vkn']) ipcMain.removeHandler(ch);
      ipcMain.handle('luca-hesap-plani', () => ({ year: '2026', firma: 'X', hesaplar: [['320', 'SATICILAR'], ['320.01', 'SATICI 1'], ['320.01.001', 'A FİRMASI'], ['320.01.007', 'B FİRMASI']] }));
      ipcMain.handle('luca-hesap-ara-vkn', () => []);
      ipcMain.handle('luca-hesap-ekle', (e, a) => { global.__hp2.push(a); return a.hesaplar.map(h => ({ ...h, ok: true, mesaj: 'Kayıt eklendi' })); }); });
    { const t1 = await w.evaluate(() => { const H = window.__hesap; const f = window.__app.Store.local().firms.kf1;
        const m = new Map([['320', 'SATICILAR'], ['320.01', 'SATICI 1'], ['320.01.001', 'A FİRMASI'], ['320.01.007', 'B FİRMASI']]);
        const o1 = H.cariOner(f, m, '320', 'YENİ TEDARİK LTD ŞTİ', '1234567890'), o2 = H.cariOner(f, m, '320', 'YENİ TEDARİK LTD ŞTİ', '1234567890'), o3 = H.cariOner(f, m, '320', 'A FİRMASI', '');
        const U = window.__app.unvanCikar;
        return { o1, o2, o3, tm: H.taslakMi(f.id, o1.kod), u1: U('FAST GELEN ABC İNŞAAT TİC. LTD. ŞTİ. REF 123456789'), u2: U('POS KOMİSYON'), u3: U('GÖNDEREN: AHMET YILMAZ AÇIKLAMA: KİRA'),
          u4: [U('TR330006100519786457841326 NOLU HESABA HAVALE'), U('İNTERNET BANKACILIĞI FAST 0012345678 SORGU NO 99887766'), U('KREDİ KARTI ÖDEMESİ 4543****1234'), U('HESAPLAR ARASI VİRMAN')],
          u5: [U('FAST GİDEN TR33 0006 1005 1978 6457 8413 26 ALİ VELİ FATURA'), U('MOBİL FAST GİDEN-HASAN HÜSEYİN ÖZTÜRK-AVANS'), U('EFT - AYŞE KAYA - TR120001002345678901234567 - EYLÜL KİRASI')] }; });
      check(t1.u4.every(x => x === ''), 'IBAN / sorgu no / kredi kartı / virman açıklamalarında cari önerilmez: ' + JSON.stringify(t1.u4));
      check(t1.u5.join('|') === 'ALİ VELİ|HASAN HÜSEYİN ÖZTÜRK|AYŞE KAYA', 'etiketsiz açıklamalarda kişi adı bulunur (IBAN atlanır): ' + JSON.stringify(t1.u5));
      check(t1.o1.kod === '320.01.008' && t1.o1.yeni && t1.o2.kod === t1.o1.kod && t1.tm && t1.o3.kod === '320.01.001' && !t1.o3.yeni, 'taslak cari: sıradaki kod 320.01.008 (aynı karşı taraf aynı kod), planda olan ünvan kendi kodunu alır');
      check(t1.u1 === 'ABC İNŞAAT TİC. LTD. ŞTİ.' && t1.u2 === '' && t1.u3 === 'AHMET YILMAZ', 'banka açıklamasından karşı taraf ünvanı çıkarıldı (' + t1.u1 + ' / ' + t1.u3 + ')');
      // Görev 22: IBAN / salt sayıya cari önerilmez; " - " ekli ünvan mevcut cariyle eşleşir, yeni cari açılmaz
      const g22 = await w.evaluate(() => { const H = window.__hesap; const f = window.__app.Store.local().firms.kf1;
        const m = new Map([['120', 'ALICILAR'], ['120.01', 'ALICILAR 1'], ['120.01.003', 'ABC TURİZM ANONİM ŞİRKETİ'], ['120.01.004', 'KAYA GIDA LTD ŞTİ']]);
        const yok = ['TR33 0006 1005 1978 6457 8413 26', 'TR330006100519786457841326', '1234567890', '0012-3456-789 / 55', 'TR 4543 1234'].map(u => H.cariOner(f, m, '120', u, ''));
        const ek = H.cariOner(f, m, '120', 'ABC TURİZM A.Ş. - XYZ OTEL', ''), ek2 = H.cariOner(f, m, '120', 'KAYA GIDA LTD. ŞTİ. - LARA ŞUBESİ', '');
        const y1 = H.cariOner(f, m, '120', 'DEF YAPI LTD ŞTİ - ANTALYA ŞANTİYESİ', ''), y2 = H.cariOner(f, m, '120', 'DEF YAPI LTD ŞTİ - İZMİR ŞANTİYESİ', '');
        const U = window.__app.unvanCikar;
        return { yok, ek, ek2, y1, y2, u: U('FAST GELEN ABC TURİZM A.Ş. - XYZ OTEL REF 778899') }; });
      check(g22.yok.every(x => x === null), 'IBAN (boşluklu / boşluksuz) ve salt sayı / kod dizilerine cari önerilmez: ' + JSON.stringify(g22.yok));
      check(g22.ek && g22.ek.kod === '120.01.003' && !g22.ek.yeni && g22.ek2 && g22.ek2.kod === '120.01.004' && !g22.ek2.yeni, '" - " ekli ünvan (ABC TURİZM A.Ş. - XYZ OTEL) mevcut cariyle eşleşti, yeni cari açılmadı (' + JSON.stringify([g22.ek, g22.ek2]) + ')');
      check(g22.y1 && g22.y1.yeni && g22.y2 && g22.y2.kod === g22.y1.kod && !/ŞANTİYE/.test(g22.y1.ad), 'planda olmayan ekli ünvanın şubeleri tek taslak cari (ek atılmış adla): ' + JSON.stringify([g22.y1, g22.y2]) + ' · banka açıklamasından: ' + g22.u);
      const p = w.evaluate(async () => { const H = window.__hesap; const f = window.__app.Store.local().firms.kf1; const r = await H.taslakHazirla(f, ['320.01.008', '770.01']); return { ok: r.ok, degis: [...r.degis], kalan: H.taslakMi(f.id, '320.01.008') }; });
      await w.waitForSelector('#askModal:not([hidden])', { timeout: 15000 }); const soru = await w.textContent('#askText'); await w.click('#askYes');
      const t2 = await p; const ek = await app.evaluate(() => global.__hp2);
      check(/320\.01\.008/.test(soru) && t2.ok && !t2.kalan && ek.length === 1 && ek[0].hesaplar.length === 1 && ek[0].hesaplar[0].kod === '320.01.008' && ek[0].hesaplar[0].ad === 'YENİ TEDARİK LTD ŞTİ', 'fiş öncesi taslak cari onayla Luca hesap planına açıldı: ' + JSON.stringify(ek.map(x => x.hesaplar))); }
    // firma silme: kurallar ve mizan saklanırsa firma yeniden eklenince geri gelir
    const geri = await w.evaluate(async () => { const { Store } = window.__app;
      await Store.deleteFirm('kf1', { kurallar: false, mizan: false });
      const d1 = Store.local(); const silindi = !d1.firms.kf1 && !(d1.fkurallar || {}).kf1;
      await Store.saveFirm({ id: 'kf2', name: 'EXPO İNŞ', lucaId: '11', banks: [] });
      let d2 = Store.local(); for (let i = 0; i < 15 && !Object.keys((d2.fkurallar || {}).kf2 || {}).length; i++) { await new Promise(r => setTimeout(r, 200)); d2 = Store.local(); }
      const m = await Store.getMizan('kf2', 1);
      return { silindi, kural: Object.keys((d2.fkurallar || {}).kf2 || {}).length, mizan: m.length, info: !!(d2.firms.kf2 || {}).mizanInfo }; });
    console.log('GERI', JSON.stringify(geri)); check(geri.silindi && geri.kural === 1 && geri.mizan >= 6 && geri.info, 'firma silinip yeniden eklenince saklanan kurallar ve mizan geri geldi');
    await w.evaluate(async () => { const { Store } = window.__app; await Store.deleteFirm('kf2', {}); await Store.saveFirm({ id: 'kf3', name: 'EXPO İNŞ', lucaId: '11', banks: [] }); });
    const temiz = await w.evaluate(() => { const d = window.__app.Store.local(); return Object.keys((d.fkurallar || {}).kf3 || {}).length + (d.firms.kf3.mizanInfo ? 1 : 0); });
    check(temiz === 0, 'tam silmede kurallar ve mizan silindi');
    // kayıttan 4 sn sonra muavin yenilemesi kendiliğinden başlar ve pencereyi kapatır; düğme hâlâ açıksa kullanıcı gibi basılır
    if (await w.isVisible('#fkkYenile')) await w.click('#fkkYenile'); await w.waitForTimeout(2500);
    check(!(await w.isHidden('#fkKayit')) && await w.isHidden('#fkkModal'), 'muavin yenileme arka planda başladı; kayıt ekranı açık kaldı (sayfa değişmedi)');
    // muavin indirilirken ekranın ortasında bekleme penceresi açıktır (yavaş makinede / CI'da hâlâ sürer): kullanıcı gibi "Arka planda devam etsin"
    if (await w.isVisible('#mwBusy')) { await w.click('#mwBusyIptal'); await w.waitForSelector('#mwBusy', { state: 'hidden', timeout: 10000 }); }
    await w.click('#fkkClose'); await w.waitForTimeout(300);
    const fr2 = await (await w.$('#fkFrame')).contentFrame();
    let du = null; for (let i = 0; i < 10 && !(du && du.tur); i++) { du = await fr2.evaluate(() => fetch('/api/toplu/durum').then(r => r.json())).catch(() => null); if (!(du && du.tur)) await new Promise(r => setTimeout(r, 500)); }
    console.log('DURUM', JSON.stringify(du).slice(0, 300), await fr2.evaluate(() => document.querySelector('#hata') && document.querySelector('#hata').textContent).catch(() => ''));
    check(du && (du.tur === 'toplu' || du.calisiyor !== undefined) && du.tur === 'toplu', 'muavin kontrolü başlatıldı (' + (du && du.tur) + ')');
  } catch (e) { bad.push('HATA (5): ' + e.message.split('\n')[0]); await w.screenshot({ path: OUT + '/hata5.png' }).catch(() => {}); }
  finally { await app.close().catch(() => {}); fake.server.close(); }

  // ---------------- 6. Yönetim modülü (yalnız program sahibi) ----------------
  {
    // birim: TCMB kuru — işlem tarihinden önceki son iş günü (hafta sonu atlanır), JPY 100 birim
    {
      const { makeKur } = require('../kur');
      const xml = t => `<Tarih_Date Tarih="${t}"><Currency Kod="USD" CurrencyCode="USD"><Unit>1</Unit><ForexBuying>41.8271</ForexBuying></Currency><Currency Kod="JPY"><Unit>100</Unit><ForexBuying>27.5100</ForexBuying></Currency></Tarih_Date>`;
      const K = makeKur(() => fs.mkdtempSync(path.join(os.tmpdir(), 'kur-')), { bugun: () => new Date('2026-10-21T10:00:00'), fetchFn: async u => {
        const m = u.match(/(\d{2})(\d{2})(\d{4})\.xml/); const g = new Date(`${m[3]}-${m[2]}-${m[1]}T12:00:00`).getDay();
        return g === 0 || g === 6 ? { status: 404, ok: false } : { status: 200, ok: true, text: async () => xml(`${m[1]}.${m[2]}.${m[3]}`) }; } });
      const a = await K.kur('USD', '2026-10-19'), b = await K.kur('JPY', '2026-10-14');
      check(a.bulten === '2026-10-16' && a.kur === 41.8271 && b.kur === 0.2751 && b.bulten === '2026-10-13', 'TCMB kuru: önceki iş günü (Pazartesi → Cuma), birimli kur');
    }
    // birim: sunucu yönetici dese bile e-posta program sahibi değilse yönetim kapalı
    const { makeCloud } = require('../cloud');
    const fk1 = await sb.start({ admin: true });
    const c1 = makeCloud(fs.mkdtempSync(path.join(os.tmpdir(), 'mwc-')), { _testUrl: fk1.url });
    await c1.login({ email: 'test@ornek.com', password: 'Sifre1234' });
    check(c1.isAdmin() === false, 'yönetici bayrağı olsa da başka e-posta yönetim açamaz');
    await c1.login({ email: 'bilgi@smmmantalya.com', password: 'Sifre1234' });
    check(c1.isAdmin() === true, 'bilgi@smmmantalya.com yönetici');
    fk1.server.close();
  }
  s = await oturum('yeni', { admin: true, email: 'bilgi@smmmantalya.com' });
  ({ app, w, fake, cfg } = s);
  try {
    await w.waitForTimeout(400);
    const kart = await w.$('.modcard[data-mod=yonetim]');
    check(!!kart, 'program sahibine Yönetim kartı görünüyor');
    await w.screenshot({ path: OUT + '/9-yonetim-kart.png' });
    await kart.click();
    await w.waitForTimeout(800);
    for (const sel of ['#chooseModal:not([hidden]) #chBtns .btn:last-child', '#regModal:not([hidden]) [data-rgclose]']) {
      const b = await w.$(sel); if (b) { await b.click().catch(() => {}); await w.waitForTimeout(300); }
    }
    await w.waitForSelector('#admPanel:not([hidden]) #admPin', { timeout: 10000 });
    check(/yetkiniz yok|şifresi girilmedi/i.test(await w.evaluate(() => window.desktop.admin('admin_users').then(() => 'açıldı', e => String(e.message)))), 'Yönetim şifresi girilmeden yönetim işlemi yapılamıyor');
    await w.fill('#admPin', '12345'); await w.click('#admPinGo'); await w.waitForTimeout(400);
    check(/hatalı/i.test(await w.textContent('#admPinE')), 'yanlış yönetim şifresi reddedildi');
    await w.fill('#admPin', '55555'); await w.keyboard.press('Enter');
    await w.waitForSelector('#admPanel:not([hidden]) .admstats', { timeout: 10000 });
    check(true, 'Yönetim ilk şifre 55555 ile açıldı');
    await w.waitForFunction(() => /Ali SMMM/.test(document.querySelector('#admBody').textContent), null, { timeout: 10000 }).catch(() => {});
    await w.waitForTimeout(300);
    const pano = await w.textContent('#admBody');
    check(/bitecek/i.test(pano) && /Ali SMMM/.test(pano) && /lisans durumu/i.test(pano), 'Pano: özet, modüller ve bitecek lisanslar');
    await w.screenshot({ path: OUT + '/9a-yonetim-pano.png' });
    await w.click('[data-admtab=uyeler]'); await w.waitForTimeout(300);
    const say = () => w.$$eval('#admBody .admuye tbody tr[data-admu]', r => r.length);
    check(await say() === 3, 'Üyeler: 3 üye listelendi');
    await w.fill('#admQ', 'veli'); await w.waitForTimeout(200);
    check(await say() === 1, 'Üyeler: arama');
    await w.fill('#admQ', ''); await w.selectOption('#admDurum', 'kapali'); await w.waitForTimeout(200);
    check(await say() === 1 && /ayse/.test(await w.textContent('#admBody .admuye tbody')), 'Üyeler: durum süzgeci (kapalı hesap)');
    await w.selectOption('#admDurum', ''); await w.waitForTimeout(200);
    await w.screenshot({ path: OUT + '/9b-yonetim-uyeler.png' });
    await w.click('#admBody tr[data-admu=u1] td:first-child');
    await w.waitForSelector('#admModal:not([hidden]) #admF_unvan', { timeout: 8000 });
    check(await w.inputValue('#admF_unvan') === 'Ali SMMM' && await w.inputValue('#admF_vkn') === '1111', 'Üye ayrıntısı: fatura bilgileri büro bilgilerinden dolu');
    await w.fill('#admF_unvan', 'Ali Yılmaz SMMM'); await w.fill('#admF_adres', 'Muratpaşa / Antalya'); await w.fill('#admNot', 'iyi müşteri');
    await w.click('[data-admd=kaydet]'); await w.waitForTimeout(500);
    const u1 = fake.state.adm.users[0];
    check(u1.fatura.unvan === 'Ali Yılmaz SMMM' && u1.fatura.adres === 'Muratpaşa / Antalya' && u1.admin_note === 'iyi müşteri', 'Üye fatura bilgileri ve yönetici notu kaydedildi');
    await w.screenshot({ path: OUT + '/9c-yonetim-uye.png' });
    await w.click('#admModal [data-admsat="u1"]');
    await w.waitForSelector('#admST', { timeout: 5000 });
    check(await w.inputValue('#admST') === '5000', 'Satış formu: liste fiyatı önerildi');
    await w.fill('#admST', '6000'); await w.selectOption('#admSD', 'odendi'); await w.fill('#admSFN', 'MUH2026000000001');
    check(/7\.200,00/.test(await w.textContent('#admSTop')), 'Satış formu: KDV dahil toplam');
    await w.screenshot({ path: OUT + '/9d-yonetim-satis.png' });
    await w.click('[data-admsf=kaydet]');
    await w.waitForSelector('#admModal:not([hidden]) #admF_unvan', { timeout: 8000 }); await w.waitForTimeout(300);
    check(fake.state.adm.pays.length === 1 && fake.state.adm.pays[0].lisans_ver === true && u1.modules.ekstre.daysLeft === 565, 'Satış kaydedildi ve lisans 365 gün uzatıldı');
    check(/MUH2026000000001/.test(await w.textContent('#admModalB')), 'Satış üye sayfasında görünüyor');
    await w.keyboard.press('Escape'); await w.waitForTimeout(300);
    check(await w.isHidden('#admModal') && await w.isVisible('#admPanel'), 'Esc üye penceresini kapatır');
    await w.click('[data-admtab=satis]'); await w.waitForTimeout(500);
    const sat = await w.textContent('#admBody');
    check(/MUH2026000000001/.test(sat) && /7\.200,00/.test(sat), 'Satışlar sekmesi: kayıt ve toplam');
    // lisans kodu üretimi: kodlar programda üretilir, sunucuya yalnız özet
    await w.click('[data-admtab=kod]'); await w.waitForTimeout(400);
    const kodDosya = path.join(cfg, 'GIZLI-test-kodlar.csv');
    await app.evaluate(({ dialog }, f) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: f }); }, kodDosya);
    await w.selectOption('#admKM', 'ekstre'); await w.fill('#admKA', '3');
    await w.click('#admKU');
    await w.waitForSelector('#admBody .admkodlar', { timeout: 8000 });
    const satirlar = fs.readFileSync(kodDosya, 'utf8').replace(/^﻿/, '').trim().split(/\r?\n/);
    const kodlar = satirlar.slice(1).map(x => x.split(';')[4]);
    const ozet = k => require('crypto').createHash('sha256').update(k.replace(/-/g, '')).digest('hex');
    check(kodlar.length === 3 && kodlar.every(k => /^[0-9A-Z]{5}(-[0-9A-Z]{5}){9}$/.test(k)), 'Lisans kodları GİZLİ dosyaya yazıldı (3 kod, 50 karakter)');
    check(JSON.stringify(fake.state.adm.kodOzetleri) === JSON.stringify(kodlar.map(ozet)), 'Sunucuya yalnız kod özetleri gönderildi');
    check(!JSON.stringify(fake.state.cagri).includes(kodlar[0].replace(/-/g, '')) && !JSON.stringify(fake.state.cagri).includes(kodlar[0]), 'Kodun kendisi sunucuya gitmedi');
    await w.fill('#admKQ', kodlar[1].toLowerCase()); await w.click('#admKS'); await w.waitForTimeout(500);
    check(/kullanılmadı/.test(await w.textContent('#admKR')), 'Kod sorgulama (özetle)');
    await w.screenshot({ path: OUT + '/9e-yonetim-kod.png' });
    // duyuru
    await w.click('[data-admtab=ayar]'); await w.waitForTimeout(300);
    await w.fill('#admDM', 'MuhaWin 2.8.0 yayınlandı.'); await w.click('#admDY'); await w.waitForTimeout(400);
    check(fake.state.adm.ayar.duyuru && fake.state.adm.ayar.duyuru.metin === 'MuhaWin 2.8.0 yayınlandı.', 'Duyuru yayınlandı');
    // yönetim şifresini değiştir
    await w.fill('#admP0', '55555'); await w.fill('#admP1', '9876x'); await w.fill('#admP2', '9876x'); await w.click('#admPS'); await w.waitForTimeout(400);
    check(fake.state.adm.pin === '9876x' && /değiştirildi/.test(await w.textContent('#admPM')), 'Yönetim şifresi programdan değiştirildi');
    // ofisler: özel çözüm tanımla
    await w.click('[data-admtab=ofis]'); await w.waitForTimeout(400);
    await w.check('[data-admoz="of1"][value=cek]'); await w.waitForTimeout(500);
    check(JSON.stringify(fake.state.adm.ofisler[0].ozel) === '["cek"]', 'Ofisler: "Çek / Senet Kayıtları" ofise tanımlandı');
    await w.screenshot({ path: OUT + '/9g-yonetim-ofis.png' });
    await w.click('[data-admtab=log]'); await w.waitForTimeout(400);
    check(/Satış kaydı/.test(await w.textContent('#admBody')), 'İşlem günlüğü');
    await w.keyboard.press('Escape'); await w.waitForTimeout(300);
    check(await w.$eval('[data-admtab=pano]', b => b.getAttribute('aria-pressed')) === 'true', 'Esc: sekmeden Pano\'ya');
    await w.keyboard.press('Escape');
    await w.waitForSelector('#modGate:not([hidden])', { timeout: 5000 }); await w.waitForTimeout(500);
    check(/2\.8\.0 yayınlandı/.test(await w.textContent('#modGate')), 'Duyuru modül seçim ekranında görünüyor');
    await w.screenshot({ path: OUT + '/9f-duyuru.png' });
    await w.click('[data-duyx]'); await w.waitForTimeout(200);
    check(!(await w.$('#modDuyuru')), 'Duyuru kapatılabiliyor');
    await w.click('.modcard[data-mod=yonetim]');
    await w.waitForSelector('#admPanel:not([hidden]) #admPin', { timeout: 10000 });
    check(true, 'Yönetime yeniden girerken şifre yeniden soruluyor');
    await w.fill('#admPin', '9876x'); await w.click('#admPinGo');
    await w.waitForSelector('#admPanel:not([hidden]) .admstats', { timeout: 10000 });
    check(true, 'yeni yönetim şifresiyle girildi');
  } catch (e) { bad.push('HATA (6): ' + e.message.split('\n')[0]); await w.screenshot({ path: OUT + '/hata6.png' }).catch(() => {}); }
  finally { await app.close().catch(() => {}); fake.server.close(); }

  // ---------------- 4. başlangıç ekranı ve imleçler ----------------
  {
    const fake2 = await sb.start({});
    const cfg2 = fs.mkdtempSync(path.join(os.tmpdir(), 'mw-'));
    const app2 = await electron.launch({ executablePath: require(path.join(APP, 'node_modules/electron')), args: [APP, '--no-sandbox'],
      env: { ...process.env, EKSTRE_TEST_SB: fake2.url, XDG_CONFIG_HOME: cfg2 } });
    try {
      await app2.firstWindow();
      let sp = null;
      for (let i = 0; i < 20 && !sp; i++) { sp = app2.windows().find(x => /splash\.html/.test(x.url())); if (!sp) await new Promise(r => setTimeout(r, 100)); }
      check(!!sp, 'başlangıç ekranı açıldı');
      await sp.waitForLoadState('domcontentloaded').catch(() => {});
      { const d = await sp.evaluate(() => ({ v: document.getElementById('v').textContent, f: typeof window.setDurum, y: document.getElementById('y').textContent })).catch(e => ({ hata: String(e) }));
        check(/^Sürüm \d/.test(d.v || '') && d.f === 'function' && /^%\d+$/.test(d.y || ''), "başlangıç ekranı betiği (splash.js) çalıştı: sürüm ve ilerleme yazıyor (" + JSON.stringify(d) + ')'); }
      await sp.waitForTimeout(400); await sp.screenshot({ path: OUT + '/0-baslangic.png' });
      await new Promise(r => setTimeout(r, 2500));
      const urls = app2.windows().map(x => x.url());
      check(!urls.some(u => /splash/.test(u)) && urls.some(u => /index\.html/.test(u)), 'başlangıç ekranı kapandı, ana pencere açık');
      const mw = app2.windows().find(x => /index\.html/.test(x.url()));
      const cur = await mw.evaluate(() => [getComputedStyle(document.body).cursor, getComputedStyle(document.querySelector('button')).cursor]);
      check(cur[0].includes('data:image') && cur[1].includes('data:image'), 'MuhaWin imleçleri uygulandı');
      await mw.waitForTimeout(500); await mw.screenshot({ path: OUT + '/0b-giris.png' });
    } catch (e) { bad.push('HATA (4): ' + e.message.split('\n')[0]); }
    finally { await app2.close().catch(() => {}); fake2.server.close(); }
  }

  // ---------------- Görev 41: ekran boyu × Windows ölçeklemesi matrisi (açılış + ana ekranlar) ----------------
  // test/ekran.js her ekranı 1280×720 … 3840×2160 @%100–200 boylarında, büyütülmüş ve tam ekran pencerede ölçer:
  // görünür öğeler üst üste binmemeli, metin kesilmemeli, sayfa yatay taşmamalı
  { const out = path.join(OUT, 'ekran'); fs.rmSync(out, { recursive: true, force: true });
    // büyütülmüş / tam ekran pencere için 4K sanal ekran (xvfb-run varsa); yoksa o iki ölçüm atlanır
    const xvfb = require('child_process').spawnSync('sh', ['-c', 'command -v xvfb-run']).status === 0;
    const r = require('child_process').spawnSync(xvfb ? 'xvfb-run' : process.execPath, [...(xvfb ? ['-a', '-s', '-screen 0 3840x2160x24', process.execPath] : []), path.join(__dirname, 'ekran.js')], { encoding: 'utf8', timeout: 900000,
      env: { ...process.env, OUT: out, MUHAWIN_APP: APP, EKRAN_EKRAN: process.env.EKRAN_EKRAN || 'giris,moduller,banka,muhasebe-toplu,muhasebe-tek,luca-kaydet' } });
    let oz = []; try { oz = JSON.parse(fs.readFileSync(path.join(out, 'ozet.json'), 'utf8')); } catch (e) { bad.push('ekran matrisi çalışmadı: ' + (r.stderr || r.stdout || String(r.error)).slice(-300)); }
    const ekranlar = [...new Set(oz.map(x => x.ekran))];
    for (const e of ekranlar) { const L = oz.filter(x => x.ekran === e); const sorunlu = L.filter(x => x.hata || x.cakisan.length || x.tasan.length || x.sayfaTasma.length);
      check(!sorunlu.length, 'ekran uyumu: ' + e + ' — ' + L.length + ' boyda çakışma / kesik metin / yatay taşma yok' + (sorunlu.length ? ' (' + sorunlu.map(x => (x.boy || '') + ': ' + (x.hata || [...x.sayfaTasma, ...x.tasan, ...x.cakisan].slice(0, 2).join(' ; '))).join(' | ').slice(0, 500) + ')' : '')); }
    check(['giris', 'moduller', 'banka', 'muhasebe-toplu', 'luca-kaydet'].every(e => ekranlar.includes(e)) && oz.some(x => / @2$/.test(x.css || '')) && oz.some(x => / @1\.25$/.test(x.css || '')), 'ekran matrisi açılış ve ana ekranları %100, %125, %150 ve %200 ölçeklemede ölçtü (' + oz.length + ' ölçüm)'); }

  console.log(ok.map(x => '✓ ' + x).join('\n'));
  console.log(bad.map(x => '✗ ' + x).join('\n'));
  process.exit(bad.length ? 1 : 0);
})();
