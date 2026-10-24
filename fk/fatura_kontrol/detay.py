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
from collections import defaultdict
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path

from .eslestirme import _CARI_ON, _GELIR_ON, _gider_mi, _kok, fatura_anahtari

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


def hazirla(r, faturalar, muavin, bas: date, bit: date) -> dict:
    """denetim.json › "detay": dönem faturalarının muhasebe kaydı özeti (gider: alış, gelir: satış)."""
    fis_ix = _fis_index(muavin)
    gecmis = gecmis_indeksi(muavin, bas)
    sat: dict[int, dict] = defaultdict(dict)                 # fatura → {id(satır): satır}
    for so in r.sonuclar:
        sat[id(so.fatura)].update((id(s), s) for s in so.satirlar)
    out = {"gider": [], "gelir": []}
    for f in sorted(faturalar, key=lambda f: (f.tarih, f.belge_no)):
        if f.yon not in ("ALIS", "SATIS") or not (bas <= f.tarih <= bit):
            continue
        kendi_ix = sat.get(id(f), {})
        kendi = list(kendi_ix.values())
        fisler = sorted({(s.fis_no, s.fis_tarihi) for s in kendi if s.fis_no}, key=lambda k: (k[1], k[0]))
        satirlar = []
        for k in fisler:
            L = fis_ix.get(k, [])
            baska = {s.belge_no for s in L if s.belge_no and s.belge_no != f.belge_no}
            satirlar += [s for s in L if not baska or s.belge_no == f.belge_no or id(s) in kendi_ix]
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
            "fisler": [{"no": n, "tarih": t.isoformat()} for n, t in fisler],
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


def kural_ekle(firma: Path, k: dict) -> list:
    """{yon: ALIS/SATIS, vkn, unvan (içerir), hesap (başlangıç: 770 ya da 770.01.01.001), aciklama}."""
    yon = k.get("yon")
    vkn, unvan, hesap = str(k.get("vkn") or "").strip(), str(k.get("unvan") or "").strip(), str(k.get("hesap") or "").strip()
    if yon not in ("ALIS", "SATIS"):
        raise ValueError("Kuralın yönü ALIS ya da SATIS olmalı")
    if not (vkn or unvan):
        raise ValueError("Kural için VKN ya da ünvan gerekir")
    if not hesap[:3].isdigit():
        raise ValueError("Hesap kodu 3 haneli ana hesapla başlamalı (ör. 770 ya da 770.01.01.001)")
    L = kurallar(firma)
    L.append({"id": max([x.get("id", 0) for x in L] + [0]) + 1, "yon": yon, "vkn": vkn, "unvan": unvan, "hesap": hesap,
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


def _kural_eslesir(k: dict, x: dict) -> bool:
    if k.get("yon") != x["yon"]:
        return False
    if k.get("vkn"):
        return k["vkn"] == x.get("vkn")
    return k.get("unvan", "").casefold() in (x.get("karsi_taraf") or "").casefold()


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
            kr = next((k for k in kural_L if _kural_eslesir(k, x)), None)
            kodlar = [h["kod"] for h in x.get("hesaplar", [])]
            if kd:
                x["durum"], x["neden"] = kd["karar"], kd.get("not") or ""
            elif kr and kodlar and all(c.startswith(kr["hesap"]) for c in kodlar):
                x["durum"], x["neden"] = "kural", f"Kural {kr['id']}: {kr.get('vkn') or kr.get('unvan')} → {kr['hesap']}" + \
                    (f" ({kr['aciklama']})" if kr.get("aciklama") else "")
            elif kr:
                x["durum"], x["neden"] = "bekliyor", f"Kural {kr['id']} {kr['hesap']} bekliyor; kayıt " + (", ".join(kodlar) or "yok")
            elif not x.get("kayitli"):
                x["durum"], x["neden"] = "bekliyor", "Fatura muavinde kayıtlı değil"
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
