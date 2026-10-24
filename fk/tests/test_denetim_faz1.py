"""Görev 43 Faz 1: Muhasebe Denetimi programdan bağımsız (Mikro · Elektra · Luca), KDV oranı ↔ hesap kodu, KDV fişi."""
import io
import sys
import zipfile
from datetime import date
from decimal import Decimal as D
from pathlib import Path

import pytest

from fatura_kontrol import eslestirme as E
from fatura_kontrol.denetim import kdv_fis_kontrol, kod_oranlari
from tests.test_denetim_ek import esle, fs
from tests.test_eslestirme import fatura

sys.path.insert(0, str(Path(__file__).parent))


def _kdv(r):
    return next(s for s in r.sonuclar if s.kontrol == "KDV")


def test_kod_oranlari_ve_oran_hatasi():
    m = [fs("191.01.20", "İndirilecek KDV", borc="200"), fs("191.01.10", "İndirilecek KDV"),
         fs("770.01", "Genel Yönetim", borc="1000"), fs("320.01", "Satıcı", alacak="1200")]
    notu = kod_oranlari(m)
    assert "191.01.20 = %20" in notu and "191.01.10 = %10" in notu
    assert m[0].kdv_orani == 20 and m[2].kdv_orani is None
    assert _kdv(esle(fatura(), m)).durum == E.UYUMLU
    m2 = [fs("191.01.10", "İndirilecek KDV", borc="200"), fs("191.01.20", "İndirilecek KDV"),
          fs("770.01", "Genel Yönetim", borc="1000"), fs("320.01", "Satıcı", alacak="1200")]
    kod_oranlari(m2)
    assert _kdv(esle(fatura(), m2)).durum == E.ORAN_HATASI           # %20'lik fatura %10 hesabına


@pytest.mark.parametrize("kodlar", [["191.01.01", "191.01.02"],      # sıra numarası
                                    ["191.01.20", "191.01"],         # iki bölümlü hesap da var
                                    ["191.01.01"],                   # %1 tek başına: sıra no olabilir
                                    ["191.01.020"]])                 # üç haneli son bölüm
def test_kod_oranlari_belirsizse_okunmaz(kodlar):
    m = [fs(k, "İndirilecek KDV", borc="1") for k in kodlar]
    assert kod_oranlari(m) == "" and all(s.kdv_orani is None for s in m)


def test_adindaki_oran_onceliklidir():
    m = [fs("191.01.20", "%10 İndirilecek KDV", borc="1"), fs("191.01.08", "İndirilecek KDV", borc="1")]
    kod_oranlari(m)
    assert m[0].kdv_orani == 10 and m[1].kdv_orani == 8


def test_kdv_baska_fiste():
    m = [fs("191.01", "İndirilecek KDV", borc="200", fis_no="2"), fs("770.01", "Genel Yönetim", borc="1000"),
         fs("320.01", "Satıcı", alacak="1200")]
    r = esle(fatura(), m)
    assert _kdv(r).durum == E.UYUMLU
    assert kdv_fis_kontrol(r) == 1
    k = _kdv(r)
    assert k.durum == E.KDV_FIS_FARKI and "KDV 2 (30.09.2026) fişinde" in k.aciklama and "1 (30.09.2026)" in k.aciklama
    m[0].fis_no = "1"
    r = esle(fatura(), m)
    assert kdv_fis_kontrol(r) == 0 and _kdv(r).durum == E.UYUMLU


def test_kdv_fis_cari_yoksa_gider_fisine_bakar():
    m = [fs("191.01", "İndirilecek KDV", borc="200", fis_no="2"), fs("770.01", "Genel Yönetim", borc="1000")]
    r = esle(fatura(), m)
    assert kdv_fis_kontrol(r) == 1 and _kdv(r).durum == E.KDV_FIS_FARKI


@pytest.fixture
def c(tmp_path, monkeypatch):
    monkeypatch.setenv("FK_VERI", str(tmp_path / "veri"))
    from fastapi.testclient import TestClient
    from fatura_kontrol.web import app as A
    return TestClient(A.app)


