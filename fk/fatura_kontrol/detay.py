"""Muhasebe Denetimi › Detay denetim (Görev 43 Faz 2): gider kontrolü ve gelir kontrolü.

Her fatura muhasebe kaydıyla karşılaştırılır: hangi gider (alış: 15x, 25x, 6xx gider, 7xx …) ya da gelir (satış: 60x,
64x, 67x) hesabına, hangi fişle, hangi cariyle kaydedilmiş. Burada HİÇBİR KAYIT YAPILMAZ; yalnız kontrol edilir.

Bir fatura otomatik "uygun" sayılır (kontrol listesine düşmez):
  * kullanıcının KONTROL KURALI'na uyuyorsa (ör. "VKN 1234567890 → 770.01.01.001 uygundur");
  * GEÇMİŞLE UYUMLUYSA: yıllık muavinde önceki en az iki ayda aynı cariye ait kayıtlar hep aynı hesap(lar)a gitmiş,
    bu ay da aynı hesap(lar)a gitmiş ve tutar geçmiş aralığın içinde (en düşüğün yarısı – en yükseğin 1,5 katı).
    Deterministiktir; fatura / muavin hiçbir dış servise gönderilmez.
Kalanlar kontrol listesine düşer; kullanıcı kontrol ekranında "Uygun" / "Uygun değil" der. Kararlar ve kurallar firma
klasöründe saklanır (detay-kararlar.json, detay-kurallari.json); hesaplama denetim.json'daki "detay" bölümünden yapılır.
"""
from __future__ import annotations

import json
import re
from collections import defaultdict
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path

from .eslestirme import _CARI_ON, _GELIR_ON, _cari_uyar, _gider_mi, _kok, fatura_anahtari

KARAR_JSON = "detay-kararlar.json"
KURAL_JSON = "detay-kurallari.json"
ALT_ORAN, UST_ORAN = Decimal("0.5"), Decimal("1.5")      # geçmiş tutar aralığı payı
EN_AZ_AY = 2


def _sayi(v) -> float:
    return float(round(Decimal(v or 0), 2))


def _hesap_mi(s, yon: str) -> bool:
    return _gider_mi(s) if yon == "ALIS" else s.hesap_kodu.startswith(_GELIR_ON)


def _tutar(s, yon: str) -> Decimal:
    return (s.borc - s.alacak) if yon == "ALIS" else (s.alacak - s.borc)


def _cari(satirlar, yon: str):
    """Fişte faturanın karşı tarafı: alışta alacaklı, satışta borçlu cari / ödeme hesabı (yoksa herhangi bir yönde)."""
    L = [s for s in satirlar if s.hesap_kodu.startswith(_CARI_ON)]
    yonlu = [s for s in L if (s.alacak if yon == "ALIS" else s.borc)]
    return (yonlu or L or [None])[0]


def satici_anahtari(s) -> str | None:
    """Cari kimliği: alt hesabı firmaya özelse (320.01.0032) kodu, değilse muavindeki ünvanın kökleri."""
    if s is None:
        return None
    if s.hesap_kodu.count(".") >= 2 or not (s.unvan or "").strip():
        return "k:" + s.hesap_kodu
    kok = _kok(s.unvan)
    return "u:" + " ".join(sorted(kok)) if kok else "k:" + s.hesap_kodu


def _fis_index(muavin) -> dict:
    ix = defaultdict(list)
    for s in muavin:
        ix[(s.fis_no, s.fis_tarihi)].append(s)
    return ix


def gecmis_indeksi(muavin, bas: date) -> dict:
    """Önceki ayların fişleri: {(yon, satıcı anahtarı): {(yıl, ay): {"hesaplar": set, "tutar": Decimal}}}.
    Birden çok cari içeren (toplu) fişler atlanır."""
    out: dict = defaultdict(dict)
    for (no, t), L in _fis_index(muavin).items():
        if t >= bas or no == "DEVREDEN":
            continue
        for yon in ("ALIS", "SATIS"):
            h = [s for s in L if _hesap_mi(s, yon) and _tutar(s, yon) > 0]
            if not h:
                continue
            cariler = {satici_anahtari(s) for s in L if s.hesap_kodu.startswith(_CARI_ON) and (s.alacak if yon == "ALIS" else s.borc)}
            if len(cariler) != 1:
                continue
            ay = out[(yon, cariler.pop())].setdefault((t.year, t.month), {"hesaplar": set(), "tutar": Decimal(0)})
            ay["hesaplar"].update(s.hesap_kodu for s in h)
            ay["tutar"] += sum((_tutar(s, yon) for s in h), Decimal(0))
    return out


