"""Luca İşletme / Serbest Meslek defteri: Gelir Listesi ve Gider Listesi → ortak muavin satırları.

Bilanço esasındaki muavinin yerine geçer: her fiş için KDV satırı (gelir 391 alacak, gider 191 borç) ve
tutar satırı (gelir 600 alacak, gider 770 borç) üretilir; böylece fatura ↔ kayıt kontrolü aynı kurallarla yapılır.
Dosya (otomasyonun yazdığı muavin_isletme.json):
    {"firma": "...", "gelir": [{tarih, evrak_no, kategori, belge_turu, aciklama, cari, tutar, kdv, toplam}], "gider": [...]}
"""
from __future__ import annotations

import json
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

from .muavin_okuyucu import MuavinSatiri

ORANLAR = (0, 1, 8, 10, 18, 20)


def _d(v) -> Decimal:
    if v is None or v == "" or isinstance(v, Decimal) and not v:
        return Decimal("0")
    if isinstance(v, Decimal):
        return v
    if isinstance(v, (int, float)):
        return Decimal(str(v))
    s = str(v).strip().replace(".", "").replace(",", ".")
    try:
        return Decimal(s) if s else Decimal("0")
    except Exception:
        return Decimal("0")


def _t(v) -> date | None:
    try:
        g, a, y = str(v).strip()[:10].replace(".", "/").split("/")
        return date(int(y), int(a), int(g))
    except (ValueError, TypeError):
        return None


def oran(tutar: Decimal, kdv: Decimal) -> int:
    if not tutar or not kdv:
        return 0
    h = float(kdv / tutar * 100)
    return min(ORANLAR, key=lambda o: abs(o - h))


def isletme_oku(yol: Path):
    veri = json.loads(Path(yol).read_text(encoding="utf-8"))
    return _satirlar(veri, Path(yol).name)


def isletme_excel_oku(yol: Path):
    """Luca İşletme Defteri → Raporlar → Genel Raporlar → Gelir/Gider Raporu (Excel): Giderler ve Gelirler sayfaları.
    Sütunlar: #, EVRAK NO, TARİH, AÇIKLAMA, GİDER|GELİR, ALINAN|SATILAN EMTİA, İNDİRİLECEK|HESAPLANACAK KDV, KREDİLİ TUTAR."""
    import openpyxl
    from .muavin_okuyucu import _tarih
    wb = openpyxl.load_workbook(yol, data_only=True)
    veri = {"gelir": [], "gider": []}
    for ws in wb.worksheets:
        rows = list(ws.iter_rows(values_only=True))
        bas = next((i for i, r in enumerate(rows[:10]) if r and any(str(c or "").strip().upper().replace("İ", "I") == "EVRAK NO" for c in r)), None)
        if bas is None:
            continue
        H = [str(c or "").strip().upper().replace("İ", "I") for c in rows[bas]]
        def kol(*adlar):
            return next((i for i, h in enumerate(H) if any(a in h for a in adlar)), None)
        ce, ct, ca = kol("EVRAK"), kol("TARIH"), kol("ACIKLAMA", "AÇIKLAMA")
        ck = kol("KDV")
        ctutar = [i for i, h in enumerate(H) if h in ("GIDER", "GELIR") or "EMTIA" in h]
        tur = "gelir" if any(h in ("GELIR",) or "SATILAN" in h or "HESAPLANACAK" in h for h in H) else "gider"
        for r in rows[bas + 1:]:
            if not r or ce is None or not str(r[ce] or "").strip():
                continue
            t = _tarih(r[ct]) if ct is not None else None
            if not t:
                continue
            tutar = sum((_d(r[i]) for i in ctutar if i < len(r)), Decimal("0"))
            veri[tur].append({"tarih": f"{t:%d/%m/%Y}", "evrak_no": str(r[ce]).strip(), "aciklama": str(r[ca] or "").strip(),
                              "cari": "", "tutar": tutar, "kdv": _d(r[ck]) if ck is not None else Decimal("0")})
    if not veri["gelir"] and not veri["gider"]:
        raise ValueError("Gelir/Gider raporunda satır bulunamadı (Giderler / Gelirler sayfası, EVRAK NO başlığı)")
    return _satirlar(veri, Path(yol).name)


def _satirlar(veri: dict, dosya: str):
    satirlar: list[MuavinSatiri] = []
    for tur, kdv_h, tut_h, borcta in (("gelir", "391", "600", False), ("gider", "191", "770", True)):
        for i, r in enumerate(veri.get(tur) or []):
            tarih = _t(r.get("tarih"))
            if not tarih:
                continue
            tutar, kdv = _d(r.get("tutar")), _d(r.get("kdv"))
            belge = str(r.get("evrak_no") or "").upper().replace(" ", "") or None
            unvan = (r.get("cari") or r.get("aciklama") or "").strip()
            ac = f"{tarih:%d/%m/%Y}-{belge or ''}-{unvan}"
            o = oran(tutar, kdv)
            ad = "Gelir" if tur == "gelir" else "Gider"
            for kod, hadi, tut in ((f"{kdv_h}.ISL", f"İşletme {ad} KDV (oran {o} civarı)", kdv), (f"{tut_h}.ISL", f"İşletme {ad}leri", tutar)):
                if not tut:
                    continue
                tut = tut.quantize(Decimal("0.01"), ROUND_HALF_UP)
                satirlar.append(MuavinSatiri(
                    dosya=dosya, satir=i + 1, hesap_kodu=kod, hesap_adi=hadi, fis_tarihi=tarih,
                    fis_tipi=r.get("belge_turu") or ad, fis_no=str(r.get("fid") or belge or i + 1), aciklama=ac,
                    borc=tut if borcta else Decimal("0"), alacak=Decimal("0") if borcta else tut,
                    belge_tarihi=tarih, belge_no=belge, unvan=unvan))
    return satirlar, {"firma": veri.get("firma", "")}
