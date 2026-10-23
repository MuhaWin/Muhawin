// Açılışta güncelleme sorusu (guncelleme.js) birim testi: node test/guncelleme.js
// electron-updater ve dialog sahte nesnelerle taklit edilir; gerçek GitHub sürümü kullanılmaz.
const { EventEmitter } = require('events');
const { makeGuncelleme } = require('../guncelleme');

const ok = [], bad = [];
const check = (c, m) => { (c ? ok : bad).push(m); console.log((c ? '  ✓ ' : '  ✗ ') + m); };
const bekle = (ms = 5) => new Promise(r => setTimeout(r, ms));

// sahte electron-updater: checkForUpdates çağrılınca senaryodaki olayları yayar
function sahteUpdater(o = {}) {
  const u = new EventEmitter();
  Object.assign(u, { yeni: o.yeni || null, indirmeHatasi: o.indirmeHatasi || null, kurHatasi: o.kurHatasi || null,
    denetim: 0, indirme: 0, kurulum: 0, kurArg: null });
  u.checkForUpdates = async () => {
    u.denetim++; u.emit('checking-for-update');
    if (u.yeni) u.emit('update-available', { version: u.yeni }); else u.emit('update-not-available', {});
    return {};
  };
  u.downloadUpdate = async () => {
    u.indirme++;
    if (u.indirmeHatasi) { const e = new Error(u.indirmeHatasi); u.emit('error', e); throw e; }
    u.emit('download-progress', { percent: 42.4 });
    u.emit('update-downloaded', { version: u.yeni });
    return [];
  };
  u.quitAndInstall = (...a) => { if (u.kurHatasi) throw new Error(u.kurHatasi); u.kurulum++; u.kurArg = a; };
  return u;
}
// sahte dialog: soru kutularına sırayla verilen yanıtları döndürür
function sahteDialog(yanitlar = []) {
  const d = { sorular: [], hatalar: [], pencereli: 0 };
  d.showMessageBox = async (w, o) => {
    if (o === undefined) o = w; else d.pencereli++;
    if (o.type === 'error') { d.hatalar.push(o); return { response: 0 }; }
    d.sorular.push(o); return { response: yanitlar.length ? yanitlar.shift() : 1 };
  };
  return d;
}
function kurulum(o = {}) {
  const updater = sahteUpdater(o), dialog = sahteDialog(o.yanitlar), olaylar = [];
  let cikis = 0;
  const g = makeGuncelleme({ updater, dialog, surum: '2.9.12', pencere: () => (o.pencereYok ? null : {}),
    gonder: st => olaylar.push(st), cikisaIzin: () => { cikis++; } });
  return { g, updater, dialog, olaylar, cikis: () => cikis };
}

