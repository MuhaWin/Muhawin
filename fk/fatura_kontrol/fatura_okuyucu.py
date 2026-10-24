"""UBL-TR (e-Fatura / e-Arşiv) XML okuyucu.

Klasör, tek XML, ZIP ya da iç içe ZIP verilebilir. Entegratörlerin ve
Luca'nın indirdiği paketler genelde "ZIP içinde ZIP içinde XML (+HTML)"
şeklindedir; hepsi özyinelemeli olarak açılır.
"""
from __future__ import annotations

import io
import re
import zipfile
from dataclasses import dataclass, field
from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path
from typing import Iterator
import xml.etree.ElementTree as ET

NS = {
    "cbc": "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
    "cac": "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
}
KDV_KODU = "0015"
# KDV dışı vergiler: entegratör adı yazmazsa GİB vergi kodundan ad verilir
VERGI_ADLARI = {"0059": "Konaklama Vergisi", "4080": "Özel İletişim Vergisi", "4081": "Özel İletişim Vergisi",
                "1047": "Damga Vergisi", "1048": "5035 Sayılı Kanuna Göre Damga Vergisi", "0071": "ÖTV (I. Liste)",
                "0073": "ÖTV (III. Liste)", "0074": "ÖTV (IV. Liste)", "0075": "ÖTV (III A Liste)", "0076": "ÖTV (III B Liste)",
                "0077": "ÖTV (III C Liste)", "9015": "KDV Tevkifatı", "0003": "Gelir Vergisi Stopajı", "0011": "Kurumlar Vergisi Stopajı",
                "8001": "Borsa Tescil Ücreti", "8002": "Enerji Fonu", "4171": "Petrol ve Doğalgaz Ürünlerine İlişkin ÖTV",
                "8004": "TRT Payı", "8005": "Elektrik Tüketim Vergisi", "8006": "Telsiz Kullanım Ücreti", "8007": "Telsiz Ruhsat Ücreti",
                "8008": "Çevre Temizlik Vergisi"}


def _d(x: str | None) -> Decimal:
    return Decimal(x.strip()) if x and x.strip() else Decimal("0")


_KUR: dict = {"kur": None}          # okunmakta olan dövizli faturanın TL kuru


def _para(el, path: str) -> Decimal:
    """Tutarı TL olarak verir: dövizli faturada currencyID TL değilse fatura kuruyla çevrilir."""
    x = el.find(path, NS)
    if x is None or not x.text or not x.text.strip():
        return Decimal("0")
    v = Decimal(x.text.strip())
    kur = _KUR["kur"]
    if kur and (x.get("currencyID") or "").upper() not in ("TRY", "TL"):
        v = (v * kur).quantize(Decimal("0.01"), ROUND_HALF_UP)
    return v


def _oran(x: str | None) -> Decimal:
    o = _d(x)
    return o.quantize(Decimal("1")) if o == o.to_integral_value() else o.normalize()


STANDART_ORANLAR = (Decimal("1"), Decimal("8"), Decimal("10"), Decimal("18"), Decimal("20"))


def _kdv_orani(st, kdv: Decimal, matrah: Decimal | None = None) -> Decimal:
    """KDV oranı: TaxSubtotal/Percent (ya da TaxCategory/Percent). Bazı entegratörler (ör. elektrik faturaları)
    oranı yazmıyor; o zaman KDV / matrah'tan hesaplanır ve yuvarlama farkı için standart orana (1, 8, 10, 18, 20)
    oturtulur."""
    yazili = _t(st, "cbc:Percent") or _t(st, "cac:TaxCategory/cbc:Percent")
    oran = _oran(yazili)
    if (yazili is None or oran == 0) and kdv:
        m = _d(_t(st, "cbc:TaxableAmount")) if _t(st, "cbc:TaxableAmount") is not None else (matrah or Decimal("0"))
        if m:
            h = abs(kdv) / abs(m) * 100
            yakin = min(STANDART_ORANLAR, key=lambda o: abs(o - h))
            oran = yakin if abs(yakin - h) <= Decimal("0.6") else _oran(str(h.quantize(Decimal("0.01"))))
    return oran


def _t(el, path: str) -> str | None:
    x = el.find(path, NS)
    return x.text.strip() if x is not None and x.text else None


