"""Luca 'Muavin Defter' Excel dökümü okuyucu.

Beklenen yapı (Luca standart çıktısı):
    MUAVİN DEFTER / Firma adı / Dönem / Tarih Aralığı
    <hesap kodu> <hesap adı>           <- her alt hesap için başlık
    TARİH | TİP | FİŞ NO | AÇIKLAMA | BORÇ | ALACAK | BAKİYE | B/A
    ... satırlar ...
    Nakli Yekün Hariç / Genel Toplam

Açıklama alanı Luca'da genelde  'GG/AA/YYYY-BELGENO-ÜNVAN'  biçimindedir.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path

import openpyxl

HESAP_RE = re.compile(r"^(\d{3}(?:\.\d+)*)\s+(.*)$")
ACIKLAMA_RE = re.compile(r"^\s*(\d{2}/\d{2}/\d{4})\s*-\s*([^-]+?)\s*-\s*(.*)$")
# GİB e-belge numarası: 3 karakter seri + 4 hane yıl + 9 hane sıra = 16 karakter
EBELGE_RE = re.compile(r"^[A-Z0-9]{3}20\d{2}\d{9}$")
ORAN_RE = re.compile(r"%\s*(\d+)")


@dataclass
class MuavinSatiri:
    dosya: str
    satir: int
    hesap_kodu: str
    hesap_adi: str
    fis_tarihi: date
    fis_tipi: str
    fis_no: str
    aciklama: str
    borc: Decimal
    alacak: Decimal
    belge_tarihi: date | None
    belge_no: str | None        # normalize edilmiş (büyük harf, boşluksuz)
    unvan: str

    @property
    def ana_hesap(self) -> str:
        return self.hesap_kodu[:3]

    @property
    def kdv_orani(self) -> Decimal | None:
        """Hesap adından KDV oranı (%1, %10, %20 ...)."""
        m = ORAN_RE.search(self.hesap_adi)
        return Decimal(m.group(1)) if m else None

    @property
    def e_belge_mi(self) -> bool:
        return bool(self.belge_no and EBELGE_RE.match(self.belge_no))

    @property
    def net(self) -> Decimal:
        """Hesabın normal yönünde tutar: 1xx/2xx/7xx ve 610-612 borç; diğerleri alacak."""
        if self.ana_hesap[0] in "127" or self.ana_hesap in ("610", "611", "612"):
            return self.borc - self.alacak
        return self.alacak - self.borc


def _dec(v) -> Decimal:
    if v is None or v == "":
        return Decimal("0")
    if isinstance(v, (int, float)):
        return Decimal(str(v))
    s = str(v).strip().replace(".", "").replace(",", ".")
    return Decimal(s) if s else Decimal("0")


def _tarih(v) -> date | None:
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, date):
        return v
    if isinstance(v, str):
        try:
            return datetime.strptime(v.strip(), "%d/%m/%Y").date()
        except ValueError:
            try:
                return datetime.strptime(v.strip(), "%d.%m.%Y").date()
            except ValueError:
                return None
    return None


def aciklama_ayristir(acik: str) -> tuple[date | None, str | None, str]:
    m = ACIKLAMA_RE.match(acik or "")
    if not m:
        return None, None, acik or ""
    return _tarih(m.group(1)), re.sub(r"\s+", "", m.group(2)).upper(), m.group(3).strip()


def muavin_oku(yol: Path) -> tuple[list[MuavinSatiri], dict]:
    wb = openpyxl.load_workbook(yol, data_only=True)  # Luca dosyalarında boyut bilgisi eksik; read_only kullanılamaz
    ws = wb.worksheets[0]
    satirlar: list[MuavinSatiri] = []
    bilgi: dict = {"dosya": yol.name}
    hesap_kodu = hesap_adi = None
    kolon: dict[str, int] = {}

    for no, r in enumerate(ws.iter_rows(values_only=True), start=1):
        ilk = r[0] if r else None
        if no == 2 and isinstance(ilk, str):
            bilgi["firma"] = ilk.strip()
        if isinstance(ilk, str) and ilk.strip().startswith("Dönem"):
            bilgi["donem"] = r[1]
        if isinstance(ilk, str) and (m := HESAP_RE.match(ilk.strip())):
            hesap_kodu, hesap_adi = m.group(1), m.group(2).strip()
            continue
        if isinstance(ilk, str) and ilk.strip().upper() == "TARİH":
            kolon = {str(h).strip().upper(): i for i, h in enumerate(r) if h}
            continue
        fis_t = _tarih(ilk)
        if fis_t is None or not kolon or hesap_kodu is None:
            continue
        acik = str(r[kolon["AÇIKLAMA"]] or "")
        b_t, b_no, unvan = aciklama_ayristir(acik)
        satirlar.append(MuavinSatiri(
            dosya=yol.name, satir=no, hesap_kodu=hesap_kodu, hesap_adi=hesap_adi,
            fis_tarihi=fis_t, fis_tipi=str(r[kolon.get("TİP", 1)] or ""),
            fis_no=str(r[kolon.get("FİŞ NO", 2)] or ""), aciklama=acik,
            borc=_dec(r[kolon["BORÇ"]]), alacak=_dec(r[kolon["ALACAK"]]),
            belge_tarihi=b_t, belge_no=b_no, unvan=unvan,
        ))
    wb.close()
    return satirlar, bilgi
