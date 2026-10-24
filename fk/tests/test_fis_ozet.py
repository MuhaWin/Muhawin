"""Görev 53: denetim fiş yazdırmada ana hesap özeti (yalnız aynı ana hesap birden çok satırdaysa) ve 3 imza alanı."""
from datetime import date
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

from fatura_kontrol.muavin_okuyucu import MuavinSatiri
from fatura_kontrol.web import app as A


def _s(i, kod, b=0, a=0):
    return MuavinSatiri("m.xlsx", i, kod, "AD " + kod, date(2026, 9, 5), "Mahsup", "12", "açıklama", Decimal(b), Decimal(a),
                        None, None, "")


@pytest.fixture
def c(tmp_path, monkeypatch):
    monkeypatch.setattr(A.depo, "rapor_klasoru", lambda id: tmp_path)
    return TestClient(A.app)


def _yaz(c, monkeypatch, satirlar):
    monkeypatch.setattr(A, "_denetim_muavini", lambda k: satirlar)
    j = c.get("/api/denetim/fis", params={"id": "F/2026-09", "fis": "12", "tarih": "05.09.2026"}).json()
    h = c.get("/api/denetim/fis/yazdir", params={"id": "F/2026-09", "fis": "12", "tarih": "05.09.2026", "oto": 0}).text
    return j, h


def test_tekrarlayan_ana_hesap_ozet_ve_denklik(c, monkeypatch):
    # iki 770 + bir 191 + üç 102 → özet var; 102'ler tek satırda toplanıyor
    j, h = _yaz(c, monkeypatch, [_s(1, "770.01", 100), _s(2, "770.02", 50), _s(3, "191.01.20", 30),
                                 _s(4, "102.01", 0, 80), _s(5, "102.02", 0, 60), _s(6, "102.03", 0, 40)])
    assert j["ozet"] is True and j["dengeli"] is True
    assert [(x["hesap"], x["borc"], x["alacak"]) for x in j["ana"]] == [("102", 0, 180), ("191", 30, 0), ("770", 150, 0)]
    assert "Ana hesap özeti" in h and "Toplam borç = toplam alacak" in h and "Bankalar" in h
    assert h.index("Ana hesap özeti") < h.index("Hazırlayan")
    for a in ("Hazırlayan", "Kontrol Eden", "Onaylayan"):
        assert a in h


def test_dengesiz_fis_farki_yaziliyor(c, monkeypatch):
    _, h = _yaz(c, monkeypatch, [_s(1, "770.01", 100), _s(2, "770.02", 50), _s(3, "320.01", 0, 140)])
    assert "Ana hesap özeti" in h and "Fiş dengesiz (fark 10,00)" in h


def test_her_ana_hesap_bir_kez_ozet_yok_imza_var(c, monkeypatch):
    # 153, 191, 320 birer kez → özet yok, imza alanları yine en altta
    j, h = _yaz(c, monkeypatch, [_s(1, "153.01", 100), _s(2, "191.01.20", 20), _s(3, "320.01", 0, 120)])
    assert j["ozet"] is False
    assert "Ana hesap özeti" not in h
    for a in ("Hazırlayan", "Kontrol Eden", "Onaylayan"):
        assert a in h


def test_ortak_yardimci_dogrudan():
    # başka raporlar (ör. KDV2) için ortak modül: üç 102 tek satır, ad önce ad_bul'dan
    from fatura_kontrol.fis_cikti import ana_hesap_ozeti, fis_ek_html
    oz = ana_hesap_ozeti([("102.01", 0, "700"), ("102.02", 0, 300), ("102.05.001", 0, 200), ("770.01", 1000, 0), ("191.01.20", 200, 0)],
                         lambda k: "GENEL YÖNETİM" if k == "770" else "")
    assert oz["goster"] and oz["dengeli"] and oz["borc"] == oz["alacak"] == 1200
    assert [(x["hesap"], x["ad"], x["alacak"], x["n"]) for x in oz["ana"]][0] == ("102", "Bankalar", 1200, 3)
    assert oz["ana"][2]["ad"] == "GENEL YÖNETİM"
    h = fis_ek_html(oz)
    assert "Ana hesap özeti" in h and "1.200,00" in h and h.index("Ana hesap özeti") < h.index("Hazırlayan")
    tek = ana_hesap_ozeti([("153.01", 100, 0), ("191.01.20", 20, 0), ("320.01", 0, 120)])
    assert not tek["goster"] and "Ana hesap özeti" not in fis_ek_html(tek) and "Kontrol Eden" in fis_ek_html(tek)