@dataclass
class Fatura:
    kaynak: str                 # dosya adı
    ettn: str | None
    belge_no: str
    tarih: date
    profil: str | None          # TEMELFATURA, TICARIFATURA, EARSIVFATURA...
    tip: str | None             # SATIS, IADE, TEVKIFAT, ISTISNA...
    para_birimi: str
    satici_vkn: str
    satici_unvan: str
    alici_vkn: str
    alici_unvan: str
    matrah: Decimal             # TaxExclusiveAmount
    kdv_toplam: Decimal
    odenecek: Decimal           # PayableAmount (yuvarlama/depozito sonrası)
    vergiler_dahil: Decimal = Decimal("0")   # TaxInclusiveAmount
    tevkifat: Decimal = Decimal("0")
    tevkifat_detay: list[dict] = field(default_factory=list)   # [{kod, ad, oran, kdv, tutar}] (KDV2)
    diger_vergiler: dict[str, Decimal] = field(default_factory=dict)    # ÖİV, damga vb.
    kdv_oranlari: dict[Decimal, Decimal] = field(default_factory=dict)  # oran -> KDV
    matrah_oranlari: dict[Decimal, Decimal] = field(default_factory=dict)
    yon: str = "?"              # ALIS / SATIS (firma VKN'sine göre)
    # Dövizli fatura: yukarıdaki tutarlar TL karşılığıdır; asıl döviz tutarları burada
    doviz: str | None = None              # USD, EUR...
    kur: Decimal | None = None
    doviz_matrah: Decimal | None = None
    doviz_vergiler_dahil: Decimal | None = None
    doviz_odenecek: Decimal | None = None
    doviz_kdv: Decimal | None = None
    tl_kaynak: str | None = None          # dövizli faturada TL KDV'nin kaynağı; None → kontrol dışı
    istisna: str = ""                     # KDV istisna gerekçesi (ör. "701 - İhraç kaydıyla teslim")
    kalemler: list[str] = field(default_factory=list)   # mal/hizmet adları (Luca kayıt kuralları için)
    notlar: list[str] = field(default_factory=list)     # faturanın notları ve kalem açıklamaları ("İADE" vb.)
    metin: str = ""             # faturanın tüm yazıları (abone / tesisat no vb. için kaydedilmeyecek kuralları); rapora yazılmaz
    # Komisyoncu (HKS) faturası: komisyoncu malı mal sahibi adına satar; fatura mal sahibine "alış" olarak gelir ama
    # içinde mal sahibinin SATIŞI (mal bedeli + KDV) ve komisyoncunun kestiği masraflar (komisyon, navlun, … + KDV'leri) var.
    masraflar: list[dict] = field(default_factory=list)   # [{ad, tutar, oran (% masraf oranı), kdv, kdv_oran}]
    masraf_kdv: Decimal = Decimal("0")
    masraf_kdv_oranlari: dict[Decimal, Decimal] = field(default_factory=dict)

    @property
    def komisyoncu(self) -> bool:
        return (self.tip or "").upper() == "KOMISYONCU"

    @property
    def karsi_vkn(self) -> str:
        return self.satici_vkn if self.yon == "ALIS" else self.alici_vkn

    @property
    def karsi_unvan(self) -> str:
        return self.satici_unvan if self.yon == "ALIS" else self.alici_unvan


def _taraf(root, yol: str) -> tuple[str, str]:
    p = root.find(yol + "/cac:Party", NS)
    if p is None:
        return "", ""
    vkn = ""
    for i in p.findall("cac:PartyIdentification/cbc:ID", NS):
        if i.get("schemeID") in ("VKN", "TCKN") and i.text:
            vkn = i.text.strip()
            break
    ad = _t(p, "cac:PartyName/cbc:Name")
    if not ad:
        ad = " ".join(filter(None, [_t(p, "cac:Person/cbc:FirstName"), _t(p, "cac:Person/cbc:FamilyName")]))
    return vkn, ad or ""


def tevkif_orani(yuzde: Decimal) -> str:
    """GİB tevkifat yüzdesi (20, 50, 90…) -> '2/10' gösterimi."""
    if yuzde and (yuzde * 10) % 100 == 0:
        return f"{int(yuzde / 10)}/10"
    return f"%{yuzde.normalize():f}" if yuzde else ""


def _tevkifat(root) -> tuple[Decimal, list[dict]]:
    """KDV tevkifatı: belge düzeyindeki WithholdingTaxTotal; yoksa satır düzeyindekiler toplanır."""
    bloklar = root.findall("cac:WithholdingTaxTotal", NS) or root.findall("cac:InvoiceLine/cac:WithholdingTaxTotal", NS)
    detay: dict[tuple, dict] = {}
    toplam = Decimal("0")
    for w in bloklar:
        alt = w.findall("cac:TaxSubtotal", NS)
        if not alt:
            toplam += _para(w, "cbc:TaxAmount")
            continue
        for st in alt:
            tutar = _para(st, "cbc:TaxAmount")
            yuzde = _oran(_t(st, "cbc:Percent") or _t(st, "cac:TaxCategory/cbc:Percent"))
            kod = _t(st, "cac:TaxCategory/cac:TaxScheme/cbc:TaxTypeCode") or ""
            ad = _t(st, "cac:TaxCategory/cac:TaxScheme/cbc:Name") or ""
            k = (kod, yuzde)
            d = detay.setdefault(k, {"kod": kod, "ad": ad, "oran": tevkif_orani(yuzde),
                                     "kdv": Decimal("0"), "tutar": Decimal("0")})
            d["kdv"] += _para(st, "cbc:TaxableAmount")     # tevkifata konu KDV
            d["tutar"] += tutar                               # tevkif edilen KDV (KDV2)
            toplam += tutar
    return toplam.quantize(Decimal("0.01"), ROUND_HALF_UP), list(detay.values())


