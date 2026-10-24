"""Firma denetimi (MuhaWin › Ofisinize Özel Çözümler › Muhasebe Denetimi; sitede muhawin.com.tr/denetim).

Yüklenen e-belgeler (alış / satış XML ya da ZIP) ile firmanın muavini (Mikro, Luca; Elektra örnek bekliyor) karşılaştırılır:
  * KDV kontrolü     — 191 / 391 (Fatura Kontrol'deki kurallarla: binek %70, döviz, tevkifat, ihraç kayıtlı, istisna …);
                       KDV oranı ↔ hesap (adındaki %20 ya da kodu: 191.01.20), KDV kaydı faturanın fişinde mi
  * Matrah kontrolü  — alışta gider / stok / duran varlık hesapları (binek KKEG ve indirilemeyen KDV dahil), satışta 60x / 64x / 67x
  * Cari kontrolü    — faturanın ödenecek tutarı ile cari / ödeme hesabı (320, 120, 329, 100, 102 …) tutarı
  * Muhtasar (deneme) — 360 hesaplarındaki stopajlar (ücret, serbest meslek, kira, yurt dışı hizmet …)
KDV 1 / KDV 2 beyannamesi ve çıktı raporu, aynı dönem klasöründeki standart kontrol raporundan hazırlanır.
"""
from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from datetime import date
from decimal import Decimal
from pathlib import Path

from . import arsiv
from .eslestirme import BILGI_DURUMLARI, DENETIM_KONTROLLER, KDV_FIS_FARKI, OIV_RE, _buyuk, esle, oiv_tutari
from .muavin_okuyucu import ORAN_RE

DENETIM_JSON = "denetim.json"
KONTROL_AD = {"KDV": "KDV kontrolü", "Matrah": "Matrah kontrolü", "Cari": "Cari kontrolü"}

# 360 alt hesap adlarından muhtasar satırı (GMSİ / serbest meslek / ücret …) ve tevkifat oranı
MUHTASAR_TURLERI = [
    ("ucret", "Ücret ödemeleri (GVK 94/1)", re.compile(r"[ÜU]CRET|PERSONEL|MAA[SŞ]|GEL[İI]R VERG[İI]S[İI] (KES|STOP)"), None),
    ("serbest", "Serbest meslek kazançları (GVK 94/2-b)", re.compile(r"SERBEST|SMM|MESLEK"), Decimal("0.20")),
    ("kira", "Kira ödemeleri (GVK 94/5-a)", re.compile(r"K[İI]RA|GMS[İI]"), Decimal("0.20")),
    ("yurtdisi", "Dar mükellef / yurt dışı hizmet (KVK 30)", re.compile(r"YURT ?DI[SŞ]I|DAR M[ÜU]KELLEF|\b30\b"), Decimal("0.15")),
    ("damga", "Damga vergisi", re.compile(r"DAMGA"), None),
    ("sgk", "SGK primleri (bilgi; muhtasar ve prim hizmet beyannamesi)", re.compile(r"SGK|S\.?G\.?K|S[İI]GORTA|PR[İI]M|[İI][ŞS]S[İI]ZL[İI]K"), None),
]


def _sayi(v) -> float:
    return float(round(Decimal(v or 0), 2))


def _tur(hesap_adi: str):
    ad = hesap_adi.upper().replace("İ", "I")
    ad2 = hesap_adi.upper()
    for kod, baslik, desen, oran in MUHTASAR_TURLERI:
        if desen.search(ad2) or desen.search(ad):
            return kod, baslik, oran
    return None


def muhtasar(muavin, bas: date, bit: date) -> dict:
    """360 hesaplarının dönem içi tahakkukları (alacak) → muhtasar beyanname taslağı (deneme)."""
    gruplar: dict[str, dict] = {}
    digerler = []
    for s in muavin:
        if not s.hesap_kodu.startswith("360"):
            continue
        t = s.belge_tarihi or s.fis_tarihi
        if not (bas <= s.fis_tarihi <= bit) or not s.alacak:
            continue
        if re.search(r"KDV", s.hesap_adi.upper()):
            continue                               # KDV tevkifatı / sorumlu KDV: KDV 2'de
        tr = _tur(s.hesap_adi)
        if not tr:
            digerler.append(s)
            continue
        kod, baslik, oran = tr
        g = gruplar.setdefault(kod, {"kod": kod, "baslik": baslik, "oran": float(oran * 100) if oran else None,
                                     "vergi": Decimal(0), "satirlar": []})
        g["vergi"] += s.alacak
        g["satirlar"].append({"tarih": t.isoformat(), "fis_no": s.fis_no, "fis_tarihi": s.fis_tarihi.isoformat(), "hesap": s.hesap_kodu, "hesap_adi": s.hesap_adi,
                              "unvan": s.unvan, "aciklama": s.aciklama, "vergi": _sayi(s.alacak),
                              "matrah": _sayi(s.alacak / oran) if oran else None})
    sira = [k for k, *_ in MUHTASAR_TURLERI]
    satirlar = []
    for kod in sira:
        g = gruplar.get(kod)
        if not g:
            continue
        oran = Decimal(str(g["oran"])) / 100 if g["oran"] else None
        satirlar.append({**g, "vergi": _sayi(g["vergi"]), "matrah": _sayi(g["vergi"] / oran) if oran else None,
                         "adet": len(g["satirlar"])})
    odenecek = sum(Decimal(str(x["vergi"])) for x in satirlar if x["kod"] != "sgk")
    return {"bas": bas.isoformat(), "bit": bit.isoformat(), "satirlar": satirlar, "odenecek": _sayi(odenecek),
            "eslesmeyen": [{"tarih": s.fis_tarihi.isoformat(), "fis_tarihi": s.fis_tarihi.isoformat(), "fis_no": s.fis_no, "hesap": s.hesap_kodu, "hesap_adi": s.hesap_adi,
                            "aciklama": s.aciklama, "tutar": _sayi(s.alacak)} for s in digerler[:200]],
            "not": "Deneme: 360 alt hesap adlarından türü bulunur (ücret, serbest meslek, kira, yurt dışı, damga). "
                   "Matrah, stopaj tutarından oranla geri hesaplanır; ücretlerde matrah bordrodan alınmalıdır."}


