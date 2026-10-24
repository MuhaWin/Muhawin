"""Kontrol raporunun kaydı ve okunması: dönem klasörüne Excel + JSON, masaüstünde ayrıca geçmiş (sqlite).

Web sunucusundan (web/app.py: FastAPI, Playwright zinciri) bağımsızdır; Mikro Denetim ve KDV beyannamesi tarayıcıda
(Pyodide) da bu modülle çalışır. sqlite3 yoksa ya da tarayıcıdaysa geçmiş kaydı sessizce atlanır.
"""
from __future__ import annotations

import json
import sys
from collections import Counter
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path

from . import depo
from .eslestirme import BILGI_DURUMLARI, TUM_DURUMLAR, esle, fatura_anahtari, fatura_tipi, fis_anahtari
from .fatura_okuyucu import faturalari_oku, vkn_tespit
from .rapor import excel_yaz, tevkifat_satirlari

try:
    import sqlite3
except ImportError:                       # Pyodide'de sqlite3 ayrı paket
    sqlite3 = None


def _db():
    """Geçmiş veritabanı (veri/gecmis.sqlite); tarayıcıda ya da sqlite3 yoksa None."""
    if sqlite3 is None or sys.platform == "emscripten":
        return None
    con = sqlite3.connect(depo.veri() / "gecmis.sqlite")
    con.execute("""CREATE TABLE IF NOT EXISTS calisma (
        id TEXT PRIMARY KEY, zaman TEXT, firma TEXT, vkn TEXT, bas TEXT, bit TEXT,
        fatura_sayisi INTEGER, sorunlu INTEGER, ozet TEXT)""")
    return con


def _tarih(s: str | None) -> date | None:
    return datetime.strptime(s, "%Y-%m-%d").date() if s else None


def _sayi(x) -> float:
    return float(x) if isinstance(x, Decimal) else x


def _t(d: date | None) -> str | None:
    return d.isoformat() if d else None


def _json(rapor, faturalar, uyarilar, firma, vkn) -> dict:
    sonuclar = [{
        "durum": s.durum, "sorunlu": s.durum not in BILGI_DURUMLARI,
        "yon": "Alış" if s.fatura.yon == "ALIS" else "Satış",
        "kontrol": s.kontrol, "belge_no": s.fatura.belge_no, "tarih": _t(s.fatura.tarih),
        "fatura_tipi": fatura_tipi(s.fatura),
        "doviz": (f"{s.fatura.doviz} · {s.fatura.tl_kaynak or 'TL yok'}") if getattr(s.fatura, "doviz", None) else "",
        "karsi_taraf": s.fatura.karsi_unvan, "vkn": s.fatura.karsi_vkn,
        "oranlar": ", ".join(f"%{o}" for o in sorted(s.fatura.kdv_oranlari)),
        "fatura_tutari": _sayi(s.fatura_tutari), "muavin_tutari": _sayi(s.muavin_tutari),
        "fark": _sayi(s.fark),
        "hesaplar": ", ".join(sorted({x.hesap_kodu for x in s.satirlar})),
        "fisler": ", ".join(sorted({f"{x.fis_no} ({x.fis_tarihi:%d.%m.%Y})" for x in s.satirlar})),
        "aciklama": s.aciklama, "anahtar": fatura_anahtari(s.fatura),
    } for s in rapor.sonuclar]

    def satir(s):
        d = {"hesap": s.hesap_kodu, "hesap_adi": s.hesap_adi, "fis_tarihi": _t(s.fis_tarihi),
             "fis_no": s.fis_no, "belge_tarihi": _t(s.belge_tarihi), "belge_no": s.belge_no,
             "unvan": s.unvan, "tutar": _sayi(s.net), "aciklama": s.aciklama, "anahtar": fis_anahtari(s)}
        if getattr(s, "uygun", None) is not None:
            d["uygun"] = s.uygun
        return d

    sayac = Counter(s.durum for s in rapor.sonuclar)
    sayac["Faturası bulunamadı"] = sum(1 for s in rapor.faturasi_olmayanlar if getattr(s, "uygun", None) is None)
    red = getattr(rapor, "red_iptal", None) or []
    for b in red:                         # e-fatura dosyalarında olmayan red / iptal faturaları da sayılır
        if not b["faturada"]:
            sayac[b["sonuc"]] += 1
    return {
        "firma": firma, "vkn": vkn,
        "donem": {("Alış" if y == "ALIS" else "Satış"): [_t(b), _t(e)] for y, (b, e) in rapor.donem.items()},
        "kontroller": rapor.calisan_kontroller, "uyarilar": uyarilar,
        "fatura_sayisi": len(faturalar),
        "alis": sum(f.yon == "ALIS" for f in faturalar), "satis": sum(f.yon == "SATIS" for f in faturalar),
        "durumlar": [{"ad": d, "adet": sayac.get(d, 0), "sorunlu": d not in BILGI_DURUMLARI}
                     for d in TUM_DURUMLAR],
        "sonuclar": sonuclar,
        "faturasi_olmayanlar": [satir(s) for s in rapor.faturasi_olmayanlar],
        "fatura_disi": [satir(s) for s in rapor.fatura_disi],
        "red_iptal": [{"belge_no": b["belge_no"], "tarih": _t(b.get("tarih")), "vkn": b.get("vkn", ""), "karsi_taraf": b.get("unvan", ""),
                       "matrah": _sayi(b.get("matrah") or 0), "kdv": _sayi(b.get("kdv") or 0), "yekun": _sayi(b.get("yekun") or 0),
                       "doviz": b.get("doviz", ""), "tur": b.get("tur", ""), "durum": b.get("durum", ""), "ne": b.get("ne", ""),
                       "dosya": b.get("dosya", ""), "yon": {"ALIS": "Alış", "SATIS": "Satış"}.get(b.get("yon"), ""),
                       "faturada": b["faturada"], "muavinde": b["muavinde"], "sonuc": b["sonuc"], "sorunlu": b["muavinde"],
                       "hesaplar": ", ".join(sorted({x.hesap_kodu for x in b["satirlar"]})),
                       "fisler": ", ".join(sorted({f"{x.fis_no} ({x.fis_tarihi:%d.%m.%Y})" for x in b["satirlar"]}))} for b in red],
        "tevkifatlar": [dict(t, tarih=_t(t["tarih"])) for t in tevkifat_satirlari(faturalar)],
        "faturalar": [{
            "yon": "Alış" if f.yon == "ALIS" else "Satış", "belge_no": f.belge_no, "tarih": _t(f.tarih),
            "senaryo": f.profil, "tip": f.tip, "fatura_tipi": fatura_tipi(f), "karsi_taraf": f.karsi_unvan, "vkn": f.karsi_vkn,
            "matrah": _sayi(f.matrah), "kdv": _sayi(f.kdv_toplam), "tevkifat": _sayi(f.tevkifat), "vergiler_dahil": _sayi(f.vergiler_dahil),
            "odenecek": _sayi(f.odenecek)} for f in sorted(faturalar, key=lambda f: (f.tarih, f.belge_no))],
    }


