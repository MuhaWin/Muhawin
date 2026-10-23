"""Luca'yı taklit eden yerel test sitesi (kayıt aracından çıkarılan yapıya göre).

Durum, tarayıcının sessionStorage'ında tutulur; sunucu yalnızca statik dosya verir.
"""
from __future__ import annotations

import functools
import shutil
import socket
import threading
import zipfile
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

GIRIS = """<!doctype html><meta charset=utf-8><title>Luca</title>
<input id=uye><input type=password id=sifre>
<button id=giris onclick="window.open('/Luca/luca.do','luca','width=1200,height=800')">Sistem Giriş</button>"""

# Gerçek akış: www.luca.com.tr → Sistem Giriş (açılır pencere) → giris.erp → captcha → main.erp → paket → luca.do
GIRIS2 = """<!doctype html><meta charset=utf-8><title>Luca</title>
<a href="#" id=sistemGiris onclick="window.open('/LUCASSO/giris.erp','agiris','width=600,height=500');return false">Sistem Giriş</a>"""

SSO_GIRIS = """<!doctype html><meta charset=utf-8><title>Luca Giriş</title>
<table><tr><td>Üye Numarası</td><td><input id=j_uye name=uyeNo></td></tr>
<tr><td>Kullanıcı Adı</td><td><input id=j_kul name=kullaniciAdi></td></tr>
<tr><td>Parola</td><td><input type=password id=j_par name=parola></td></tr></table>
<button id=girisBtn onclick="gir()">GİRİŞ</button>
<div id=cap style="display:none">Güvenlik Kodu <img alt=captcha width=80 height=20>
  <input id=guvenlikKodu name=captchaText><button id=tamamBtn onclick="tamam()">Tamam</button></div>
<script>
function gir() {
  localStorage.setItem('giris', JSON.stringify([j_uye.value, j_kul.value, j_par.value]));
  document.getElementById('cap').style.display = 'block';
}
function tamam() {
  if (guvenlikKodu.value !== '7K3P') { document.title = 'hatali'; return; }
  location = 'main.erp';
}
guvenlikKodu.addEventListener('keydown', e => { if (e.key === 'Enter') tamam(); });
</script>"""

SSO_MAIN = """<!doctype html><meta charset=utf-8><title>Luca</title>
<div style="padding:20px;border:1px solid #ccc;cursor:pointer" onclick="window.open('/Luca/luca.do','luca'); if (!location.search.includes('acik')) setTimeout(() => window.close(), 300)">LUCA MALİ MÜŞAVİR PAKETİ</div>"""

LUCA = """<!doctype html><meta charset=utf-8><title>LUCA</title>
<iframe name=frm1 src="headerFrame.do"></iframe>
<iframe name=frm2 src="menu.do"></iframe>
<iframe name=frm4 src="TopFrameAction.do"></iframe>
<iframe name=frm3 src="musteriBilgileri.do" width=1100 height=700></iframe>
<iframe name=frm5 src="YMFrameAction.do"></iframe>"""

MENU = """<!doctype html><meta charset=utf-8>
<style>ul{list-style:none;margin:0;padding:0} li{position:relative;padding:3px 8px;white-space:nowrap;background:#eef}
li>ul{display:none;position:absolute;left:100%;top:0} li:hover>ul{display:block} #ust>li{display:inline-block}
#ust>li>ul{left:0;top:100%}</style>
<ul id=ust><li><span id=apy1000m0i0ITD>Muhasebe</span><ul><li>Fişler</li>
 <li><span>Raporlar</span><ul><li>Mizan</li>
  <li><span>Defterler</span><ul>
   <li><span>Nokta Vuruşlu</span><ul><li><span onclick="sessionStorage.setItem('yanlis','nokta')">Muavin Defter</span></li></ul></li>
   <li><span>Tüm Yazıcılar</span><ul><li><span onclick="top.frames['frm3'].location='raporMizanDetayHazirla.do?menu=1'">Muavin Defter</span></li></ul></li>
  </ul></li></ul></li></ul></li></ul>
<script>var m = [["||e-Fatura Alış Faturaları","gib530.do?tur=gib_efatura_alis&c_musteri_id=1212207"]];</script>"""

YM = """<!doctype html><meta charset=utf-8><div>Sık kullanılanlar: <span>Raporlar</span> ·
<span onclick="sessionStorage.setItem('yanlis','sag')">Muavin Defter</span></div>"""

HATA = """<!doctype html><meta charset=utf-8><title>LUCA HATA</title><h3>LUCA HATA</h3>
<p>Lütfen https://www.luca.com.tr adresinden giriş yapınız.</p>"""

