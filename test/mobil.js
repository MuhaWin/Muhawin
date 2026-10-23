// Telefon yönetim paneli (mobil-yonetim/) uçtan uca testi: iPhone boyutu, sahte Supabase (test/sahte_sb.js)
//   node test/mobil.js
const http = require('http'); const fs = require('fs'); const path = require('path'); const crypto = require('crypto');
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }
const sahte = require('./sahte_sb');
const KOK = path.join(__dirname, '..', 'mobil-yonetim');
let ok = 0, bad = 0; const check = (c, m) => { if (c) { ok++; console.log('  ✓ ' + m); } else { bad++; console.log('  ✗ ' + m); } };
const bekle = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const sb = await sahte.start({ admin: true });
  const web = http.createServer((q, r) => { const p = path.join(KOK, decodeURIComponent(q.url.split('?')[0]).replace(/^\/+$/, '/index.html'));
    if (!p.startsWith(KOK) || !fs.existsSync(p)) { r.statusCode = 404; return r.end(); }
    r.setHeader('Content-Type', { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.webmanifest': 'application/manifest+json' }[path.extname(p)] || 'application/octet-stream'); r.end(fs.readFileSync(p)); });
  await new Promise(r => web.listen(0, '127.0.0.1', r)); const URL_ = 'http://127.0.0.1:' + web.address().port + '/';
  const br = await chromium.launch();
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, permissions: ['clipboard-read', 'clipboard-write'] });
  const istekler = [];
  await ctx.route('https://rupwlypoblungdfajrya.supabase.co/**', async route => {
    const u = new URL(route.request().url()); istekler.push([u.pathname, route.request().postData() || '']);
    const resp = await route.fetch({ url: sb.url + u.pathname + u.search }); await route.fulfill({ response: resp, headers: { ...resp.headers(), 'access-control-allow-origin': '*' } });
  });
  const pg = await ctx.newPage(); const hatalar = []; pg.on('pageerror', e => hatalar.push(String(e))); pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) hatalar.push(m.text()); });
  const metin = () => pg.evaluate(() => document.body.innerText);
  const tikla = async (sel) => { await pg.click(sel); await bekle(250); };
  try {
    await pg.goto(URL_); await bekle(400);
    console.log('Giriş');
    check(await pg.isVisible('#gS') && (await pg.inputValue('#gE')) === 'bilgi@smmmantalya.com', 'giriş ekranı, e-posta hazır');
    await pg.fill('#gE', 'baska@ornek.com'); await pg.fill('#gS', 'x12345678'); await tikla('#gB');
    check(/yalnız bilgi@smmmantalya\.com/i.test(await metin()) && !istekler.some(x => x[0].includes('/token')), 'başka hesapla giriş sunucuya gitmeden reddedilir');
    await pg.fill('#gS', 'sifre1234'); await tikla('#gB'); await bekle(300);
    check(await pg.isVisible('#pP'), 'girişten sonra yönetim şifresi sorulur');
    check(!(await pg.evaluate(() => localStorage.getItem('mw-yonetim-oturum') || '')).includes('sifre1234'), 'hesap şifresi telefonda saklanmaz');
    await pg.fill('#pP', '11111'); await tikla('#pB'); await bekle(300);
    check(/Şifre hatalı/.test(await metin()), 'yanlış yönetim şifresi reddedilir');
    await pg.fill('#pP', '55555'); await tikla('#pB'); await bekle(700);
    console.log('Pano');
    const t = await metin();
    check(/Pano/.test(t) && /Üye\s*3/.test(t) && /Son üyeler/.test(t) && /Ali SMMM/.test(t), 'pano: kutular ve son üyeler');
    check(/30 gün içinde bitecek/.test(t) && await pg.isVisible('[data-satis="u1"]'), 'pano: bitecek lisanslar ve Uzat / sat');
    const sw = await pg.evaluate(() => document.documentElement.scrollWidth); check(sw <= 390, 'telefon genişliğinde yatay kaydırma yok (' + sw + ')');
    console.log('Üyeler');
    await tikla('[data-tab="uyeler"]'); await bekle(200);
    check((await pg.$$('.satir[data-u]')).length === 3, 'üye listesi 3 üye');
    await pg.fill('#uQ', 'veli'); await bekle(250);
    check((await pg.$$('.satir[data-u]')).length === 1 && (await pg.evaluate(() => document.activeElement.id)) === 'uQ', 'arama süzer, odak kutuda kalır');
    await pg.fill('#uQ', ''); await pg.selectOption('#uD', 'kapali'); await bekle(200);
    check((await pg.$$('.satir[data-u]')).length === 1 && /Ayşe/.test(await metin()), 'durum süzgeci: kapalı hesap');
    await pg.selectOption('#uD', ''); await bekle(150);
    await tikla('.satir[data-u="u2"]'); await bekle(500);
    let u = await metin();
    check(/veli@buro\.com/.test(u) && /MuhaWin lisansı/.test(u) && /OFIS-PC/.test(u), 'üye sayfası: lisans, bilgisayarlar');
    check(await pg.isVisible('a[href^="tel:"]') && await pg.isVisible('a[href^="https://wa.me/"]'), 'üyeyi ara / WhatsApp bağlantıları');
    // lisans ver: 1 yıl + not
    await tikla('[data-i="grant"]'); await tikla('[data-sec="365"]'); await pg.fill('[data-girdi]', 'telefondan'); await tikla('[data-sec="__tamam"]'); await bekle(800);
    const g = sb.state.cagri.filter(c => c[0] === 'admin_grant').pop();
    check(g && g[1].p_user === 'u2' && g[1].p_days === 365 && g[1].p_module === 'ekstre' && g[1].p_note === 'telefondan', 'Lisans ver → admin_grant (ekstre, 365 gün, not)');
    check(/lisanslı/.test(await metin()), 'üye sayfası yenilendi: lisanslı');
    // fatura bilgisi kaydet
    await pg.fill('#f_unvan', 'Veli Muhasebe Ltd'); await pg.fill('#f_not', 'telefondan not'); await tikla('[data-i="kaydet"]'); await bekle(400);
    const up = sb.state.cagri.filter(c => c[0] === 'admin_user_update').pop();
    check(up && up[1].p_fatura.unvan === 'Veli Muhasebe Ltd' && up[1].p_admin_note === 'telefondan not', 'fatura bilgileri ve not kaydedilir');
    // hesap kapat: vazgeç
    const once = sb.state.cagri.length; await tikla('[data-i="dis"]'); await tikla('[data-sec="__iptal"]');
    check(sb.state.cagri.length === once, 'Hesabı kapat: vazgeçince sunucuya gitmez');
    console.log('Satış');
    await tikla('#uyeS [data-satis="u2"]'); await bekle(200);
    check(await pg.isVisible('#sT') && (await pg.inputValue('#sU')) === 'veli@buro.com', 'satış formu üyeyle açılır');
    await pg.fill('#sT', '5000'); await bekle(100);
    check(/6\.000,00/.test(await pg.textContent('#sTop')), 'toplam KDV dahil hesaplanır');
    await pg.selectOption('#sD', 'odendi'); await bekle(100);
    check((await pg.inputValue('#sOT')) !== '', 'Tahsil edildi seçilince ödeme tarihi dolar');
    await tikla('[data-sf="kaydet"]'); await bekle(900);
    const ps = sb.state.cagri.filter(c => c[0] === 'admin_payment_save').pop();
    check(ps && ps[1].p.user_id === 'u2' && ps[1].p.module === 'ekstre' && +ps[1].p.tutar === 5000 && ps[1].p.lisans_ver === true && ps[1].p.durum === 'odendi', 'satış kaydı → admin_payment_save');
    check(!(await pg.isVisible('#sT')) && /tahsil edildi/.test(await metin()), 'form kapandı, üye sayfasında satış görünür');
    await tikla('#uGeri'); await tikla('[data-tab="satis"]'); await bekle(500);
    check(/Tahsil edilen/.test(await metin()) && (await pg.$$('[data-p="sil"]')).length === 1, 'Satışlar sekmesi: özet ve kayıt');
    await tikla('[data-p="sil"]'); await tikla('[data-sec="__tamam"]'); await bekle(600);
    check(sb.state.cagri.some(c => c[0] === 'admin_payment_delete'), 'satış silme onayla');
    console.log('Lisans kodları');
    await tikla('[data-tab="kod"]'); await bekle(400);
    check(/ilk-1000/.test(await metin()), 'kod partileri');
    await pg.fill('#kA', '3'); await pg.fill('#kP', 'tel-deneme'); await tikla('#kU'); await tikla('[data-sec="__tamam"]'); await bekle(900);
    const kodlar = await pg.$$eval('.kod', l => l.map(x => x.textContent).filter(x => /^[0-9A-Z]{5}(-[0-9A-Z]{5}){9}$/.test(x)));
    const add = sb.state.cagri.filter(c => c[0] === 'admin_codes_add').pop();
    const ozet = k => crypto.createHash('sha256').update(k.replace(/-/g, '')).digest('hex');
    check(kodlar.length === 3 && add && add[1].p_hashes.length === 3 && kodlar.every(k => add[1].p_hashes.includes(ozet(k))), '3 kod üretildi; sunucuya yalnız SHA-256 özetleri gitti');
    check(!istekler.some(x => kodlar.some(k => x[1].includes(k) || x[1].includes(k.replace(/-/g, '')))), 'kodların kendisi hiçbir isteğe girmedi');
    check(add[1].p_module === 'ekstre' && add[1].p_batch === 'tel-deneme' && add[1].p_days === 365, 'kod partisi: ekstre, parti adı, 365 gün');
    await pg.fill('#kQ', kodlar[0].toLowerCase()); await tikla('#kS'); await bekle(400);
    check(/kullanılmadı/.test(await metin()), 'kod sorgula (küçük harfle de) bulur');
    await pg.fill('#kQ', 'ABC'); await tikla('#kS'); await bekle(200);
    check(/50 haneli/.test(await metin()), 'eksik kod uyarısı');
    console.log('Diğer');
    await tikla('[data-tab="diger"]'); await tikla('[data-tab="ofis"]'); await bekle(400);
    check(/Ali SMMM Ofisi/.test(await metin()), 'ofisler listesi');
    await pg.check('[data-oz="of1"][value="mikro"]'); await bekle(500);
    const oz = sb.state.cagri.filter(c => c[0] === 'admin_office_set_ozel').pop();
    check(oz && oz[1].p_office === 'of1' && oz[1].p_ozel.includes('mikro'), 'ofise Mikro Denetim tanımlanır');
    await tikla('[data-tab="diger"]'); await tikla('[data-tab="ayar"]'); await bekle(300);
    await pg.fill('#dM', 'Telefon test duyurusu'); await tikla('#dY'); await tikla('[data-sec="__tamam"]'); await bekle(500);
    check(sb.state.adm.ayar.duyuru && sb.state.adm.ayar.duyuru.metin === 'Telefon test duyurusu' && /Yayında/.test(await metin()), 'duyuru yayınlanır');
    await pg.fill('#aF', '4500'); await tikla('#aK'); await bekle(400);
    check(sb.state.adm.ayar.fiyatlar.ekstre === '4500' && sb.state.adm.ayar.fiyatlar.fatura === 5000, 'liste fiyatı kaydedilir (diğer fiyatlar korunur)');
    await pg.fill('#p0', '55555'); await pg.fill('#p1', '1234'); await pg.fill('#p2', '1234'); await tikla('#pS'); await bekle(400);
    check(sb.state.adm.pin === '1234', 'yönetim şifresi değiştirilir');
    await tikla('[data-tab="diger"]'); await tikla('[data-tab="log"]'); await bekle(400);
    check(/Lisans verildi/.test(await metin()), 'işlem günlüğü');
    console.log('Kilit / oturum');
    await tikla('[data-tab="diger"]'); await tikla('#kilit'); await bekle(200);
    check(await pg.isVisible('#pP'), 'Kilitle → şifre ekranı');
    await pg.reload(); await bekle(800);
    check(await pg.isVisible('#pP'), 'sayfa yeniden açılınca oturum hatırlanır, yalnız yönetim şifresi sorulur');
    await pg.fill('#pP', '1234'); await tikla('#pB'); await bekle(600);
    check(/Pano/.test(await metin()), 'yeni şifreyle açılır');
    // yetkisiz sunucu yanıtı
    sb.state.admin = false; await tikla('#yenile'); await bekle(600);
    check(/yetkiniz yok/i.test(await metin()), 'sunucu yetkisiz derse hata gösterilir');
    sb.state.admin = true;
    await pg.screenshot({ path: path.join(process.env.CIKTI || '/tmp', 'mobil-pano.png') });
    // karanlık tema
    await pg.emulateMedia({ colorScheme: 'dark' }); await bekle(100);
    const bg = await pg.evaluate(() => getComputedStyle(document.body).backgroundColor); check(bg === 'rgb(18, 22, 28)', 'karanlık temada koyu zemin');
    check(!hatalar.length, 'sayfa hatası yok' + (hatalar.length ? ': ' + hatalar.join(' | ') : ''));
  } catch (e) { bad++; console.log('  ✗ HATA ' + (e && e.stack || e)); }
  await br.close(); web.close(); sb.server.close();
  console.log(`\n${ok} geçti, ${bad} başarısız`); process.exit(bad ? 1 : 0);
})();