# Eşleştirme kuralları değiştiğinde artırılır: eski raporlar açılırken klasördeki faturalar ve muavinle
# Luca'ya bağlanmadan yeniden hesaplanır (ör. istisna / ihracat sınıflandırması).
KURAL_SURUMU = 11  # 11: kaydedilmeyecek kuralları (abone no vb.); 10: konaklama vergisi, iade (610), ÖİV, yakın belge no; 9: red / iptal listeleri; 8: 689 araç/yakıt → binek; kısa evrak no (AAA-889)


def rapor_yenile(cid: str, eski: dict) -> dict | None:
    from .arsiv import donem_faturalari, paket_uyarilari
    from .kontrol import muavin_dosyalari, muavinleri_oku
    k = depo.rapor_klasoru(cid)
    if not k or not muavin_dosyalari(k):
        return None
    zipler = donem_faturalari(k) or sorted(k.glob("gib_*.zip"))
    d = eski.get("donem", {})
    aralik = d.get("Alış") or d.get("Satış")
    if not zipler or not aralik:
        return None
    vkn = eski.get("vkn") or vkn_tespit(zipler)
    ft, uyarilar = faturalari_oku(zipler, vkn)
    muavin, bilgi = muavinleri_oku(muavin_dosyalari(k))
    from . import muavin_programlari as MP, red_iptal
    red, red_uyari = red_iptal.oku(red_iptal.dosyalari(k), MP.red_iptal_duzeni(MP.klasor_programi(k)))
    uyarilar = uyarilar + red_uyari
    rapor = esle(ft, muavin, Decimal("0.05"), (_tarih(aralik[0]), _tarih(aralik[1])), red=red)
    luca = [u for u in eski.get("uyarilar", []) if u.startswith("Luca indirme hatası")]
    return rapor_kaydet(rapor, ft, luca + paket_uyarilari(k) + uyarilar, eski.get("firma") or bilgi.get("firma") or "",
                        vkn, klasor=k)


