"""Muhasebe Denetimi › Yönetici raporu (Görev 43 Faz 3): yıllık muavinden aylık satış / gider, o ayın vergileri, rasyolar.

Muavinden mizan kurulur (hesap bakiyeleri ay sonları itibarıyla). Bilanço oranları için muavinde açılış fişi (ya da
devir) olmalı; yoksa raporda uyarı çıkar ve oranlar yalnız yıl içi hareketlerle hesaplanmış olur.
"""
from __future__ import annotations

import calendar
import re
from collections import defaultdict
from datetime import date
from decimal import Decimal

AY_ADLARI = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"]
ARTIS_KAT = Decimal("1.5")          # gider: önceki ayların ortalamasının 1,5 katını aşarsa vurgulanır
ARTIS_EN_AZ = Decimal("1000")       # … ve fark en az 1.000 TL ise (küçük hesaplarda gürültü olmasın)
_KATLA = str.maketrans("çğıöşüÇĞİÖŞÜ", "cgiosuCGIOSU")

RASYOLAR = [
    ("cari", "Cari oran", "Dönen varlıklar (1xx) ÷ Kısa vadeli yabancı kaynaklar (3xx)", "kat"),
    ("asit", "Asit-test oranı", "(Dönen varlıklar − Stoklar (15x)) ÷ Kısa vadeli yabancı kaynaklar", "kat"),
    ("nakit", "Nakit oranı", "(Hazır değerler (10x) + Menkul kıymetler (11x)) ÷ Kısa vadeli yabancı kaynaklar", "kat"),
    ("borc_ozkaynak", "Borç / özkaynak", "(Kısa (3xx) + uzun (4xx) vadeli yabancı kaynaklar) ÷ Özkaynaklar (5xx + dönem kârı)", "kat"),
    ("kaldirac", "Kaldıraç oranı", "(Kısa + uzun vadeli yabancı kaynaklar) ÷ Aktif toplamı (1xx + 2xx)", "%"),
    ("kar_marji", "Net kâr marjı", "Dönem kârı (6xx gelir − gider − 7xx) ÷ Net satışlar (60x − 61x)", "%"),
    ("brut_marj", "Brüt kâr marjı", "(Net satışlar − Satışların maliyeti (62x)) ÷ Net satışlar", "%"),
]


def _ay_sonu(yil: int, ay: int) -> date:
    return date(yil, ay, calendar.monthrange(yil, ay)[1])


def _f(v) -> float | None:
    return None if v is None else float(round(Decimal(v), 2))


def _bol(a: Decimal, b: Decimal, yuzde=False) -> float | None:
    if not b or b <= 0:
        return None
    return float(round(a / b * (100 if yuzde else 1), 2))