def xml_oku(veri: bytes, kaynak: str) -> Fatura | None:
    try:
        root = ET.fromstring(veri)
    except ET.ParseError:
        return None
    if root.tag.endswith("}eArsivVeri") or root.tag == "eArsivVeri":
        return esmm_oku(root, kaynak)
    if not root.tag.endswith("}Invoice"):
        return None  # uygulama yanıtı, irsaliye vb.

    para_birimi = (_t(root, "cbc:DocumentCurrencyCode") or "TRY").upper()
    doviz = para_birimi if para_birimi not in ("TRY", "TL") else None
    kur = None
    if doviz:
        for yol in ("cac:PricingExchangeRate", "cac:TaxExchangeRate", "cac:PaymentExchangeRate"):
            kur = _d(_t(root, yol + "/cbc:CalculationRate")) or None
            if kur and kur != 1:
                break
            kur = None
    _KUR["kur"] = kur           # TL olarak yazılmış tutarlar olduğu gibi, döviz tutarlar kurla çevrilir
    try:
        f = _invoice_oku(root, kaynak, para_birimi, doviz, kur)
    finally:
        _KUR["kur"] = None
    if doviz:
        _doviz_tl(root, f)
    f.istisna = _istisna(root)
    return f


def _istisna(root) -> str:
    """İlk KDV istisna/muafiyet gerekçesi: '701 - 3065 s. KDV K. 11/1-c md. ...' (belge ya da satır düzeyi)."""
    for kat in root.iterfind(".//cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory", NS):
        kod = _t(kat, "cbc:TaxExemptionReasonCode")
        neden = _t(kat, "cbc:TaxExemptionReason")
        if kod or neden:
            neden = re.sub(r"^\s*" + re.escape(kod or "") + r"\s*[-–:]?\s*", "", neden or "") if kod else (neden or "")
            return " - ".join(x for x in (kod, neden[:120]) if x)
    return ""


def _sayi_tr(x: str) -> Decimal | None:
    """'1.234,56' / '1234.56' / '1,234.56' → Decimal"""
    x = x.strip().rstrip(".,")
    if not re.search(r"\d", x):
        return None
    if "," in x and "." in x:
        x = x.replace(".", "").replace(",", ".") if x.rfind(",") > x.rfind(".") else x.replace(",", "")
    elif "," in x:
        x = x.replace(".", "").replace(",", ".")
    elif x.count(".") > 1 or re.search(r"\.\d{3}$", x) and len(x.split(".")[0]) <= 3 and not re.search(r"\.\d{1,2}$", x):
        x = x.replace(".", "")
    try:
        return Decimal(x)
    except Exception:
        return None


_NOT_KDV = re.compile(r"(?:K\.?D\.?V\.?|KATMA\s*DE[ĞG]ER)[^0-9\n;|]{0,40}?(?:TL|TRY|₺)[^0-9\n;|]{0,15}?([\d][\d\.,]*)"
                      r"|(?:K\.?D\.?V\.?|KATMA\s*DE[ĞG]ER)[^0-9\n;|]{0,40}?([\d][\d\.,]*)\s*(?:TL|TRY|₺)", re.I)
_NOT_HARIC = re.compile(r"DAH[İI]L|HAR[İI][ÇC]|MATRAH|TOPLAM\s*TUTAR|GENEL\s*TOPLAM|%\s*$", re.I)


def _nottan_kdv_tl(root) -> Decimal | None:
    """Fatura notlarında yazan TL KDV ('KDV TL: 1.234,56', 'Hesaplanan KDV (TL) 1.234,56 TL' …)."""
    bulunan = []
    for n in root.findall("cbc:Note", NS):
        for parca in re.split(r"[\n;|]+", n.text or ""):
            for m in _NOT_KDV.finditer(parca):
                onceki = parca[:m.start()][-25:] + parca[m.start():m.start(1 if m.group(1) else 2)]
                if _NOT_HARIC.search(onceki):
                    continue
                v = _sayi_tr(m.group(1) or m.group(2))
                if v is not None and v > 0:
                    bulunan.append(v)
    return bulunan[0] if len(set(bulunan)) == 1 else (max(bulunan) if bulunan else None)