def gecmis_degerlendir(gecmis: dict, hesaplar: set, tutar: Decimal) -> dict:
    aylar = sorted(gecmis)
    if not aylar:
        return {"aylar": 0, "uyumlu": False, "aciklama": "Önceki aylarda bu cariye ait kayıt yok"}
    kumeler = [gecmis[a]["hesaplar"] for a in aylar]
    tutarlar = [gecmis[a]["tutar"] for a in aylar]
    tum = sorted(set().union(*kumeler))
    v = {"aylar": len(aylar), "hesaplar": tum, "min": _sayi(min(tutarlar)), "max": _sayi(max(tutarlar)),
         "son": f"{aylar[-1][1]:02d}.{aylar[-1][0]}"}
    if len(aylar) < EN_AZ_AY:
        return {**v, "uyumlu": False, "aciklama": f"Önceki aylarda yalnız {len(aylar)} ay kayıt var (en az {EN_AZ_AY} gerekir)"}
    if any(k != kumeler[0] for k in kumeler):
        return {**v, "uyumlu": False, "aciklama": "Önceki aylarda farklı hesaplara kaydedilmiş: " + ", ".join(tum)}
    if hesaplar != kumeler[0]:
        return {**v, "uyumlu": False, "aciklama": "Önceki aylarda " + ", ".join(sorted(kumeler[0])) + "; bu ay " + ", ".join(sorted(hesaplar))}
    if not (min(tutarlar) * ALT_ORAN <= tutar <= max(tutarlar) * UST_ORAN):
        return {**v, "uyumlu": False, "aciklama": f"Hesap aynı ama tutar ({_sayi(tutar):,.2f}) önceki ayların aralığının dışında "
                                                 f"({_sayi(min(tutarlar)):,.2f} – {_sayi(max(tutarlar)):,.2f})"}
    return {**v, "uyumlu": True, "aciklama": f"Önceki {len(aylar)} ayda da " + ", ".join(sorted(hesaplar)) + " hesabına kaydedilmiş"}


_ALNUM = re.compile(r"[^0-9A-Z]")
TOL = Decimal("0.05")


def _ayni_ay(s, f) -> bool:
    return (s.fis_tarihi.year, s.fis_tarihi.month) == (f.tarih.year, f.tarih.month) or s.belge_tarihi == f.tarih


def _no_metni(s) -> str:
    return _ALNUM.sub("", f"{s.belge_no or ''} {s.aciklama or ''}".upper().replace("İ", "I"))


def yedek_eslesme(f, donem: list, fis_ix: dict, kullanilan: set) -> tuple[list, str]:
    """Belge no ile eşleşmeyen faturanın muavin kaydı (Görev 49). Sırayla:
    1) açıklama / evrak no'da numara farklı yazılmış (ayraçlı "ABC-2026-000000123", küçük harf, seri ön eki olmadan
       "2026000000123"); aynı ay ve fişin karşı tarafı tutuyorsa;
    2) numara hiç yazılmamışsa: aynı ayda, karşı tarafı (ünvan / VKN) tutan tek fişte cari / ödeme hesabına faturanın
       ödenecek tutarı (alışta alacak, satışta borç) kaydedilmiş.
    donem: dönemin muavin satırları ve numara metinleri [(satır, metin)]. Dönen: (satırlar, nasıl bulunduğu).
    Başka faturaya ait satırlar (kullanilan) alınmaz."""
    no = _ALNUM.sub("", (f.belge_no or "").upper())
    if len(no) >= 8:
        adaylar = [no] + ([no[3:]] if len(no) == 16 and no[3:].isdigit() else [])
        for a in adaylar:
            L = [s for s, m in donem if a in m and id(s) not in kullanilan and _ayni_ay(s, f)]
            fisler = {(s.fis_no, s.fis_tarihi) for s in L}
            fisler = {k for k in fisler if _cari_uyar(f, fis_ix.get(k) if k[0] else L) is not False}
            if len(fisler) == 1:
                k = fisler.pop()
                ornek = next((s.belge_no or s.aciklama for s in L if (s.fis_no, s.fis_tarihi) == k), "")
                return [s for s in L if (s.fis_no, s.fis_tarihi) == k], f"muavinde numara farklı yazılmış: '{str(ornek)[:60]}'"
    tutar = Decimal(f.odenecek or 0) or Decimal(getattr(f, "vergiler_dahil", 0) or 0) or Decimal(f.matrah or 0) + Decimal(f.kdv_toplam or 0)
    if not tutar:
        return [], ""
    taraf = "alacak" if f.yon == "ALIS" else "borc"
    L = [s for s, _ in donem if s.hesap_kodu.startswith(_CARI_ON) and abs(getattr(s, taraf) - tutar) <= TOL
         and id(s) not in kullanilan and _ayni_ay(s, f)]
    fisler = {(s.fis_no, s.fis_tarihi) for s in L if s.fis_no}
    fisler = [k for k in fisler if _cari_uyar(f, fis_ix.get(k, [])) is True]
    if len(fisler) == 1:
        L = [x for x in fis_ix[fisler[0]] if id(x) not in kullanilan]
        return L, "belge no muavinde yok; aynı ayda karşı taraf ve ödenecek tutar tutan fiş"
    return [], ""