def test_program_listesi_ve_elektra(c, tmp_path):
    from test_denetim import _mikro
    from test_luca_otomasyon import ubl, FIRMA_VKN
    d = c.get("/api/muavin/programlar", params={"denetim": 1}).json()["programlar"]
    assert [p["kod"] for p in d] == ["mikro", "elektra", "luca"]
    assert [p["hazir"] for p in d] == [True, False, True]
    assert "elektra" not in [p["kod"] for p in c.get("/api/muavin/programlar").json()["programlar"]]   # Tek firma kontrolde yok
    zb = io.BytesIO()
    with zipfile.ZipFile(zb, "w") as z:
        z.writestr("a.xml", ubl("AAA2026000000001", "2026-09-05", "1", FIRMA_VKN, "1000.00", "200.00", 20))
        z.writestr("b.xml", ubl("EX02026000000001", "2026-09-10", FIRMA_VKN, "9", "2000.00", "400.00", 20))   # firma VKN'si iki faturada
    y = tmp_path / "m.xlsx"; _mikro(y)
    r = c.post("/api/denetim", data={"bas": "2026-09-01", "bit": "2026-09-30", "program": "elektra"},
               files=[("faturalar", ("p.zip", zb.getvalue(), "application/zip")), ("muavinler", ("m.xlsx", y.read_bytes(), "application/octet-stream"))])
    assert r.status_code == 400 and "Elektra muavin örneği bekleniyor" in r.json()["detail"]
    # Mikro muavininde 191.01.20 adında da %20 → oran adından; denetim yine yapılır, KDV fişi doğru
    r = c.post("/api/denetim", data={"bas": "2026-09-01", "bit": "2026-09-30", "program": "mikro"},
               files=[("faturalar", ("p.zip", zb.getvalue(), "application/zip")), ("muavinler", ("m.xlsx", y.read_bytes(), "application/octet-stream"))])
    assert r.status_code == 200, r.text
    assert {s["durum"] for s in r.json()["denetim"]["sonuclar"] if s["kontrol"] == "KDV"} == {"Uyumlu"}


def test_luca_muavini_denetimde(tmp_path, monkeypatch):
    """Luca seçili: muavin de Luca'dan (toplu otomasyonun "muavin" adımı, toplu özetine girmez) alınıp denetlenir."""
    from test_program import _bekle
    import os
    monkeypatch.setenv("FK_VERI", str(tmp_path / "veri"))
    monkeypatch.setenv("PYTHONPATH", os.pathsep.join([str(Path(__file__).parent), str(Path(__file__).parent.parent)]))
    from fastapi.testclient import TestClient
    from fatura_kontrol.web import app as A, toplu_api
    from fatura_kontrol.luca import toplu as T
    from fatura_kontrol import depo
    monkeypatch.setattr(toplu_api, "MODUL", "sahte_toplu")
    toplu_api._is.clear()
    c = TestClient(A.app)
    try:
        _luca_muavini_akisi(c, toplu_api, T, depo)
    finally:
        toplu_api._is.clear()                       # sonraki testlere çalışan iş kalmasın


def _luca_muavini_akisi(c, toplu_api, T, depo):
    from test_program import _bekle
    T.liste_yaz([{"ad": "EXPO İNŞ", "id": "1"}])
    q = {"firma_id": "1", "bas": "2026-09-01"}
    assert c.get("/api/kontrol/luca-faturalari", params=q).json()["muavin"] is None
    c.post("/api/toplu/baslat", json={"ay": "2026-09", "idler": ["1"], "yalniz_fatura": True}); assert _bekle(c)["cikis_kodu"] == 0
    veri = {"bas": "2026-09-01", "bit": "2026-09-30", "program": "luca", "firma_id": "1", "firma_ad": "EXPO İNŞ",
            "fatura_kaynak": "luca", "muavin_kaynak": "luca"}
    yok = c.post("/api/denetim", data=veri)
    assert yok.status_code == 400 and "Luca'dan alınmış muavin yok" in yok.text
    # kullanıcının yüklediği muavin.xlsx (adım kaydı yok) Luca'dan alınmış sayılmaz
    k = depo.donem_klasoru("EXPO İNŞ", date(2026, 9, 1))
    from test_luca_otomasyon import muavin_yaz
    muavin_yaz(k / "muavin.xlsx")
    assert c.get("/api/kontrol/luca-faturalari", params=q).json()["muavin"] is None
    r = c.post("/api/toplu/baslat", json={"ay": "2026-09", "idler": ["1"], "yalniz_fatura": True, "adim": "muavin"})
    assert r.status_code == 200 and r.json()["klasor"] == "_tek/2026-09"
    assert _bekle(c)["cikis_kodu"] == 0
    a = toplu_api._is["proc"].args
    assert "--yalniz-fatura" in a and a[a.index("--adim") + 1] == "muavin"
    assert c.get("/api/toplu/gecmis").json() == []                     # toplu kontrol geçmişine girmez
    j = c.get("/api/kontrol/luca-faturalari", params=q).json()
    assert j["muavin"]["zaman"] and j["adet"] == 2
    assert c.post("/api/denetim", data={**veri, "program": "mikro"}).status_code == 400   # Luca muavini yalnız Luca seçiliyken
    r = c.post("/api/denetim", data=veri)
    assert r.status_code == 200, r.text
    d = r.json()["denetim"]
    kdv = {s["belge_no"]: s["durum"] for s in d["sonuclar"] if s["kontrol"] == "KDV"}
    assert kdv["AAA2026000000001"] == "Uyumlu" and kdv["EX02026000000001"] == "Uyumlu"


