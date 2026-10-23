'use strict';
// Açılışta güncelleme sorusu: yeni sürüm varsa kullanıcıya sorulur; "Şimdi kur" denirse indirilir ve
// indirme bitince program kapanıp kurulur. "Sonra" denen sürüm o oturumda yeniden sorulmaz (elle denetim hariç).
// updater (electron-updater autoUpdater) ve dialog dışarıdan verilir; test/guncelleme.js sahte nesnelerle sınar.
function makeGuncelleme({ updater, dialog, pencere, surum, gonder, cikisaIzin }) {
  let durum = { state: 'idle' }, ertelenen = null, elle = false, soruluyor = false, onaylandi = false;
  const yay = st => { durum = st; gonder(st); };
  const kisa = e => String(e && e.message || e).split('\n')[0].slice(0, 200);
  const kutu = o => { const w = pencere(); return (w ? dialog.showMessageBox(w, o) : dialog.showMessageBox(o)).catch(() => ({ response: -1 })); };

  updater.autoDownload = false; updater.autoInstallOnAppQuit = true; updater.allowPrerelease = false;

  function hata(e) {
    const msg = kisa(e);
    yay({ state: 'error', error: msg });
    if (!onaylandi) return;
    onaylandi = false;
    kutu({ type: 'error', buttons: ['Tamam'], noLink: true, title: 'Güncelleme', message: 'Güncelleme kurulamadı',
      detail: msg + '\n\nProgram çalışmaya devam ediyor. Daha sonra "Güncellemeleri Denetle" ile yeniden deneyebilirsiniz.' });
  }

  async function sor(v) {
    const zorla = elle; elle = false;
    if (onaylandi || soruluyor) return;
    if (!zorla && ertelenen === v) { yay({ state: 'idle' }); return; }
    soruluyor = true;
    const r = await kutu({ type: 'question', buttons: ['Şimdi kur', 'Sonra'], defaultId: 0, cancelId: 1, noLink: true,
      title: 'Yeni sürüm var', message: 'Yeni sürüm var',
      detail: `MuhaWin ${v} yayınlandı (kurulu: ${surum}). Şimdi indirip kurmak ister misiniz?` });
    soruluyor = false;
    if (r.response !== 0) { ertelenen = v; yay({ state: 'idle' }); return; }
    ertelenen = null; onaylandi = true;
    yay({ state: 'available', version: v });
    try { await updater.downloadUpdate(); } catch (e) { if (onaylandi) hata(e); }
  }

  function kur() {
    if (durum.state !== 'ready') return false;
    cikisaIzin();
    setImmediate(() => { try { updater.quitAndInstall(false, true); } catch (e) { onaylandi = true; hata(e); } });
    return true;
  }

  updater.on('checking-for-update', () => yay({ state: 'checking' }));
  updater.on('update-not-available', () => { elle = false; yay({ state: 'latest' }); });
  updater.on('update-available', i => { sor(i && i.version); });
  updater.on('download-progress', p => yay({ state: 'downloading', version: durum.version || '', percent: Math.round(p.percent || 0) }));
  updater.on('update-downloaded', i => { yay({ state: 'ready', version: i && i.version }); if (onaylandi) kur(); });
  updater.on('error', e => { elle = false; hata(e); });

  return {
    // elleMi: "Güncellemeleri Denetle" düğmesi; "Sonra" denmiş sürüm de yeniden sorulur
    denetle: elleMi => { elle = !!elleMi; return Promise.resolve().then(() => updater.checkForUpdates()).catch(() => {}); },
    kur,
    durum: () => durum
  };
}
module.exports = { makeGuncelleme };
