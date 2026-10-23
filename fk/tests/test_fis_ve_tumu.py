"""Görev 19: rapordaki fiş numarasına tıklayınca fiş açılır; Toplu kontrol › Sonuçlar'da "Tümü" bütün sonuçları gösterir."""
import io
import json
import os
import sys
import threading
import time
import zipfile
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent))
from test_luca_otomasyon import FIRMA_VKN, muavin_yaz, ubl  # noqa: E402


@pytest.fixture
def c(tmp_path, monkeypatch):
    monkeypatch.setenv("FK_VERI", str(tmp_path / "veri"))
    from fastapi.testclient import TestClient
    from fatura_kontrol.web import app as A
    return TestClient(A.app)


def _kontrol(c, tmp_path):
    zb = io.BytesIO()
    with zipfile.ZipFile(zb, "w") as z:
        z.writestr("a.xml", ubl("AAA2026000000001", "2026-09-05", "1", FIRMA_VKN, "1000.00", "200.00", 20))
        z.writestr("b.xml", ubl("EX02026000000001", "2026-09-10", FIRMA_VKN, "9", "2000.00", "400.00", 20))
    m = tmp_path / "muavin.xlsx"; muavin_yaz(m)
    r = c.post("/api/kontrol", data={"bas": "2026-09-01", "bit": "2026-09-30", "program": "luca"},
               files=[("faturalar", ("f.zip", zb.getvalue(), "application/zip")), ("muavinler", ("m.xlsx", m.read_bytes(), "application/octet-stream"))])
    assert r.status_code == 200, r.text
    return r.json()


def test_fis_satirlari_tarihli(c, tmp_path):
    v = _kontrol(c, tmp_path)
    fisler = [s["fisler"] for s in v["sonuclar"] if s.get("fisler")]
    assert fisler, "raporda fiş bilgisi olmalı"
    no, tarih = fisler[0].split(" (")[0], fisler[0].split("(")[1].rstrip(")")
    j = c.get("/api/denetim/fis", params={"id": v["id"], "fis": no, "tarih": tarih}).json()
    assert j["fis_no"] == no and j["satirlar"]
    for s in j["satirlar"]:
        assert {"tarih", "hesap", "hesap_adi", "aciklama", "belge_no", "borc", "alacak"} <= set(s)
        assert s["tarih"] == "2026-09-30"
    # faturası bulunamayan kaydın fişi (AAA…002 muavinde var, faturası yok) de açılır
    fs = [x for x in v["faturasi_olmayanlar"] if x.get("fis_no")]
    assert fs
    j2 = c.get("/api/denetim/fis", params={"id": v["id"], "fis": fs[0]["fis_no"], "tarih": fs[0]["fis_tarihi"]})
    assert j2.status_code == 200 and any("AAA2026000000002" in s["aciklama"] for s in j2.json()["satirlar"])
    assert c.get("/api/denetim/fis", params={"id": v["id"], "fis": "999", "tarih": tarih}).status_code == 404


# ---------------------------------------------------------------- tarayıcıda (Playwright varsa)
def _sunucu(veri: Path):
    import uvicorn
    os.environ["FK_VERI"] = str(veri)
    from fatura_kontrol.web import app as A
    s = uvicorn.Server(uvicorn.Config(A.app, host="127.0.0.1", port=0, log_level="warning"))
    t = threading.Thread(target=s.run, daemon=True); t.start()
    for _ in range(100):
        if s.started:
            break
        time.sleep(0.05)
    port = s.servers[0].sockets[0].getsockname()[1]
    return s, f"http://127.0.0.1:{port}"


@pytest.fixture
def tarayici():
    pw = pytest.importorskip("playwright.sync_api")
    p = pw.sync_playwright().start()
    try:
        b = p.chromium.launch(executable_path=os.environ.get("PW_CHROMIUM") or None)
    except Exception as e:  # tarayıcı kurulu değilse atla
        p.stop(); pytest.skip(f"Chromium yok: {e}")
    yield b
    b.close(); p.stop()


