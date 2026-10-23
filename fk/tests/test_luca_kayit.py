"""Luca kayıt aracını, Luca'yı taklit eden yerel bir siteyle sınar.

Giriş sitesi (localhost:P1) kaydedilmemeli; program sitesi (127.0.0.1:P2) açılır pencerede,
iframe içinde menü, açılır liste, onay diyaloğu ve indirme içerir.
"""
import functools
import json
import os
import socket
import threading
import zipfile
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

import pytest

pytest.importorskip("playwright")


def _port():
    s = socket.socket(); s.bind(("127.0.0.1", 0)); p = s.getsockname()[1]; s.close(); return p


@pytest.fixture
def siteler(tmp_path):
    p1, p2 = _port(), _port()
    giris, prog = tmp_path / "giris", tmp_path / "prog"
    giris.mkdir(); prog.mkdir()
    (giris / "index.html").write_text(f"""<!doctype html><meta charset=utf-8>
      <input id=uye name=uye><input id=sifre type=password name=parola>
      <button id=giris onclick="window.open('http://127.0.0.1:{p2}/luca.html','luca','width=900,height=700')">GİRİŞ</button>""",
                                       encoding="utf-8")
    (prog / "luca.html").write_text("""<!doctype html><meta charset=utf-8>
      <select id=firma name=firma><option value=1>ANTHILL</option><option value=2>EXPO İNŞ</option></select>
      <iframe name=icerik src="icerik.html" width=600 height=300></iframe>""", encoding="utf-8")
    (prog / "icerik.html").write_text("""<!doctype html><meta charset=utf-8>
      <ul><li><a href=# id=menuEfat onclick="return false">e-Fatura Alış Faturaları</a></li></ul>
      <input id=bas name=baslangic value="01/09/2026">
      <input type=password id=gizli name=gizli>
      <input type=password id=gib_sifre value="GOMULU-SIFRE-999">
      <input id=gib_kullanici_adi value="GOMULU-KULLANICI-777">
      <input type=checkbox class=sec id=satir1><input type=checkbox class=sec id=satir2>
      <input type=checkbox id=hepsi onclick="document.querySelectorAll('.sec').forEach(c => c.click())">
      <button id=getir onclick="confirm('Belgeler getirilsin mi?')">GİB'den Getir</button>
      <a id=indir href="ornek.zip" download>Seçilenleri İndir</a>""", encoding="utf-8")
    with zipfile.ZipFile(prog / "ornek.zip", "w") as z:
        z.writestr("a.xml", "<Invoice/>")
    sunucular = []
    for kok, port in ((giris, p1), (prog, p2)):
        h = functools.partial(SimpleHTTPRequestHandler, directory=str(kok))
        h.log_message = lambda *a, **k: None
        srv = ThreadingHTTPServer(("127.0.0.1", port), h)
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        sunucular.append(srv)
    yield f"http://localhost:{p1}/index.html", f"127.0.0.1:{p2}"
    for s in sunucular:
        s.shutdown()


def test_kayit_araci(siteler, tmp_path, monkeypatch):
    giris_url, prog_host = siteler
    monkeypatch.setenv("FK_HEADLESS", "1")
    from importlib import reload
    from fatura_kontrol.luca import kayit
    monkeypatch.setattr(kayit, "BASLANGIC", giris_url)
    monkeypatch.setattr(kayit, "KAYIT_HOST", prog_host)

    def surucu(ctx, sayfa):
        sayfa.fill("#uye", "1212207")
        sayfa.fill("#sifre", "GIZLI-SIFRE-123")
        with sayfa.expect_popup() as pp:
            sayfa.click("#giris")
        luca = pp.value
        luca.wait_for_load_state()
        sayfa.close()                                   # giriş sekmesi kapanır (Luca'daki gibi)
        yield
        yield                                           # ana döngü kapanan sekmeye rağmen sürmeli
        luca.focus("#firma"); luca.keyboard.press("ArrowDown"); yield   # gerçek kullanıcı seçimi
        fr = luca.frame(name="icerik")
        fr.click("#menuEfat"); yield
        fr.fill("#bas", "01/10/2026"); fr.press("#bas", "Tab"); yield
        fr.fill("#gizli", "IKINCI-SIFRE"); yield
        fr.click("#getir"); yield
        fr.click("#hepsi"); yield
        fr.click("#indir")
        for _ in range(6):
            yield

    zip_yol = kayit.calistir(surucu=surucu, profil=tmp_path / "profil", cikti=tmp_path / "out")
    with zipfile.ZipFile(zip_yol) as z:
        adlar = z.namelist()
        olaylar_ad = next(a for a in adlar if a.endswith("olaylar.jsonl"))
        ham = z.read(olaylar_ad).decode("utf-8")
        tum_icerik = b"".join(z.read(a) for a in adlar if not a.endswith(".png"))
    olaylar = [json.loads(s) for s in ham.splitlines()]
    turler = [o["tur"] for o in olaylar]

    # Gizlilik: giriş sayfasındaki ve program içindeki şifreler hiçbir dosyaya yazılmamalı
    assert b"GIZLI-SIFRE-123" not in tum_icerik and b"1212207" not in tum_icerik
    assert b"IKINCI-SIFRE" not in tum_icerik
    assert b"GOMULU-SIFRE-999" not in tum_icerik and b"GOMULU-KULLANICI-777" not in tum_icerik
    assert any(o["tur"] == "tik" and o.get("id") == "hepsi" for o in olaylar)
    assert not any(o.get("id") in ("satir1", "satir2") for o in olaylar)   # yapay tıklamalar yok
    assert all("localhost" not in (o.get("frame_url") or "") for o in olaylar)

    secim = next(o for o in olaylar if o["tur"] == "degisim" and o.get("id") == "firma")
    assert secim["secilen_metin"] == "EXPO İNŞ" and ["1", "ANTHILL"] in secim["secenekler"]
    menu = next(o for o in olaylar if o["tur"] == "tik" and o.get("id") == "menuEfat")
    assert menu["frame"] == "icerik" and menu["metin"] == "e-Fatura Alış Faturaları" and menu.get("ekran")
    assert any(o["tur"] == "degisim" and o.get("id") == "bas" and o["deger"] == "01/10/2026" for o in olaylar)
    assert any(o["tur"] == "diyalog" and "getirilsin" in o["mesaj"] for o in olaylar)
    assert any(o["tur"] == "indirme" and o["dosya"] == "ornek.zip" for o in olaylar)
    assert any(a.endswith("indirilenler/ornek.zip") for a in adlar)
    assert any(a.endswith("frameler.json") for a in adlar)
    assert "acilir_pencere" in turler
