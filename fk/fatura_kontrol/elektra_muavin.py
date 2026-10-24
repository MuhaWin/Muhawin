"""Elektra muavin dökümü (xlsx) okuyucu.

Yapı (tek sayfa, yıllık dökümde ~180 bin satır):
  1. satır başlık: Grup | Fiş Tarihi | Fiş Numarası | Hesap Kodu | Hesap Adı | Dok Tipi | Dok Tipi | Fiş Notu |
                   Detay Notları | Borç | Alacak | Bakiye | Dvz Borç | Dvz Alacak | Dvz Bakiye   ("Dok Tipi" iki kez)
  Hesap grup satırı: yalnız "Grup" dolu (" -> 100.01.01.001 Kasa Hesabı / TL", başta başka sözcük olabilir); tutarları
    devir / özet toplamıdır, hareket sayılmaz.
  Hareket satırı: Grup boş; Fiş Tarihi Excel tarihi; Fiş Numarası metin ("0025" gibi baştaki sıfır korunur);
    Hesap Kodu her satırda tam (harfli seviye olabilir: 120.01.01.A010); Dok Tipi: Fatura / Diğer / Makbuz / Çek / boş.
  e-belge numarası Fiş Notu ya da Detay Notları'nda (çoğunlukla başta, 16 karakter).
Büyük dosya için sayfa XML'i doğrudan akışla okunur (openpyxl'den ~6 kat hızlı, bellekte tek satır); okunamazsa openpyxl.
"""
from __future__ import annotations

import hashlib
import re
import zipfile
import xml.etree.ElementTree as ET
from datetime import date, datetime, timedelta
from pathlib import Path, PurePosixPath

import openpyxl

from .mikro_muavin import EBELGE
from .muavin_okuyucu import MuavinSatiri, _dec, _kat, _tarih

_CARI_ON = ("120", "121", "320", "321", "329", "336", "131", "331", "159", "340")
# katlanmış başlık adı → alan
BASLIKLAR = {"grup": "grup", "fis tarihi": "tarih", "fis numarasi": "fis_no", "hesap kodu": "kod", "hesap adi": "ad",
             "dok tipi": "tip", "fis notu": "fis_notu", "detay notlari": "detay", "borc": "borc", "alacak": "alacak"}


def _baslik(r) -> dict[str, int] | None:
    kolon: dict[str, int] = {}
    for i, h in enumerate(r):
        a = BASLIKLAR.get(_kat(h))
        if a and a not in kolon:            # "Dok Tipi" iki kez: ilki
            kolon[a] = i
    return kolon if {"tarih", "fis_no", "kod", "borc", "alacak"} <= set(kolon) else None


def _metin(v) -> str:
    if v is None:
        return ""
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    return str(v).strip()


_NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
_REL = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
_HUCRE = re.compile(r"([A-Z]+)(\d+)")


def _sutun(harf: str) -> int:
    n = 0
    for c in harf:
        n = n * 26 + ord(c) - 64
    return n - 1


def _xml_satirlari(yol: Path):
    """İlk sayfanın satırları (değer listesi; sayılar float, metinler str). Tarih biçimi çözülmez (seri sayı kalır)."""
    with zipfile.ZipFile(yol) as z:
        adlar = set(z.namelist())
        ortak: list[str] = []
        if "xl/sharedStrings.xml" in adlar:
            for _, el in ET.iterparse(z.open("xl/sharedStrings.xml")):
                if el.tag == _NS + "si":
                    ortak.append("".join(t.text or "" for t in el.iter(_NS + "t")))
                    el.clear()
        wbx = ET.fromstring(z.read("xl/workbook.xml"))
        rid = wbx.find(f"{_NS}sheets/{_NS}sheet").get(_REL)
        rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
        hedef = next(r.get("Target") for r in rels if r.get("Id") == rid)
        yolu = hedef.lstrip("/") if hedef.startswith("/") else str(PurePosixPath("xl") / hedef)
        for _, el in ET.iterparse(z.open(yolu)):
            if el.tag != _NS + "row":
                continue
            r: list = []
            for c in el.iter(_NS + "c"):
                m = _HUCRE.match(c.get("r") or "")
                i = _sutun(m.group(1)) if m else len(r)
                t = c.get("t")
                if t == "inlineStr":
                    v = "".join(x.text or "" for x in c.iter(_NS + "t"))
                else:
                    ve = c.find(_NS + "v")
                    v = ve.text if ve is not None else None
                    if v is not None:
                        if t == "s":
                            v = ortak[int(v)]
                        elif t in (None, "n"):
                            v = float(v)
                        elif t == "b":
                            v = v == "1"
                if i >= len(r):
                    r.extend([None] * (i - len(r) + 1))
                r[i] = v
            el.clear()
            yield r


