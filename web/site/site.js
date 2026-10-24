/* MuhaWin tanıtım sitesi: indirme bağlantısı ve son sürümün notları (önceki sürümler gösterilmez).
   surum.json (tools/site_uret.js) her zaman okunur; GitHub'daki son sürüm erişilebilirse indirme onunla güncellenir. */
'use strict';
(function () {
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const mb = n => (n / 1048576).toFixed(0) + ' MB';

  $('#yil').textContent = new Date().getFullYear();

  function indirmeyiYaz(surum, url, dosya, boyut) {
    if (url) $('#indirDugme').href = url;
    if (surum) $('#indirSurum').textContent = 'Sürüm ' + surum;
    if (dosya) $('#dosyaAdi').textContent = dosya;
    if (boyut) $('#indirBoyut').textContent = mb(boyut);
  }

  function notlariYaz(notlar) {
    const n = notlar && notlar[0];
    if (!n) { $('#notlar').innerHTML = '<p class="not">Sürüm notu bulunamadı.</p>'; return; }
    $('#notlar').innerHTML = `<article class="surum-notu">
      <h3>MuhaWin ${esc(n.surum)}<small>son sürüm</small></h3>
      <ul>${n.maddeler.map(m => `<li>${esc(m.metin)}${m.alt.length ? `<ul>${m.alt.map(a => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}</li>`).join('')}</ul>
    </article>`;
  }

  async function githubSonSurum(depo) {
    const r = await fetch(`https://api.github.com/repos/${depo}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } });
    if (!r.ok) throw new Error('GitHub ' + r.status);
    const j = await r.json();
    const exe = (j.assets || []).find(a => /\.exe$/i.test(a.name) && !/blockmap/i.test(a.name));
    if (!exe) throw new Error('kurulum dosyası yok');
    return { surum: String(j.tag_name || '').replace(/^v/, ''), url: exe.browser_download_url, dosya: exe.name, boyut: exe.size };
  }

  fetch('surum.json', { cache: 'no-cache' })
    .then(r => r.json())
    .then(v => {
      indirmeyiYaz(v.surum, null, v.dosya);
      notlariYaz(v.notlar);
      if (v.yakinda && v.yakinda.length) $('#yakinda').textContent = 'Yakında: ' + v.yakinda.join(' · ');
      if (v.depo) {
        $('#indirDugme').href = `https://github.com/${v.depo}/releases/latest`;
        return githubSonSurum(v.depo)
          .then(s => indirmeyiYaz(s.surum, s.url, s.dosya, s.boyut))
          .catch(() => { if (v.indir) $('#indirDugme').href = v.indir; });
      }
    })
    .catch(() => notlariYaz([]));
})();