def _doviz_tl(root, f: "Fatura"):
    """Dövizli faturada KDV'nin TL karşılığını belirler (öncelik: faturada yazılı TL > kur ile hesap)."""
    vergiler = [x for x in root.iterfind(".//cac:TaxTotal/cbc:TaxAmount", NS)] + \
               [x for x in root.iterfind(".//cac:TaxTotal/cac:TaxSubtotal/cbc:TaxAmount", NS)]
    tl_yazili = any((x.get("currencyID") or "").upper() in ("TRY", "TL") for x in vergiler)
    # döviz KDV (bilgi için)
    dkdv = Decimal("0")
    for st in root.findall("cac:TaxTotal/cac:TaxSubtotal", NS):
        if _t(st, "cac:TaxCategory/cac:TaxScheme/cbc:TaxTypeCode") == KDV_KODU:
            x = st.find("cbc:TaxAmount", NS)
            if x is not None and (x.get("currencyID") or "").upper() not in ("TRY", "TL"):
                dkdv += _d(x.text)
    f.doviz_kdv = dkdv
    not_kdv = _nottan_kdv_tl(root)
    if not_kdv is not None and f.kdv_oranlari:
        toplam = sum(f.kdv_oranlari.values()) or Decimal("1")
        f.kdv_oranlari = {o: (v / toplam * not_kdv).quantize(Decimal("0.01"), ROUND_HALF_UP) if toplam else not_kdv
                          for o, v in f.kdv_oranlari.items()}
        if len(f.kdv_oranlari) == 1:
            f.kdv_oranlari = {next(iter(f.kdv_oranlari)): not_kdv}
        f.kdv_toplam = not_kdv
        f.tl_kaynak = "TL tutar faturada yazılı (not)"
    elif tl_yazili:
        if not f.kur:                    # kur yok: yalnız TL yazılmış vergi tutarlarını kullan
            tl_or: dict[Decimal, Decimal] = {}
            for st in root.findall("cac:TaxTotal/cac:TaxSubtotal", NS):
                x = st.find("cbc:TaxAmount", NS)
                if _t(st, "cac:TaxCategory/cac:TaxScheme/cbc:TaxTypeCode") == KDV_KODU and x is not None \
                        and (x.get("currencyID") or "").upper() in ("TRY", "TL"):
                    o = _kdv_orani(st, _d(x.text), _para(root, "cac:LegalMonetaryTotal/cbc:TaxExclusiveAmount"))
                    tl_or[o] = tl_or.get(o, Decimal("0")) + _d(x.text)
            if not tl_or:
                top = next((_d(x.text) for x in root.findall("cac:TaxTotal/cbc:TaxAmount", NS)
                            if (x.get("currencyID") or "").upper() in ("TRY", "TL")), None)
                if top is not None and f.kdv_oranlari:
                    t0 = sum(f.kdv_oranlari.values())
                    tl_or = {o: (v / t0 * top).quantize(Decimal("0.01"), ROUND_HALF_UP) if t0 else top
                             for o, v in f.kdv_oranlari.items()}
            if tl_or:
                f.kdv_oranlari = tl_or
                f.kdv_toplam = sum(tl_or.values())
        f.tl_kaynak = "TL tutar faturada yazılı"
    elif f.kur:
        f.tl_kaynak = f"kur ile hesaplandı ({f.kur})"
    else:
        f.tl_kaynak = None


