"""Luca muavin okuyucu: başlık / tutar / tarih biçimi farkları, devir ve toplam satırları, sayfa sonları (Görev 20).
Örnekler sahtedir; gerçek Luca dökümünden türetilmedi."""
from datetime import date, datetime
from decimal import Decimal

import openpyxl
import pytest

from fatura_kontrol.muavin_okuyucu import _dec, _tarih, muavin_oku

BAS = ("TARİH", "TİP", "FİŞ NO", "AÇIKLAMA", "BORÇ", "ALACAK", "BAKİYE", "B/A")
UST = [("MUAVİN DEFTER",), ("ÖRNEK TİCARET LTD. ŞTİ.",), ("Dönem :", "01/01/2026-31/12/2026")]


def yaz(yol, *sayfalar):
    wb = openpyxl.Workbook()
    for i, satirlar in enumerate(sayfalar):
        ws = wb.active if i == 0 else wb.create_sheet(f"Sayfa{i + 1}")
        for r in satirlar:
            ws.append(r)
    wb.save(yol)
    return yol


def ozet(satirlar):
    return [(s.hesap_kodu, s.fis_tarihi, s.fis_no, s.borc, s.alacak) for s in satirlar]


def test_standart_bicim(tmp_path):
    y = yaz(tmp_path / "m.xlsx", UST + [("191.10.20 %20 İndirilecek KDV",), BAS,
            (datetime(2026, 9, 30), "Mahsup", "1", "05/09/2026-AAA2026000000001-SATICI 1", 200, None, 200, "B")])
    s, bilgi = muavin_oku(y)
    assert ozet(s) == [("191.10.20", date(2026, 9, 30), "1", Decimal("200"), Decimal("0"))]
    assert s[0].belge_no == "AAA2026000000001" and s[0].unvan == "SATICI 1" and bilgi["firma"] == "ÖRNEK TİCARET LTD. ŞTİ."


def test_kucuk_harf_baslik_ve_ilk_sutun_bos(tmp_path):
    """'Tarih' başlığı (Python'da 'Tarih'.upper() == 'TARIH') ve A sütunu boş döküm eskiden hiç satır vermiyordu."""
    y = yaz(tmp_path / "m.xlsx", UST + [(None, "320.01.001 SATICI A",),
            (None, "Tarih", "Fiş Tipi", "Fiş No", "Açıklama", "Borç", "Alacak", "Bakiye"),
            (None, "15.09.2026", "Tediye", 7, "ÖDEME", "1.250,50", None, None),
            (None, "16.09.2026", "Mahsup", 8.0, "FATURA", None, "3.000,00", None)])
    s, _ = muavin_oku(y)
    assert ozet(s) == [("320.01.001", date(2026, 9, 15), "7", Decimal("1250.50"), Decimal("0")),
                       ("320.01.001", date(2026, 9, 16), "8", Decimal("0"), Decimal("3000.00"))]


@pytest.mark.parametrize("metin,deger", [
    ("1.234,56", "1234.56"), ("1,234.56", "1234.56"), ("1234.56", "1234.56"), ("1234,56", "1234.56"),
    ("1.234", "1234"), ("1.234.567,8", "1234567.8"), ("(1.234,56)", "-1234.56"), ("1.234,56-", "-1234.56"),
    ("-15,00", "-15.00"), ("1.234,56 TL", "1234.56"), ("-", "0"), ("", "0"), (12.5, "12.5"), (None, "0")])
def test_tutar_bicimleri(metin, deger):
    assert _dec(metin) == Decimal(deger)


def test_tutar_okunamazsa_satir_bildirilir(tmp_path):
    y = yaz(tmp_path / "m.xlsx", UST + [("100.01 KASA",), BAS, (datetime(2026, 1, 2), "Tahsil", "1", "X", "abc", None)])
    with pytest.raises(ValueError, match="satır 6"):
        muavin_oku(y)


def test_tarih_bicimleri():
    assert _tarih("30/09/2026") == _tarih("30.09.2026") == _tarih("2026-09-30") == _tarih("30-09-2026") \
        == _tarih("30.09.2026 00:00:00") == date(2026, 9, 30)
    assert _tarih("Devreden") is None


def test_excel_seri_tarih(tmp_path):
    y = yaz(tmp_path / "m.xlsx", UST + [("100.01 KASA",), BAS, (46295, "Tahsil", "1", "X", 10, None)])
    assert muavin_oku(y)[0][0].fis_tarihi == date(2026, 9, 30)