(async () => {
  console.log('Ayarlar');
  {
    const { updater } = kurulum();
    check(updater.autoDownload === false, 'autoDownload kapalı (sorulmadan indirilmez)');
    check(updater.autoInstallOnAppQuit === true && updater.allowPrerelease === false, 'autoInstallOnAppQuit açık, ön sürüm kapalı');
  }

  console.log('Yeni sürüm yok');
  {
    const { g, updater, dialog, olaylar } = kurulum();
    await g.denetle(false); await bekle();
    check(dialog.sorular.length === 0, 'soru sorulmadı');
    check(updater.indirme === 0, 'indirme yok');
    check(olaylar.some(s => s.state === 'latest'), "'latest' durumu gönderildi");
  }

  console.log('Yeni sürüm var + Şimdi kur');
  {
    const { g, updater, dialog, olaylar, cikis } = kurulum({ yeni: '2.9.13', yanitlar: [0] });
    await g.denetle(false); await bekle(20);
    const s = dialog.sorular[0] || {};
    check(dialog.sorular.length === 1, 'soru bir kez soruldu');
    check(s.title === 'Yeni sürüm var' && s.message === 'Yeni sürüm var', 'başlık "Yeni sürüm var"');
    check(s.detail === 'MuhaWin 2.9.13 yayınlandı (kurulu: 2.9.12). Şimdi indirip kurmak ister misiniz?', 'metin yeni ve kurulu sürümü içeriyor');
    check(JSON.stringify(s.buttons) === '["Şimdi kur","Sonra"]' && s.defaultId === 0 && s.cancelId === 1, 'düğmeler: Şimdi kur (varsayılan) · Sonra');
    check(dialog.pencereli === 1, 'soru ana pencereye bağlı');
    check(updater.indirme === 1, 'downloadUpdate çağrıldı');
    check(olaylar.some(x => x.state === 'downloading' && x.percent === 42 && x.version === '2.9.13'), 'indirme ilerlemesi (yüzde) gönderildi');
    check(olaylar.some(x => x.state === 'ready'), "'ready' durumu gönderildi");
    check(updater.kurulum === 1 && JSON.stringify(updater.kurArg) === '[false,true]', 'indirme bitince quitAndInstall(false, true)');
    check(cikis() === 1, 'çıkış onayı atlandı (cikisOnay)');
    check(dialog.hatalar.length === 0, 'hata kutusu yok');
  }

  console.log('Sonra');
  {
    const { g, updater, dialog, olaylar } = kurulum({ yeni: '2.9.13', yanitlar: [1] });
    await g.denetle(false); await bekle();
    check(dialog.sorular.length === 1 && updater.indirme === 0, 'indirme yok');
    check(olaylar[olaylar.length - 1].state === 'idle', "'idle' durumu (bant ve 'indiriliyor' yazısı yok)");
    await g.denetle(false); await bekle();
    check(updater.denetim === 2 && dialog.sorular.length === 1, 'aynı oturumda ikinci (4 saatlik) denetimde soru yok');
    updater.yeni = '2.9.14';
    await g.denetle(false); await bekle();
    check(dialog.sorular.length === 2 && /2\.9\.14/.test(dialog.sorular[1].detail), 'daha yeni bir sürüm çıkarsa yeniden sorulur');
  }

  console.log('Elle denetim');
  {
    const { g, updater, dialog } = kurulum({ yeni: '2.9.13', yanitlar: [1, 0] });
    await g.denetle(false); await bekle();
    await g.denetle(true); await bekle(20);
    check(dialog.sorular.length === 2, '"Sonra" sonrası elle denetimde soru yine çıktı');
    check(updater.indirme === 1 && updater.kurulum === 1, 'elle denetimde Şimdi kur → indirilip kuruldu');
  }
  {
    const { g, updater, dialog } = kurulum({ yanitlar: [1] });
    await g.denetle(true); await bekle();
    updater.yeni = '2.9.13';
    await g.denetle(false); await bekle();
    await g.denetle(false); await bekle();
    check(dialog.sorular.length === 1, 'sonuçsuz elle denetim sonraki otomatik denetimi "elle" saymaz');
  }

  console.log('Hatalar');
  {
    const { g, updater, dialog, olaylar } = kurulum({ yeni: '2.9.13', yanitlar: [0, 0], indirmeHatasi: 'net::ERR_CONNECTION_RESET\nayrıntı' });
    let coktu = false;
    try { await g.denetle(false); await bekle(); } catch (e) { coktu = true; }
    check(!coktu, 'indirme hatasında çökme yok');
    check(updater.kurulum === 0, 'kurulum yapılmadı');
    check(dialog.hatalar.length === 1, 'hata mesajı bir kez gösterildi');
    check(/kurulamadı/.test(dialog.hatalar[0] && dialog.hatalar[0].message) && /ERR_CONNECTION_RESET/.test(dialog.hatalar[0].detail) && !/ayrıntı/.test(dialog.hatalar[0].detail), 'hata mesajı açık (ilk satır)');
    check(olaylar.some(x => x.state === 'error'), "'error' durumu gönderildi");
    updater.indirmeHatasi = null;
    await g.denetle(true); await bekle(20);
    check(updater.kurulum === 1, 'hatadan sonra elle denetimle yeniden denenebiliyor');
  }
  {
    const { g, updater, dialog, cikis } = kurulum({ yeni: '2.9.13', yanitlar: [0], kurHatasi: 'kurulum dosyası açılamadı' });
    await g.denetle(false); await bekle(20);
    check(cikis() === 1 && updater.kurulum === 0, 'kurulum hatası yakalandı');
    check(dialog.hatalar.length === 1 && /kurulum dosyası/.test(dialog.hatalar[0].detail), 'kurulum hatasında hata mesajı');
  }
  {
    const { g, updater, dialog } = kurulum();
    updater.checkForUpdates = async () => { updater.emit('error', new Error('ağ yok')); throw new Error('ağ yok'); };
    let coktu = false;
    try { await g.denetle(false); } catch (e) { coktu = true; }
    check(!coktu && dialog.hatalar.length === 0, 'yalnız denetim hatasında kutu çıkmaz (bugünkü gibi durum yazısı)');
  }

  console.log('Diğer');
  {
    const { g, dialog } = kurulum({ yeni: '2.9.13', yanitlar: [1], pencereYok: true });
    await g.denetle(false); await bekle();
    check(dialog.sorular.length === 1 && dialog.pencereli === 0, 'pencere yokken soru yine gösterilir');
    check(g.kur() === false, "indirilmemiş güncelleme için kur() → false");
  }
  {
    const { g, updater, dialog } = kurulum({ yeni: '2.9.13' });
    let cevap; dialog.showMessageBox = async () => { dialog.sorular.push(1); return new Promise(r => { cevap = r; }); };
    await g.denetle(false); await g.denetle(true); await bekle();
    check(dialog.sorular.length === 1, 'soru açıkken ikinci soru açılmaz');
    cevap({ response: 1 }); await bekle();
    check(updater.indirme === 0, 'açık soru "Sonra" ile kapandı');
  }

  console.log(`\n${ok.length} geçti, ${bad.length} başarısız`);
  process.exit(bad.length ? 1 : 0);
})().catch(e => { console.error('✗ HATA', e); process.exit(1); });
