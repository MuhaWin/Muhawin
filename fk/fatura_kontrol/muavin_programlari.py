"""Muavin dökümü okuyucuları — program bazında.

Tek firma (dosyadan) kontrolde kullanıcı muavin dökümünün hangi muhasebe programına ait olduğunu seçer; dosya o
programın okuyucusuyla okunup ortak muavin satırlarına (MuavinSatiri) çevrilir, kontrol aynı kurallarla yapılır.
Yeni program eklemek: aşağıdaki PROGRAMLAR sözlüğüne okuyucu fonksiyonuyla bir kayıt eklenir
(okuyucu(yol) -> (list[MuavinSatiri], {"firma": ...})).
  "denetim": True  → program Denetim ekranının (denetim.html) program seçiminde görünür (sıra: DENETIM_SIRA)
  "hazir": False   → listede görünür ama okuyucusu henüz yok (örnek dosya bekleniyor); seçilince uyarı, denetim yapılmaz
  "yalniz_denetim" → yalnız Denetim ekranında (Tek firma kontrolün program listesinde görünmez)
  "red_iptal": düzen → red / iptal Excel listelerinin sütun düzeni (red_iptal.DUZENLER; yoksa varsayılan düzen)
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


ELEKTRA_BEKLENIYOR = "Elektra muavin örneği bekleniyor: biçim bilinmeden okunamaz. Örnek dosya gelince okuyucu eklenecek."


def _elektra_oku(y):
    """İskelet: Elektra muavin dökümünün sütunları bilinmiyor (kullanıcı örnek verecek). Sütun uydurulmaz;
    örnek gelince burada muavin_okuyucu.KOLONLAR benzeri bir eşleme ile MuavinSatiri listesi üretilecek."""
    raise ValueError(ELEKTRA_BEKLENIYOR)


PROGRAMLAR: dict[str, dict] = {
    "luca": {
        "ad": "Luca",
        "uzantilar": [".xlsx"],
        "ipucu": "Luca → Defterler → Muavin Defter → Rapor türü: Excel Liste (xlsx) · tüm hesaplar (100–999) önerilir",
        "okuyucu": _luca_oku,
        "denetim": True,
    },
    "mikro": {
        "ad": "Mikro",
        "uzantilar": [".xlsx"],
        "ipucu": "Mikro → Muhasebe → Hesap hareket dökümü (muavin) · tüm hesaplar · dönem · Excel'e aktar (xlsx)",
        "okuyucu": lambda y: _mikro_oku(y),
        "denetim": True,
        "red_iptal": "mikro",
    },
    "elektra": {
        "ad": "Elektra",
        "uzantilar": [".xlsx", ".xls"],
        "ipucu": ELEKTRA_BEKLENIYOR,
        "okuyucu": _elektra_oku,
        "denetim": True,
        "hazir": False,
        "yalniz_denetim": True,
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
DENETIM_SIRA = ["mikro", "elektra", "luca"]   # Denetim ekranındaki program seçimi sırası
DOSYA = "muavin_program.json"          # dönem klasöründe: muavinin hangi programdan geldiği


def liste(denetim: bool = False) -> list[dict]:
    """Seçim listesi; denetim=True ise yalnız Denetim ekranında kullanılabilen programlar (DENETIM_SIRA ile)."""
    L = [{"kod": k, "ad": v["ad"], "uzantilar": v["uzantilar"], "ipucu": v["ipucu"], "hazir": v.get("hazir", True)}
         for k, v in PROGRAMLAR.items()
         if not v.get("gizli") and (v.get("denetim") if denetim else not v.get("yalniz_denetim"))]
    if denetim:
        L.sort(key=lambda p: DENETIM_SIRA.index(p["kod"]) if p["kod"] in DENETIM_SIRA else len(DENETIM_SIRA))
    return L


def denetimde_mi(kod: str) -> bool:
    return bool(PROGRAMLAR.get(kod, {}).get("denetim"))


def hazir_mi(kod: str) -> bool:
    return PROGRAMLAR.get(kod, {}).get("hazir", True)


def red_iptal_duzeni(kod: str | None) -> str:
    """Programın red / iptal listesi sütun düzeni (kayıtta yoksa red_iptal.VARSAYILAN_DUZEN)."""
    from . import red_iptal
    d = PROGRAMLAR.get(kod or "", {}).get("red_iptal")
    return d if d in red_iptal.DUZENLER else red_iptal.VARSAYILAN_DUZEN


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
