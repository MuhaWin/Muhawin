"""Muhtasar ve Prim Hizmet Beyannamesi (GİB 1003A) PDF'i → özet + muavinle karşılaştırma (Görev 43 Faz 2).

PDF'in metni pypdf ile (düzen korunarak) okunur; tarayıcıda (Pyodide) da aynı kod çalışır, PDF sunucuya gitmez.
Okunan bölümler: başlık (form, dönem, onay zamanı), vergi sorumlusu (VKN, unvan), MATRAH VE VERGİ BİLDİRİMİ (tür kodu,
gayrisafi, kesinti), terkin / kalan vergi, tevkifata ilişkin damga vergisi, TAHAKKUKA ESAS İCMAL CETVELİ ve
TEVKİFATA TABİ ÖDEMELERE AİT BİLDİRİM'in yalnız tür kodu bazında adet / toplamları.
Kullanıcı kararı: ÇALIŞAN bölümleri ("VERGİ BİLDİRİMİ" ve "Sigortalı Çalışan Bilgileri") hiç okunmaz. Kişisel alanlar
(TC kimlik no, ad soyad, adres) hiçbir yere yazılmaz: dönen sözlükte ve kayıtta yalnız tutarlar ve adetler bulunur.
"""
from __future__ import annotations

import io
import re
from decimal import Decimal

TUTAR = r"\d{1,3}(?:\.\d{3})*,\d{2}"
_TUTAR_RE = re.compile(rf"(?<![\d.,]){TUTAR}(?![\d,])")
AYLAR = ["ocak", "subat", "mart", "nisan", "mayis", "haziran", "temmuz", "agustos", "eylul", "ekim", "kasim", "aralik"]
_KATLA = str.maketrans("çğıöşüâîû", "cgiosuaiu")
TUR_ADLARI = {"011": "Ücret", "012": "Ücret (diğer)", "021": "Serbest meslek (diğer)", "022": "Serbest meslek",
              "031": "Yıllara yaygın inşaat", "041": "Kira (GMSİ)", "042": "Kira (GMSİ, diğer)"}


class BeyannameHatasi(ValueError):
    pass


def _k(s: str) -> str:
    """Karşılaştırma için: Türkçe harfler sadeleşir, küçük harf, tek boşluk."""
    s = (s or "").replace("İ", "i").replace("I", "ı").lower().replace("i̇", "i").translate(_KATLA)
    return re.sub(r"\s+", " ", s).strip()


def _d(t: str) -> Decimal:
    return Decimal(t.replace(".", "").replace(",", "."))


def _tutarlar(satir: str) -> list[Decimal]:
    return [_d(x) for x in _TUTAR_RE.findall(satir)]


def pdf_metni(veri: bytes) -> str:
    try:
        from pypdf import PdfReader
    except ImportError as e:                                     # masaüstünde paket kurulmamışsa
        raise BeyannameHatasi("PDF okuyucu (pypdf) kurulu değil; programı güncelleyin.") from e
    try:
        r = PdfReader(io.BytesIO(veri))
        if r.is_encrypted:
            r.decrypt("")
        return "\n".join((p.extract_text(extraction_mode="layout") or "") for p in r.pages)
    except Exception as e:
        raise BeyannameHatasi(f"PDF okunamadı: {type(e).__name__}") from e


