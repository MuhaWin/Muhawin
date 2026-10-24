"""Görev 40: harfli / çok seviyeli / baştaki sıfırlı cari alt hesapları muavinde kendi hesabına okunur.

Eskiden hesap başlığı yalnız rakamlı alt gruplarla (^\\d{3}(\\.\\d+)*) tanınıyordu: "320.P.0006 PETROL" gibi harfli cari
başlıkları atlanıyor, satırlar muavinde bir önceki hesaba (ör. 302.01) yazılıyordu. Sonuç: fişte bütün cariler tek
hesapta, cari alt hesap muavinleri boş, kayıt ekranı geçmişten yanlış cari öğreniyor. Veriler sahtedir."""
import io
import sys
import zipfile
from collections import defaultdict
from datetime import datetime
from decimal import Decimal as D
from pathlib import Path

import openpyxl

from fatura_kontrol.muavin_okuyucu import muavin_oku

sys.path.insert(0, str(Path(__file__).parent))
from test_cari_vkn import TC, V1, _ubl  # noqa: E402
from test_program import istemci  # noqa: E402,F401  (fixture)

BAS = ("TARİH", "TİP", "FİŞ NO", "AÇIKLAMA", "BORÇ", "ALACAK", "BAKİYE", "B/A")
# Luca'da (kod sırasıyla) 302 hesabı harfli carilerden hemen önce gelir; eski okuyucu carileri ona yazıyordu
CARILER = [("320.A.0001", "AKSA LTD"), ("320.P.0006", "PETROL OFİSİ A.Ş."), ("320.Ş.0012", "ŞAHİN TİC."), ("320.Ç.0003", "ÇELİK A.Ş."),
           ("320.01.0302", "ACME (baştaki sıfır)"), ("320.01.302", "ACME 2"), ("320.02.001.0007", "DÖRT SEVİYELİ"), ("120.M.0042", "MÜŞTERİ A.Ş."),
           ("320.01.P.12", "KARMA SEVİYE"), ("320.ğ.0002", "küçük harfli ğ"), ("120.İ.0005", "İPEK A.Ş."), ("320.Ö.0001", "ÖZ LTD"),
           ("320.Ü.0009", "ÜNAL"), ("320.Ğ.0004", "GÜNEY")]


def _fis(no, gun, cari, tutar):
    """Bir alış faturası fişi: 770 borç, 191 borç, cari alacak (müşteride tersi)."""
    kdv = (tutar * D("0.2")).quantize(D("0.01"))
    musteri = cari.startswith("120")
    acik = f"{gun:02d}/09/2026-ABC20260000000{no:02d}-{cari}"
    return [("770.01" if not musteri else "600.01", tutar, musteri, acik), ("191.10.20" if not musteri else "391.10.20", kdv, musteri, acik),
            (cari, tutar + kdv, not musteri, acik)]


def _muavin(yol, ad_ayri=False):
    """Luca muavin dökümü: her hesap için başlık + sütun başlığı + hareketler (hesaplar kod sırasıyla)."""
    fisler = {i + 1: _fis(i + 1, 1 + i, c, D(100 * (i + 1))) for i, (c, _) in enumerate(CARILER)}
    hareket = defaultdict(list)
    for no, satirlar in fisler.items():
        for hesap, tutar, alacakta, acik in satirlar:
            hareket[hesap].append((datetime(2026, 9, no), "Mahsup", str(no), acik, None if alacakta else float(tutar), float(tutar) if alacakta else None))
    adlar = dict(CARILER) | {"302.01": "ERTELENMİŞ FİN. KİR. BORÇ.", "770.01": "GENEL YÖNETİM GİDERLERİ", "191.10.20": "%20 İndirilecek KDV",
                             "600.01": "YURT İÇİ SATIŞLAR", "391.10.20": "%20 Hesaplanan KDV"}
    hareket["302.01"].append((datetime(2026, 9, 30), "Mahsup", "99", "KİRA", 50.0, None))
    wb = openpyxl.Workbook(); ws = wb.active
    for r in [("MUAVİN DEFTER",), ("INNOCAP ÖRNEK",), ("Tarih Aralığı :", "01/01/2026-31/12/2026")]:
        ws.append(r)
    sira = sorted(hareket, key=lambda k: ("302" if k.startswith("302") else k[:3], k))   # Luca sırası: hesap koduna göre
    for kod in sira:
        ws.append((kod, adlar[kod]) if ad_ayri else (f"{kod} {adlar[kod]}",))
        ws.append(BAS)
        for x in hareket[kod]:
            ws.append(x)
    wb.save(yol)
    return fisler