KDV_ORANLARI = {1, 8, 10, 18, 20}


def kod_oranlari(muavin) -> str:
    """Adında oran (%20) olmayan 191 / 391 alt hesaplarında oranı koddan okur: 191.01.20 → %20.
    Yalnız bütün bu hesapların kodu üç ya da daha çok bölümlüyse, son bölüm bilinen bir KDV oranıysa (1, 8, 10, 18, 20)
    ve en az biri %8 ya da üstüyse (191.01.01 tek başına sıra numarası olabilir). Dönen: rapora yazılacak not (yoksa "")."""
    adsiz = {s.hesap_kodu for s in muavin if s.hesap_kodu[:3] in ("191", "391") and not ORAN_RE.search(s.hesap_adi)}
    oran: dict[str, Decimal] = {}
    for k in adsiz:
        p = re.split(r"[.\-]", k)
        if len(p) < 3 or not p[-1].isdigit() or len(p[-1]) > 2 or int(p[-1]) not in KDV_ORANLARI:
            return ""
        oran[k] = Decimal(int(p[-1]))
    if not oran or max(oran.values()) < 8:
        return ""
    for s in muavin:
        if s.hesap_kodu in oran:
            s.kod_orani = oran[s.hesap_kodu]
    return "KDV oranı hesap kodundan okundu: " + ", ".join(f"{k} = %{v}" for k, v in sorted(oran.items()))


def _fisler(satirlar) -> set:
    return {(x.fis_no, x.fis_tarihi) for x in satirlar if x.fis_no}


def kdv_fis_kontrol(r) -> int:
    """KDV kaydı faturanın fişinde mi: KDV satırlarının fişi, aynı faturanın cari (yoksa gider / gelir) satırlarının
    fiş(ler)inden biri olmalı. Başka fişteyse KDV_FIS_FARKI (uyumlu görünen sonuç sorunluya döner). Dönen: bulunan adet."""
    gruplar: dict[int, dict] = defaultdict(dict)
    for so in r.sonuclar:
        gruplar[id(so.fatura)].setdefault(so.kontrol, so)
    n = 0
    for g in gruplar.values():
        kdv = g.get("KDV")
        if not kdv or not kdv.satirlar:
            continue
        dayanak = next((_fisler(g[k].satirlar) for k in ("Cari", "Matrah") if k in g and _fisler(g[k].satirlar)), set())
        disari = _fisler(kdv.satirlar) - dayanak
        if not dayanak or not disari:
            continue
        yaz = lambda L: ", ".join(f"{no} ({t:%d.%m.%Y})" for no, t in sorted(L, key=lambda x: (x[1], x[0])))
        notu = f"KDV {yaz(disari)} fişinde; faturanın cari / gider kaydı {yaz(dayanak)} fişinde"
        kdv.aciklama = f"{notu}; {kdv.aciklama}" if kdv.aciklama else notu
        if kdv.durum in BILGI_DURUMLARI:
            kdv.durum = KDV_FIS_FARKI
        n += 1
    return n


OIV_UYUMLU, OIV_FARK, OIV_YOK, OIV_KAYITSIZ = "ÖİV – uyumlu", "ÖİV – fark", "ÖİV 689'da kayıtlı değil", "Fatura muavinde yok"