def hazirla(r, faturalar, muavin, bas: date, bit: date) -> dict:
    """denetim.json › "detay": dönem faturalarının muhasebe kaydı özeti (gider: alış, gelir: satış)."""
    fis_ix = _fis_index(muavin)
    gecmis = gecmis_indeksi(muavin, bas)
    sat: dict[int, dict] = defaultdict(dict)                 # fatura → {id(satır): satır}
    for so in r.sonuclar:
        sat[id(so.fatura)].update((id(s), s) for s in so.satirlar)
    kullanilan = {i for d in sat.values() for i in d}
    acik_ix: dict[tuple, list] = defaultdict(list)          # fiş no'su olmayan satırlar: (tarih, açıklama)
    for s in muavin:
        if not s.fis_no:
            acik_ix[(s.fis_tarihi, s.aciklama)].append(s)
    aylar = {(bas.year, bas.month), (bit.year, bit.month)}
    donem = None                                             # yedek eşleştirme için dönemin satırları (gerekirse bir kez)
    out = {"gider": [], "gelir": []}
    for f in sorted(faturalar, key=lambda f: (f.tarih, f.belge_no)):
        if f.yon not in ("ALIS", "SATIS") or not (bas <= f.tarih <= bit):
            continue
        kendi_ix = sat.get(id(f), {})
        eslesme = ""
        if not kendi_ix:
            if donem is None:
                donem = [(s, _no_metni(s)) for s in muavin if (s.fis_tarihi.year, s.fis_tarihi.month) in aylar or
                         (s.belge_tarihi and bas <= s.belge_tarihi <= bit) or bas <= s.fis_tarihi <= bit]
            L, eslesme = yedek_eslesme(f, donem, fis_ix, kullanilan)
            kendi_ix = {id(s): s for s in L}
            kullanilan.update(kendi_ix)
        kendi = list(kendi_ix.values())
        fisler = sorted({(s.fis_no, s.fis_tarihi) for s in kendi if s.fis_no}, key=lambda k: (k[1], k[0]))
        satirlar = []
        for k in fisler:
            L = fis_ix.get(k, [])
            baska = {s.belge_no for s in L if s.belge_no and s.belge_no != f.belge_no}
            # toplu fiş (fişte başka faturalar da var): numarasız satırdan yalnız bu faturanınkiler (karşı tarafı yazıyor
            # ya da gider / gelir tutarı faturanın matrahı)
            satirlar += [s for s in L if not baska or s.belge_no == f.belge_no or id(s) in kendi_ix or
                         (not s.belge_no and (_cari_uyar(f, [s]) is True or
                                              (_hesap_mi(s, f.yon) and abs(_tutar(s, f.yon) - f.matrah) <= TOL)))]
        if kendi and not fisler:                              # muavinde fiş no yok: aynı gün, aynı açıklamalı satırlar
            ek = {id(s): s for s in kendi}
            for s in kendi:
                ek.update((id(x), x) for x in acik_ix.get((s.fis_tarihi, s.aciklama), []))
            satirlar = list(ek.values())
        h: dict[str, dict] = {}
        for s in satirlar:
            if _hesap_mi(s, f.yon):
                x = h.setdefault(s.hesap_kodu, {"kod": s.hesap_kodu, "ad": s.hesap_adi, "tutar": Decimal(0)})
                x["tutar"] += _tutar(s, f.yon)
        hesaplar = [{**x, "tutar": _sayi(x["tutar"])} for x in sorted(h.values(), key=lambda x: x["kod"]) if x["tutar"]]
        toplam = sum((Decimal(str(x["tutar"])) for x in hesaplar), Decimal(0))
        c = _cari(satirlar, f.yon)
        anahtar = satici_anahtari(c)
        g = gecmis_degerlendir(gecmis.get((f.yon, anahtar), {}) if anahtar else {}, {x["kod"] for x in hesaplar}, toplam) \
            if hesaplar else {"aylar": 0, "uyumlu": False, "aciklama": ""}
        out["gider" if f.yon == "ALIS" else "gelir"].append({
            "anahtar": fatura_anahtari(f), "belge_no": f.belge_no, "tarih": f.tarih.isoformat(), "yon": f.yon,
            "karsi_taraf": f.karsi_unvan, "vkn": f.karsi_vkn, "matrah": _sayi(f.matrah), "kdv": _sayi(f.kdv_toplam),
            "toplam": _sayi(f.odenecek), "kayitli": bool(kendi), "kalemler": [str(k)[:120] for k in (f.kalemler or [])[:15]],
            "fisler": [{"no": n, "tarih": t.isoformat()} for n, t in fisler], "eslesme": eslesme,
            "kayit_satirlari": [] if fisler else [{"tarih": s.fis_tarihi.isoformat(), "hesap": s.hesap_kodu, "hesap_adi": s.hesap_adi,
                                                   "aciklama": s.aciklama, "borc": _sayi(s.borc), "alacak": _sayi(s.alacak)}
                                                  for s in sorted(satirlar, key=lambda s: (s.satir, s.hesap_kodu))[:30]],
            "hesaplar": hesaplar, "hesap_toplam": _sayi(toplam),
            "cari": {"kod": c.hesap_kodu, "ad": c.hesap_adi} if c else None, "gecmis": g})
    return out