def rapor_kaydet(rapor, ft, uyarilar, firma, vkn, klasor: Path | None = None) -> dict:
    """Raporu firmanın dönem klasörüne (veri/firmalar/<FİRMA>/<YIL>/<AA>) Excel + JSON olarak yazar ve
    geçmişe ekler. Aynı firma-dönem için önceki rapor yenisiyle değişir."""
    donem = rapor.donem.get("ALIS") or rapor.donem.get("SATIS") or (None, None)
    if klasor is not None:
        try:
            depo.rapor_id(klasor)
        except ValueError:          # veri/firmalar dışında bir klasör → firma/dönem klasörüne yaz
            klasor = None
    if klasor is None:
        bas = donem[0] or (min(f.tarih for f in ft) if ft else date.today())
        ad = depo.vkn_ile_firma(vkn) or firma or vkn or "FIRMA"
        klasor = depo.donem_klasoru(ad, bas)
        if vkn:
            depo.firma_bilgisi_yaz(ad, vkn)
    klasor.mkdir(parents=True, exist_ok=True)
    cid = depo.rapor_id(klasor)
    from .eslestirme import haric_uygula, uygun_uygula
    haric = depo.haric_oku(klasor.parent.parent)
    if haric:
        haric_uygula(rapor, haric)
    from .eslestirme import haric_kurallari_uygula
    haric_kurallari_uygula(rapor, depo.haric_kurallari_oku(klasor.parent.parent))
    uygun_uygula(rapor, depo.uygun_oku(klasor.parent.parent))
    excel_yaz(rapor, ft, firma, vkn, uyarilar, klasor / depo.RAPOR_EXCEL)
    veri = _json(rapor, ft, uyarilar, firma, vkn)
    veri["id"] = cid
    veri["zaman"] = datetime.now().isoformat(timespec="seconds")
    veri["defter"] = defter_turu(klasor)
    veri["kural"] = KURAL_SURUMU
    from .ortak import sorgulayan
    veri["sorgulayan"] = sorgulayan()             # ortak veri klasöründe "kim sorguladı" (Görev 51)
    (klasor / depo.RAPOR_JSON).write_text(json.dumps(veri, ensure_ascii=False), encoding="utf-8")
    sorunlu = sum(d["adet"] for d in veri["durumlar"] if d["sorunlu"])
    con = _db()
    if con is not None:                   # tarayıcıda (Pyodide) geçmiş tablosu yok; rapor dosyaları yine yazılır
        with con:
            con.execute("INSERT OR REPLACE INTO calisma VALUES (?,?,?,?,?,?,?,?,?)",
                        (cid, veri["zaman"], firma, vkn,
                         _t(donem[0]), _t(donem[1]), len(ft), sorunlu,
                         json.dumps({d["ad"]: d["adet"] for d in veri["durumlar"]}, ensure_ascii=False)))
    return veri


def rapor_oku(cid: str) -> dict | None:
    k = depo.rapor_klasoru(cid)
    if not k or not (k / depo.RAPOR_JSON).exists():
        return None
    try:
        v = json.loads((k / depo.RAPOR_JSON).read_text(encoding="utf-8"))
    except ValueError:
        return None
    if v.get("kural") != KURAL_SURUMU:
        try:
            yeni = rapor_yenile(cid, v)
            if yeni:
                v = yeni
                try:
                    from .luca.toplu import ozet_satiri_guncelle
                    ozet_satiri_guncelle(v)
                except Exception:
                    pass
        except Exception as e:                      # yeniden hesaplanamazsa eski rapor gösterilir
            print("Rapor yeniden hesaplanamadı:", cid, e)
    return v


def defter_turu(klasor: Path | None) -> str:
    """Firmanın defter türü: isletme | serbest | bilanco | '' (bilinmiyor). MuhaWin Ayarlar › Firmalar (Luca SIRKET_ID)
    ya da dönemin muavin programı (Luca işletme defteri listesi) belirler."""
    if not klasor:
        return ""
    try:
        lid = str(json.loads((klasor.parent.parent / "firma.json").read_text(encoding="utf-8")).get("luca_id") or "")
    except (OSError, ValueError):
        lid = ""
    if lid:
        try:                              # Luca kayıtları yalnız masaüstünde
            from .luca import toplu as T
            d = T.defter_oku().get(lid)
        except ImportError:
            d = ""
        if d:
            return d
    try:
        from . import muavin_programlari as MP
        if MP.klasor_programi(klasor).startswith("luca_isletme"):
            return "isletme"
    except Exception:
        pass
    return ""