def test_tarayicida_program_donem_ve_fis(tmp_path):
    """denetim.html: program seçimi (Elektra → uyarı, başlat kapalı), dönem tablosu, muhtasar listesinde fiş düğmesi."""
    from test_fis_ve_tumu import _sunucu
    from test_denetim import _mikro
    from test_luca_otomasyon import ubl, FIRMA_VKN
    import os
    pw = pytest.importorskip("playwright.sync_api")
    p = pw.sync_playwright().start()
    try:
        b = p.chromium.launch(executable_path=os.environ.get("PW_CHROMIUM") or None)
    except Exception as e:
        p.stop(); pytest.skip(f"Chromium yok: {e}")
    z = tmp_path / "f.zip"
    with zipfile.ZipFile(z, "w") as zz:
        zz.writestr("a.xml", ubl("AAA2026000000001", "2026-09-05", "1", FIRMA_VKN, "1000.00", "200.00", 20))
        zz.writestr("b.xml", ubl("EX02026000000001", "2026-09-10", FIRMA_VKN, "9", "2000.00", "400.00", 20))
    m = tmp_path / "m.xlsx"; _mikro(m)
    srv, adres = _sunucu(tmp_path / "veri")
    try:
        pg = b.new_page(); hatalar = []; pg.on("pageerror", lambda e: hatalar.append(str(e)))
        pg.goto(f"{adres}/denetim")
        pg.wait_for_function("document.querySelectorAll('#program option').length === 3")
        assert pg.eval_on_selector_all("#program option", "o => o.map(x => x.value)") == ["mikro", "elektra", "luca"]
        assert "Mikro" not in pg.inner_text("header")
        pg.select_option("#program", "elektra")
        assert pg.is_visible("#programUyari") and "örneği bekleniyor" in pg.inner_text("#programUyari")
        assert pg.is_disabled("#basla") and pg.is_disabled("#muavin")
        pg.select_option("#program", "luca")
        assert pg.is_hidden("#programUyari") and pg.is_enabled("#basla") and "Luca'dan henüz" in pg.inner_text("#redIpucu")
        assert pg.is_hidden("#lucaMuavinKutu")                    # MuhaWin dışında / Luca'lı firma yok
        pg.select_option("#program", "mikro")
        # dönem: yıl + ay → ayın 1'i ve son günü; ara tarih elle girilebilir
        pg.select_option("#donemYil", "2026")
        pg.click("#donemAy [data-ay='2']")
        assert pg.input_value("#bas") == "2026-02-01" and pg.input_value("#bit") == "2026-02-28"
        assert pg.get_attribute("#donemAy [data-ay='2']", "aria-pressed") == "true"
        pg.click("#donemAy [data-ay='9']")
        assert pg.input_value("#bas") == "2026-09-01" and pg.input_value("#bit") == "2026-09-30"
        pg.fill("#bit", "2026-09-10"); pg.dispatch_event("#bit", "change")
        assert pg.get_attribute("#donemAy [data-ay='9']", "aria-pressed") == "false"
        pg.fill("#bit", "2026-09-30"); pg.dispatch_event("#bit", "change")
        pg.set_input_files("#xml", str(z)); pg.set_input_files("#muavin", str(m))
        pg.click("#basla")
        pg.wait_for_selector("#nav [data-g=muhtasar]:not([disabled])", timeout=30000)
        pg.click("#nav [data-g=muhtasar]")
        pg.click("#icerik details summary >> nth=0")
        pg.click("#icerik details .fisbtn >> nth=0")
        pg.wait_for_selector("#fisPen.acik tbody tr", timeout=15000)
        assert "360.03" in pg.inner_text("#fisPen")
        assert not hatalar, hatalar
    finally:
        srv.should_exit = True
        b.close(); p.stop()
