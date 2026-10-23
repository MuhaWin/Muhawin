"""Fatura arşivi: her fatura yalnız BİR kez ve kendi tarihinin ayında saklanır.

Luca'nın 'GİB'den Getir' listesi o firmanın daha önce getirilmiş tüm belgelerini de gösterdiği için
indirilen ZIP'lerde başka aylara ait faturalar da bulunur. İndirmeden sonra:
  - her XML okunur, fatura tarihine göre veri/firmalar/<FİRMA>/<YIL>/<AA>/faturalar.zip içine yazılır,
  - aynı fatura (tür + belge no) zaten varsa tekrar yazılmaz,
  - Luca'dan gelen ham ZIP'ler (HTML görüntüleri dahil) silinir → çok daha az yer kaplar.
Kontrol, dönemin faturalar.zip dosyasındaki faturalarla yapılır.
"""
from __future__ import annotations

import re
import zipfile
from collections import defaultdict
from datetime import date
from pathlib import Path

from . import depo
import json

from . import fatura_okuyucu as FO
from .fatura_okuyucu import _hamlar, xml_oku

ARSIV = "faturalar.zip"


def _tur(zip_yolu: Path) -> str:
    m = re.match(r"(gib_[a-z]+_[a-z]+)_\d+$", zip_yolu.stem)
    return m.group(1) if m else "diger"


def _ad(tur: str, belge_no: str, ettn: str | None) -> str:
    anahtar = re.sub(r"[^A-Za-z0-9_-]+", "_", belge_no or ettn or "belge")
    return f"{tur}/{anahtar}.xml"


def mevcut_adlar(arsiv: Path) -> set[str]:
    if not arsiv.exists():
        return set()
    try:
        with zipfile.ZipFile(arsiv) as z:
            return set(z.namelist())
    except zipfile.BadZipFile:
        return set()


def arsive_al(firma_ad: str, zipler: list[Path], sil: bool = True) -> dict[str, int]:
    """Ham ZIP'lerdeki faturaları tarihlerine göre aylık arşivlere dağıtır. Dönüş: {'2026-09': eklenen, ...}"""
    gruplar: dict[Path, dict[str, bytes]] = defaultdict(dict)
    FO.ZIP_UYARILARI.clear()
    uyarilar: dict[Path, list[str]] = defaultdict(list)
    for zy in zipler:
        if not zy.exists() or zy.name == ARSIV:
            continue
        tur = _tur(zy)
        try:
            hamlar = _hamlar([zy])
        except Exception as e:                      # okunamayan paket diğerlerini durdurmaz
            uyarilar[zy.parent].append(f"{zy.name}: okunamadı ({type(e).__name__})")
            continue
        uyarilar[zy.parent].extend(FO.ZIP_UYARILARI)
        FO.ZIP_UYARILARI.clear()
        for veri, kaynak in hamlar:
            f = xml_oku(veri, kaynak)
            if f is None:
                continue
            # arşivin kendisi yeniden yüklendiyse (Luca'dan alınan faturalar → kontrol) içindeki tür klasörü korunur
            ic = re.search(r"/(gib_[a-z]+_(?:alis|satis))/[^/]+$", kaynak)
            t = ic.group(1) if ic and not re.match(r"gib_(e[a-z]+)_(alis|satis)$", tur) else tur
            hedef = depo.donem_klasoru(firma_ad, date(f.tarih.year, f.tarih.month, 1)) / ARSIV
            gruplar[hedef].setdefault(_ad(t, f.belge_no, f.ettn), veri)
    eklenen: dict[str, int] = {}
    for hedef, belgeler in gruplar.items():
        hedef.parent.mkdir(parents=True, exist_ok=True)
        var = mevcut_adlar(hedef)
        kokler = {ad.rsplit("/", 1)[-1] for ad in var}          # aynı fatura başka tür adıyla zaten varsa tekrar yazılmaz
        yeni = {}
        for ad, v in belgeler.items():
            kok = ad.rsplit("/", 1)[-1]
            if ad not in var and kok not in kokler:
                yeni[ad] = v
                kokler.add(kok)
        if yeni:
            with zipfile.ZipFile(hedef, "a", zipfile.ZIP_DEFLATED) as z:
                for ad, v in yeni.items():
                    z.writestr(ad, v)
        eklenen[f"{hedef.parent.parent.name}-{hedef.parent.name}"] = len(yeni)
    for klasor, liste in uyarilar.items():         # rapora eklenecek indirme uyarıları
        if liste:
            y = klasor / "paket_uyarilari.json"
            eski = json.loads(y.read_text(encoding="utf-8")) if y.exists() else []
            y.write_text(json.dumps(eski + liste, ensure_ascii=False), encoding="utf-8")
    if sil:
        for zy in zipler:
            if zy.name != ARSIV:
                zy.unlink(missing_ok=True)
    return eklenen


def paket_uyarilari(klasor: Path) -> list[str]:
    try:
        return json.loads((klasor / "paket_uyarilari.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return []


def tur_sil(klasor: Path, tur: str):
    """Dönem arşivinden bir türün faturalarını çıkarır (o adım yeniden indirilecekse)."""
    y = klasor / "paket_uyarilari.json"
    if y.exists():
        kalan = [u for u in paket_uyarilari(klasor) if not u.startswith(tur)]
        y.write_text(json.dumps(kalan, ensure_ascii=False), encoding="utf-8")
    arsiv = klasor / ARSIV
    if not arsiv.exists():
        return
    with zipfile.ZipFile(arsiv) as z:
        kalan = {ad: z.read(ad) for ad in z.namelist() if not ad.startswith(tur + "/")}
    if not kalan:
        arsiv.unlink()
        return
    gecici = arsiv.with_suffix(".tmp")
    with zipfile.ZipFile(gecici, "w", zipfile.ZIP_DEFLATED) as z:
        for ad, v in kalan.items():
            z.writestr(ad, v)
    gecici.replace(arsiv)


def donem_faturalari(klasor: Path) -> list[Path]:
    a = klasor / ARSIV
    return [a] if a.exists() else []
