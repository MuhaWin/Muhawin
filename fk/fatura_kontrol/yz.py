"""Muhasebe Denetimi › Detay denetim › Yapay zekâ ile karşılaştırma (Görev 43 Faz 4) — gönderilecek verinin hazırlanması.

Burada hiçbir dış servise bağlanılmaz: yalnız Claude'a gönderilecek METİN hazırlanır ve dönen öneriler firmada saklanır.
İsteği masaüstü programın ana süreci (Electron, yz.js) gönderir; anahtar orada şifreli durur.

Veri en aza indirilir (kullanıcı ayarlarda açıkça onay verir):
  * Fatura dosyası (PDF / XML) GÖNDERİLMEZ; yalnız gereken alanlar: tarih, tür, karşı tarafın unvanı, tutarlar, KDV oranları,
    mal / hizmet kalemleri; bu ayki kayıt (hesap satırları, açıklamasız); carinin önceki aylardaki kayıt özeti.
  * VKN / TCKN ve 10–11 haneli tüm numaralar, IBAN, e-posta, telefon maskelenir; adres hiç alınmaz.
  * Gerçek kişi olabilecek unvanlar (TCKN'li karşı taraf; şirket eki olmayan cari adları) "[gerçek kişi]" olur.
  * Firmanın hesap planından cari / personel / ortak hesapları (12x, 13x, 19x avans, 32x, 33x, 34x …) gönderilmez.
"""
from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime
from pathlib import Path

# Görev 49: yapay zekâ önerisi şimdilik KAPALI (kod duruyor). Kapalıyken /api/denetim/yz/* uçları 404 döner ve detay
# listesine öneri eklenmez. Açmak için True (programda yz.js › YZ_ETKIN, ekranda denetim.html › YZ_ETKIN de açılmalı).
ETKIN = False
ONBELLEK_JSON = "detay-yz.json"
KARARLAR = ("uygun", "supheli", "uygun_degil")
_SIRKET = re.compile(r"\b(A\.?\s?Ş\.?|AŞ|A\.S\.?|LTD|LİMİTED|LIMITED|ŞTİ|STİ|ŞİRKETİ|SIRKETI|KOOP|KOOPERATİF|VAKF|DERNE|BELEDİYE|"
                     r"BAKANLI|MÜDÜRLÜ|ÜNİVERSİTE|BANK|SİGORTA|HOLDİNG|TİCARET|SANAYİ|ENERJİ|ELEKTRİK|TELEKOM|TURKCELL|VODAFONE|"
                     r"SU VE KANALİZASYON|İDARESİ|KURUMU|BAŞKANLIĞI|ODASI|BORSASI)", re.I)      # sonda \b yok: BELEDİYESİ, VAKFI …
_GIZLI_HESAP = ("12", "13", "195", "196", "32", "33", "34", "43", "44")   # cari / personel / ortak / avans hesapları
_IBAN = re.compile(r"\bTR\s?\d{2}(?:\s?\d{4}){5}\s?\d{2}\b", re.I)
_EPOSTA = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")
_UZUN_SAYI = re.compile(r"(?<![\d.,])\+?\d[\d ]{9,14}\d(?![\d,])")    # VKN / TCKN / telefon / abone no
_SAYI_10_11 = re.compile(r"(?<!\d)\d{10,11}(?!\d)")


def maskele(metin: str) -> str:
    """Serbest metinden IBAN, e-posta, VKN / TCKN / telefon gibi uzun numaraları çıkarır."""
    s = _IBAN.sub("[IBAN]", str(metin or ""))
    s = _EPOSTA.sub("[e-posta]", s)
    s = _SAYI_10_11.sub("[numara]", s)
    s = _UZUN_SAYI.sub(lambda m: "[numara]" if len(re.sub(r"\D", "", m.group(0))) >= 10 else m.group(0), s)
    return s


def gercek_kisi_mi(unvan: str, vkn: str = "") -> bool:
    if len(re.sub(r"\D", "", vkn or "")) == 11:
        return True                                       # TCKN: gerçek kişi (şahıs işletmesi dahil)
    u = (unvan or "").strip()
    return bool(u) and not _SIRKET.search(u.replace("i", "İ").replace("ı", "I").upper())


def unvan_maskele(unvan: str, vkn: str = "") -> str:
    return "[gerçek kişi]" if gercek_kisi_mi(unvan, vkn) else maskele(unvan)


def _gizli_hesap(kod: str) -> bool:
    return kod.startswith(_GIZLI_HESAP)


