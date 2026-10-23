"""Verilerin bilgisayardaki düzeni.

veri/
  ayarlar.json                      kullanıcı/büro bilgileri ve (şifreli) Luca girişi
  firma_listesi.xlsx                Luca'dan çekilen firma listesi (Dahil E/H)
  gecmis.sqlite                     rapor geçmişi (her firma-dönem için tek satır)
  firmalar/<FİRMA>/<YIL>/<AA>/      o dönemin indirilen belgeleri, muavini ve kontrol raporu
  toplu/<YIL-AA>/                   o ayın toplu kontrol özeti

Aynı firma ve dönem yeniden sorgulanınca eski dosyalar silinir, yenileri yazılır (yer kaplamasın diye).
"""
from __future__ import annotations

import json
import os
import re
import shutil
from datetime import date
from pathlib import Path

SURUM = "2"
RAPOR_EXCEL = "kontrol_raporu.xlsx"
RAPOR_JSON = "rapor.json"


def veri() -> Path:
    return Path(os.environ.get("FK_VERI", Path.cwd() / "veri"))


def firmalar_kok() -> Path:
    return veri() / "firmalar"


def toplu_kok() -> Path:
    return veri() / "toplu"


def guvenli_ad(ad: str) -> str:
    """Windows'ta klasör adı olabilecek hale getirir (Türkçe harfler korunur)."""
    ad = re.sub(r'[<>:"/\\|?*\x00-\x1f]+', " ", ad or "")
    ad = re.sub(r"\s+", " ", ad).strip(" .")
    if ad.upper() in {"CON", "PRN", "AUX", "NUL"} or re.fullmatch(r"(?i)(COM|LPT)\d", ad):
        ad = "_" + ad
    return ad[:60].strip(" .") or "FIRMA"


def firma_klasoru(firma_ad: str) -> Path:
    return firmalar_kok() / guvenli_ad(firma_ad)


def donem_klasoru(firma_ad: str, bas: date) -> Path:
    return firma_klasoru(firma_ad) / f"{bas:%Y}" / f"{bas:%m}"


def toplu_klasoru(bas: date) -> Path:
    return toplu_kok() / f"{bas:%Y-%m}"


def donem_temizle(klasor: Path) -> Path:
    """Dönem klasörünü boşaltır (önceki indirmelerin yerine yenileri yazılacak)."""
    if klasor.exists():
        shutil.rmtree(klasor, ignore_errors=True)
    klasor.mkdir(parents=True, exist_ok=True)
    return klasor


def rapor_id(klasor: Path) -> str:
    return klasor.resolve().relative_to(firmalar_kok().resolve()).as_posix()


def rapor_klasoru(rid: str) -> Path | None:
    """Rapor kimliğinden (FİRMA/YIL/AA) klasörü bulur; dışarı taşan yolları reddeder."""
    parcalar = (rid or "").split("/")
    if len(parcalar) != 3 or any(p in ("", ".", "..") for p in parcalar) or \
            not re.fullmatch(r"\d{4}", parcalar[1]) or not re.fullmatch(r"\d{2}", parcalar[2]):
        return None
    k = (firmalar_kok() / parcalar[0] / parcalar[1] / parcalar[2]).resolve()
    try:
        k.relative_to(firmalar_kok().resolve())
    except ValueError:
        return None
    return k


# ---------------------------------------------------------------- firma kimliği (VKN -> klasör)
def firma_bilgisi_yaz(firma_ad: str, vkn: str | None, luca_id: str | None = None):
    k = firma_klasoru(firma_ad)
    k.mkdir(parents=True, exist_ok=True)
    y = k / "firma.json"
    eski = {}
    if y.exists():
        try:
            eski = json.loads(y.read_text(encoding="utf-8"))
        except ValueError:
            pass
    eski.update({"ad": firma_ad, **({"vkn": vkn} if vkn else {}), **({"luca_id": luca_id} if luca_id else {})})
    y.write_text(json.dumps(eski, ensure_ascii=False), encoding="utf-8")


HARIC_JSON = "kaydedilmeyecek.json"


def haric_oku(firma_klasor: Path) -> dict:
    """Firmada "kaydedilmeyecek" işaretlenen faturalar: {anahtar: {belge_no, tarih, karsi_unvan, …}}."""
    try:
        return json.loads((firma_klasor / HARIC_JSON).read_text(encoding="utf-8")) or {}
    except (OSError, ValueError):
        return {}