def _invoice_oku(root, kaynak, para_birimi, doviz, kur) -> Fatura:
    oranlar: dict[Decimal, Decimal] = {}
    matrahlar: dict[Decimal, Decimal] = {}
    kdv_top = Decimal("0")
    diger: dict[str, Decimal] = {}
    for tt in root.findall("cac:TaxTotal", NS):
        for st in tt.findall("cac:TaxSubtotal", NS):
            kod_ = _t(st, "cac:TaxCategory/cac:TaxScheme/cbc:TaxTypeCode")
            if kod_ != KDV_KODU:
                ad = _t(st, "cac:TaxCategory/cac:TaxScheme/cbc:Name") or VERGI_ADLARI.get(kod_ or "", "Diğer vergi")
                if kod_ == "0059" and "KONAKLAMA" not in ad.upper():
                    ad = "Konaklama Vergisi"
                if kod_ in ("4080", "4081") and not re.search(r"İLET|ILET|ÖİV|OIV", ad.upper()):
                    ad = "Özel İletişim Vergisi"
                diger[ad] = diger.get(ad, Decimal("0")) + _para(st, "cbc:TaxAmount")
                continue
            kdv = _para(st, "cbc:TaxAmount").quantize(Decimal("0.01"), ROUND_HALF_UP)
            oran = _kdv_orani(st, kdv, _para(root, "cac:LegalMonetaryTotal/cbc:TaxExclusiveAmount"))
            matrah = _t(st, "cbc:TaxableAmount")
            oranlar[oran] = oranlar.get(oran, Decimal("0")) + kdv
            if matrah is not None:
                matrahlar[oran] = (matrahlar.get(oran, Decimal("0")) + _para(st, "cbc:TaxableAmount")).quantize(
                    Decimal("0.01"), ROUND_HALF_UP)
            kdv_top += kdv

    for o in [o for o in oranlar if o == 0 and oranlar[o] == 0 and not matrahlar.get(o)]:
        oranlar.pop(o)
        matrahlar.pop(o, None)
    tevkifat, tevkifat_detay = _tevkifat(root)
    s_vkn, s_ad = _taraf(root, "cac:AccountingSupplierParty")
    a_vkn, a_ad = _taraf(root, "cac:AccountingCustomerParty")
    lmt = "cac:LegalMonetaryTotal/cbc:"
    matrah_top = _para(root, lmt + "TaxExclusiveAmount")
    # Bazı entegratörler TaxableAmount yazmıyor (ör. tek oranlı faturada) -> toplamdan tamamla
    if len(oranlar) == 1 and not matrahlar:
        matrahlar[next(iter(oranlar))] = matrah_top

    f = Fatura(
        kaynak=kaynak,
        ettn=_t(root, "cbc:UUID"),
        belge_no=_t(root, "cbc:ID") or "",
        tarih=date.fromisoformat(_t(root, "cbc:IssueDate")),
        profil=_t(root, "cbc:ProfileID"),
        tip=_t(root, "cbc:InvoiceTypeCode"),
        para_birimi=para_birimi,
        satici_vkn=s_vkn, satici_unvan=s_ad, alici_vkn=a_vkn, alici_unvan=a_ad,
        matrah=matrah_top, kdv_toplam=kdv_top,
        odenecek=_para(root, lmt + "PayableAmount"),
        vergiler_dahil=_para(root, lmt + "TaxInclusiveAmount"),
        doviz=doviz, kur=kur,
        doviz_matrah=_d(_t(root, lmt + "TaxExclusiveAmount")) if doviz else None,
        doviz_vergiler_dahil=_d(_t(root, lmt + "TaxInclusiveAmount")) if doviz else None,
        doviz_odenecek=_d(_t(root, lmt + "PayableAmount")) if doviz else None,
        tevkifat=tevkifat, tevkifat_detay=tevkifat_detay, diger_vergiler=diger, kdv_oranlari=oranlar, matrah_oranlari=matrahlar,
        kalemler=_kalemler(root),
        notlar=_notlar(root),
        metin=_metin(root),
    )
    _masraflar(root, f)
    return f


def _yuzde(x: str | None) -> Decimal | None:
    """MultiplierFactorNumeric 0,08 ya da 8 olarak gelebilir → yüzde."""
    if not x or not x.strip():
        return None
    v = _d(x)
    if 0 < v < 1:
        v = v * 100
    return _oran(str(v.quantize(Decimal("0.01"))))


def _masraflar(root, f: "Fatura") -> None:
    """Komisyoncu faturasındaki masraflar: belge düzeyindeki AllowanceCharge'lar (Komisyon, Navlun, Hamaliye, Rüsum,
    Diğer … ve bunların "… KDV" satırları). KDV satırı adı en çok benzeyen (yoksa bir önceki) masrafa bağlanır.
    Masraf satırı yoksa mal bedeli (vergiler dahil) ile ödenecek arasındaki fark tek masraf sayılır."""
    if not f.komisyoncu:
        return
    liste: list[dict] = []
    kdvler: list[tuple[str, Decimal, Decimal | None]] = []
    for ac in root.findall("cac:AllowanceCharge", NS):
        tutar = _para(ac, "cbc:Amount")
        if not tutar:
            continue
        ad = " ".join((_t(ac, "cbc:AllowanceChargeReason") or "Masraf").split())
        yuzde = _yuzde(_t(ac, "cbc:MultiplierFactorNumeric"))
        if re.search(r"K\.?\s*D\.?\s*V", ad.upper().replace("İ", "I")):
            kdvler.append((ad, tutar, yuzde))
        else:
            liste.append({"ad": ad, "tutar": tutar, "oran": yuzde, "kdv": Decimal("0"), "kdv_oran": None})
    for ad, tutar, yuzde in kdvler:
        kok = re.sub(r"\s*K\.?\s*D\.?\s*V\.?\s*", " ", ad, flags=re.I).strip().upper()
        hedef = next((m for m in liste if kok and not m["kdv"] and m["ad"].upper().startswith(kok.split()[0])), None)
        if hedef is None:
            bos = [m for m in liste if not m["kdv"]]
            hedef = bos[-1] if bos else None
        if hedef is None:
            liste.append({"ad": ad, "tutar": Decimal("0"), "oran": None, "kdv": tutar, "kdv_oran": yuzde})
            continue
        hedef["kdv"] = tutar
        hedef["kdv_oran"] = yuzde if yuzde else (_oran(str((tutar / hedef["tutar"] * 100).quantize(Decimal("1")))) if hedef["tutar"] else None)
    if not liste:
        fark = (f.vergiler_dahil - f.odenecek).quantize(Decimal("0.01"))
        if fark > Decimal("0.05"):
            liste.append({"ad": "Komisyoncu masrafları", "tutar": fark, "oran": None, "kdv": Decimal("0"), "kdv_oran": None})
    f.masraflar = liste
    f.masraf_kdv = sum((m["kdv"] for m in liste), Decimal("0"))
    for m in liste:
        if m["kdv"]:
            o = m["kdv_oran"] or Decimal("20")
            f.masraf_kdv_oranlari[o] = f.masraf_kdv_oranlari.get(o, Decimal("0")) + m["kdv"]