def test_devir_nakli_yekun_ve_toplam_satirlari_hareket_sayilmaz(tmp_path):
    y = yaz(tmp_path / "m.xlsx", UST + [("120.01 MÜŞTERİ A",), BAS,
            (datetime(2026, 1, 1), None, None, "DEVREDEN BAKİYE", 5000, None, 5000, "B"),
            (datetime(2026, 1, 5), "Mahsup", "3", "FATURA", 1200, None, 6200, "B"),
            (None, None, None, "Nakli Yekün", 6200, 0),
            (datetime(2026, 1, 31), None, None, "Ara Toplam", 6200, 0),
            ("120.01 Toplamı", None, None, None, 6200, 0),
            (None, None, None, "GENEL TOPLAM", 6200, 0)])
    assert ozet(muavin_oku(y)[0]) == [("120.01", date(2026, 1, 5), "3", Decimal("1200"), Decimal("0"))]


def test_acilis_fisi_numarali_ise_okunur(tmp_path):
    y = yaz(tmp_path / "m.xlsx", UST + [("100.01 KASA",), BAS, (datetime(2026, 1, 1), "Açılış", "1", "DEVİR AÇILIŞ", 900, None)])
    assert ozet(muavin_oku(y)[0]) == [("100.01", date(2026, 1, 1), "1", Decimal("900"), Decimal("0"))]


def test_sayfa_sonu_tekrarlanan_baslik(tmp_path):
    """Sayfa sonunda başlık ve hesap satırı tekrarlanır; hareketler doğru hesaba yazılır, hiçbiri kaybolmaz."""
    y = yaz(tmp_path / "m.xlsx", UST + [("102.01 BANKA",), BAS,
            (datetime(2026, 2, 1), "Tahsil", "1", "A", 10, None),
            ("Sayfa 1 / 2",), ("MUAVİN DEFTER",), ("102.01 BANKA",), BAS,
            (datetime(2026, 2, 2), "Tahsil", "2", "B", 20, None),
            ("102.02 BANKA 2",), BAS,
            (datetime(2026, 2, 3), "Tediye", "3", "C", None, 30)])
    assert [(x[0], x[2]) for x in ozet(muavin_oku(y)[0])] == [("102.01", "1"), ("102.01", "2"), ("102.02", "3")]


def test_kod_ve_ad_ayri_hucrede(tmp_path):
    """'191.10.20' ve hesap adı ayrı hücredeyse satırlar önceki hesaba yazılıyordu."""
    y = yaz(tmp_path / "m.xlsx", UST + [("100.01 KASA",), BAS, (datetime(2026, 3, 1), "Tahsil", "1", "A", 10, None),
            ("191.10.20", "%20 İndirilecek KDV"), BAS, (datetime(2026, 3, 2), "Mahsup", "2", "B", 20, None),
            ("Hesap Kodu : 391.10.20 %20 Hesaplanan KDV",), BAS, (datetime(2026, 3, 3), "Mahsup", "3", "C", None, 5)])
    s, _ = muavin_oku(y)
    assert [(x.hesap_kodu, x.hesap_adi) for x in s] == [("100.01", "KASA"), ("191.10.20", "%20 İndirilecek KDV"),
                                                        ("391.10.20", "%20 Hesaplanan KDV")]
    assert s[1].kdv_orani == Decimal("20")


def test_birden_cok_sayfa(tmp_path):
    y = yaz(tmp_path / "m.xlsx", UST + [("100.01 KASA",), BAS, (datetime(2026, 4, 1), "Tahsil", "1", "A", 10, None)],
            [(datetime(2026, 4, 2), "Tahsil", "2", "B", 20, None), ("600.01 SATIŞLAR",), BAS,
             (datetime(2026, 4, 3), "Mahsup", "3", "C", None, 30)])
    s, _ = muavin_oku(y)
    assert [(x.hesap_kodu, x.fis_no) for x in s] == [("100.01", "1"), ("100.01", "2"), ("600.01", "3")]
    assert len({x.satir for x in s}) == 3


def test_tarih_araligi_okunur(tmp_path):
    """Görev 34: muavinin kapsadığı dönem ("Tarih Aralığı") silinen fiş kararında kullanılır."""
    y = yaz(tmp_path / "m.xlsx", [("MUAVİN DEFTER",), ("ÖRNEK",), ("Dönem :", "01/01/2026-31/12/2026"),
                                  ("Tarih Aralığı :", "01/01/2026-30/09/2026"), ("100.01 KASA",), BAS,
                                  (datetime(2026, 3, 1), "Tahsil", "1", "A", 10, None)])
    assert muavin_oku(y)[1]["aralik"] == (date(2026, 1, 1), date(2026, 9, 30))
    y2 = yaz(tmp_path / "m2.xlsx", UST + [("100.01 KASA",), BAS, (datetime(2026, 3, 1), "Tahsil", "1", "A", 10, None)])
    assert "aralik" not in muavin_oku(y2)[1]