def ayristir(metin: str) -> dict:
    b: dict = {"form": "", "vergi_dairesi": "", "yil": None, "ay": None, "onay": "", "vkn": "", "unvan": "",
               "kodlar": {}, "toplam": None, "terkin": None, "kalan_vergi": None, "damga": None,
               "icmal": [], "damga_odenecek": None, "tevkifat": {"kodlar": {}, "gayrisafi": None, "vergi": None}}
    bolum, unvan, kisi_kod, kisi_tutar = "", [], None, []
    for ham in metin.splitlines():
        s = ham.strip()
        if not s:
            continue
        k = _k(s)
        # bölüm başlıkları (sıra önemli: "matrah ve vergi bildirimi" ↔ çalışanların "vergi bildirimi")
        if k.startswith("matrah ve vergi bildirimi"):
            bolum = "matrah"; continue
        if k.startswith("vergi bildirimi") or k.startswith("sigortali calisan"):
            bolum = "atla"; continue                              # çalışan bilgileri: okunmaz (kullanıcı kararı)
        if k.startswith("tahakkuka esas icmal"):
            bolum = "icmal"; continue
        if k.startswith("tevkifata tabi odemelere ait bildirim"):
            bolum = "tevkifat"; continue
        if k.startswith("vergi sorumlusunun"):
            bolum = "kimlik"; continue
        if "1003a" in k and not b["form"]:
            b["form"] = "1003A"
        if "muhtasar ve prim hizmet beyannamesi" in k:
            b["baslik"] = True
        if bolum == "atla":
            continue
        if (m := re.search(r"\byil\s+(20\d\d)\b", k)) and b["yil"] is None:
            b["yil"] = int(m.group(1))
        if (m := re.search(r"\bay\s+(" + "|".join(AYLAR) + r")\b", k)) and b["ay"] is None:
            b["ay"] = AYLAR.index(m.group(1)) + 1
        if (m := re.search(r"onay zamani\s+(\d{2}\.\d{2}\.\d{4})(?:\s*-\s*(\d{2}:\d{2}(?::\d{2})?))?", k)):
            b["onay"] = m.group(1) + (" " + m.group(2) if m.group(2) else "")
        if k.startswith("vergi dairesi") and not b["vergi_dairesi"]:
            b["vergi_dairesi"] = re.sub(r"(?i)^vergi\s+dairesi\s*", "", s).strip()
        if bolum == "kimlik":
            if (m := re.search(r"vergi kimlik (?:numarasi|no)\s+(\d{10,11})", k)):
                b["vkn"] = m.group(1)
            elif k.startswith("soyadi (unvani)") or k.startswith("adi (unvanin devami)"):
                unvan.append(re.sub(r"^.*?\)\s*", "", s, count=1).strip())
            continue
        t = _tutarlar(s)
        if bolum == "matrah":
            if (m := re.match(r"^(\d{3})\s+(.*?)\s+" + TUTAR, s)) and len(t) >= 2:
                b["kodlar"][m.group(1)] = {"ad": m.group(2).strip(), "gayrisafi": t[-2], "vergi": t[-1]}
            elif k.startswith("toplam") and len(t) >= 2:
                b["toplam"] = {"gayrisafi": t[-2], "vergi": t[-1]}
            elif "terkin sonrasi kalan" in k and t:
                b["kalan_vergi"] = t[-1]
            elif "terkin" in k and t:
                b["terkin"] = (b["terkin"] or Decimal(0)) + t[-1]
            elif "tevkifata iliskin damga" in k and t:
                b["damga"] = t[-1]
        elif bolum == "icmal":
            if k.startswith("damga vergisi odenecek") and t:
                b["damga_odenecek"] = t[-1]
            elif len(t) >= 5:
                ad = re.split(TUTAR, s)[0].strip()
                adlar = ["matrah", "tahakkuk", "mahsup", "tecil", "odenecek", "iade"]
                b["icmal"].append({"ad": ad, **dict(zip(adlar, t[:6]))})
        elif bolum == "tevkifat":
            # kişi satırları: yalnız tür kodu ve tutarlar alınır; TC / ad / adres okunmaz, saklanmaz
            if k.startswith("gayrisafi tutar toplami") and t:
                b["tevkifat"]["gayrisafi"] = t[-1]; continue
            if k.startswith("kesilen vergi tutari toplami") and t:
                b["tevkifat"]["vergi"] = t[-1]; continue
            if (m := re.search(r"(?<!\d)(0\d\d)\s+(?:s\.?\s*m\.?\s*makbuz|yok|fatura|gider pusulasi|diger)\b", k)):
                kisi_kod, kisi_tutar = m.group(1), []
                x = b["tevkifat"]["kodlar"].setdefault(kisi_kod, {"adet": 0, "gayrisafi": Decimal(0), "vergi": Decimal(0)})
                x["adet"] += 1
            if kisi_kod and t and len(kisi_tutar) < 2:          # kişinin gayrisafi ve kesilen vergisi (aynı ya da ayrı satırlarda)
                for v in t[: 2 - len(kisi_tutar)]:
                    if len(t) == 1 and "kesilen" in k:
                        alan = "vergi"
                    elif len(t) == 1 and "gayrisafi" in k:
                        alan = "gayrisafi"
                    else:
                        alan = "gayrisafi" if not kisi_tutar else "vergi"
                    kisi_tutar.append(v)
                    b["tevkifat"]["kodlar"][kisi_kod][alan] += v
    b["unvan"] = " ".join(x for x in unvan if x)
    if not b.get("baslik") and not b["kodlar"]:
        raise BeyannameHatasi("Bu dosya Muhtasar ve Prim Hizmet Beyannamesi (1003A) görünmüyor.")
    b.pop("baslik", None)
    return b