def _openpyxl_satirlari(yol: Path):
    wb = openpyxl.load_workbook(yol, read_only=True, data_only=True)
    try:
        yield from wb.worksheets[0].iter_rows(values_only=True)
    finally:
        wb.close()


def _gun(v) -> date | None:
    if isinstance(v, (int, float)) and not isinstance(v, bool) and 20000 < v < 80000:     # Excel seri tarihi
        return (datetime(1899, 12, 30) + timedelta(days=float(v))).date()
    return _tarih(v)


_ONBELLEK: dict[str, list[MuavinSatiri]] = {}   # içerik özeti → satırlar (denetimde aynı dosya 3 kez okunuyor)


def elektra_oku(yol: Path) -> tuple[list[MuavinSatiri], dict]:
    ozet = hashlib.sha1(Path(yol).read_bytes()).hexdigest()
    if ozet not in _ONBELLEK:
        try:
            satirlar, _ = _oku(yol, _xml_satirlari(yol))
        except (KeyError, StopIteration, ET.ParseError, zipfile.BadZipFile, AttributeError):
            satirlar, _ = _oku(yol, _openpyxl_satirlari(yol))
        _ONBELLEK.clear()                        # yalnız son dosya (bellek)
        _ONBELLEK[ozet] = satirlar
    ad = Path(yol).name                         # kopyalar: çağıran satırları değiştirebilir (kod_orani, uygun …)
    return [_kopya(s, ad) for s in _ONBELLEK[ozet]], {"dosya": ad}


def _kopya(s: MuavinSatiri, ad: str) -> MuavinSatiri:
    k = MuavinSatiri.__new__(MuavinSatiri)
    k.__dict__.update(s.__dict__); k.dosya = ad
    return k


def _oku(yol: Path, kaynak) -> tuple[list[MuavinSatiri], dict]:
    satirlar: list[MuavinSatiri] = []
    kolon: dict[str, int] | None = None
    ad_ = Path(yol).name
    for no, r in enumerate(kaynak, start=1):
        if not r:
            continue
        if kolon is None:
            kolon = _baslik(r)
            if kolon is None and no > 20:
                break
            continue
        g = lambda k: r[kolon[k]] if k in kolon and kolon[k] < len(r) else None
        grup = g("grup")
        if isinstance(grup, str) and grup.strip():
            continue                                    # hesap grup başlığı (devir / özet tutarları)
        t, kod = _gun(g("tarih")), _metin(g("kod"))
        if t is None or not kod:
            continue                                    # boş ayraç satırı
        borc, alacak = _dec(g("borc")), _dec(g("alacak"))
        if not borc and not alacak:
            continue
        fis_notu, detay = _metin(g("fis_notu")), _metin(g("detay"))
        acik = " · ".join(x for x in (fis_notu, detay) if x)
        m = EBELGE.search(acik.upper())
        ad = _metin(g("ad"))
        satirlar.append(MuavinSatiri(
            dosya=ad_, satir=no, hesap_kodu=kod, hesap_adi=ad, fis_tarihi=t, fis_tipi=_metin(g("tip")),
            fis_no=_metin(g("fis_no")), aciklama=acik, borc=borc, alacak=alacak, belge_tarihi=None,
            belge_no=m.group(1) if m else None, unvan=ad if kod.startswith(_CARI_ON) else ""))
    if kolon is None:
        raise ValueError("Elektra muavin başlıkları bulunamadı (Grup, Fiş Tarihi, Fiş Numarası, Hesap Kodu, Borç, Alacak)")
    return satirlar, {"dosya": Path(yol).name}
