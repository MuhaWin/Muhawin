"""Görev 34: "Faturaları Luca'ya kaydet" ekranı için muavin özeti (kapsanan dönem, indirilme zamanı, fiş numaraları)."""
from datetime import datetime

import openpyxl

from fatura_kontrol.kayit_aday import fis_no_norm, muavin_ozeti
from fatura_kontrol.kontrol import muavinleri_oku

BAS = ("TARİH", "TİP", "FİŞ NO", "AÇIKLAMA", "BORÇ", "ALACAK", "BAKİYE", "B/A")


def yaz(yol, satirlar):
    wb = openpyxl.Workbook()
    for r in satirlar:
        wb.active.append(r)
    wb.save(yol)
    return yol


def test_fis_no_norm():
    assert fis_no_norm("000123") == fis_no_norm(123) == fis_no_norm("123.0") == fis_no_norm(" 12 3 ") == "123"
    assert fis_no_norm("M-0012") == "M-0012" and fis_no_norm("0") == "0" and fis_no_norm(None) == ""


def test_muavin_ozeti_luca_araligi_ve_fisler(tmp_path):
    y = yaz(tmp_path / "muavin.xlsx", [("MUAVİN DEFTER",), ("ÖRNEK LTD",), ("Tarih Aralığı :", "01/01/2026-30/09/2026"),
            ("320.01 SATICI",), BAS,
            (datetime(2026, 9, 5), "Mahsup", "0012", "05/09/2026-AAA2026000000001-SATICI", None, 1200),
            (datetime(2026, 9, 6), "Mahsup", 13, "06/09/2026-AAA2026000000002-SATICI", None, 600),
            ("191.01 KDV",), BAS, (datetime(2026, 9, 5), "Mahsup", "0012", "05/09/2026-AAA2026000000001-SATICI", 200, None)])
    m, b = muavinleri_oku([y])
    o = muavin_ozeti([y], m, b)
    assert o["bas"] == "2026-01-01" and o["bit"] == "2026-09-30" and o["aralik_kaynak"] == "luca"
    assert o["fisler"] == [["2026-09-05", "12"], ["2026-09-06", "13"]]
    assert o["zaman"].startswith(str(datetime.now().year))


def test_muavin_ozeti_aralik_yoksa_satirlardan(tmp_path):
    y = yaz(tmp_path / "muavin.xlsx", [("MUAVİN DEFTER",), ("ÖRNEK LTD",), ("100.01 KASA",), BAS,
            (datetime(2026, 2, 1), "Tahsil", "1", "A", 10, None), (datetime(2026, 4, 30), "Tahsil", "2", "B", 10, None)])
    o = muavin_ozeti([y], *muavinleri_oku([y]))
    assert (o["bas"], o["bit"], o["aralik_kaynak"]) == ("2026-02-01", "2026-04-30", "satirlar")


def test_muavin_ozeti_isletme_ve_bos(tmp_path):
    j = tmp_path / "muavin_isletme.json"
    j.write_text("{}")
    assert muavin_ozeti([j], [], {}) is None and muavin_ozeti([], [], {}) is None