TOP = """<!doctype html><meta charset=utf-8>
<select id=SirketCombo name=SirketCombo onchange="location='TopFrameAction.do?SIRKET_ID='+this.value">
  <option value="">   </option><option value=110304730>BANKOĞLU M</option><option value=110198728>EXPO İNŞ</option><option value=1>EXPO İNŞ ESKİ</option>
</select>
<select id=DonemCombo><option value=1>01/01/2025 - 31/12/2025</option><option value=2>01/01/2026 - 31/12/2026</option></select>
<table><tr><td id=SirName></td></tr></table>
<script>
const ss = sessionStorage, q = new URLSearchParams(location.search);
const aktif = ss.getItem('firma') || '110304730';
const sec = q.get('SIRKET_ID') || aktif;
document.getElementById('SirketCombo').value = sec;
document.getElementById('DonemCombo').value = ss.getItem('donem') || '1';
document.getElementById('DonemCombo').onchange = e => { ss.setItem('donemBekleyen', e.target.value); goster(); };
function goster() {
  document.getElementById('SirName').innerHTML = '<button class="no-bold green" onclick="formSubmit(event,0)">Tamam</button>';
}
if (q.get('SIRKET_ID')) goster();
function formSubmit() {
  ss.setItem('firma', sec);
  if (ss.getItem('donemBekleyen')) { ss.setItem('donem', ss.getItem('donemBekleyen')); ss.removeItem('donemBekleyen'); }
  top.frames['frm3'].location = 'musteriBilgileri.do';
  location = 'TopFrameAction.do';
}
</script>"""

MUSTERI = """<!doctype html><meta charset=utf-8><div id=bilgi></div><script>
const f = sessionStorage.getItem('firma') || '110304730';
const vkn = f === '110198728' ? '3810463613' : '1111111111';
const yil = sessionStorage.getItem('donem') === '2' ? 2026 : 2025;
document.getElementById('bilgi').innerText = 'Şu an FİRMA şirketinin 01/01/' + yil + '-31/12/' + yil + ' döneminde çalışıyorsunuz! Vergi No: ' + vkn;
</script>"""