def oiv_kontrol(r, faturalar, muavin) -> list[dict]:
    """ÖİV'li faturalar (telefon, internet …): faturadaki Özel İletişim Vergisi ↔ faturanın fişindeki 689 kayıtları."""
    fis_index = defaultdict(list)
    for s in muavin:
        fis_index[(s.fis_no, s.fis_tarihi)].append(s)
    sat = defaultdict(list)
    for so in r.sonuclar:
        sat[id(so.fatura)] += so.satirlar
    out = []
    for f in faturalar:
        oiv = oiv_tutari(f)
        if not oiv:
            continue
        kayit = sat.get(id(f), [])
        fisler = sorted({(x.fis_no, x.fis_tarihi) for x in kayit if x.fis_no}, key=lambda k: (k[1], k[0]))
        tum = [x for k in fisler for x in fis_index.get(k, [])]
        h689 = [x for x in tum if x.hesap_kodu.startswith("689")]
        adli = [x for x in h689 if OIV_RE.search(_buyuk(f"{x.hesap_adi} {x.aciklama}"))]
        L = adli or h689
        tutar = sum(((x.borc - x.alacak) if f.yon == "ALIS" else (x.alacak - x.borc) for x in L), Decimal(0))
        if not kayit:
            d = OIV_KAYITSIZ
        elif not L:
            d = OIV_YOK
        else:
            d = OIV_UYUMLU if abs(tutar - oiv) <= Decimal("0.05") else OIV_FARK
        out.append({"durum": d, "sorunlu": d != OIV_UYUMLU, "yon": "Alış" if f.yon == "ALIS" else "Satış", "belge_no": f.belge_no,
                    "tarih": f.tarih.isoformat(), "karsi_taraf": f.karsi_unvan, "vkn": f.karsi_vkn, "matrah": _sayi(f.matrah),
                    "oiv": _sayi(oiv), "muavin": _sayi(tutar), "fark": _sayi(tutar - oiv),
                    "hesaplar": ", ".join(sorted({x.hesap_kodu for x in L})),
                    "fisler": ", ".join(f"{n} ({t:%d.%m.%Y})" for n, t in fisler),
                    "aciklama": ("689'da adında ÖİV / iletişim geçen hesap" if adli else "fişteki tüm 689 satırları" if L else
                                 "faturanın fişinde 689 satırı yok" if kayit else "fatura muavinde bulunamadı")})
    return out


def denetle(klasor: Path, bas: date, bit: date, vkn: str | None = None, firma: str = "", rapor_id: str = "") -> dict | None:
    from .kontrol import kimlik_sec, muavin_dosyalari, muavinleri_oku
    from .rapor_kayit import _json
    zipler = arsiv.donem_faturalari(klasor) or sorted(klasor.glob("gib_*.zip"))
    muavinler = muavin_dosyalari(klasor)
    if not zipler or not muavinler:
        return None
    ft, uyarilar, vkn = kimlik_sec(zipler, vkn)
    muavin, bilgi = muavinleri_oku(muavinler)
    from . import muavin_programlari as MP, red_iptal
    red, red_uyari = red_iptal.oku(red_iptal.dosyalari(klasor), MP.red_iptal_duzeni(MP.klasor_programi(klasor)))
    uyarilar = list(uyarilar) + red_uyari
    oran_notu = kod_oranlari(muavin)
    if oran_notu:
        uyarilar.append(oran_notu)
    r = esle(ft, muavin, Decimal("0.05"), (bas, bit), kontrol_listesi=DENETIM_KONTROLLER, red=red)
    kdv_fis_kontrol(r)
    v = _json(r, ft, uyarilar, bilgi.get("firma") or firma or "", vkn)
    ozet = {}
    for ad in ("KDV", "Matrah", "Cari"):
        L = [s for s in v["sonuclar"] if s["kontrol"] == ad or (ad == "KDV" and s["kontrol"] == "Kayıt")]
        say = Counter(s["durum"] for s in L)
        ozet[ad] = {"ad": KONTROL_AD[ad], "adet": len(L), "sorunlu": sum(1 for s in L if s["sorunlu"]),
                    "durumlar": [{"ad": d, "adet": n, "sorunlu": d not in BILGI_DURUMLARI} for d, n in say.most_common()]}
    v["ozet"] = ozet
    v["muhtasar"] = muhtasar(muavin, bas, bit)
    v["oiv"] = oiv_kontrol(r, ft, muavin)
    ozet["OIV"] = {"ad": "ÖİV kontrolü", "adet": len(v["oiv"]), "sorunlu": sum(1 for x in v["oiv"] if x["sorunlu"]),
                   "durumlar": [{"ad": d, "adet": n, "sorunlu": d != OIV_UYUMLU} for d, n in Counter(x["durum"] for x in v["oiv"]).most_common()]}
    from . import detay
    v["detay"] = detay.hazirla(r, ft, muavin, bas, bit)          # Detay denetim (gider / gelir kontrolü)
    v["rapor_id"] = rapor_id
    v["bas"], v["bit"] = bas.isoformat(), bit.isoformat()
    (klasor / DENETIM_JSON).write_text(json.dumps(v, ensure_ascii=False), encoding="utf-8")
    return v
