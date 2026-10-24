"""Kullanıcı / büro bilgileri ve isteğe bağlı Luca giriş bilgileri (veri/ayarlar.json).

Luca parolası düz metin olarak saklanmaz: Windows'ta DPAPI ile, yalnız bu Windows kullanıcısının
çözebileceği şekilde şifrelenir. Windows dışında (geliştirme / test) diske hiç yazılmaz, yalnız süreç açıkken
bellekte tutulur (rapor-02 D11). Parola hiçbir zaman ekrana / API yanıtına geri gönderilmez.
"""
from __future__ import annotations

import base64
import json
import sys

from . import depo

KULLANICI_ALANLARI = ["ad_soyad", "buro_unvan", "vkn", "eposta", "telefon", "adres", "lisans_no"]
LUCA_ALANLARI = ["luca_uye_no", "luca_kullanici"]


def _yol():
    return depo.veri() / "ayarlar.json"


def _ham() -> dict:
    try:
        return json.loads(_yol().read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def _yaz(d: dict):
    _yol().parent.mkdir(parents=True, exist_ok=True)
    _yol().write_text(json.dumps(d, ensure_ascii=False, indent=1), encoding="utf-8")


# ---------------------------------------------------------------- parola şifreleme
if sys.platform == "win32":
    import ctypes
    from ctypes import wintypes

    class _BLOB(ctypes.Structure):
        _fields_ = [("cbData", wintypes.DWORD), ("pbData", ctypes.POINTER(ctypes.c_char))]

    def _blob(b: bytes):
        buf = ctypes.create_string_buffer(b, len(b))
        return _BLOB(len(b), ctypes.cast(buf, ctypes.POINTER(ctypes.c_char))), buf

    def _sifrele(metin: str) -> str:
        giris, _tut = _blob(metin.encode("utf-8"))
        cikis = _BLOB()
        if not ctypes.windll.crypt32.CryptProtectData(ctypes.byref(giris), "FaturaKontrol", None, None, None, 0,
                                                       ctypes.byref(cikis)):
            raise OSError("Parola şifrelenemedi")
        try:
            return "dpapi:" + base64.b64encode(ctypes.string_at(cikis.pbData, cikis.cbData)).decode()
        finally:
            ctypes.windll.kernel32.LocalFree(cikis.pbData)

    def _coz(deger: str) -> str:
        ham = base64.b64decode(deger.split(":", 1)[1])
        giris, _tut = _blob(ham)
        cikis = _BLOB()
        if not ctypes.windll.crypt32.CryptUnprotectData(ctypes.byref(giris), None, None, None, None, 0,
                                                         ctypes.byref(cikis)):
            raise OSError("Parola çözülemedi (başka bir Windows kullanıcısında kaydedilmiş olabilir)")
        try:
            return ctypes.string_at(cikis.pbData, cikis.cbData).decode("utf-8")
        finally:
            ctypes.windll.kernel32.LocalFree(cikis.pbData)
else:                                   # geliştirme / test ortamı (Windows dışı): diske yazılmaz, yalnız bellekte
    _BELLEK: dict[str, str] = {}

    def _sifrele(metin: str) -> str:
        import secrets
        k = secrets.token_hex(8)
        _BELLEK[k] = metin
        return "bellek:" + k

    def _coz(deger: str) -> str:
        tur, _, v = deger.partition(":")
        if tur == "b64":                    # eski sürümün kaydı (yalnız base64): okunur, ilk yazışta silinir
            return base64.b64decode(v).decode("utf-8")
        if tur == "bellek" and v in _BELLEK:
            return _BELLEK[v]
        raise OSError("Parola bu oturumda girilmedi (Windows dışında diske kaydedilmez)")


def _parola_var(d: dict) -> bool:
    """Kayıtlı parola bu süreçte çözülebiliyor mu?"""
    if not d.get("luca_parola"):
        return False
    try:
        _coz(d["luca_parola"])
        return True
    except Exception:
        return False


# ---------------------------------------------------------------- dışa açık işlevler
def oku() -> dict:
    """Ekranda gösterilecek ayarlar (parola hariç; yalnız kayıtlı olup olmadığı)."""
    d = _ham()
    cikti = {k: d.get(k, "") for k in KULLANICI_ALANLARI + LUCA_ALANLARI}
    cikti["luca_parola_kayitli"] = _parola_var(d)
    cikti["otomatik_giris"] = bool(d.get("otomatik_giris"))
    cikti["kurulum_tamam"] = bool(d.get("ad_soyad") or d.get("buro_unvan"))
    import os
    if os.environ.get("FK_MUHAWIN"):          # büro ve Luca bilgileri MuhaWin Ayarlar'ında tutulur
        cikti["muhawin"] = True
        cikti["kurulum_tamam"] = True
        cikti["muhawin_luca_girisi"] = _muhawin_girisi() is not None
    return cikti


def kaydet(yeni: dict):
    d = _ham()
    for k in KULLANICI_ALANLARI + LUCA_ALANLARI:
        if k in yeni:
            d[k] = str(yeni[k] or "").strip()
    if "otomatik_giris" in yeni:
        d["otomatik_giris"] = bool(yeni["otomatik_giris"])
    if yeni.get("luca_parola_sil"):
        d.pop("luca_parola", None)
    elif yeni.get("luca_parola"):
        d["luca_parola"] = _sifrele(str(yeni["luca_parola"]))
    elif str(d.get("luca_parola", "")).startswith("b64:"):   # eski sürümün düz (base64) kaydı diskte bırakılmaz
        try:
            d["luca_parola"] = _sifrele(_coz(d["luca_parola"]))
        except Exception:
            d.pop("luca_parola", None)
    _yaz(d)


def _muhawin_girisi() -> dict | None:
    """MuhaWin içinde çalışırken Luca giriş bilgileri MuhaWin Ayarlar'ından (ortam değişkeniyle) gelir."""
    import os
    try:
        g = json.loads(os.environ.get("FK_LUCA_GIRIS") or "{}")
    except ValueError:
        return None
    if os.environ.get("FK_LUCA_UYE"):                 # ofis üyesi: üye no ofisinki
        g["uye_no"] = os.environ["FK_LUCA_UYE"]
    if all(g.get(k) for k in ("uye_no", "kullanici", "parola")):
        return {k: str(g[k]) for k in ("uye_no", "kullanici", "parola")}
    return None


def luca_girisi() -> dict | None:
    """Otomatik giriş açık ve bilgiler tamamsa {'uye_no','kullanici','parola'}; değilse None."""
    m = _muhawin_girisi()
    if m:
        return m
    d = _ham()
    if not d.get("otomatik_giris") or not all(d.get(k) for k in ("luca_uye_no", "luca_kullanici", "luca_parola")):
        return None
    try:
        parola = _coz(d["luca_parola"])
    except Exception:
        return None
    return {"uye_no": d["luca_uye_no"], "kullanici": d["luca_kullanici"], "parola": parola}