def firma_baglami(muavin) -> str:
    """Önbelleğe alınacak firma bağlamı: kullanılan hesap planı (cari / personel hesapları hariç), sıralı ve sabit."""
    adlar: dict[str, str] = {}
    for s in muavin:
        if s.hesap_kodu[:1] in "1234567" and not _gizli_hesap(s.hesap_kodu):
            adlar.setdefault(s.hesap_kodu, maskele(s.hesap_adi)[:60])
    satirlar = [f"{k}\t{v}" for k, v in sorted(adlar.items())][:800]
    return "Firmanın kullandığı hesaplar (kod\tad; cari, personel ve ortak hesapları gönderilmedi):\n" + "\n".join(satirlar)


def _hesap_adi(kod: str, ad: str, karsi_kisi: bool) -> str:
    if _gizli_hesap(kod) or kod.startswith(("120", "320", "329", "336")):
        return "[cari hesap]" if karsi_kisi or gercek_kisi_mi(ad) else maskele(ad)[:60]
    return maskele(ad)[:60]


def fatura_istegi(x: dict, fis_satirlari: list[dict]) -> dict:
    """Detay öğesinden (denetim.json › detay) gönderilecek veri. Dönen sözlük JSON'a çevrilip gönderilir ve
    kullanıcıya "Gönderilecek veriyi göster" ile aynen gösterilir."""
    kisi = gercek_kisi_mi(x.get("karsi_taraf", ""), x.get("vkn", ""))
    g = x.get("gecmis") or {}
    return {
        "fatura": {
            "yon": "alış" if x.get("yon") == "ALIS" else "satış",
            "tarih": x.get("tarih"),
            "karsi_taraf": "[gerçek kişi]" if kisi else maskele(x.get("karsi_taraf", "")),
            "karsi_taraf_turu": "gerçek kişi" if kisi else "tüzel kişi",
            "matrah": x.get("matrah"), "kdv": x.get("kdv"), "toplam": x.get("toplam"),
            "kalemler": [maskele(k)[:80] for k in (x.get("kalemler") or [])[:15]],
        },
        "bu_ay_kayit": {
            "hesaplar": [{"kod": h["kod"], "ad": maskele(h["ad"])[:60], "tutar": h["tutar"]} for h in x.get("hesaplar", [])],
            "cari": ({"kod": x["cari"]["kod"], "ad": _hesap_adi(x["cari"]["kod"], x["cari"]["ad"], kisi)} if x.get("cari") else None),
            "fis_satirlari": [{"hesap": s["hesap"], "ad": _hesap_adi(s["hesap"], s.get("hesap_adi", ""), kisi),
                               "borc": s.get("borc"), "alacak": s.get("alacak")} for s in fis_satirlari[:40]],
            "muavinde_kayitli": bool(x.get("kayitli")),
        },
        "gecmis": {"onceki_ay_sayisi": g.get("aylar", 0), "hesaplar": g.get("hesaplar", []), "en_dusuk": g.get("min"),
                   "en_yuksek": g.get("max"), "kural_sonucu": g.get("aciklama", "")},
    }


def istek_ozeti(baglam: str, istek: dict) -> str:
    return hashlib.sha256((baglam + json.dumps(istek, ensure_ascii=False, sort_keys=True)).encode("utf-8")).hexdigest()[:24]


def token_tahmini(metin: str) -> int:
    return max(1, round(len(metin) / 3.2))


# ------------------------------------------------------------------ öneri önbelleği (firma klasöründe)
def onbellek(firma: Path) -> dict:
    try:
        v = json.loads((firma / ONBELLEK_JSON).read_text(encoding="utf-8"))
        return v if isinstance(v, dict) else {}
    except (OSError, ValueError):
        return {}


def sonuc_dogrula(s: dict) -> dict:
    if not isinstance(s, dict) or s.get("karar") not in KARARLAR:
        raise ValueError("Geçersiz yapay zekâ sonucu")
    try:
        guven = float(s.get("guven", 0))
    except (TypeError, ValueError):
        raise ValueError("Geçersiz güven değeri")
    return {"karar": s["karar"], "guven": max(0.0, min(1.0, guven)), "gerekce": str(s.get("gerekce") or "")[:600],
            "onerilen_hesap": str(s.get("onerilen_hesap") or "")[:40]}


def sonuc_yaz(firma: Path, anahtar: str, ozet: str, sonuc: dict, model: str) -> dict:
    v = onbellek(firma)
    v[anahtar] = {"ozet": ozet, "sonuc": sonuc_dogrula(sonuc), "model": str(model)[:60], "zaman": datetime.now().isoformat(timespec="minutes")}
    firma.mkdir(parents=True, exist_ok=True)
    (firma / ONBELLEK_JSON).write_text(json.dumps(v, ensure_ascii=False, indent=1), encoding="utf-8")
    return v[anahtar]
