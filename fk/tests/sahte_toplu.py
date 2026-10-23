"""Program testleri için sahte toplu süreç: Luca'ya bağlanmadan durum.json / ozet.json üretir."""
import argparse
import json
import time
from datetime import date
from pathlib import Path

from fatura_kontrol.luca import toplu as T
from fatura_kontrol import depo

ap = argparse.ArgumentParser()
ap.add_argument("--sessiz", action="store_true"); ap.add_argument("--cikti"); ap.add_argument("--ay")
ap.add_argument("--idler"); ap.add_argument("--liste", action="store_true"); ap.add_argument("--adim")
ap.add_argument("--yalniz-fatura", action="store_true")
a = ap.parse_args()
k = Path(a.cikti)
if a.liste:
    il = T.Ilerleme(k, date.today(), date.today(), [])
    il.olay("giris", "Açılan Chrome penceresinde Luca'ya giriş yapın"); time.sleep(0.5)
    T.liste_yaz([{"ad": "EXPO İNŞ", "id": "1"}, {"ad": "RAKİKOM", "id": "2"}, {"ad": "YENİ FİRMA", "id": "3"}])
    il.yaz(asama="bitti", mesaj="3 firma alındı")
    raise SystemExit
firmalar = [f for f in T.liste_oku() if f["id"] in a.idler.split(",")] if a.idler else \
    [f for f in T.liste_oku() if f["dahil"]]
y, m = map(int, a.ay.split("-"))
if a.yalniz_fatura:           # Tek firma › "Luca'dan al": yalnız e-belgeler firmanın dönem arşivine
    import zipfile, sys as _s
    from test_luca_otomasyon import ubl, FIRMA_VKN
    il = T.Ilerleme(k, date(y, m, 1), date(y, m, 28), firmalar)
    il.olay("giris", "Açılan Chrome penceresinde Luca'ya giriş yapın"); time.sleep(0.5)
    for f in firmalar:
        r = depo.donem_klasoru(f["ad"], date(y, m, 1)); r.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(r / "faturalar.zip", "w") as z:
            z.writestr("gib_efatura_alis/AAA2026000000001.xml", ubl("AAA2026000000001", f"{y}-{m:02d}-05", "1", FIRMA_VKN, "1000.00", "200.00", 20))
            z.writestr("gib_efatura_satis/EX02026000000001.xml", ubl("EX02026000000001", f"{y}-{m:02d}-10", FIRMA_VKN, "9", "2000.00", "400.00", 20))
        depo.firma_bilgisi_yaz(f["ad"], FIRMA_VKN, f["id"])
        adimlar = [{"adim": "e-Fatura Alış: sayfa 1 indirildi", "durum": "tamam", "ayrinti": "1 belge, 1 KB"}]
        adimlar.append({"adim": "e-Fatura Satış: sayfa 1 indirildi", "durum": "tamam", "ayrinti": "1 belge, 1 KB"} if a.adim == "gib_efatura_satis"
                       else {"adim": "e-Fatura Satış", "durum": "hata", "ayrinti": "İndirme zaman aşımı"})
        (r / "adimlar.json").write_text(json.dumps(adimlar, ensure_ascii=False), encoding="utf-8")
        T.ozet_yaz([{"ad": f["ad"], "id": f["id"], "vkn": FIRMA_VKN, "durum": "Belge/muavin yok", "fatura": 0, "indirme_hatasi": [], "sorunlar": {}, "rapor": None, "rapor_id": None, "sure": 0, "zaman": ""}], date(y, m, 1), date(y, m, 28), k)
    il.yaz(asama="bitti", mesaj="bitti")
    raise SystemExit
