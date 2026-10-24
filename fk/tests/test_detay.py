"""Görev 43 Faz 2: Detay denetim (gider / gelir kontrolü), geçmişle uyum, kontrol kuralları, kararlar, rapor."""
import io
import sys
import zipfile
from datetime import date
from decimal import Decimal as D
from pathlib import Path

import pytest

from fatura_kontrol import detay
from fatura_kontrol import eslestirme as E
from tests.test_eslestirme import fatura, satir

sys.path.insert(0, str(Path(__file__).parent))


def fs(hesap, adi, borc="0", alacak="0", no="ABC2026000000001", fis_no="9", fis=date(2026, 9, 30), unvan="ÖRNEK GIDA LTD ŞTİ"):
    s = satir(no=no, hesap=hesap, adi=adi, tutar="0", unvan=unvan, fis_no=fis_no, fis=fis, belge_t=fis)
    s.borc, s.alacak = D(borc), D(alacak)
    return s


def fis(no, t, gider_hesap, tutar, belge):
    return [fs(gider_hesap, "Elektrik Gideri", borc=str(tutar), no=belge, fis_no=no, fis=t),
            fs("320.01.01.005", "ELEKTRİK AŞ", alacak=str(tutar * D("1.2")), no=belge, fis_no=no, fis=t)]


def bu_ay(gider="770.01.01.001", tutar="1000"):
    return [fs("191.01", "İndirilecek KDV %20", borc="200"), fs(gider, "Elektrik Gideri", borc=tutar),
            fs("320.01.01.005", "ELEKTRİK AŞ", alacak=str(D(tutar) + 200))]


def hazirla(muavin):
    f = fatura()
    r = E.esle([f], muavin, donem=(date(2026, 9, 1), date(2026, 9, 30)), kontrol_listesi=E.DENETIM_KONTROLLER)
    return detay.hazirla(r, [f], muavin, date(2026, 9, 1), date(2026, 9, 30))["gider"][0]


def test_gecmisle_uyumlu():
    m = fis("7", date(2026, 7, 15), "770.01.01.001", D(900), "ABC2026000000007") + \
        fis("8", date(2026, 8, 15), "770.01.01.001", D(1100), "ABC2026000000008") + bu_ay()
    x = hazirla(m)
    assert x["hesaplar"] == [{"kod": "770.01.01.001", "ad": "Elektrik Gideri", "tutar": 1000.0}]
    assert x["cari"]["kod"] == "320.01.01.005" and x["fisler"] == [{"no": "9", "tarih": "2026-09-30"}]
    assert x["gecmis"]["uyumlu"] and x["gecmis"]["aylar"] == 2, x["gecmis"]
    d = detay.uygula({"gider": [x]}, [], {})
    assert d["gider"][0]["durum"] == "gecmis" and d["ozet"]["gider"]["gecmis"] == 1


@pytest.mark.parametrize("gecmis, buay, neden", [
    ([("7", 7, "770.01.01.001", 900)], {}, "yalnız 1 ay"),
    ([("7", 7, "770.01.01.001", 900), ("8", 8, "760.01.01.001", 900)], {}, "farklı hesaplara"),
    ([("7", 7, "770.01.01.001", 900), ("8", 8, "770.01.01.001", 900)], {"gider": "760.01.01.001"}, "bu ay 760"),
    ([("7", 7, "770.01.01.001", 900), ("8", 8, "770.01.01.001", 900)], {"tutar": "3000"}, "aralığının dışında"),
])
def test_gecmisle_uyumsuz(gecmis, buay, neden):
    m = [s for no, ay, h, t in gecmis for s in fis(no, date(2026, ay, 15), h, D(t), f"ABC20260000000{no}{ay:02d}")] + bu_ay(**buay)
    x = hazirla(m)
    assert not x["gecmis"]["uyumlu"] and neden in x["gecmis"]["aciklama"], x["gecmis"]
    assert detay.uygula({"gider": [x]}, [], {})["gider"][0]["durum"] == "bekliyor"


