"""Test verisi üreticisi: fk/tests/veri_isletme_gelir_gider.xlsx ve fk/tests/veri_mikro_muavin.xlsx.

Dosyalar tamamen uydurmadır: firma, kişi adı, VKN ve belge numaraları gerçek değildir (VKN'ler biçimce geçerli ama
rastgele). Testler ağsız ve hızlı kalsın diye üretilmiş hâlleri depoya eklenir; değişiklikte yeniden üretin:

    cd fk && python tests/veri_uret.py
"""
from __future__ import annotations

import random
from datetime import date, timedelta
from pathlib import Path

import openpyxl

KLASOR = Path(__file__).resolve().parent


def isletme_gelir_gider(yol: Path) -> None:
    """Luca İşletme Defteri › Gelir/Gider Raporu düzeni (Giderler ve Gelirler sayfaları).

    test_isletme.py::test_gelir_gider_raporu_excel: KDV'li 11 belge; GIB2026000000045 hesaplanan KDV 5.833,33;
    SMM2026000000707 indirilecek KDV 400; GIB2026000000047 gelir 30.000."""
    wb = openpyxl.Workbook()
    gider = wb.active
    gider.title = "Giderler"
    gider.append(["ÖRNEK DANIŞMANLIK – İŞLETME DEFTERİ GİDERLER (01/09/2026 - 30/09/2026)"])
    gider.append(["#", "EVRAK NO", "TARİH", "AÇIKLAMA", "GİDER", "ALINAN EMTİA", "İNDİRİLECEK KDV", "KREDİLİ TUTAR"])
    giderler = [  # evrak, gün, açıklama, gider, emtia, kdv
        ("SMM2026000000707", 3, "Serbest meslek makbuzu – örnek müşavirlik", 2000, 0, 400),
        ("GIB2026000000101", 5, "Kırtasiye alımı", 500, 0, 100),
        ("GIB2026000000102", 9, "Ofis kirası", 10000, 0, 2000),
        ("GIB2026000000103", 12, "Elektrik faturası", 750, 0, 150),
        ("GIB2026000000104", 15, "Emtia alımı", 0, 8000, 1600),
        ("GIB2026000000105", 20, "Telefon faturası", 400, 0, 80),
        ("FIS2026000000001", 22, "Kargo gideri (KDV'siz)", 120, 0, 0),
    ]
    for i, (no, gun, ac, g, e, k) in enumerate(giderler, 1):
        gider.append([i, no, date(2026, 9, gun), ac, g, e, k, 0])
    gelir = wb.create_sheet("Gelirler")
    gelir.append(["ÖRNEK DANIŞMANLIK – İŞLETME DEFTERİ GELİRLER (01/09/2026 - 30/09/2026)"])
    gelir.append(["#", "EVRAK NO", "TARİH", "AÇIKLAMA", "GELİR", "SATILAN EMTİA", "HESAPLANACAK KDV", "KREDİLİ TUTAR"])
    gelirler = [
        ("GIB2026000000045", 6, "Danışmanlık hizmeti – Örnek Alıcı A.Ş.", 29166.67, 0, 5833.33),
        ("GIB2026000000046", 14, "Danışmanlık hizmeti", 5000, 0, 1000),
        ("GIB2026000000047", 18, "Yıllık sözleşme bedeli", 30000, 0, 6000),
        ("GIB2026000000048", 24, "Emtia satışı", 0, 12000, 2400),
        ("GIB2026000000049", 28, "Eğitim hizmeti", 2500, 0, 500),
    ]
    for i, (no, gun, ac, g, e, k) in enumerate(gelirler, 1):
        gelir.append([i, no, date(2026, 9, gun), ac, g, e, k, 0])
    wb.save(yol)