bas, bit = date(y, m, 1), date(y, m, 28)
onceki = {r["id"]: r for r in T.onceki_sonuclar(k)}
sonuclar = [r for r in onceki.values() if r["id"] not in {f["id"] for f in firmalar}]
il = T.Ilerleme(k, bas, bit, firmalar)
il.olay("giris", "Açılan Chrome penceresinde Luca'ya giriş yapın"); time.sleep(3)
il.olay("giris_tamam", "Luca oturumu açık")
for i, f in enumerate(firmalar, 1):
    il.yaz(sira=i, firma=f["ad"], adimlar=[])
    il.olay("adim", "✓ e-Fatura Alış: sayfa 1 indirildi"); time.sleep(0.6)
    rak = f["ad"].startswith("RAK")
    adimlar = [{"adim": "e-Fatura Alış: sayfa 1 indirildi", "durum": "tamam", "ayrinti": "12 belge, 40 KB"},
               {"adim": "e-Fatura Satış: indirme", "durum": "atlandı", "ayrinti": "listede belge yok"},
               {"adim": "Muavin indirildi", "durum": "tamam", "ayrinti": "50 KB"}]
    if not rak:
        adimlar.append({"adim": "e-Arşiv Alış: indirme", "durum": "atlandı", "ayrinti": "listede belge yok"})
    if rak and a.adim != "gib_ebelge_alis":
        adimlar.append({"adim": "e-Arşiv Alış", "durum": "hata", "ayrinti": "Uyarı kutusu kapanmadı"})
    elif rak:
        adimlar.append({"adim": "e-Arşiv Alış: sayfa 1 indirildi", "durum": "tamam", "ayrinti": "3 belge, 5 KB"})
    oz = T.adim_ozeti(adimlar)
    rid = None
    if not rak:     # EXPO: tevkifatlı alış faturası içeren sahte rapor
        r = depo.donem_klasoru(f["ad"], bas); r.mkdir(parents=True, exist_ok=True)
        rid = depo.rapor_id(r)
        (r / "rapor.json").write_text(json.dumps({"id": rid, "firma": f["ad"], "vkn": "123", "donem": {},
            "uyarilar": [], "alis": 1, "satis": 0, "fatura_sayisi": 1, "durumlar": [], "sonuclar": [],
            "faturasi_olmayanlar": [], "fatura_disi": [], "faturalar": [], "dovizliler": [], "tevkifatlar": [
            {"yon": "Alış", "tarih": "2026-09-12", "belge_no": "ABC2026000000001", "karsi_taraf": "NAKLİYE LTD",
             "vkn": "1234567890", "matrah": 14000, "kdv": 2800, "kod": "624", "tur": "YÜK TAŞIMACILIĞI HİZMETİ",
             "oran": "2/10", "tutar": 560, "odenecek": 16240},
            {"yon": "Alış", "tarih": "2026-10-02", "belge_no": "ABC2026000000099", "karsi_taraf": "SONRAKİ AY LTD",
             "vkn": "1", "matrah": 1000, "kdv": 200, "kod": "624", "tur": "YÜK", "oran": "2/10", "tutar": 40, "odenecek": 1160},
            {"yon": "Satış", "tarih": "2026-09-13", "belge_no": "EX02026000000009", "karsi_taraf": "MÜŞTERİ",
             "vkn": "9", "matrah": 1000, "kdv": 200, "kod": "601", "tur": "YAPIM İŞLERİ", "oran": "4/10",
             "tutar": 80, "odenecek": 1120}]}, ensure_ascii=False), encoding="utf-8")
    hata = [o["ad"] for o in oz if o["durum"] in ("hata", "yarim")]
    sonuclar.append({"ad": f["ad"], "id": f["id"], "vkn": "123", "durum": "Eksik indirme" if hata else "Sorun var",
                     "fatura": 12, "sorunlar": {"Muavinde yok": 2}, "adimlar": oz, "kdv2": 0 if rak else 560.0,
                     "kdv2_adet": 0 if rak else 1, "indirme_hatasi": hata, "rapor": None, "rapor_id": rid, "sure": 61})
    T.ozet_yaz(sonuclar, bas, bit, k)
il.yaz(asama="bitti", mesaj="Tamamlandı")
print("bitti", json.dumps(len(sonuclar)))
