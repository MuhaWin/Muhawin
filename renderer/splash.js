// MuhaWin açılış ekranı: sürüm yazısı ve ana sürecin çağırdığı setDurum (Görev 28: satır içi betikten ayrıldı, CSP'de 'unsafe-inline' yok)
const m = location.hash.match(/v=([\w.\-]+)/);
document.getElementById('v').textContent = 'Sürüm ' + (m ? m[1] : '');
// ana süreç çağırır: setDurum('Arayüz yükleniyor…', 40)
window.setDurum = (metin, yuzde) => {
  if (metin) document.getElementById('d').textContent = metin;
  const p = Math.max(0, Math.min(100, yuzde | 0));
  document.getElementById('b').style.width = p + '%';
  document.getElementById('y').textContent = '%' + p;
  document.querySelector('.bar').setAttribute('aria-valuenow', p);
};
setDurum('Program başlatılıyor…', 8);
