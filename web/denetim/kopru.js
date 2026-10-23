/* MuhaWin sitesi · Denetim: sayfa ile tarayıcıdaki Python (calisan.js) arasındaki köprü.
   Sayfa (fk/fatura_kontrol/web/static/denetim.html'in kopyası) /api/... adreslerine istek atar; burada yakalanıp
   Worker'a verilir. Hiçbir belge ağa çıkmaz. HTML yanıtlar (fiş, fatura, çıktı raporu) ayrı pencerede, kum
   havuzlu (sandbox) bir çerçevede açılır: faturayla gelen şablon bu sitenin oturumuna erişemez. */
'use strict';
(function () {
  const asilFetch = window.fetch.bind(window), asilAc = window.open.bind(window);
  const bekleyen = new Map();
  let sira = 0, hazirCoz, hazirRed;
  const hazir = new Promise((c, r) => { hazirCoz = c; hazirRed = r; });
  const calisan = new Worker('calisan.js');

  calisan.onmessage = e => {
    const m = e.data;
    if (m.tip === 'hazir') { hazirCoz(); durumYaz(''); return; }
    if (m.tip === 'ilerleme') { durumYaz(m.metin); return; }
    if (m.tip === 'hata') { hazirRed(new Error(m.metin)); durumYaz('Denetim motoru açılamadı: ' + m.metin, true); return; }
    const b = bekleyen.get(m.no); if (!b) return;
    bekleyen.delete(m.no); b(m.yanit);
  };

  // ---- üst şerit: hazırlanıyor / hata
  let serit = null;
  function durumYaz(metin, hata) {
    if (!serit) {
      serit = document.createElement('div');
      serit.style.cssText = 'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:99;padding:8px 14px;border-radius:8px;font:13px system-ui,Segoe UI,Arial;box-shadow:0 4px 16px rgba(0,0,0,.2)';
      (document.body || document.documentElement).appendChild(serit);
    }
    serit.hidden = !metin;
    serit.textContent = metin;
    serit.style.background = hata ? '#fde7e7' : '#16325C'; serit.style.color = hata ? '#a3262c' : '#fff';
  }
  document.addEventListener('DOMContentLoaded', () => { if (!serit) durumYaz('Denetim motoru hazırlanıyor…'); });

  const apiMi = u => u.origin === location.origin && u.pathname.startsWith('/api/');

  async function istekHazirla(girdi, ayar = {}) {
    const istek = girdi instanceof Request ? girdi : null;
    const u = new URL(istek ? istek.url : String(girdi), location.href);
    const yontem = String(ayar.method || (istek && istek.method) || 'GET').toUpperCase();
    const govdeKaynak = ayar.body !== undefined ? ayar.body : null;
    let govde = null; const form = {}, aktar = [];
    if (govdeKaynak instanceof FormData) {
      for (const [ad, d] of govdeKaynak.entries()) {
        (form[ad] = form[ad] || []);
        if (d instanceof File) { const veri = await d.arrayBuffer(); aktar.push(veri); form[ad].push({ ad: d.name, veri }); }
        else form[ad].push(String(d));
      }
    } else if (typeof govdeKaynak === 'string' && govdeKaynak) {
      try { govde = JSON.parse(govdeKaynak); } catch (e) { govde = null; }
    }
    return { yontem, yol: u.pathname, sorgu: Object.fromEntries(u.searchParams), govde, form, aktar };
  }

  async function gonder(girdi, ayar) {
    const i = await istekHazirla(girdi, ayar);
    await hazir;
    const no = ++sira;
    const p = new Promise(c => bekleyen.set(no, c));
    calisan.postMessage({ tip: 'istek', no, istek: { yontem: i.yontem, yol: i.yol, sorgu: i.sorgu, govde: i.govde, form: i.form } }, i.aktar);
    return p;
  }

  window.fetch = async (girdi, ayar) => {
    const u = new URL(girdi instanceof Request ? girdi.url : String(girdi), location.href);
    if (!apiMi(u)) return asilFetch(girdi, ayar);
    const y = await gonder(girdi, ayar);
    return new Response(y.govde, { status: y.durum, headers: { 'Content-Type': y.medya || 'application/octet-stream' } });
  };

  // ---- dosya indirme ve HTML görüntüleme
  function indir(y, varsayilanAd) {
    const blob = new Blob([y.govde], { type: y.medya || 'application/octet-stream' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = y.dosya_adi || varsayilanAd || 'dosya';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  }
  const kacir = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  function goster(pencere, y) {
    if (!pencere) { alert('Açılır pencere engellendi. Bu site için açılır pencerelere izin verin.'); return; }
    const icerik = y.durum >= 400 ? `<p style="font:14px system-ui;padding:20px;color:#a3262c">${kacir((() => { try { return JSON.parse(y.govde).detail; } catch (e) { return y.govde; } })())}</p>` : String(y.govde);
    pencere.document.open();
    pencere.document.write(`<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>MuhaWin</title>
<style>html,body{margin:0;height:100%}iframe{border:0;width:100%;height:100%;display:block}</style></head>
<body><iframe sandbox="allow-scripts allow-modals" srcdoc="${kacir(icerik)}"></iframe></body></html>`);
    pencere.document.close();
  }
  async function ac(adres, pencere) {
    const u = new URL(adres, location.href);
    if (!apiMi(u)) {
      // /beyanname?id=… → bu klasördeki beyanname.html
      if (u.origin === location.origin && u.pathname === '/beyanname') { const h = new URL('beyanname.html' + u.search, location.href).href; if (pencere) pencere.location = h; else location.href = h; return; }
      if (pencere) pencere.location = u.href; else location.href = u.href; return;
    }
    const y = await gonder(u.href);
    if (y.tur === 'dosya' && y.durum < 400) { if (pencere) pencere.close(); indir(y, u.pathname.split('/').pop()); return; }
    if (/html/.test(y.medya || '') || y.durum >= 400) { goster(pencere || asilAc('', '_blank'), y); return; }
    if (pencere) pencere.close();
    indir(y, u.pathname.split('/').pop());
  }

  window.open = (adres, hedef, ozellik) => {
    if (adres == null || adres === '') return asilAc(adres, hedef, ozellik);
    const u = new URL(String(adres), location.href);
    if (u.origin !== location.origin || !(u.pathname.startsWith('/api/') || u.pathname === '/beyanname')) return asilAc(adres, hedef, ozellik);
    const p = asilAc('', '_blank');           // tıklama anında açılır (açılır pencere engeli)
    if (p) p.document.write('<p style="font:14px system-ui;padding:20px">Hazırlanıyor…</p>');
    ac(u.href, p);
    return p;
  };

  document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.button !== 0) return;
    const u = new URL(a.getAttribute('href'), location.href);
    if (!apiMi(u)) return;
    e.preventDefault();
    if (a.target === '_blank') window.open(u.href, '_blank'); else ac(u.href, null);
  }, true);

  // location.href = "/api/…" yerine (derleme sırasında sayfada bu ada çevrilir)
  window.MW_KOPRU = { set git(adres) { ac(adres, null); } };

  // ---- firma listesi: programda MuhaWin verir; burada önceki denetimlerden ve elle eklenen adlardan kurulur
  const FIRMA_ANAHTAR = 'mw-denetim-firmalar';
  const elleOku = () => { try { return JSON.parse(localStorage.getItem(FIRMA_ANAHTAR) || '[]'); } catch (e) { return []; } };
  const elleYaz = L => { try { localStorage.setItem(FIRMA_ANAHTAR, JSON.stringify(L)); } catch (e) {} };
  async function firmalariGonder(sec) {
    let liste = [];
    try { liste = (await (await window.fetch('/api/denetim/liste')).json()).liste || []; } catch (e) {}
    const g = new Map();
    const ekle = (ad, vkn) => { ad = String(ad || '').trim(); const k = ad.toLocaleUpperCase('tr-TR'); if (ad && !g.has(k)) g.set(k, { mw: ad, ad, vkn: vkn || '' }); };
    liste.forEach(x => ekle(x.firma, x.vkn)); elleOku().forEach(x => ekle(x));
    const L = [...g.values()].sort((a, b) => a.ad.localeCompare(b.ad, 'tr'));
    window.postMessage({ muhawin: true, tip: 'firma', liste: L, mw: sec || (document.querySelector('#firma') || {}).value || '' }, location.origin);
  }
  function firmaEklemeKur() {
    const sec = document.querySelector('#firma'); if (!sec) return;
    const kutu = document.createElement('div');
    kutu.style.cssText = 'display:flex;gap:6px;margin-top:6px';
    kutu.innerHTML = '<input id="mwYeniFirma" placeholder="Yeni firma adı" aria-label="Yeni firma adı" style="flex:1"><button type="button" class="btn" id="mwFirmaEkle">Ekle</button>';
    sec.after(kutu);
    const ipucu = kutu.nextElementSibling;
    if (ipucu && ipucu.classList.contains('ipucu')) ipucu.textContent = 'Firmayı seçin ya da adını yazıp ekleyin. Belgeler ve raporlar yalnız bu tarayıcıda saklanır.';
    const ekle = () => { const ad = document.querySelector('#mwYeniFirma').value.trim(); if (!ad) return; const L = elleOku(); if (!L.includes(ad)) { L.push(ad); elleYaz(L); } document.querySelector('#mwYeniFirma').value = ''; firmalariGonder(ad).then(() => sec.dispatchEvent(new Event('change'))); };
    document.querySelector('#mwFirmaEkle').onclick = ekle;
    document.querySelector('#mwYeniFirma').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); ekle(); } });
    // denetim bitince liste yenilensin (yeni firma VKN'den bulunmuş olabilir)
    const basla = document.querySelector('#basla');
    if (basla) new MutationObserver(() => { if (!basla.disabled) firmalariGonder(); }).observe(basla, { attributes: true, attributeFilter: ['disabled'] });
  }

  // ---- giriş ve izin; üst çubukta e-posta ve çıkış
  function kapat(metin) {
    const k = document.createElement('div');
    k.style.cssText = 'position:fixed;inset:0;z-index:100;display:grid;place-items:center;background:rgba(15,23,38,.6);font:15px system-ui,Segoe UI,Arial';
    k.innerHTML = '<div style="background:#fff;color:#172033;max-width:440px;margin:16px;padding:24px;border-radius:12px"><b style="font-size:17px">Denetime erişim yok</b><p></p><p><a href="/">Ana sayfa</a> · <a href="#" id="mwCikis2">Başka hesapla giriş</a></p></div>';
    k.querySelector('p').textContent = metin;
    document.body.appendChild(k);
    k.querySelector('#mwCikis2').onclick = async e => { e.preventDefault(); await Oturum.cikis(); location.href = '/giris.html?geri=' + encodeURIComponent(location.pathname); };
  }
  function ustCubuk() {
    const h = document.querySelector('header'); if (!h) return;
    const s = document.createElement('span');
    s.style.cssText = 'margin-left:auto;display:flex;gap:10px;align-items:center;font-size:12.5px';
    s.innerHTML = '<span id="mwEposta"></span><button type="button" class="btn" id="mwCikis" style="min-height:28px;background:transparent;border-color:rgba(255,255,255,.55);color:inherit">Çıkış</button>';
    h.appendChild(s);
    s.querySelector('#mwEposta').textContent = Oturum.eposta();
    s.querySelector('#mwCikis').onclick = async () => { await Oturum.cikis(); location.href = '/giris.html'; };
  }
  document.addEventListener('DOMContentLoaded', async () => {
    let izin;
    try { izin = await Oturum.gerekli({ ozel: 'mikro' }); } catch (e) { izin = { izin: false, neden: e.message }; }
    ustCubuk();
    if (!izin.izin) { kapat(izin.neden); calisan.terminate(); return; }
    firmaEklemeKur();
    hazir.then(() => firmalariGonder()).catch(() => {});
  });
})();
