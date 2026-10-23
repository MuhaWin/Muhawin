"""Muavin dökümü okuyucuları — program bazında.

Tek firma (dosyadan) kontrolde kullanıcı muavin dökümünün hangi muhasebe programına ait olduğunu seçer; dosya o
programın okuyucusuyla okunup ortak muavin satırlarına (MuavinSatiri) çevrilir, kontrol aynı kurallarla yapılır.
Yeni program eklemek: aşağıdaki PROGRAMLAR sözlüğüne okuyucu fonksiyonuyla bir kayıt eklenir
(okuyucu(yol) -> (list[MuavinSatiri], {"firma": ...})).
"""
from __future__ import annotations

import json
from pathlib import Path

from .muavin_okuyucu import muavin_oku as _luca_oku


def _mikro_oku(y):
    from .mikro_muavin import mikro_oku
    return mikro_oku(y)


def _isletme_excel_oku(y):
    from .isletme_okuyucu import isletme_excel_oku
    return isletme_excel_oku(y)


def _isletme_oku(y):
    from .isletme_okuyucu import isletme_oku
    return isletme_oku(y)

PROGRAMLAR: dict[str, dict] = {
    "luca": {
        "ad": "Luca",
        "uzantilar": [".xlsx"],
        "ipucu": "Luca → Defterler → Muavin Defter → Rapor türü: Excel Liste (xlsx) · tüm hesaplar (100–999) önerilir",
        "okuyucu": _luca_oku,
    },
    "mikro": {
        "ad": "Mikro",
        "uzantilar": [".xlsx"],
        "ipucu": "Mikro → Muhasebe → Hesap hareket dökümü (muavin) · tüm hesaplar · dönem · Excel'e aktar (xlsx)",
        "okuyucu": lambda y: _mikro_oku(y),
    },
    "luca_isletme_excel": {
        "ad": "Luca İşletme / Serbest Meslek Defteri",
        "uzantilar": [".xlsx"],
        "ipucu": "Luca İşletme Defteri → Raporlar → Genel Raporlar → Gelir/Gider Raporu · tarih aralığı · Excel",
        "okuyucu": lambda y: _isletme_excel_oku(y),
    },
    "luca_isletme": {
        "ad": "Luca İşletme Defteri",
        "uzantilar": [".json"],
        "ipucu": "Toplu kontrolde Luca İşletme Defteri → Gelir / Gider Listesi'nden otomatik alınır",
        "okuyucu": lambda y: _isletme_oku(y),
        "gizli": True,
    },
}
VARSAYILAN = "luca"
DOSYA = "muavin_program.json"          # dönem klasöründe: muavinin hangi programdan geldiği


def liste() -> list[dict]:
    return [{"kod": k, "ad": v["ad"], "uzantilar": v["uzantilar"], "ipucu": v["ipucu"]} for k, v in PROGRAMLAR.items()
            if not v.get("gizli")]


def gecerli(kod: str | None) -> str:
    kod = (kod or "").strip().lower()
    if kod not in PROGRAMLAR:
        raise ValueError(f"Bilinmeyen muavin programı: {kod or '(seçilmedi)'}")
    return kod


def klasor_programi(klasor: Path) -> str:
    try:
        return gecerli(json.loads((klasor / DOSYA).read_text(encoding="utf-8")).get("program"))
    except (OSError, ValueError):
        return VARSAYILAN


def klasore_yaz(klasor: Path, kod: str):
    (klasor / DOSYA).write_text(json.dumps({"program": gecerli(kod)}, ensure_ascii=False), encoding="utf-8")


def oku(yol: Path, kod: str | None = None):
    kod = gecerli(kod) if kod else klasor_programi(Path(yol).parent)
    return PROGRAMLAR[kod]["okuyucu"](yol)