# ------------------------------------------------------------------ kurallar ve kararlar (firma klasöründe)
def _oku(y: Path, bos):
    try:
        v = json.loads(y.read_text(encoding="utf-8"))
        return v if isinstance(v, type(bos)) else bos
    except (OSError, ValueError):
        return bos


def _yaz(y: Path, v):
    y.parent.mkdir(parents=True, exist_ok=True)
    y.write_text(json.dumps(v, ensure_ascii=False, indent=1), encoding="utf-8")


def kurallar(firma: Path) -> list:
    return _oku(firma / KURAL_JSON, [])


def kararlar(firma: Path) -> dict:
    return _oku(firma / KARAR_JSON, {})


# Kontrol kuralı (Görev 49): Faturaları Luca'ya kaydet › "Kural yap" penceresiyle aynı mantık. Şartlar: [{alan, deger}],
# hepsi birlikte tutmalı (VE); bir şartın içinde "A | B" = ya da, "A + B" = ikisi de (3 harf ve kısası tam kelime).
# Sonuç: "uygun" (uygun say) ya da "uygun_degil" (uygun değil say) — kayıttaki "Kaydet" / "Hiç kaydetme" karşılığı.
# Eski kurallar ({vkn | unvan, hesap}) aynen geçerlidir: VKN eşittir / ünvan içerir VE hesap … ile başlar, sonuç uygun.
SART_AD = {"unvan": "Ünvan içerir", "vkn": "VKN/TCKN eşittir", "icerik": "Fatura içeriği içerir",
           "tutar": "Matrah aralığı", "hesap": "Kayıt hesabı ile başlar"}
SONUC_AD = {"uygun": "Uygun say", "uygun_degil": "Uygun değil say"}
_TR = str.maketrans({"İ": "I", "Ş": "S", "Ğ": "G", "Ü": "U", "Ö": "O", "Ç": "C", "Â": "A", "À": "A", "Á": "A",
                     "Î": "I", "Ì": "I", "Í": "I", "Û": "U", "Ù": "U", "Ú": "U"})


def N(s) -> str:
    """Programdaki (renderer › N) karşılaştırma biçimi: Türkçe büyük harf, aksansız, yalnız harf / rakam."""
    u = str(s or "").replace("i", "İ").replace("ı", "I").upper().translate(_TR)
    return re.sub(r"[^A-Z0-9]+", " ", u).strip()


def _metin_tutar(deger: str, metin: str) -> bool:
    d = " " + N(metin) + " "
    for a in str(deger or "").split("|"):
        p = [N(x) for x in a.split("+") if N(x)]
        if p and all((" " + x + " " in d) if len(x) <= 3 else (x in d) for x in p):
            return True
    return False