def test_harfli_ve_cok_seviyeli_cari_basliklari(tmp_path):
    for ayri in (False, True):
        fisler = _muavin(tmp_path / "m.xlsx", ad_ayri=ayri)
        s, _ = muavin_oku(tmp_path / "m.xlsx")
        hesaplar = {x.hesap_kodu for x in s}
        assert {c for c, _ in CARILER} <= hesaplar, sorted(hesaplar)
        # 302.01'de yalnız kendi satırı var (cariler oraya yazılmıyor)
        assert [(x.fis_no, x.borc) for x in s if x.hesap_kodu == "302.01"] == [("99", D("50"))]
        # muavinden kurulan her fiş Luca'daki fişle satır satır aynı (hesap kodu, borç / alacak)
        grup = defaultdict(list)
        for x in s:
            grup[x.fis_no].append((x.hesap_kodu, x.borc, x.alacak))
        for no, satirlar in fisler.items():
            bek = sorted((h, D("0") if a else t, t if a else D("0")) for h, t, a, _ in satirlar)
            assert sorted(grup[str(no)]) == bek, (no, ayri)
        assert next(x for x in s if x.hesap_kodu == "320.Ş.0012").hesap_adi == "ŞAHİN TİC."


def test_muavin_api_cari_alt_hesap_dolu_ve_gecmis_dogru_cari(istemci, tmp_path):  # noqa: F811
    """Muavin ekranının verisi (/api/muavin): harfli cari alt hesabın hareketleri kendi kodunda;
    kayıt ekranının geçmişi aynı VKN'li faturanın kaydedildiği cariyi (320.P.0006) öğrenir, 302'yi değil."""
    c, _ = istemci
    m = tmp_path / "muavin.xlsx"; _muavin(m)
    zb = io.BytesIO()
    with zipfile.ZipFile(zb, "w") as z:
        z.writestr("2.xml", _ubl("ABC2026000000002", "2026-09-02", V1, "PETROL OFİSİ A.Ş.", "200.00", "40.00"))   # muavinde fiş 2 → 320.P.0006
        z.writestr("9.xml", _ubl("ABC2026000000090", "2026-09-20", V1, "PETROL OFİSİ A.Ş."))                    # aynı satıcı, kayıtsız
        z.writestr("t.xml", _ubl("XYZ2026000000001", "2026-09-21", TC, "AHMET YILMAZ"))   # firmanın VKN'si alıcı olarak çoğunlukta kalsın
    r = c.post("/api/kontrol", data={"bas": "2026-09-01", "bit": "2026-09-30"},
               files=[("faturalar", ("p.zip", zb.getvalue(), "application/zip")), ("muavinler", ("muavin.xlsx", m.read_bytes(), "application/octet-stream"))])
    assert r.status_code == 200, r.text
    rid = r.json()["id"]
    satir = c.get("/api/muavin", params={"id": rid}).json()["satirlar"]
    p = [x for x in satir if x["hesap_kodu"] == "320.P.0006"]
    assert len(p) == 1 and p[0]["alacak"] == 240 and not [x for x in satir if x["hesap_kodu"] == "302.01" and x["fis_no"] != "99"]
    a = c.get("/api/kayit/adaylar", params={"id": rid}).json()
    f = {x["belge_no"]: x for x in a["faturalar"]}
    assert f["ABC2026000000002"]["kayitli"] and f["ABC2026000000090"]["gecmis"]["cari"] == "320.P.0006" and f["ABC2026000000090"]["gecmis"]["eslesme"] == "vkn"


def test_aciklama_satiri_hesap_basligi_sayilmaz(tmp_path):
    """Tarihsiz açıklama satırı ("320 nolu fatura iptal", "100 adet …") hesabı değiştirmez; gerçek başlıklar tanınır."""
    wb = openpyxl.Workbook(); ws = wb.active
    for r in [("MUAVİN DEFTER",), ("X",), ("320.P.0006 PETROL",), BAS, (datetime(2026, 9, 1), "Mahsup", "1", "A", None, 10),
              ("320 nolu fatura iptal edildi",), ("100 adet koli",), ("320 NOLU FATURA",), (datetime(2026, 9, 2), "Mahsup", "2", "B", None, 20),
              ("320 SATICILAR",), BAS, (datetime(2026, 9, 3), "Mahsup", "3", "C", None, 30)]:
        ws.append(r)
    wb.save(tmp_path / "m.xlsx")
    s, _ = muavin_oku(tmp_path / "m.xlsx")
    assert [(x.fis_no, x.hesap_kodu) for x in s] == [("1", "320.P.0006"), ("2", "320.P.0006"), ("3", "320")]
