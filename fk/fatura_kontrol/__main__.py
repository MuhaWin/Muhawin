"""Komut satırı kullanımı:

    python -m fatura_kontrol --vkn 3810463613 \
        --fatura faturalar.zip [--fatura klasor/ ...] \
        --muavin muavin191.xlsx --muavin muavin391.xlsx ... \
        [--bas 01.09.2026 --bit 30.09.2026] [--tolerans 0.05] \
        --cikti rapor.xlsx
"""
from __future__ import annotations

import argparse
import warnings
from datetime import datetime
from decimal import Decimal
from pathlib import Path

from .eslestirme import esle
from .fatura_okuyucu import faturalari_oku
from .muavin_okuyucu import muavin_oku
from .rapor import excel_yaz


def _tarih(s: str):
    return datetime.strptime(s, "%d.%m.%Y").date()


def calistir(vkn, fatura_yollari, muavin_yollari, cikti, bas=None, bit=None, tolerans="0.05"):
    warnings.filterwarnings("ignore", module="openpyxl")
    faturalar, uyarilar = faturalari_oku([Path(p) for p in fatura_yollari], vkn)
    muavin, firma = [], ""
    for p in muavin_yollari:
        satirlar, bilgi = muavin_oku(Path(p))
        muavin.extend(satirlar)
        firma = firma or bilgi.get("firma", "")
    donem = (bas, bit) if bas and bit else None
    rapor = esle(faturalar, muavin, Decimal(tolerans), donem)
    excel_yaz(rapor, faturalar, firma, vkn, uyarilar, Path(cikti))
    return rapor, faturalar, uyarilar


def main():
    ap = argparse.ArgumentParser(description="e-Fatura XML'lerini Luca muavin dökümüyle karşılaştırır.")
    ap.add_argument("--vkn", required=True, help="Kontrol edilen firmanın VKN'si")
    ap.add_argument("--fatura", action="append", required=True, help="XML/ZIP dosyası veya klasör")
    ap.add_argument("--muavin", action="append", required=True, help="Luca muavin Excel dökümü")
    ap.add_argument("--bas", type=_tarih, help="Kontrol başlangıcı (GG.AA.YYYY)")
    ap.add_argument("--bit", type=_tarih, help="Kontrol bitişi (GG.AA.YYYY)")
    ap.add_argument("--tolerans", default="0.05", help="Kuruş farkı toleransı (TL)")
    ap.add_argument("--cikti", default="kontrol_raporu.xlsx")
    a = ap.parse_args()
    rapor, faturalar, uyarilar = calistir(a.vkn, a.fatura, a.muavin, a.cikti, a.bas, a.bit, a.tolerans)
    from collections import Counter
    print(f"{len(faturalar)} fatura okundu, {len(uyarilar)} uyarı.")
    for d, n in Counter(s.durum for s in rapor.sonuclar).most_common():
        print(f"  {d}: {n}")
    print(f"  Faturası bulunamayan muavin kaydı: {len(rapor.faturasi_olmayanlar)}")
    print(f"Rapor: {a.cikti}")


if __name__ == "__main__":
    main()