def test_tarayicida_fis_ve_tumu(c, tmp_path, monkeypatch, tarayici):
    v = _kontrol(c, tmp_path)
    toplu = tmp_path / "veri" / "toplu" / "2026-09"; toplu.mkdir(parents=True)
    sonuc = lambda ad, d: {"ad": ad, "vkn": "1", "durum": d, "fatura": 1, "sorunlar": {}, "indirme_hatasi": []}
    (toplu / "ozet.json").write_text(json.dumps({"bas": "2026-09-01", "bit": "2026-09-30", "sonuclar": [
        sonuc("ALFA A.Ş.", "Temiz"), sonuc("BETA LTD.", "Sorun var"), sonuc("GAMA KOLL.", "Hata")]}, ensure_ascii=False), encoding="utf-8")
    srv, adres = _sunucu(tmp_path / "veri")
    try:
        pg = tarayici.new_page()
        hatalar = []; pg.on("pageerror", lambda e: hatalar.append(str(e)))
        # rapor: fiş numarasına tıkla → fiş penceresi
        pg.goto(f"{adres}/?rapor={v['id']}")
        pg.wait_for_selector("#tablo .fisbtn", timeout=15000)
        pg.click("#tablo .fisbtn >> nth=0")
        pg.wait_for_selector("#fisPen[open] tbody tr", timeout=15000)
        metin = pg.inner_text("#fisPen")
        assert "30.09.2026" in metin and "191" in metin and "Borç" in metin, metin
        pg.keyboard.press("Escape")
        assert not pg.is_visible("#fisPen")
        # "Faturası bulunamayan" sekmesindeki fiş no düğmesi
        pg.click("#sekmeler [data-k=faturasiz]")
        pg.click("#tablo .fisbtn >> nth=0")
        pg.wait_for_selector("#fisPen[open] tbody tr", timeout=15000)
        assert "AAA2026000000002" in pg.inner_text("#fisPen")
        # toplu: durum ve sütun filtresi → Tümü
        pg.goto(f"{adres}/toplu")
        pg.wait_for_selector("#tumuBtn", state="attached", timeout=15000)
        pg.click("button.s[data-s=sonuc]")                      # ilk açılışta (ayar yok) Ayarlar sekmesi açık
        pg.wait_for_selector("#tumuBtn", timeout=15000)
        gorunen = lambda: pg.eval_on_selector_all("#sonucTablo tbody tr", "t => t.filter(r => r.style.display !== 'none').length")
        assert gorunen() == 3 and "secili" in pg.get_attribute("#tumuBtn", "class")
        pg.click("#kutular .kutu[data-k='Sorun var']")
        pg.wait_for_function("document.querySelectorAll('#sonucTablo tbody tr').length === 1")
        pg.wait_for_selector("#sonucTablo tr.tg-filtre input")
        pg.click("#kutular .kutu[data-k='Sorun var']")          # durum kalktı; şimdi sütun filtresi
        pg.wait_for_function("document.querySelectorAll('#sonucTablo tbody tr').length === 3")
        pg.wait_for_selector("#sonucTablo tr.tg-filtre input")
        pg.fill("#sonucTablo tr.tg-filtre input >> nth=0", "ALFA")
        pg.wait_for_function("[...document.querySelectorAll('#sonucTablo tbody tr')].filter(r => r.style.display !== 'none').length === 1")
        assert "secili" not in pg.get_attribute("#tumuBtn", "class")
        pg.click("#tumuBtn")
        pg.wait_for_function("[...document.querySelectorAll('#sonucTablo tbody tr')].filter(r => r.style.display !== 'none').length === 3")
        pg.wait_for_selector("#sonucTablo tr.tg-filtre input")
        assert all(not x for x in pg.eval_on_selector_all("#sonucTablo tr.tg-filtre input", "i => i.map(x => x.value)"))
        assert "secili" in pg.get_attribute("#tumuBtn", "class")
        assert not hatalar, hatalar
    finally:
        srv.should_exit = True