def test_kural_ve_karar(tmp_path):
    x = hazirla(bu_ay())
    assert detay.uygula({"gider": [x]}, [], {})["gider"][0]["durum"] == "bekliyor"
    firma = tmp_path / "F"
    with pytest.raises(ValueError):
        detay.kural_ekle(firma, {"yon": "ALIS", "hesap": "770"})              # VKN / ünvan yok
    L = detay.kural_ekle(firma, {"yon": "ALIS", "vkn": x["vkn"], "hesap": "770", "aciklama": "elektrik"})
    d = detay.uygula({"gider": [x]}, L, {})["gider"][0]
    assert d["durum"] == "kural" and "770" in d["neden"] and "elektrik" in d["neden"]
    L2 = detay.kural_ekle(firma, {"yon": "ALIS", "unvan": "örnek gıda", "hesap": "760"})
    assert detay.uygula({"gider": [x]}, L2[1:], {})["gider"][0]["durum"] == "bekliyor"     # kural 760 bekliyor, kayıt 770
    K = detay.karar_yaz(firma, x["anahtar"], "uygun_degil", "yanlış hesap")
    d = detay.uygula({"gider": [x]}, L2, K)["gider"][0]
    assert d["durum"] == "uygun_degil" and d["neden"] == "yanlış hesap"                # karar kuraldan önce
    assert detay.kararlar(firma)[x["anahtar"]]["karar"] == "uygun_degil"
    assert detay.karar_yaz(firma, x["anahtar"], "") == {}
    ids = [k["id"] for k in L2]
    assert len(set(ids)) == 2 and ids[1] > ids[0]          # kimlik zamana dayalı, tekil (Görev 51: iki bilgisayar çakışmasın)
    assert [k["id"] for k in detay.kural_sil(firma, ids[0])] == [ids[1]]


def test_toplu_fis_baska_faturalar_karismaz():
    m = bu_ay() + [fs("770.02", "Kırtasiye", borc="50", no="XYZ2026000000099"), fs("320.01.01.009", "KIRTASİYE", alacak="60", no="XYZ2026000000099")]
    x = hazirla(m)
    assert [h["kod"] for h in x["hesaplar"]] == ["770.01.01.001"] and x["cari"]["kod"] == "320.01.01.005"


@pytest.fixture
def c(tmp_path, monkeypatch):
    monkeypatch.setenv("FK_VERI", str(tmp_path / "veri"))
    from fastapi.testclient import TestClient
    from fatura_kontrol.web import app as A
    return TestClient(A.app)


def test_api_detay_karar_kural_rapor(c, tmp_path):
    from test_denetim import _mikro
    from test_luca_otomasyon import ubl, FIRMA_VKN
    zb = io.BytesIO()
    with zipfile.ZipFile(zb, "w") as z:
        z.writestr("a.xml", ubl("AAA2026000000001", "2026-09-05", "1", FIRMA_VKN, "1000.00", "200.00", 20))
        z.writestr("b.xml", ubl("EX02026000000001", "2026-09-10", FIRMA_VKN, "9", "2000.00", "400.00", 20))
    y = tmp_path / "m.xlsx"; _mikro(y, satis_matrah=1900)
    r = c.post("/api/denetim", data={"bas": "2026-09-01", "bit": "2026-09-30", "firma_ad": "DETAY A.Ş."},
               files=[("faturalar", ("p.zip", zb.getvalue(), "application/zip")), ("muavinler", ("m.xlsx", y.read_bytes(), "application/octet-stream"))])
    assert r.status_code == 200, r.text
    rid = r.json()["rapor_id"]
    d = c.get("/api/denetim/detay", params={"id": rid}).json()
    g, s = d["gider"][0], d["gelir"][0]
    assert g["belge_no"] == "AAA2026000000001" and [h["kod"] for h in g["hesaplar"]] == ["770.01"] and g["durum"] == "bekliyor"
    assert s["belge_no"] == "EX02026000000001" and s["hesaplar"][0]["tutar"] == 1900 and s["cari"]["kod"] == "120.01"
    assert c.post("/api/denetim/detay/karar", json={"id": rid, "anahtar": g["anahtar"], "karar": "uygun"}).status_code == 200
    assert c.post("/api/denetim/detay/karar", json={"id": rid, "anahtar": "yok", "karar": "uygun"}).status_code == 404
    assert c.post("/api/denetim/detay/karar", json={"id": rid, "anahtar": g["anahtar"], "karar": "belki"}).status_code == 400
    assert c.post("/api/denetim/detay/kural", json={"id": rid, "yon": "SATIS", "vkn": s["vkn"], "hesap": "600", "aciklama": "satış"}).status_code == 200
    assert c.post("/api/denetim/detay/kural", json={"id": rid, "yon": "SATIS", "hesap": "600"}).status_code == 400
    d = c.get("/api/denetim/detay", params={"id": rid}).json()
    assert d["gider"][0]["durum"] == "uygun" and d["gelir"][0]["durum"] == "kural" and len(d["kurallar"]) == 1
    assert d["ozet"]["gider"]["uygun"] == 1 and d["ozet"]["gelir"]["kural"] == 1
    h = c.get("/api/denetim/detay/rapor", params={"id": rid}).text
    assert "DETAY A" in h and "KDV kontrolü" in h and "Matrah kontrolü" in h and "Gider kontrolü" in h and "Hazırlayan" in h
    assert "EX02026000000001" in h                              # matrah farkı (1.900 ≠ 2.000) raporda
    # kararlar ve kurallar firmada: yeniden denetimde de geçerli
    assert c.post("/api/denetim/yerel", json={"firma_ad": "DETAY A.Ş.", "ay": "2026-09", "bas": "2026-09-01", "bit": "2026-09-30"}).status_code == 200
    d = c.get("/api/denetim/detay", params={"id": rid}).json()
    assert d["gider"][0]["durum"] == "uygun" and d["gelir"][0]["durum"] == "kural"
    assert c.post("/api/denetim/detay/kural", json={"id": rid, "sil": d["kurallar"][0]["id"]}).json()["kurallar"] == []