def _tl(v: str) -> Decimal | None:
    from .muavin_okuyucu import _dec
    v = (v or "").strip()
    if not v:
        return None
    try:
        return _dec(v)
    except ValueError:
        raise ValueError(f"Tutar okunamadı: {v}") from None


def tutar_araligi(deger: str) -> tuple[Decimal | None, Decimal | None]:
    """ "1.000-5.000", "1000 – 5000", "1000-" (en az), "-5000" (en çok), "2500" (tam) → (alt, üst)."""
    p = re.split(r"\s*[-–]\s*", str(deger or "").strip(), maxsplit=1)
    if len(p) == 1:
        t = _tl(p[0])
        return t, t
    return _tl(p[0]), _tl(p[1])


def kural_sartlari(k: dict) -> list[dict]:
    if isinstance(k.get("sartlar"), list):
        return [x for x in k["sartlar"] if isinstance(x, dict) and str(x.get("deger") or "").strip()]
    L = [{"alan": "vkn", "deger": k["vkn"]}] if k.get("vkn") else [{"alan": "unvan", "deger": k.get("unvan", "")}]
    L += [{"alan": "hesap", "deger": k["hesap"]}] if k.get("hesap") else []
    return [x for x in L if str(x["deger"] or "").strip()]


def kural_metni(k: dict) -> str:
    return " VE ".join(f"{SART_AD.get(x['alan'], x['alan'])} “{str(x['deger']).strip()}”" for x in kural_sartlari(k))


def sart_tutar(x: dict, f: dict) -> bool:
    a, d = x.get("alan"), str(x.get("deger") or "").strip()
    if a == "vkn":
        return any(v.strip() and v.strip() == str(f.get("vkn") or "") for v in d.split("|"))
    if a == "unvan":
        return _metin_tutar(d, f.get("karsi_taraf", ""))
    if a == "icerik":
        return _metin_tutar(d, " | ".join(f.get("kalemler") or []))
    if a == "tutar":
        alt, ust = tutar_araligi(d)
        m = Decimal(str(f.get("matrah") or 0))
        return (alt is None or m >= alt) and (ust is None or m <= ust)
    if a == "hesap":
        kodlar = [h["kod"] for h in f.get("hesaplar", [])]
        on = [v.strip() for v in d.split("|") if v.strip()]
        return bool(kodlar) and all(any(c.startswith(o) for o in on) for c in kodlar)
    return False


def kural_ekle(firma: Path, k: dict) -> list:
    """{yon: ALIS / SATIS / *, sartlar: [{alan, deger}], sonuc: uygun / uygun_degil, aciklama}. Eski biçim de kabul edilir:
    {yon, vkn | unvan, hesap} (VKN / ünvan VE hesap ile başlar → uygun)."""
    yon = k.get("yon")
    if yon not in ("ALIS", "SATIS", "*"):
        raise ValueError("Kuralın yönü ALIS, SATIS ya da * olmalı")
    if not isinstance(k.get("sartlar"), list) and not (str(k.get("vkn") or "").strip() or str(k.get("unvan") or "").strip()):
        raise ValueError("Kural için VKN ya da ünvan gerekir")
    sartlar = [{"alan": str(x.get("alan") or ""), "deger": str(x.get("deger") or "").strip()[:200]}
               for x in kural_sartlari(k)][:6]
    if not sartlar:
        raise ValueError("Şartın değerini yazın")
    for x in sartlar:
        if x["alan"] not in SART_AD:
            raise ValueError(f"Bilinmeyen şart: {x['alan']}")
        if x["alan"] == "hesap" and not all(v.strip()[:3].isdigit() for v in x["deger"].split("|") if v.strip()):
            raise ValueError("Hesap kodu 3 haneli ana hesapla başlamalı (ör. 770 ya da 770.01.01.001)")
        if x["alan"] == "tutar" and tutar_araligi(x["deger"]) == (None, None):
            raise ValueError("Tutar aralığını yazın (ör. 1000-5000)")
    sonuc = k.get("sonuc") or "uygun"
    if sonuc not in SONUC_AD:
        raise ValueError("Sonuç 'uygun' ya da 'uygun_degil' olmalı")
    L = kurallar(firma)
    L.append({"id": max([x.get("id", 0) for x in L] + [0]) + 1, "yon": yon, "sartlar": sartlar, "sonuc": sonuc,
              "aciklama": str(k.get("aciklama") or "").strip()[:200], "zaman": datetime.now().isoformat(timespec="minutes")})
    _yaz(firma / KURAL_JSON, L)
    return L


