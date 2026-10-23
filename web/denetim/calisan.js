/* MuhaWin sitesi · Denetim: tarayıcıdaki Python (Pyodide) çalışanı.
   Pyodide, wheel'ler ve fatura_kontrol paketi bu siteden yüklenir (CDN yok). Veriler /veri altında, tarayıcının
   IndexedDB'sinde kalır (bu bilgisayar, bu tarayıcı); ağa gönderilmez. */
'use strict';
importScripts('pyodide/pyodide.js');

let py = null, kopruCagir = null, kayitSira = Promise.resolve();
const ilerleme = metin => postMessage({ tip: 'ilerleme', metin });

// IndexedDB'ye yazma: üst üste gelen istekler sırayla yazılır
const kaydet = () => (kayitSira = kayitSira.then(() => new Promise(c => py.FS.syncfs(false, () => c()))));

async function baslat() {
  ilerleme('Muhasebe Denetimi indiriliyor… (ilk açılışta biraz sürer)');
  const paket = await (await fetch('py/paket.json', { cache: 'no-cache' })).json();
  py = await loadPyodide({ indexURL: new URL('pyodide/', location.href).href, env: { FK_VERI: '/veri', FK_BILDIRIM_URL: '' } });
  ilerleme('Muhasebe Denetimi kuruluyor…');
  const al = async ad => new Uint8Array(await (await fetch('py/' + ad + '?s=' + paket.surum)).arrayBuffer());
  for (const w of paket.wheels) py.unpackArchive(await al(w), 'wheel');
  py.FS.mkdirTree('/kod');
  py.unpackArchive(await al(paket.paket), 'zip', { extractDir: '/kod' });
  py.FS.writeFile('/kod/kopru.py', await al('kopru.py'));
  py.FS.mkdirTree('/veri');
  py.FS.mount(py.FS.filesystems.IDBFS, {}, '/veri');
  await new Promise((c, r) => py.FS.syncfs(true, e => (e ? r(e) : c())));
  py.runPython("import os, sys; os.environ['FK_VERI'] = '/veri'; os.environ['FK_BILDIRIM_URL'] = ''; sys.path.insert(0, '/kod')");
  const kopru = py.pyimport('kopru');
  kopru.yukle();
  kopruCagir = kopru.cagir;
  postMessage({ tip: 'hazir' });
}

const hazir = baslat().catch(e => { postMessage({ tip: 'hata', metin: String(e && e.message || e).split('\n').slice(-2).join(' ') }); throw e; });

onmessage = async e => {
  const m = e.data;
  if (m.tip !== 'istek') return;
  let yanit;
  try {
    await hazir;
    const i = m.istek;
    const sonuc = await kopruCagir(i.yontem, i.yol, py.toPy(i.sorgu), i.govde == null ? null : py.toPy(i.govde), py.toPy(i.form));
    const j = sonuc.toJs({ dict_converter: Object.fromEntries });
    sonuc.destroy();
    yanit = { durum: j.durum, tur: j.tur, medya: j.medya, dosya_adi: j.dosya_adi, govde: j.govde };
    if (i.yontem !== 'GET') await kaydet();
  } catch (x) {
    yanit = { durum: 500, tur: 'metin', medya: 'application/json', govde: JSON.stringify({ detail: 'Denetim motoru hatası: ' + String(x && x.message || x).split('\n').slice(-3).join(' ') }) };
  }
  postMessage({ tip: 'yanit', no: m.no, yanit }, yanit.govde instanceof Uint8Array ? [yanit.govde.buffer] : []);
};