def haric_yaz(firma_klasor: Path, veri: dict):
    firma_klasor.mkdir(parents=True, exist_ok=True)
    (firma_klasor / HARIC_JSON).write_text(json.dumps(veri, ensure_ascii=False, indent=1), encoding="utf-8")


HARIC_KURAL_JSON = "kaydedilmeyecek-kurallari.json"


def haric_kurallari_oku(firma_klasor: Path) -> list:
    """Firmanın "kaydedilmeyecek" kuralları (şahsi faturalar): [{id, alan, ifade, yon, aciklama, zaman}]."""
    try:
        v = json.loads((firma_klasor / HARIC_KURAL_JSON).read_text(encoding="utf-8"))
        return v if isinstance(v, list) else []
    except (OSError, ValueError):
        return []


def haric_kurallari_yaz(firma_klasor: Path, kurallar: list):
    firma_klasor.mkdir(parents=True, exist_ok=True)
    (firma_klasor / HARIC_KURAL_JSON).write_text(json.dumps(kurallar, ensure_ascii=False, indent=1), encoding="utf-8")


UYGUN_JSON = "uygun-kararlar.json"


def uygun_oku(firma_klasor: Path) -> dict:
    """Kullanıcının açıklama yazarak "uygun" kabul ettiği kayıtlar: {anahtar: {aciklama, zaman, belge_no, …}}."""
    try:
        return json.loads((firma_klasor / UYGUN_JSON).read_text(encoding="utf-8")) or {}
    except (OSError, ValueError):
        return {}


def uygun_yaz(firma_klasor: Path, veri: dict):
    firma_klasor.mkdir(parents=True, exist_ok=True)
    (firma_klasor / UYGUN_JSON).write_text(json.dumps(veri, ensure_ascii=False, indent=1), encoding="utf-8")


def luca_ile_firma(luca_id: str | None) -> str | None:
    """Luca SIRKET_ID'si daha önce bir firma klasörüne yazıldıysa (toplu kontrol / tek firma) o klasörün adı."""
    if not luca_id or not firmalar_kok().exists():
        return None
    for y in firmalar_kok().glob("*/firma.json"):
        try:
            if str(json.loads(y.read_text(encoding="utf-8")).get("luca_id") or "") == str(luca_id):
                return y.parent.name
        except ValueError:
            continue
    return None


def vkn_ile_firma(vkn: str | None) -> str | None:
    """Elle yüklenen dosyalar için: bu VKN daha önce bir firma klasörüne yazıldıysa o klasörün adı."""
    if not vkn or not firmalar_kok().exists():
        return None
    for y in firmalar_kok().glob("*/firma.json"):
        try:
            if json.loads(y.read_text(encoding="utf-8")).get("vkn") == vkn:
                return y.parent.name
        except ValueError:
            continue
    return None


# ---------------------------------------------------------------- temizlik
def _sil(y: Path):
    if y.is_dir():
        shutil.rmtree(y, ignore_errors=True)
    elif y.exists():
        try:
            y.unlink()
        except OSError:
            pass


def eski_surumu_temizle(program_klasoru: Path) -> bool:
    """Önceki sürümlerin dağınık verilerini bir kez siler (yeni düzene temiz başlangıç)."""
    v = veri()
    isaret = v / ".surum"
    if isaret.exists() and isaret.read_text().strip() == SURUM:
        return False
    for y in [v / "toplu", v / "luca_indirmeler", v / "raporlar", v / "gecmis.sqlite", v / "firmalar.xlsx",
              v / "firmalar", program_klasoru / "luca_kayitlari", program_klasoru / "luca_kayit_hata.txt"]:
        _sil(y)
    v.mkdir(parents=True, exist_ok=True)
    isaret.write_text(SURUM)
    return True


def tum_verileri_sil():
    """Tüm sorgu sonuçlarını ve indirilen belgeleri siler; ayarlar ve firma listesi kalır."""
    for y in [firmalar_kok(), toplu_kok(), veri() / "gecmis.sqlite"]:
        _sil(y)


def klasor_boyutu(y: Path) -> int:
    return sum(f.stat().st_size for f in y.rglob("*") if f.is_file()) if y.exists() else 0