def _notlar(root, en_cok: int = 30) -> list[str]:
    out = []
    for yol in ("cbc:Note", "cac:InvoiceLine/cbc:Note", "cac:InvoiceLine/cac:Item/cbc:Description"):
        for n in root.findall(yol, NS):
            t = " ".join((n.text or "").split())
            if t and t not in out:
                out.append(t[:300])
            if len(out) >= en_cok:
                return out
    return out


def _metin(root, sinir: int = 20000) -> str:
    """Faturadaki bütün yazılar (gömülü görüntü / ek dosyalar hariç): abone no, tesisat no, sözleşme no, adres…"""
    parca, n = [], 0
    for e in root.iter():
        ad = e.tag.rsplit("}", 1)[-1] if isinstance(e.tag, str) else ""
        if ad in ("EmbeddedDocumentBinaryObject", "Signature", "X509Certificate", "SignatureValue", "DigestValue", "UBLExtensions"):
            continue
        t = (e.text or "").strip()
        if t and len(t) < 400:
            parca.append(t); n += len(t) + 1
            if n > sinir:
                break
    return " ".join(parca)


def _kalemler(root, en_cok: int = 20) -> list[str]:
    adlar = []
    for satir in root.findall("cac:InvoiceLine", NS):
        ad = _t(satir, "cac:Item/cbc:Name") or _t(satir, "cac:Item/cbc:Description") or ""
        ad = " ".join(ad.split())
        if ad and ad not in adlar:
            adlar.append(ad[:120])
        if len(adlar) >= en_cok:
            break
    return adlar


def _yerel(el, yol: str):
    """Ad alanından bağımsız (yerel adla) alt öğe bulur: 'a/b/c'."""
    for parca in yol.split("/"):
        if el is None:
            return None
        el = next((c for c in el if c.tag.split("}")[-1] == parca), None)
    return el


def _yt(el, yol: str) -> str | None:
    x = _yerel(el, yol)
    return x.text.strip() if x is not None and x.text and x.text.strip() else None


def esmm_oku(root, kaynak: str) -> Fatura | None:
    """GİB e-Serbest Meslek Makbuzu (eArsivVeri/serbestMeslekMakbuz) okuyucu.
    KDV (0015) normal KDV gibi; gelir vergisi stopajı (0003) 'diğer vergiler'e yazılır."""
    m = _yerel(root, "serbestMeslekMakbuz")
    if m is None:
        return None
    satici = _yt(root, "baslik/mukellef/vkn") or _yt(root, "baslik/mukellef/tckn") or ""
    alici_el = _yerel(m, "aliciBilgileri")
    alici, alici_ad = "", ""
    if alici_el is not None:
        for tur in ("tuzelKisi", "gercekKisi"):
            k = _yerel(alici_el, tur)
            if k is not None:
                alici = _yt(k, "vkn") or _yt(k, "tckn") or ""
                alici_ad = _yt(k, "unvan") or " ".join(filter(None, [_yt(k, "ad"), _yt(k, "soyad")]))
                break
    oranlar: dict[Decimal, Decimal] = {}
    matrahlar: dict[Decimal, Decimal] = {}
    diger: dict[str, Decimal] = {}
    kdv_top = Decimal("0")
    vb = _yerel(m, "vergiBilgisi")
    for v in (list(vb) if vb is not None else []):
        if v.tag.split("}")[-1] != "vergi":
            continue
        kod, matrah, tutar = _yt(v, "vergiKodu"), _d(_yt(v, "matrah")), _d(_yt(v, "vergiTutari"))
        if kod == KDV_KODU:
            oran = _oran(str((tutar / matrah * 100).quantize(Decimal("1")))) if matrah else Decimal("0")
            oranlar[oran] = oranlar.get(oran, Decimal("0")) + tutar.quantize(Decimal("0.01"), ROUND_HALF_UP)
            matrahlar[oran] = matrahlar.get(oran, Decimal("0")) + matrah
            kdv_top += tutar
        else:
            ad = "Gelir Vergisi Stopajı" if kod == "0003" else f"Vergi {kod}"
            diger[ad] = diger.get(ad, Decimal("0")) + tutar
    brut = _d(_yt(m, "malHizmetBilgisi/malHizmet/burutUcret")) or (next(iter(matrahlar.values())) if matrahlar else Decimal("0"))
    return Fatura(
        kaynak=kaynak, ettn=_yt(m, "ETTN"), belge_no=_yt(m, "makbuzNo") or "",
        tarih=date.fromisoformat(_yt(m, "belgeTarihi")), profil="ESMM", tip="SERBESTMESLEK",
        para_birimi=_yt(m, "paraBirimi") or "TRY",
        satici_vkn=satici, satici_unvan=f"Serbest meslek erbabı {satici}", alici_vkn=alici, alici_unvan=alici_ad,
        matrah=brut, kdv_toplam=kdv_top, odenecek=_d(_yt(m, "odenecekTutar")),
        vergiler_dahil=brut + kdv_top, diger_vergiler=diger,
        kdv_oranlari=oranlar, matrah_oranlari=matrahlar,
    )