def test_tarayicida_kontrol_ekrani(tmp_path):
    """Gider kontrolü → kontrol ekranı (solda kayıt + fiş, sağda fatura), U ile karar, sıradaki; gelirde kural; rapor."""
    import os
    from test_fis_ve_tumu import _sunucu
    from test_denetim import _mikro
    from test_luca_otomasyon import ubl, FIRMA_VKN
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
        pg = b.new_page(viewport={"width": 1400, "height": 900}); hatalar = []; pg.on("pageerror", lambda e: hatalar.append(str(e)))
        pg.goto(f"{adres}/denetim")
        pg.wait_for_function("document.querySelectorAll('#program option').length === 3")
        pg.fill("#bas", "2026-09-01"); pg.fill("#bit", "2026-09-30")
        pg.set_input_files("#xml", str(z)); pg.set_input_files("#muavin", str(m))
        pg.click("#basla")
        pg.wait_for_selector("#nGider .rozet", timeout=30000)
        assert "1 açık" in pg.inner_text("#nGider") and "1 açık" in pg.inner_text("#nGelir")
        pg.click("#nav [data-g=gider]")
        assert "AAA2026000000001" in pg.inner_text("#icerik") and "770.01" in pg.inner_text("#icerik")
        pg.click("#kBasla")
        pg.wait_for_selector("#kontrolPen.acik #kFis table", timeout=15000)
        assert "770.01" in pg.inner_text("#kFis") and "1 / 1" in pg.inner_text("#kSira")
        pg.wait_for_function("document.querySelector('#kFatura').srcdoc.includes('AAA2026000000001')", timeout=15000)
        assert pg.get_attribute("#kFatura", "sandbox") == ""
        pg.fill("#kNot", "elektrik faturası, doğru hesap")
        pg.click("#kSira")                                         # odak not alanından çıksın: kısayol çalışsın
        pg.keyboard.press("u")
        pg.wait_for_selector("#kontrolPen.acik", state="detached", timeout=15000)   # tek bekleyen vardı: ekran kapandı
        pg.wait_for_function("document.querySelector('#nGider').textContent.includes('tamam')")
        pg.click("#icerik [data-dfiltre=uygun]")
        assert "elektrik faturası" in pg.inner_text("#icerik")
        # gelir: kontrol ekranından kural ekle → otomatik uygun (kural)
        pg.click("#nav [data-g=gelir]"); pg.click("#kBasla")
        pg.wait_for_selector("#kontrolPen.acik #kKuralHesap", state="attached")
        pg.click("#kSol details summary")
        assert pg.input_value("#kKuralHesap") == "600.01"
        pg.fill("#kKuralAcik", "her ay aynı müşteri"); pg.click("#kKural")
        pg.wait_for_selector("#kontrolPen.acik", state="detached", timeout=15000)
        pg.click("#nav [data-g=kurallar]")
        assert "600.01" in pg.inner_text("#icerik") and "her ay aynı müşteri" in pg.inner_text("#icerik")
        pg.click("#nav [data-g=gelir]")
        pg.click("#icerik [data-dfiltre=kural]")
        assert "EX02026000000001" in pg.inner_text("#icerik")
        pg.click("#nav [data-g=rapor]")
        with pg.expect_popup() as pp:
            pg.click("#icerik [data-ac^='/api/denetim/detay/rapor']")
        pp.value.wait_for_load_state()
        icerik = pp.value.content()
        assert "Gider kontrolü" in icerik and "elektrik faturası" in icerik             # uygunlar notlarıyla (details içinde)
        assert "Kurala uygun" in icerik and "Hazırlayan" in icerik
        assert not hatalar, hatalar
    finally:
        srv.should_exit = True
        b.close(); p.stop()
