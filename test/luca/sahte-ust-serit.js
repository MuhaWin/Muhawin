// Görev 44 testleri için sahte Luca ana ekranı: üstte logolu şerit (frm4), solda menü (frm2), sağda içerik (frm3).
// Yalnız require ile kullanılır (test/luca/muhawine-git.js, test/e2e.js); doğrudan çalıştırılınca bir şey yapmaz.
const http = require('http');
const LOGO = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="34"><rect width="120" height="34" rx="6" fill="#fff"/><text x="12" y="24" font-family="Arial" font-size="18" font-weight="700" fill="#1f3a6b">LUCA</text></svg>');
const SAYFA = {
  '/Luca/luca.do': '<html><head><title>LUCA</title></head><frameset rows="56,*" border="0"><frame name="frm4" src="TopFrameAction.do" scrolling="no"><frameset cols="200,*"><frame name="frm2" src="menu.do"><frame name="frm3" src="bos.do"></frameset></frameset></html>',
  '/Luca/TopFrameAction.do': `<html><body style="margin:0;height:56px;background:#1f3a6b;font:13px Arial;color:#fff;overflow:hidden">
    <img id="lucaLogo" src="${LOGO}" style="position:absolute;left:10px;top:11px;width:120px;height:34px" alt="Luca">
    <span style="position:absolute;left:140px;top:20px">Mali Müşavir Paketi</span>
    <div style="position:absolute;right:10px;top:14px;display:flex;gap:8px;align-items:center">
      <select id="firma" style="width:240px"><option>EXPO İNŞ</option></select><select id="donem" style="width:120px"><option>2026</option></select>
      <a href="#" id="cikis" style="color:#fff" onclick="window.__cikis=(window.__cikis||0)+1;return false">Çıkış</a></div></body></html>`,
  '/Luca/menu.do': '<html><body style="margin:0;font:13px Arial"><ul><li><a href="bos.do" target="frm3">Fiş Listesi</a></li><li><a href="bos.do?b=2" target="frm3">Muavin</a></li></ul></body></html>',
  '/Luca/bos.do': '<html><body style="font:13px Arial"><h3>Luca içerik</h3><p>Fiş listesi burada.</p></body></html>',
  // çerçevesiz sayfa: şerit sayfanın kendisinde
  '/Luca/tek.do': `<html><head><title>LUCA</title></head><body style="margin:0;font:13px Arial"><div style="height:56px;background:#1f3a6b;position:relative">
    <img src="${LOGO}" style="position:absolute;left:10px;top:11px;width:120px;height:34px" alt="Luca"><a href="#" style="position:absolute;right:12px;top:20px;color:#fff">Çıkış</a></div><p>İçerik</p></body></html>`
};
function baslat() {
  return new Promise(res => { const s = http.createServer((q, r) => { const u = new URL(q.url, 'http://x'); const h = SAYFA[u.pathname];
    r.writeHead(h ? 200 : 404, { 'Content-Type': 'text/html; charset=utf-8' }); r.end(h || 'yok'); });
    s.listen(0, '127.0.0.1', () => res({ url: 'http://127.0.0.1:' + s.address().port, kapat: () => s.close() })); });
}
module.exports = { baslat };