ZIP_UYARILARI: list[str] = []      # bozuk paketlerden kurtarma notları (rapora uyarı olarak eklenir)

# Belge girdisi sınırları (rapor-02 G-F, Görev 26). Gerçek arşivleri reddetmeyecek, açma bombasını durduracak eşikler:
# GİB / Luca paketleri en çok 2 düzey iç içe (dönem paketi → fatura paketi); tek fatura XML'i ekli PDF'le bile birkaç MB.
MB = 1024 * 1024
ZIP_DERINLIK = 4                  # iç içe ZIP düzeyi (dış dosya 1)
ZIP_GIRDI_EN_COK = 256 * MB       # tek XML / iç ZIP'in açılmış boyutu
ZIP_TOPLAM_EN_COK = 4096 * MB     # bir dosyadan açılan toplam boyut (200 MB'lık XML arşivi ≈ 2-3 GB açılır)
ZIP_ORAN_EN_COK = 500             # 10 MB üstü girdide açılmış / sıkışmış oranı (XML en çok ~50-100 kat sıkışır)
ZIP_GIRDI_SAYISI = 500_000        # bir dosyadaki toplam girdi


class GirdiSiniri(ValueError):
    """Belge girdisi sınırı aşıldı; mesaj kullanıcıya gösterilir."""


class _Sayac:
    def __init__(self, kaynak: str):
        self.kaynak, self.toplam, self.adet = kaynak, 0, 0

    def ekle(self, ad: str, boyut: int, sikismis: int | None = None):
        self.adet += 1
        if self.adet > ZIP_GIRDI_SAYISI:
            raise GirdiSiniri(f"{self.kaynak}: arşivde çok fazla dosya var (en çok {ZIP_GIRDI_SAYISI:,}).".replace(",", "."))
        if boyut > ZIP_GIRDI_EN_COK:
            raise GirdiSiniri(f"{ad}: açılınca {boyut // MB} MB oluyor; tek dosya en çok {ZIP_GIRDI_EN_COK // MB} MB olabilir.")
        if sikismis is not None and boyut > 10 * MB and boyut > ZIP_ORAN_EN_COK * max(sikismis, 1):
            raise GirdiSiniri(f"{ad}: olağan dışı sıkıştırılmış (açılınca {boyut // MB} MB); bozuk ya da zararlı arşiv olabilir, açılmadı.")
        self.toplam += boyut
        if self.toplam > ZIP_TOPLAM_EN_COK:
            raise GirdiSiniri(f"{self.kaynak}: arşivin açılmış boyutu {ZIP_TOPLAM_EN_COK // MB // 1024} GB sınırını aşıyor; "
                              "arşivi dönemlere bölüp ayrı ayrı yükleyin.")


def _kurtar(veri: bytes, sayac: "_Sayac | None" = None) -> Iterator[tuple[str, bytes]]:
    """İçindekiler listesi (central directory) olmayan / sonu bozuk ZIP'ten girdileri yerel başlıklardan okur.
    Luca bazen paketin sonuna hata mesajı yazıp paketi yarım bırakıyor."""
    import struct
    import zlib
    i = 0
    while True:
        i = veri.find(b"PK\x03\x04", i)
        if i < 0 or i + 30 > len(veri):
            return
        try:
            (_, _, bayrak, yontem, _, _, _, boyut, _, ad_uz, ek_uz) = struct.unpack("<IHHHHHIIIHH", veri[i:i + 30])
            ad = veri[i + 30:i + 30 + ad_uz].decode("utf-8", "replace")
            bas = i + 30 + ad_uz + ek_uz
            if yontem == 8:
                d = zlib.decompressobj(-15)
                icerik = d.decompress(veri[bas:bas + boyut] if boyut and not bayrak & 8 else veri[bas:], ZIP_GIRDI_EN_COK + 1)
                if len(icerik) > ZIP_GIRDI_EN_COK:
                    raise GirdiSiniri(f"{ad}: açılınca {ZIP_GIRDI_EN_COK // MB} MB'ı aşıyor; tek dosya en çok bu kadar olabilir.")
                if not d.eof:
                    raise ValueError("eksik")
                son = len(veri) - len(d.unused_data) if not (boyut and not bayrak & 8) else bas + boyut
            elif yontem == 0 and boyut:
                icerik, son = veri[bas:bas + boyut], bas + boyut
            else:
                i += 4
                continue
            if sayac:
                sayac.ekle(ad, len(icerik), (son - bas) if yontem == 8 else None)
            yield ad, icerik
            i = max(son, i + 4)
        except GirdiSiniri:
            raise
        except (struct.error, zlib.error, ValueError):
            i += 4