GIB530 = r"""<!doctype html><meta charset=utf-8>
<script>
const ss = sessionStorage, q = new URLSearchParams(location.search);
var menu_tur = q.get('tur'), sirket_id = +(ss.getItem('firma') || 0), kisa_ad = 'EXPO İNŞ';
const SAYFA_BOYU = 2;
const VERI = %VERI%;    // tur -> satır sayısı
function kayit(k, v) { const l = JSON.parse(ss.getItem('log') || '[]'); l.push([k, v]); ss.setItem('log', JSON.stringify(l)); }
</script>
<div id=araclar></div>
<table class="tab-1"><thead><tr><td><input type=checkbox class=hepsi onclick='hepsi(this, ".tab-1 .sec")'></td></tr></thead><tbody id=liste></tbody></table>
<input type=checkbox class=hepsi onclick='hepsi(this, ".fisler .sec")'>
<div id=indir-window style="display:none">
  <input type=text id=gib_kullanici_adi value="GIZLI-KULLANICI"><input type=password id=gib_sifre value="GIZLI-SIFRE">
  <input id=tarih1><input id=tarih2>
  <input type=checkbox id=geceSorgula class="geceSorgula hidden" style="display:none">
  <button type=button onclick="gonder('indir')" id=faturalari-getir-btn>Belgeleri Getir</button>
</div>
<div id=zip-window style="display:none"><button type=button onclick="gonder('zip')" id=zip-btn>Seçilenleri İndir</button>
  <button type=button onclick="hide_window()" class=red-btn>Kapat</button></div>
<div id=luca-board style="display:none"><pre id=log></pre><div class="p-4 align-right"><button type=button onclick="this.closest('#luca-board').style.display='none'">Kapat</button></div></div>
<script>
const getirildi = ss.getItem('getir_' + menu_tur);
if (!ss.getItem('sayfa_gecis')) ss.removeItem('sayfa_' + menu_tur);   // ekran yeniden açılınca 1. sayfa
ss.removeItem('sayfa_gecis');
const sayfa_no = +(ss.getItem('sayfa_' + menu_tur) || 1);
document.getElementById('araclar').innerHTML = `
  <button type=button class="gib_530-item ${menu_tur}-item" onclick="gonder('indir-window')">GİB'den Getir</button>
  <button type=button onclick="gonder('zip-window')">Seçilenleri İndir</button>
  <button type=button onclick="yenile()">Yenile</button>
  <button type=button onclick="sayfa(+1)">></button>
  <button type=button id=sil-btn onclick="gonder('sil')" class=red-btn>Belge Sil</button>
  <button type=button id=muhasebelestir-btn onclick="gonder('kdv-window')">Muhasebeleştir</button>`;
const toplam = getirildi ? (VERI[menu_tur] || 0) : 0;
const bas = (sayfa_no - 1) * SAYFA_BOYU;
let html = '';
for (let i = bas; i < Math.min(toplam, bas + SAYFA_BOYU); i++)
  html += `<tr><td><input type=checkbox class="sec spacekey-toggle-checked"></td><td>BELGE-${menu_tur}-${i}</td></tr>`;
document.getElementById('liste').innerHTML = html;
if (!toplam) {
  const m = document.createElement('div');
  m.id = 'modal';
  m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.3);z-index:99';
  m.innerHTML = '<div style="background:#fff;margin:200px auto;width:400px">Her hangi bir fatura bulunamadı.' +
    '<button onclick="this.closest(\'#modal\').remove()">Tamam</button><button onclick="kayit(\'YASAK\',\'iptal\')">İptal</button></div>';
  document.body.appendChild(m);
}
function hepsi(c, s) { document.querySelectorAll(s).forEach(x => { if (x.checked !== c.checked) x.click(); }); }
function yenile() { ss.setItem('sayfa_gecis', '1'); location.reload(); }
function sayfa(d) { const n = sayfa_no + d; if ((n - 1) * SAYFA_BOYU < toplam && n >= 1) { ss.setItem('sayfa_' + menu_tur, n); ss.setItem('sayfa_gecis', '1'); location.reload(); } else { ss.setItem('sayfa_gecis', '1'); location.reload(); } }
function hide_window() { document.getElementById('zip-window').style.display = 'none'; }
function gonder(n) {
  if (n === 'indir-window') document.getElementById('indir-window').style.display = 'block';
  if (n === 'sil' || n === 'kdv-window') { kayit('YASAK', n); alert('silindi'); }
  if (n === 'indir') {
    kayit('getir', [menu_tur, document.getElementById('tarih1').value, document.getElementById('tarih2').value, sirket_id]);
    document.getElementById('indir-window').style.display = 'none';
    const b = document.getElementById('luca-board'); b.style.display = 'block';
    const log = document.getElementById('log'); log.textContent = 'Belgeler sorgulanıyor...';
    if (menu_tur === 'gib_ebelge_satis') return;          // hiç bitmeyen sorgu
    if (menu_tur === 'gib_efatura_alis' && !ss.getItem('uzun_yapildi')) {   // UKİ MADEN: uzun sorgu + GİB uyarıları
      ss.setItem('uzun_yapildi', '1');
      b.style.cssText = 'display:block;position:fixed;inset:20px;background:#fff;z-index:98';   // listeyi örter
      setTimeout(() => { log.textContent += '\nSorgulama Tarihi: 26/09/2026 Hata mesajı: Belirtilen tarih aralığında fatura bulunamadı.'; }, 400);
      setTimeout(() => { const t = document.createElement('div'); t.className = 'toast';
        t.style.cssText = 'position:fixed;right:0;bottom:0;z-index:100;background:#fdd';
        t.textContent = 'Sorgulama Tarihi: 27/09/2026 Hata mesajı: Belirtilen tarih aralığında fatura bulunamadı.';
        document.body.appendChild(t); setTimeout(() => t.remove(), 6000); }, 600);
      setTimeout(() => { log.textContent += '\n[OK] ' + (VERI[menu_tur] || 0) + ' adet belge kaydı bulundu.\nFatura kaydetme işlemi sona erdi.'; ss.setItem('getir_' + menu_tur, '1'); }, 7000);
      return;
    }
    if (menu_tur === 'gib_ebelge_alis') {                  // sorgu sırasında 'bulunamadı' penceresi (Nail Karat)
      setTimeout(() => {
        b.style.display = 'none';
        const m = document.createElement('div'); m.id = 'confirm_window';
        m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.3);z-index:99';
        m.innerHTML = '<div style="background:#fff;margin:200px auto;width:400px">Her hangi bir fatura bulunamadı.' +
          '<div class=buttons><button class=green onclick="this.closest(\'#confirm_window\').remove()">Tamam</button>' +
          '<button class=red onclick="kayit(\'YASAK\',\'iptal\')">İptal</button></div></div>';
        document.body.appendChild(m);
      }, 1500);
      return;
    }
    setTimeout(() => { log.textContent += '\nBelgeler sorgulandı (01/09/2026)'; }, 800);
    setTimeout(() => { log.textContent += '\n[OK] ' + (VERI[menu_tur] || 0) + ' adet belge kaydı bulundu.\nFatura kaydetme işlemi sona erdi.'; ss.setItem('getir_' + menu_tur, '1'); }, 1600);
  }
  if (n === 'zip-window') {
    if (!document.querySelectorAll('.tab-1 .sec:checked').length) { alert('Belge seçiniz'); return; }
    document.getElementById('zip-window').style.display = 'block';
  }
  if (n === 'zip') {
    kayit('zip', [menu_tur, sayfa_no, document.querySelectorAll('.tab-1 .sec:checked').length]);
    const a = document.createElement('a'); a.href = 'dl/' + menu_tur + '_' + sayfa_no + '.zip'; a.download = 'expo_ins-16102026.zip';
    document.body.appendChild(a); a.click();
  }
}
</script>"""