def hazirla(muavin, bas: date, bit: date) -> dict:
    yil, son = bas.year, bas.month
    aylar = list(range(1, son + 1))
    # ay bazında hesap (tam kod) hareketleri ve ay sonuna kadar birikimli bakiyeler
    ay_net: dict[int, dict[str, Decimal]] = {a: defaultdict(Decimal) for a in aylar}      # borç − alacak
    ay_borc: dict[int, dict[str, Decimal]] = {a: defaultdict(Decimal) for a in aylar}
    ay_alacak: dict[int, dict[str, Decimal]] = {a: defaultdict(Decimal) for a in aylar}
    once: dict[str, Decimal] = defaultdict(Decimal)          # yıl öncesi (devir) hareketleri
    adlar: dict[str, str] = {}
    acilis = False
    for s in muavin:
        t = s.fis_tarihi
        if s.fis_no == "DEVREDEN" or re.search(r"acilis|devir", f"{s.fis_tipi} {s.aciklama}".translate(_KATLA).lower()):
            acilis = True
        adlar.setdefault(s.hesap_kodu[:3], "")
        if t.year < yil:
            once[s.hesap_kodu] += s.borc - s.alacak
            continue
        if t.year > yil or t.month > son:
            continue
        ay_net[t.month][s.hesap_kodu] += s.borc - s.alacak
        ay_borc[t.month][s.hesap_kodu] += s.borc
        ay_alacak[t.month][s.hesap_kodu] += s.alacak
        if t.month == 1 and t.day == 1:
            acilis = True

    def ay_top(a, on, kaynak=ay_net) -> Decimal:
        return sum((v for k, v in kaynak[a].items() if k.startswith(on)), Decimal(0))

    def birikim(a, on, devir=True) -> Decimal:        # ay sonu bakiyesi (borç − alacak)
        b = sum((v for k, v in once.items() if k.startswith(on)), Decimal(0)) if devir else Decimal(0)
        return b + sum((ay_top(x, on) for x in aylar if x <= a), Decimal(0))

    # satışlar (600–602 brüt; iadeler 61x ayrıca)
    satis = []
    for a in aylar:
        brut = -(ay_top(a, "600") + ay_top(a, "601") + ay_top(a, "602"))
        iade = ay_top(a, "61")
        satis.append({"ay": a, "brut": _f(brut), "iade": _f(iade), "net": _f(brut - iade)})
    for i, x in enumerate(satis):
        onceki = satis[i - 1]["brut"] if i else None
        x["degisim"] = round((x["brut"] - onceki) / onceki * 100, 1) if onceki else None

    # giderler: 7xx ana hesaplar (7x1 yansıtma ve 79x gider çeşitleri hariç), ay ay
    kodlar = sorted({k[:3] for a in aylar for k in ay_net[a] if k.startswith("7") and k[2] != "1" and not k.startswith("79")})
    giderler = []
    for kod in kodlar:
        L = [ay_top(a, kod) for a in aylar]
        if not any(L):
            continue
        ad = next((s.hesap_adi for s in muavin if s.hesap_kodu == kod), "") or TDHP_7.get(kod, "")
        seri = []
        for i, (a, v) in enumerate(zip(aylar, L)):
            onceki = [x for x in L[:i] if x]
            ort = sum(onceki, Decimal(0)) / len(onceki) if onceki else None
            yuksek = bool(ort and ort > 0 and v > ort * ARTIS_KAT and v - ort >= ARTIS_EN_AZ)
            seri.append({"ay": a, "tutar": _f(v), "ortalama": _f(ort), "yuksek": yuksek,
                         "artis": round((v - ort) / ort * 100, 1) if ort and ort > 0 else None})
        giderler.append({"kod": kod, "ad": ad, "seri": seri, "toplam": _f(sum(L, Decimal(0)))})

    # o ayın vergileri
    a = son
    hes_kdv = -ay_top(a, "391")
    ind_kdv = ay_top(a, "191")
    devreden_onceki = birikim(a - 1, "190") if a > 1 else sum((v for k, v in once.items() if k.startswith("190")), Decimal(0))
    fark = hes_kdv - ind_kdv - max(devreden_onceki, Decimal(0))
    ay_ozet = {
        "ay": a, "yil": yil, "ay_adi": AY_ADLARI[a - 1],
        "satis": satis[-1]["brut"], "satis_net": satis[-1]["net"], "satis_degisim": satis[-1]["degisim"],
        "hesaplanan_kdv": _f(hes_kdv), "indirilecek_kdv": _f(ind_kdv), "onceki_devreden_kdv": _f(max(devreden_onceki, Decimal(0))),
        "odenecek_kdv": _f(max(fark, Decimal(0))), "devreden_kdv": _f(max(-fark, Decimal(0))),
        "kdv_190_bakiye": _f(birikim(a, "190")),
        "tahakkuk_360": _f(ay_top(a, "360", ay_alacak)), "odenen_360": _f(ay_top(a, "360", ay_borc)),
        "bakiye_360": _f(-birikim(a, "360")),
        "tahakkuk_361": _f(ay_top(a, "361", ay_alacak)), "odenen_361": _f(ay_top(a, "361", ay_borc)),
    }
    # 360 alt hesap kırılımı (o ay tahakkuk)
    alt = defaultdict(Decimal)
    for k, v in ay_alacak[a].items():
        if k.startswith("360") and v:
            alt[k] += v
    ad_tam = {s.hesap_kodu: s.hesap_adi for s in muavin if s.hesap_kodu.startswith("360")}
    ay_ozet["vergiler_360"] = [{"kod": k, "ad": ad_tam.get(k, ""), "tutar": _f(v)} for k, v in sorted(alt.items())]

    # rasyolar (ay sonları)
    rasyo = []
    for x in aylar:
        donen, stok = birikim(x, "1"), birikim(x, "15")
        hazir = birikim(x, "10") + birikim(x, "11")
        kvyk, uvyk = -birikim(x, "3"), -birikim(x, "4")
        aktif = birikim(x, "1") + birikim(x, "2")
        gelir_gider = -(birikim(x, "6", False) + birikim(x, "7", False))          # yıl içi (dönem) kârı
        net_satis = -(birikim(x, "60", False)) - birikim(x, "61", False)
        maliyet = birikim(x, "62", False)
        ozkaynak = -birikim(x, "5") + gelir_gider
        rasyo.append({"ay": x, "cari": _bol(donen, kvyk), "asit": _bol(donen - stok, kvyk), "nakit": _bol(hazir, kvyk),
                      "borc_ozkaynak": _bol(kvyk + uvyk, ozkaynak), "kaldirac": _bol(kvyk + uvyk, aktif, True),
                      "kar_marji": _bol(gelir_gider, net_satis, True) if net_satis > 0 else None,
                      "brut_marj": _bol(net_satis - maliyet, net_satis, True) if net_satis > 0 and maliyet else None,
                      "kar": _f(gelir_gider), "net_satis": _f(net_satis)})
    uyarilar = []
    if not acilis:
        uyarilar.append("Muavinde açılış fişi / devir bulunamadı: bilanço oranları (cari, asit-test, nakit, borç / özkaynak, "
                        "kaldıraç) yalnız yıl içi hareketlerle hesaplandı. Yıl başından itibaren tüm hesapları içeren muavin yükleyin.")
    ilk = min((s.fis_tarihi for s in muavin if s.fis_tarihi.year == yil), default=None)
    if ilk and ilk.month > 1:
        uyarilar.append(f"Muavin {AY_ADLARI[ilk.month - 1]} ayından başlıyor; önceki aylar boş görünür. Karşılaştırma için yıllık muavin gerekir.")
    return {"yil": yil, "ay": son, "aylar": [AY_ADLARI[x - 1] for x in aylar], "satis": satis, "giderler": giderler,
            "ay_ozet": ay_ozet, "rasyolar": rasyo, "rasyo_tanim": [{"kod": k, "ad": ad, "formul": f, "birim": b} for k, ad, f, b in RASYOLAR],
            "uyarilar": uyarilar}


TDHP_7 = {"710": "Direkt İlk Madde ve Malzeme Giderleri", "720": "Direkt İşçilik Giderleri", "730": "Genel Üretim Giderleri",
          "740": "Hizmet Üretim Maliyeti", "750": "Araştırma ve Geliştirme Giderleri", "760": "Pazarlama Satış ve Dağıtım Giderleri",
          "770": "Genel Yönetim Giderleri", "780": "Finansman Giderleri"}
