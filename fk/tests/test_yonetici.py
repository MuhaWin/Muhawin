"""Görev 43 Faz 3: Yönetici raporu — aylık satış / gider, o ayın vergileri, rasyolar."""
import io
import sys
import zipfile
from datetime import date
from decimal import Decimal as D
from pathlib import Path

import pytest

from fatura_kontrol import yonetici
from fatura_kontrol.muavin_okuyucu import MuavinSatiri

sys.path.insert(0, str(Path(__file__).parent))


def m(kod, ad, t, borc=0, alacak=0, fis="1", tip="Mahsup", acik=""):
    return MuavinSatiri("m.xlsx", 1, kod, ad, t, tip, fis, acik, D(str(borc)), D(str(alacak)), None, None, "")


def muavin(acilis=True):
    L = []
    if acilis:
        L += [m("100.01", "Kasa", date(2026, 1, 1), borc=20000, tip="Açılış"), m("153.01", "Ticari Mallar", date(2026, 1, 1), borc=5000, tip="Açılış"),
              m("320.01", "Satıcılar", date(2026, 1, 1), alacak=10000, tip="Açılış"), m("500.01", "Sermaye", date(2026, 1, 1), alacak=15000, tip="Açılış")]
    for ay, satis, gider in ((1, 10000, 1000), (2, 12000, 1000), (3, 6000, 4000)):
        t = date(2026, ay, 15)
        L += [m("120.01", "Alıcı", t, borc=satis * 1.2), m("600.01", "Yurtiçi Satışlar", t, alacak=satis), m("391.01", "Hesaplanan KDV", t, alacak=satis * 0.2),
              m("770.01", "Genel Yönetim", t, borc=gider), m("191.01", "İndirilecek KDV", t, borc=gider * 0.2), m("320.01", "Satıcılar", t, alacak=gider * 1.2),
              m("360.01", "Gelir Vergisi Stopajı", t, alacak=300), m("360.01", "Gelir Vergisi Stopajı", t, borc=250, fis="2")]
    return L


def test_aylik_satis_gider_ve_vergiler():
    y = yonetici.hazirla(muavin(), date(2026, 3, 1), date(2026, 3, 31))
    assert y["aylar"] == ["Ocak", "Şubat", "Mart"]
    assert [x["brut"] for x in y["satis"]] == [10000, 12000, 6000] and [x["degisim"] for x in y["satis"]] == [None, 20.0, -50.0]
    g = y["giderler"][0]
    assert g["kod"] == "770" and g["ad"] == "Genel Yönetim Giderleri" and [s["yuksek"] for s in g["seri"]] == [False, False, True]
    assert g["seri"][2]["artis"] == 300.0
    o = y["ay_ozet"]
    assert (o["satis"], o["hesaplanan_kdv"], o["indirilecek_kdv"], o["odenecek_kdv"]) == (6000, 1200, 800, 400)
    assert (o["tahakkuk_360"], o["odenen_360"], o["bakiye_360"]) == (300, 250, 150)
    assert o["vergiler_360"] == [{"kod": "360.01", "ad": "Gelir Vergisi Stopajı", "tutar": 300}]
    assert y["uyarilar"] == []


def test_rasyolar():
    y = yonetici.hazirla(muavin(), date(2026, 1, 1), date(2026, 1, 31))
    r = y["rasyolar"][0]
    # Ocak sonu: dönen = 20000 kasa + 5000 stok + 12000 alıcı + 200 KDV = 37200; KVYK = 10000 + 1200 + 2000 + 50 = 13250
    assert r["cari"] == round(37200 / 13250, 2) and r["asit"] == round(32200 / 13250, 2) and r["nakit"] == round(20000 / 13250, 2)
    assert r["kar"] == 9000 and r["net_satis"] == 10000 and r["kar_marji"] == 90.0
    assert r["borc_ozkaynak"] == round(13250 / (15000 + 9000), 2)
    y2 = yonetici.hazirla(muavin(acilis=False), date(2026, 1, 1), date(2026, 1, 31))
    assert any("açılış" in u for u in y2["uyarilar"])


def test_rapor_html():
    from fatura_kontrol.yonetici_rapor import rapor_html
    y = yonetici.hazirla(muavin(), date(2026, 3, 1), date(2026, 3, 31))
    h = rapor_html({"firma": "YÖNETİCİ A.Ş.", "vkn": "1"}, y)
    assert "YÖNETİCİ A.Ş." in h and "Mart 2026" in h and h.count("<svg") == 2 and "▲" in h and "-50,0%" in h
    assert "Cari oran" in h and "Dönen varlıklar (1xx)" in h and "Ödenecek KDV" in h


@pytest.fixture
def c(tmp_path, monkeypatch):
    monkeypatch.setenv("FK_VERI", str(tmp_path / "veri"))
    from fastapi.testclient import TestClient
    from fatura_kontrol.web import app as A
    return TestClient(A.app)


def test_api(c, tmp_path):
    from test_denetim import _mikro
    from test_luca_otomasyon import ubl, FIRMA_VKN
    zb = io.BytesIO()
    with zipfile.ZipFile(zb, "w") as z:
        z.writestr("a.xml", ubl("AAA2026000000001", "2026-09-05", "1", FIRMA_VKN, "1000.00", "200.00", 20))
        z.writestr("b.xml", ubl("EX02026000000001", "2026-09-10", FIRMA_VKN, "9", "2000.00", "400.00", 20))
    y = tmp_path / "m.xlsx"; _mikro(y)
    r = c.post("/api/denetim", data={"bas": "2026-09-01", "bit": "2026-09-30", "firma_ad": "YÖNETİCİ A.Ş."},
               files=[("faturalar", ("p.zip", zb.getvalue(), "application/zip")), ("muavinler", ("m.xlsx", y.read_bytes(), "application/octet-stream"))])
    h = c.get("/api/denetim/yonetici", params={"id": r.json()["rapor_id"]})
    assert h.status_code == 200 and "Eylül 2026" in h.text and "Rasyolar" in h.text and "<svg" in h.text
    assert "Eylül ayından başlıyor" in h.text                     # yalnız aylık muavin: uyarı
    assert c.get("/api/denetim/yonetici", params={"id": "YOK/2026/09"}).status_code == 404