def kural_sil(firma: Path, kid: int) -> list:
    L = [x for x in kurallar(firma) if x.get("id") != kid]
    _yaz(firma / KURAL_JSON, L)
    return L


def karar_yaz(firma: Path, anahtar: str, karar: str, notu: str = "", ek: dict | None = None) -> dict:
    if karar not in ("uygun", "uygun_degil", ""):
        raise ValueError("Karar 'uygun' ya da 'uygun_degil' olmalı")
    K = kararlar(firma)
    if karar:
        K[anahtar] = {"karar": karar, "not": (notu or "").strip()[:500], "zaman": datetime.now().isoformat(timespec="minutes"), **(ek or {})}
    else:
        K.pop(anahtar, None)
    _yaz(firma / KARAR_JSON, K)
    return K


def _kural_bul(kural_L: list, x: dict) -> tuple[dict | None, dict | None]:
    """(tutan kural, yalnız hesap şartı tutmayan kural). Çok şartlı kural daha özeldir, önce denenir."""
    ks = [k for k in kural_L if k.get("yon") in ("*", x["yon"]) and kural_sartlari(k)]
    ks.sort(key=lambda k: -len(kural_sartlari(k)))
    yakin = None
    for k in ks:
        try:
            S = kural_sartlari(k)
            if all(sart_tutar(s, x) for s in S):
                return k, None
            if yakin is None and any(s["alan"] == "hesap" for s in S) and \
                    all(sart_tutar(s, x) for s in S if s["alan"] != "hesap"):
                yakin = k
        except ValueError:
            continue
    return None, yakin


def _hesap_sarti(k: dict) -> str:
    return " | ".join(s["deger"] for s in kural_sartlari(k) if s["alan"] == "hesap")


DURUM_AD = {"kural": "Kurala uygun", "gecmis": "Geçmişle uyumlu", "uygun": "Uygun (kontrol edildi)",
            "uygun_degil": "Uygun değil", "bekliyor": "Kontrol bekliyor"}


def uygula(detay: dict, kural_L: list, karar_D: dict) -> dict:
    """Her faturaya durum: karar > kural > geçmiş > bekliyor. Dönen: {gider, gelir, ozet}."""
    out = {}
    ozet = {}
    for tur in ("gider", "gelir"):
        L = []
        for x in detay.get(tur, []):
            x = dict(x)
            kd = karar_D.get(x["anahtar"])
            kr, yakin = _kural_bul(kural_L, x)
            kodlar = [h["kod"] for h in x.get("hesaplar", [])]
            if kd:
                x["durum"], x["neden"] = kd["karar"], kd.get("not") or ""
            elif kr:
                degil = kr.get("sonuc") == "uygun_degil"
                x["durum"] = "uygun_degil" if degil else "kural"
                x["neden"] = f"Kural {kr['id']}: {kural_metni(kr)} → {SONUC_AD['uygun_degil' if degil else 'uygun'].lower()}" + \
                    (f" ({kr['aciklama']})" if kr.get("aciklama") else "")
                x["kural"] = kr["id"]
            elif yakin:
                x["durum"], x["neden"] = "bekliyor", f"Kural {yakin['id']} {_hesap_sarti(yakin)} bekliyor; kayıt " + (", ".join(kodlar) or "yok")
            elif not x.get("kayitli"):
                x["durum"], x["neden"] = "bekliyor", "Fatura muavinde bulunamadı (belge no, cari / tutar / tarih ile)"
            elif not kodlar:
                x["durum"], x["neden"] = "bekliyor", ("Fişte gider hesabı yok" if x["yon"] == "ALIS" else "Fişte gelir hesabı yok")
            elif (x.get("gecmis") or {}).get("uyumlu"):
                x["durum"], x["neden"] = "gecmis", x["gecmis"]["aciklama"]
            else:
                x["durum"], x["neden"] = "bekliyor", (x.get("gecmis") or {}).get("aciklama", "")
            x["durum_ad"] = DURUM_AD[x["durum"]]
            L.append(x)
        out[tur] = L
        ozet[tur] = {d: sum(1 for x in L if x["durum"] == d) for d in DURUM_AD}
    out["ozet"] = ozet
    return out
