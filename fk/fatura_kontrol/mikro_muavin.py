"""Mikro muavin (Hesap hareket dökümü) Excel okuyucu.

Yapı: üst satırda başlıklar (HESAP KODU, Kayıt no, Tarih, Sıra, Y.No, Fiş tipi, Belge türü, Evrak no, Cari ismi,
Entegrasyon kaynağı, Açıklama, TL Borç, TL Alacak, …); her hesap için "<kod> <ad> Hesap hareket dökümü (..)" satırı,
ardından DEVREDEN, hareketler ve Toplam. e-belge numarası açıklamada ("Sat.fat : AAS2026000004755/…") ya da
Evrak no'da ("KS12026-1130211" → KS12026001130211) bulunur.
"""
from __future__ import annotations

import re
from datetime import timedelta
from decimal import Decimal
from pathlib import Path

import openpyxl

from .muavin_okuyucu import MuavinSatiri, _dec, _tarih

HESAP_SATIRI = re.compile(r"^\s*(\d{3}(?:\.[0-9A-Za-zÇĞİÖŞÜçğıöşü]+)*)\s+(.*?)\s+Hesap hareket d[öo]k[üu]m[üu]", re.I)
EBELGE = re.compile(r"\b([A-Z0-9]{3}20\d{2}\d{9})\b")
EVRAK = re.compile(r"^([A-Z0-9]{3})(20\d{2})-?(\d{1,9})$")


def _belge_no(evrak: str, aciklama: str) -> str | None:
    m = EBELGE.search((aciklama or "").upper())
    if m:
        return m.group(1)
    e = re.sub(r"\s+", "", str(evrak or "")).upper()
    m = EVRAK.match(e)
    if m:
        return f"{m.group(1)}{m.group(2)}{int(m.group(3)):09d}"
    return e or None


def _anahtar(h) -> str:
    return re.sub(r"[^A-Z]", "", str(h or "").upper().replace("İ", "I").replace("Ç", "C").replace("Ş", "S")
                  .replace("Ğ", "G").replace("Ü", "U").replace("Ö", "O"))


def mikro_oku(yol: Path) -> tuple[list[MuavinSatiri], dict]:
    wb = openpyxl.load_workbook(yol, read_only=True, data_only=True)
    ws = wb.worksheets[0]
    satirlar: list[MuavinSatiri] = []
    kolon: dict[str, int] = {}
    hesap_kodu = hesap_adi = None
    for no, r in enumerate(ws.iter_rows(values_only=True), start=1):
        if not r:
            continue
        ilk = r[0]
        if not kolon:
            ks = [_anahtar(x) for x in r]
            if "HESAPKODU" in ks and "TARIH" in ks:
                kolon = {k: i for i, k in enumerate(ks) if k}
            continue
        if isinstance(ilk, str) and (m := HESAP_SATIRI.match(ilk)):
            hesap_kodu, hesap_adi = m.group(1), m.group(2).strip()
            continue
        g = lambda k: r[kolon[k]] if k in kolon and kolon[k] < len(r) else None
        t = _tarih(g("TARIH"))
        acik = str(g("ACIKLAMA") or "").strip()
        if t is not None and hesap_kodu and hesap_kodu.startswith("190") and "DEVREDEN" in acik.replace(" ", "").upper():
            # 190 Devreden KDV'nin dönem başı bakiyesi: beyannamede "önceki dönemden devreden KDV" için (dönemden bir gün önce)
            b0, a0 = _dec(g("TLBORC")), _dec(g("TLALACAK"))
            if b0 or a0:
                satirlar.append(MuavinSatiri(
                    dosya=Path(yol).name, satir=no, hesap_kodu=hesap_kodu, hesap_adi=hesap_adi,
                    fis_tarihi=t - timedelta(days=1), fis_tipi="Devir", fis_no="DEVREDEN", aciklama="DEVREDEN",
                    borc=b0, alacak=a0, belge_tarihi=None, belge_no=None, unvan=""))
            continue
        if t is None or hesap_kodu is None or not str(g("KAYITNO") or "").strip():
            continue                                    # DEVREDEN, Toplam, boş satırlar
        borc, alacak = _dec(g("TLBORC")), _dec(g("TLALACAK"))
        if not borc and not alacak:
            continue
        satirlar.append(MuavinSatiri(
            dosya=Path(yol).name, satir=no, hesap_kodu=hesap_kodu, hesap_adi=hesap_adi,
            fis_tarihi=t, fis_tipi=str(g("FISTIPI") or ""), fis_no=str(g("YNO") or g("KAYITNO") or ""),
            aciklama=acik, borc=borc, alacak=alacak, belge_tarihi=None,
            belge_no=_belge_no(g("EVRAKNO"), acik), unvan=str(g("CARIISMI") or "").strip(),
        ))
    wb.close()
    if not kolon:
        raise ValueError("Mikro muavin başlıkları bulunamadı (HESAP KODU, Tarih, Evrak no, TL Borç, TL Alacak)")
    return satirlar, {"dosya": Path(yol).name}
