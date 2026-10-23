"""Kullanıcı kayıt bildirimi: kullanıcı / büro bilgileri kaydedilince program sağlayıcısına e-posta ile iletilir.

Şifresiz bir form servisi kullanılır (varsayılan FormSubmit): program içinde e-posta şifresi bulunmaz.
Adres `kayit_bildirim.json` dosyasından okunur; program dağıtan kişi bunu değiştirebilir:
    {"adres": "https://formsubmit.co/ajax/bilgi@smmmantalya.com"}
FormSubmit ilk gönderimde alıcı adrese bir ETKİNLEŞTİRME e-postası yollar; o bağlantıya bir kez tıklanınca
sonraki bildirimler doğrudan gelir.

GÖNDERİLENLER: yalnız kullanıcı/büro alanları (ad soyad, unvan, VKN, e-posta, telefon, adres, lisans no),
program sürümü ve bilgisayar adı. Luca üye no / kullanıcı adı / parola ASLA gönderilmez.
"""
from __future__ import annotations

import hashlib
import json
import os
import platform
import threading
import urllib.request
from datetime import datetime
from pathlib import Path

from . import ayarlar, depo

SURUM = "2026.10"
VARSAYILAN_ADRES = "https://formsubmit.co/ajax/bilgi@smmmantalya.com"
_ALANLAR = {"ad_soyad": "Ad soyad", "buro_unvan": "Büro / firma unvanı", "vkn": "VKN / TCKN",
            "eposta": "E-posta", "telefon": "Telefon", "adres": "Adres", "lisans_no": "Lisans numarası"}


def hedef_adres() -> str | None:
    if os.environ.get("FK_BILDIRIM_URL") is not None:          # testler / dağıtıcı
        return os.environ["FK_BILDIRIM_URL"] or None
    y = Path(__file__).parent / "kayit_bildirim.json"
    try:
        return json.loads(y.read_text(encoding="utf-8")).get("adres") or None
    except (OSError, ValueError):
        return VARSAYILAN_ADRES


def _durum_yolu() -> Path:
    return depo.veri() / "kayit_bildirimi.json"


def _durum() -> dict:
    try:
        return json.loads(_durum_yolu().read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def _icerik() -> dict:
    a = ayarlar.oku()
    veri = {etiket: a.get(k, "") for k, etiket in _ALANLAR.items()}
    return veri


def _ozet(veri: dict) -> str:
    return hashlib.sha256(json.dumps(veri, ensure_ascii=False, sort_keys=True).encode()).hexdigest()


def durum() -> dict:
    d = _durum()
    return {"gonderildi": d.get("zaman"), "hata": d.get("hata"), "adres_var": bool(hedef_adres()),
            "guncel": d.get("ozet") == _ozet(_icerik()) and not d.get("hata")}


def gonder(zorla: bool = False) -> dict:
    """Bilgiler değiştiyse (ya da önceki gönderim başarısızsa) bildirimi gönderir. Ağ hatası programı durdurmaz."""
    adres = hedef_adres()
    veri = _icerik()
    if not adres or not any(veri.values()):
        return durum()
    ozet = _ozet(veri)
    eski = _durum()
    if not zorla and eski.get("ozet") == ozet and not eski.get("hata"):
        return durum()
    govde = {"_subject": f"Fatura Kontrol kullanıcı kaydı – {veri['Büro / firma unvanı'] or veri['Ad soyad']}",
             "_template": "table", "_captcha": "false",
             **veri, "Program sürümü": SURUM, "Bilgisayar": platform.node(),
             "Kayıt zamanı": datetime.now().strftime("%d.%m.%Y %H:%M"),
             "Durum": "yeni kayıt" if not eski.get("zaman") else "bilgi güncellemesi"}
    if veri["E-posta"]:
        govde["_replyto"] = veri["E-posta"]
    try:
        istek = urllib.request.Request(adres, data=json.dumps(govde, ensure_ascii=False).encode("utf-8"),
                                       headers={"Content-Type": "application/json", "Accept": "application/json"},
                                       method="POST")
        with urllib.request.urlopen(istek, timeout=15) as r:
            yanit = r.read(2000).decode("utf-8", "replace")
            if r.status >= 300:
                raise OSError(f"HTTP {r.status}")
        yeni = {"ozet": ozet, "zaman": datetime.now().isoformat(timespec="seconds"), "hata": None,
                "yanit": yanit[:300]}
    except Exception as e:                      # internet yok vb. → sonraki açılışta yeniden denenir
        yeni = {**eski, "hata": f"{type(e).__name__}: {str(e)[:150]}"}
    _durum_yolu().parent.mkdir(parents=True, exist_ok=True)
    _durum_yolu().write_text(json.dumps(yeni, ensure_ascii=False), encoding="utf-8")
    return durum()


def arka_planda_gonder():
    threading.Thread(target=gonder, daemon=True).start()
