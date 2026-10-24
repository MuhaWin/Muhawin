"""Sahte Elektra muavin dökümü (gerçek firma verisi yok): test_denetim._mikro ile aynı kayıtlar, Elektra düzeninde."""
from datetime import datetime

BASLIK = ["Grup", "Fiş Tarihi", "Fiş Numarası", "Hesap Kodu", "Hesap Adı", "Dok Tipi", "Dok Tipi", "Fiş Notu",
          "Detay Notları", "Borç", "Alacak", "Bakiye", "Dvz Borç", "Dvz Alacak", "Dvz Bakiye"]


def elektra_yaz(y, satis_matrah=2000, cari_alis=1200, dolgu=0):
    """dolgu: hız / bellek denemesi için eklenen sahte 770 hareketi sayısı (her biri ayrı fiş)."""
    import openpyxl
    wb = openpyxl.Workbook(write_only=True); ws = wb.create_sheet("ÖRNEK TİCARET A.Ş. MUAVİN")
    ws.append(BASLIK)
    d1, d2 = datetime(2026, 9, 5), datetime(2026, 9, 10)
    al, sa = "AAA2026000000001 SATICI alış faturası", "EX02026000000001 ALICI 24-12/02-01 konaklama"

    def hesap(kod, ad, satirlar, on=""):
        b = sum(s[3] or 0 for s in satirlar); a = sum(s[4] or 0 for s in satirlar)
        ws.append([f"{on} -> {kod} {ad} / TL", None, None, None, None, None, None, None, None, b, a, b - a, 0, 0, 0])
        for fis_no, t, tip, borc, alacak, notu in satirlar:
            ws.append([None, t, fis_no, kod, ad, tip, tip, notu, "", borc, alacak, (borc or 0) - (alacak or 0), None, None, None])
        ws.append([None] * 15)

    hesap("120.01.01.A010", "ALICI", [("0011", d2, "Fatura", 2400, None, sa)])
    hesap("191.01.001", "İndirilecek KDV %20", [("0010", d1, "Fatura", 200, None, al)], on="KDV")
    hesap("320.01.01.032", "SATICI", [("0010", d1, "Fatura", None, cari_alis, al)])
    hesap("360.01.003", "Serbest Meslek Stopajı", [("0012", d2, "Makbuz", None, 500, "Serbest meslek makbuzu")])
    hesap("391.01.002", "Hesaplanan KDV %20", [("0011", d2, "Fatura", None, 400, sa)])
    hesap("600.01.06.001", "Yurtiçi Satışlar", [("0011", d2, "Fatura", None, satis_matrah, sa)])
    hesap("770.01.01.001", "Genel Yönetim Giderleri", [("0010", d1, "Fatura", 1000, None, al)])
    if dolgu:
        ws.append([" -> 770.01.01.099 Diğer Giderler / TL", None, None, None, None, None, None, None, None, dolgu, 0, dolgu, 0, 0, 0])
        for i in range(dolgu):
            ws.append([None, datetime(2026, 1 + i % 6, 1 + i % 28), str(100000 + i), "770.01.01.099", "Diğer Giderler", "Diğer",
                       "Diğer", f"gider {i} nolu", "", 1, None, 1, None, None, None])
    wb.save(y)