MUAVIN = """<!doctype html><meta charset=utf-8><div style="display:none"><input id=hesap_kodu_ilk><input id=hesap_kodu_son></div>
<table class="form_table luca-form">
<tr><th>Başlangıç Hesap Kodu</th><td><input id=hesap_kodu_ilk></td><th>Bitiş Hesap Kodu</th><td><input id=hesap_kodu_son></td></tr>
<tr><th>Rapor Türü</th><td><select name=raporTuru><option>PDF</option><option>Excel Liste (xlsx)</option></select></td></tr>
<tr class="altBar"><th><table><tr><td class=right><button class="green bold" onclick="gonder()">Rapor</button></td></tr></table></th></tr></table>
<script>
if (!location.search.includes('menu=1') || localStorage.getItem('dusur')) {
  localStorage.removeItem('dusur'); top.location = '/Luca/hata.do';
}
function gonder() {
  const s = document.querySelector('select[name=raporTuru]');
  const g = id => [...document.querySelectorAll('#' + id)].pop().value;   // görünür (ikinci) kutu
  const ok = g('hesap_kodu_ilk') === '100' && g('hesap_kodu_son') === '999' && /Excel/.test(s.options[s.selectedIndex].text);
  if (!ok) { alert('Hatalı parametre'); return; }
  setTimeout(() => { const a = document.createElement('a'); a.href = 'dl/muavin.xlsx'; a.download = 'muavin_expo_ins.xlsx'; document.body.appendChild(a); a.click(); }, 1200);
}
</script>"""


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, ".do": "text/html; charset=utf-8",
                      ".erp": "text/html; charset=utf-8"}

    def log_message(self, *a):
        pass


def _port():
    s = socket.socket(); s.bind(("127.0.0.1", 0)); p = s.getsockname()[1]; s.close(); return p


def site_kur(kok: Path, xmller: dict[str, list[bytes]], muavin: Path, veri: dict[str, int]):
    """xmller: dosya adı -> içerik listesi; örn. {'gib_efatura_alis_1.zip': [xml, xml]}"""
    (kok / "Luca" / "dl").mkdir(parents=True)
    (kok / "index.html").write_text(GIRIS, encoding="utf-8")
    (kok / "giris2.html").write_text(GIRIS2, encoding="utf-8")
    (kok / "LUCASSO").mkdir()
    (kok / "LUCASSO" / "giris.erp").write_text(SSO_GIRIS, encoding="utf-8")
    (kok / "LUCASSO" / "main.erp").write_text(SSO_MAIN, encoding="utf-8")
    L = kok / "Luca"
    for ad, icerik in {"luca.do": LUCA, "menu.do": MENU, "TopFrameAction.do": TOP, "headerFrame.do": "<p>luca",
                       "YMFrameAction.do": YM, "hata.do": HATA, "musteriBilgileri.do": MUSTERI,
                       "gib530.do": GIB530.replace("%VERI%", __import__("json").dumps(veri)),
                       "raporMizanDetayHazirla.do": MUAVIN}.items():
        (L / ad).write_text(icerik, encoding="utf-8")
    for ad, liste in xmller.items():
        with zipfile.ZipFile(L / "dl" / ad, "w") as z:
            for i, x in enumerate(liste):
                z.writestr(f"{i}.xml", x)
    shutil.copy(muavin, L / "dl" / "muavin.xlsx")
    port = _port()
    srv = ThreadingHTTPServer(("127.0.0.1", port), functools.partial(Handler, directory=str(kok)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, f"http://127.0.0.1:{port}/index.html"