def oku(veri: bytes) -> dict:
    return ayristir(pdf_metni(veri))


# ------------------------------------------------------------------ muavinle karşılaştırma
def _f(v) -> float | None:
    return None if v is None else float(round(Decimal(v), 2))


def _satir(ad: str, beyan, muavin, aciklama: str = "", bilgi: bool = False) -> dict:
    fark = None if beyan is None or muavin is None else Decimal(str(muavin)) - Decimal(str(beyan))
    if fark is None:
        durum = "bilgi"
    elif abs(fark) <= Decimal("1.00"):
        durum = "uyumlu"
    else:
        durum = "bilgi" if bilgi else "fark"
    return {"ad": ad, "beyan": _f(beyan), "muavin": _f(muavin), "fark": _f(fark), "durum": durum, "aciklama": aciklama}


def karsilastir(b: dict, v: dict, muavin, bas, bit) -> dict:
    """b: ayristir() sonucu; v: denetim.json (muhtasar taslağı, faturalar); muavin: dönemin muavin satırları."""
    import re as _re
    gr = {x["kod"]: Decimal(str(x["vergi"])) for x in (v.get("muhtasar") or {}).get("satirlar", [])}
    kod = b.get("kodlar", {})
    g = lambda c, a: kod[c][a] if c in kod else None
    donem = [s for s in muavin if bas <= s.fis_tarihi <= bit]

    def gider(desen):
        L = [s for s in donem if s.hesap_kodu[:1] in ("6", "7") and _re.search(desen, _k(s.hesap_adi))]
        return sum((s.borc - s.alacak for s in L), Decimal(0)) if L else None

    smm = [x for x in v.get("faturalar", []) if x.get("yon") == "Alış" and x.get("tip") == "SERBESTMESLEK"
           and bas.isoformat() <= (x.get("tarih") or "") <= bit.isoformat()]
    kalan = b.get("kalan_vergi") if b.get("kalan_vergi") is not None else (b.get("toplam") or {}).get("vergi")
    toplam_b = (kalan or Decimal(0)) + (b.get("damga") or Decimal(0)) if kalan is not None else None
    S = [
        _satir("Ödenecek toplam (stopaj + damga) ↔ 360 tahakkukları", toplam_b, Decimal(str((v.get("muhtasar") or {}).get("odenecek", 0))),
               "Muavin: 360 alt hesaplarının dönem içi alacakları (SGK hariç)"),
        _satir("011 Ücret · vergi kesintisi ↔ 360 ücret stopajı", g("011", "vergi"), gr.get("ucret")),
        _satir("011 Ücret · gayrisafi ↔ ücret giderleri (6xx / 7xx)", g("011", "gayrisafi"), gider(r"ucret|maas|personel"),
               "Gider hesaplarında SGK işveren payı da olabilir", bilgi=True),
        _satir("022 Serbest meslek · vergi kesintisi ↔ 360 serbest meslek stopajı", g("022", "vergi"), gr.get("serbest")),
        _satir("022 Serbest meslek · gayrisafi ↔ e-SMM alış faturaları", g("022", "gayrisafi"),
               sum((Decimal(str(x["matrah"])) for x in smm), Decimal(0)) if smm else None, f"{len(smm)} e-SMM faturası"),
        _satir("022 Serbest meslek · stopaj oranı (%20)", g("022", "gayrisafi") * Decimal("0.20") if "022" in kod else None, g("022", "vergi"),
               "Beyandaki kesinti gayrisafinin %20'si olmalı"),
        _satir("041 Kira · vergi kesintisi ↔ 360 kira stopajı", g("041", "vergi"), gr.get("kira")),
        _satir("041 Kira · gayrisafi ↔ kira giderleri (6xx / 7xx)", g("041", "gayrisafi"), gider(r"kira")),
        _satir("041 Kira · stopaj oranı (%20)", g("041", "gayrisafi") * Decimal("0.20") if "041" in kod else None, g("041", "vergi"),
               "Beyandaki kesinti gayrisafinin %20'si olmalı"),
        _satir("Damga vergisi ↔ 360 damga", b.get("damga"), gr.get("damga")),
    ]
    S = [x for x in S if x["beyan"] is not None or x["muavin"] is not None]
    diger = {c: x for c, x in kod.items() if c not in ("011", "022", "041")}
    for c, x in sorted(diger.items()):
        S.append(_satir(f"{c} {x['ad']} · vergi kesintisi", x["vergi"], None, "Muavinde karşılığı ayrıca kontrol edilmeli"))
    uyarilar = []
    if b.get("yil") and b.get("ay") and (b["yil"], b["ay"]) != (bas.year, bas.month):
        uyarilar.append(f"Beyannamenin dönemi {b['ay']:02d}/{b['yil']}, denetimin dönemi {bas:%m/%Y}.")
    if b.get("vkn") and v.get("vkn") and b["vkn"] != v.get("vkn"):
        uyarilar.append(f"Beyannamedeki VKN {b['vkn']}, denetlenen firmanın VKN'si {v.get('vkn')}.")
    t = b.get("tevkifat") or {}
    if t.get("gayrisafi") is not None and t.get("kodlar"):
        top = sum((x["gayrisafi"] for x in t["kodlar"].values()), Decimal(0))
        if abs(top - t["gayrisafi"]) > Decimal("1.00"):
            uyarilar.append("Tevkifata tabi ödemeler bildiriminde kişi tutarlarının toplamı genel toplamla tutmuyor (PDF düzeni farklı olabilir).")
    return {"satirlar": S, "sorunlu": sum(1 for x in S if x["durum"] == "fark"), "uyarilar": uyarilar}


def kayit_bicimi(b: dict) -> dict:
    """JSON'a yazılacak özet (Decimal → sayı). Kişisel alan yoktur."""
    def c(o):
        if isinstance(o, Decimal):
            return _f(o)
        if isinstance(o, dict):
            return {k: c(x) for k, x in o.items()}
        if isinstance(o, list):
            return [c(x) for x in o]
        return o
    return c(b)


def kayittan(b: dict) -> dict:
    """kayit_bicimi() ile yazılmış özeti yeniden karşılaştırılabilir hâle getirir (sayılar Decimal)."""
    def c(o):
        if isinstance(o, float) or (isinstance(o, int) and not isinstance(o, bool)):
            return Decimal(str(o))
        if isinstance(o, dict):
            return {k: (x if k in ("yil", "ay", "adet") else c(x)) for k, x in o.items()}
        if isinstance(o, list):
            return [c(x) for x in o]
        return o
    return c(b)