def mikro_muavin(yol: Path, hareket: int = 4475) -> None:
    """Mikro › Hesap hareket dökümü düzeni: başlık satırı, her hesap için "<kod> <ad> Hesap hareket dökümü (...)"
    satırı, DEVREDEN, hareketler, Toplam.

    test_isletme.py::test_mikro_muavin: 4475 hareket + 190 Devreden KDV'nin dönem başı satırı = 4476 muavin satırı;
    KS12026001130211 belgesi 191 %1 hesabında 2,18 borç ("ÖRNEK MARKETLER A.Ş."); AAS2026000004604 391 %20'de."""
    rnd = random.Random(2026)
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(["HESAP KODU", "Kayıt no", "Tarih", "Sıra", "Y.No", "Fiş tipi", "Belge türü", "Evrak no", "Cari ismi",
               "Entegrasyon kaynağı", "Açıklama", "TL Borç", "TL Alacak"])
    bas, bit = date(2026, 9, 1), date(2026, 9, 30)
    donem = f"({bas:%d.%m.%Y}-{bit:%d.%m.%Y})"
    kayit = [0]

    def blok(kod, ad, satirlar, devir=None):
        ws.append([f"{kod} {ad} Hesap hareket dökümü  {donem}"])
        if devir is not None:
            ws.append(["", "", bas, "", "", "", "", "", "", "", "DEVREDEN", devir, None])
        for tarih, evrak, cari, acik, borc, alacak in satirlar:
            kayit[0] += 1
            ws.append(["", f"K{kayit[0]}", tarih, 1, kayit[0], "Mahsup", "", evrak, cari, "", acik, borc, alacak])
        ws.append(["", "", None, "", "", "", "", "", "", "", "Toplam", None, None])

    gun = lambda: bas + timedelta(days=rnd.randrange(30))
    saticilar = ["ÖRNEK MARKETLER A.Ş.", "DEMO GIDA LTD. ŞTİ.", "TEST AKARYAKIT A.Ş.", "UYDURMA KIRTASİYE LTD. ŞTİ."]
    alicilar = ["ÖRNEK ALICI A.Ş.", "DENEME TURİZM LTD. ŞTİ.", "SAHTE İNŞAAT A.Ş."]

    # 190 Devreden KDV: dönem başı bakiyesi (DEVREDEN satırı) → muavinde 1 satır, hareket sayısına girmez
    blok("190.01", "Devreden KDV", [], devir=12500.00)
    sabit = [
        ("191.01.01", "İndirilecek KDV %1", [(date(2026, 9, 11), "KS12026-1130211", "ÖRNEK MARKETLER A.Ş.",
                                               "Al.fat. : market alışverişi", 2.18, None)]),
        ("391.01.20", "Hesaplanan KDV %20", [(date(2026, 9, 16), "1", "ÖRNEK ALICI A.Ş.",
                                               "Sat.fat : AAS2026000004604/ÖRNEK ALICI", None, 400.00)]),
    ]
    kalan = hareket - sum(len(s) for _, _, s in sabit)
    # kalan hareketler: 191 / 391 / 770 / 600 / 320 / 120 hesaplarına dağıtılır (her belge KDV + matrah + cari)
    dolgu = {"191.01.20": [], "391.01.10": [], "770.01": [], "600.01": [], "320.01": [], "120.01": []}
    sira = 0
    while kalan > 0:
        sira += 1
        t = gun()
        if sira % 2:
            cari = rnd.choice(saticilar)
            no = f"GIB2026{100000000 + sira:09d}"
            matrah = round(rnd.uniform(50, 5000), 2)
            kdv = round(matrah * 0.20, 2)
            for kod, b, a in (("770.01", matrah, None), ("191.01.20", kdv, None), ("320.01", None, round(matrah + kdv, 2))):
                if kalan <= 0:
                    break
                dolgu[kod].append((t, no, cari, f"Al.fat. : {no}/{cari}", b, a))
                kalan -= 1
        else:
            cari = rnd.choice(alicilar)
            no = f"AAS2026{200000000 + sira:09d}"
            matrah = round(rnd.uniform(100, 8000), 2)
            kdv = round(matrah * 0.10, 2)
            for kod, b, a in (("120.01", round(matrah + kdv, 2), None), ("600.01", None, matrah), ("391.01.10", None, kdv)):
                if kalan <= 0:
                    break
                dolgu[kod].append((t, str(sira), cari, f"Sat.fat : {no}/{cari}", b, a))
                kalan -= 1
    adlar = {"191.01.20": "İndirilecek KDV %20", "391.01.10": "Hesaplanan KDV %10", "770.01": "Genel Yönetim Giderleri",
             "600.01": "Yurtiçi Satışlar", "320.01": "Satıcılar", "120.01": "Alıcılar"}
    hesaplar = [(k, a, s) for k, a, s in sabit] + [(k, adlar[k], sorted(v)) for k, v in dolgu.items()]
    for kod, ad, s in sorted(hesaplar):
        blok(kod, ad, s)
    wb.save(yol)


if __name__ == "__main__":
    isletme_gelir_gider(KLASOR / "veri_isletme_gelir_gider.xlsx")
    mikro_muavin(KLASOR / "veri_mikro_muavin.xlsx")
    print("Yazıldı:", KLASOR / "veri_isletme_gelir_gider.xlsx", KLASOR / "veri_mikro_muavin.xlsx")