def _zipten(veri: bytes, kaynak: str, derinlik: int = 1, sayac: "_Sayac | None" = None) -> Iterator[tuple[bytes, str]]:
    sayac = sayac or _Sayac(kaynak)
    if derinlik > ZIP_DERINLIK:
        raise GirdiSiniri(f"{kaynak}: iç içe {ZIP_DERINLIK} düzeyden derin ZIP açılmaz.")

    def _oku(z: zipfile.ZipFile):
        for bilgi in z.infolist():
            if bilgi.is_dir() or not bilgi.filename.lower().endswith((".xml", ".zip")):
                continue
            # bildirilen boyut önce denetlenir; okuma da en çok bildirilen boyut kadardır (zipfile CRC ile doğrular)
            sayac.ekle(bilgi.filename, bilgi.file_size, bilgi.compress_size)
            with z.open(bilgi) as f:
                icerik = f.read(ZIP_GIRDI_EN_COK + 1)
            if len(icerik) > ZIP_GIRDI_EN_COK:
                raise GirdiSiniri(f"{bilgi.filename}: tek dosya en çok {ZIP_GIRDI_EN_COK // MB} MB olabilir.")
            yield bilgi.filename, icerik

    try:
        z = zipfile.ZipFile(io.BytesIO(veri))
        girdiler = _oku(z)
    except zipfile.BadZipFile:
        hata = ""
        j = veri.rfind(b'{"')
        if j > 0 and len(veri) - j < 2000:
            hata = veri[j:].decode("utf-8", "replace")[:300]
        ZIP_UYARILARI.append(f"{kaynak}: paket yarım inmiş, içindeki faturalar tek tek kurtarıldı"
                             + (f" (Luca'nın mesajı: {hata})" if hata else ""))
        girdiler = _kurtar(veri, sayac)
    for ad, alt in girdiler:
        if ad.lower().endswith(".zip"):
            try:
                yield from _zipten(alt, f"{kaynak}/{ad}", derinlik + 1, sayac)
            except GirdiSiniri:
                raise
            except Exception:
                ZIP_UYARILARI.append(f"{kaynak}/{ad}: okunamadı")
        elif ad.lower().endswith(".xml"):
            yield alt, f"{kaynak}/{ad}"


def _hamlar(yollar: list[Path]) -> list[tuple[bytes, str]]:
    hamlar: list[tuple[bytes, str]] = []
    for y in yollar:
        dosyalar = [y] if y.is_file() else sorted(p for p in y.rglob("*") if p.is_file())
        for d in dosyalar:
            if d.suffix.lower() == ".zip":
                hamlar.extend(_zipten(d.read_bytes(), d.name))
            elif d.suffix.lower() == ".xml":
                hamlar.append((d.read_bytes(), d.name))
    return hamlar


def vkn_tespit(yollar: list[Path]) -> str | None:
    """Faturaların ortak tarafı olan VKN'yi bulur (kontrol edilen firma)."""
    from collections import Counter
    sayac: Counter[str] = Counter()
    for veri, kaynak in _hamlar(yollar):
        f = xml_oku(veri, kaynak)
        if f:
            sayac.update({f.satici_vkn, f.alici_vkn} - {""})
    return sayac.most_common(1)[0][0] if sayac else None


def faturalari_oku(yollar: list[Path], firma_vkn: str) -> tuple[list[Fatura], list[str]]:
    """Faturaları okur; aynı ETTN/belge no iki kez gelirse bir kez alır.
    Dönüş: (faturalar, uyarılar)"""
    hamlar = _hamlar(yollar)

    faturalar, uyarilar, gorulen = [], [], set()
    mukerrer = 0
    for veri, kaynak in hamlar:
        f = xml_oku(veri, kaynak)
        if f is None:
            uyarilar.append(f"Fatura olarak okunamadı: {kaynak}")
            continue
        anahtar = f.ettn or (f.satici_vkn, f.belge_no)
        if anahtar in gorulen:
            mukerrer += 1
            continue
        gorulen.add(anahtar)
        if f.alici_vkn == firma_vkn:
            f.yon = "ALIS"
        elif f.satici_vkn == firma_vkn:
            f.yon = "SATIS"
        else:
            uyarilar.append(f"Firma VKN'si faturada yok, atlandı: {f.belge_no}")
            continue
        faturalar.append(f)
    if mukerrer:
        uyarilar.append(f"{mukerrer} fatura birden fazla dosyada geldi; her biri bir kez sayıldı")
    return faturalar, uyarilar
