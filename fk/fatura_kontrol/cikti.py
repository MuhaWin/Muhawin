"""Dosyaya konulacak çıktı raporu (yazdır / PDF):
  1) Kontrol özeti   – firma, dönem, fatura sayıları, sonuçlar, sorunlu belgeler
  2) Açıklamalı muavin dökümü – KDV hesapları (190/191/192/391/360-KDV) ve satış hesapları; dönem satırları
     ve her satırın fatura kontrol sonucu
  3) KDV beyannamesi örneği (taslak) – yalnız muavin kayıtlarından hesaplanır; resmi beyanname değildir.

Ay sonu 'KDV tahakkuk / mahsup' fişi (190 hesabı geçen ya da 391 borç + 191 alacak içeren fiş) hesaplamaya
katılmaz; varsa taslakla karşılaştırılır.
"""
from __future__ import annotations

import html
import re
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal

from .muavin_okuyucu import MuavinSatiri

SIFIR = Decimal("0")
YUZ = Decimal("100")


def _buyuk(x: str) -> str:
    return (x or "").replace("i", "İ").replace("ı", "I").upper()


def tl(x, bos: str = "") -> str:
    if x is None:
        return bos
    x = Decimal(str(x)).quantize(Decimal("0.01"))
    if x == 0 and bos:
        return bos
    s = f"{abs(x):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return ("-" if x < 0 else "") + s


def _e(x) -> str:
    return html.escape(str(x if x is not None else ""))


def kdv_hesabi_mi(s: MuavinSatiri) -> bool:
    a = s.ana_hesap
    if a in ("190", "191", "192", "391"):
        return True
    return a == "360" and bool(re.search(r"KDV|TEVK", _buyuk(s.hesap_adi)))


def kdv2_hesabi(ad: str) -> bool:
    """360 altında sorumlu sıfatıyla (KDV2) tevkifat hesabı mı? (ör. '2/10 Tevkifatlı KDV')"""
    return bool(re.search(r"TEVK|KDV\s*-?\s*2\b|SORUMLU", _buyuk(ad)))


def tahakkuk_fisleri(muavin: list[MuavinSatiri], bas: date, bit: date) -> set[tuple]:
    """Dönem içindeki KDV tahakkuk (mahsup) fişleri: 190 geçen ya da 391 borç + 191 alacak içeren fişler."""
    fisler: dict[tuple, list[MuavinSatiri]] = defaultdict(list)
    for s in muavin:
        if bas <= s.fis_tarihi <= bit:
            fisler[(s.fis_no, s.fis_tarihi)].append(s)
    sonuc = set()
    for k, satirlar in fisler.items():
        has190 = any(s.ana_hesap == "190" for s in satirlar)
        b391 = any(s.ana_hesap == "391" and s.borc > 0 for s in satirlar)
        a191 = any(s.ana_hesap == "191" and s.alacak > 0 for s in satirlar)
        if has190 or (b391 and a191):
            sonuc.add(k)
    return sonuc


# ------------------------------------------------------------------ KDV beyannamesi taslağı
@dataclass
class BeyanSatiri:
    ad: str
    matrah: Decimal | None = None
    oran: str = ""
    vergi: Decimal | None = None
    not_: str = ""


@dataclass
class Beyan:
    teslimler: list[BeyanSatiri] = field(default_factory=list)
    kismi_tevkifat: list[BeyanSatiri] = field(default_factory=list)
    ilave: list[BeyanSatiri] = field(default_factory=list)
    devreden: Decimal = SIFIR
    indirimler: list[BeyanSatiri] = field(default_factory=list)
    istisnalar: list[BeyanSatiri] = field(default_factory=list)
    kdv2: Decimal = SIFIR
    ihrac_kayitli_kdv: Decimal = SIFIR
    satis_hesaplari: list[BeyanSatiri] = field(default_factory=list)
    efatura_istisna: list = field(default_factory=list)
    tahakkuk: dict | None = None
    iade_edilebilir: Decimal | None = None      # iade talep edilecek yüklenilen KDV (kullanıcı cevabı / 136)
    iade_cevap: str | None = None               # "evet" / "hayir" / None (sorulmadı)
    iade_onerisi: Decimal | None = None         # muavindeki tahakkuk fişinde 136'ya alınan tutar
    kumulatif_bedel: Decimal = SIFIR
    notlar: list[str] = field(default_factory=list)

    @property
    def toplam_matrah(self) -> Decimal:
        return sum((x.matrah or SIFIR for x in self.teslimler + self.kismi_tevkifat), SIFIR)

    @property
    def istisna_bedeli(self) -> Decimal:
        return sum((x.matrah or SIFIR for x in self.istisnalar if x.not_ == "muavin"), SIFIR)

    @property
    def aylik_bedel(self) -> Decimal:
        return self.toplam_matrah + self.istisna_bedeli

    @property
    def hesaplanan(self) -> Decimal:
        return sum((x.vergi or SIFIR for x in self.teslimler + self.kismi_tevkifat), SIFIR)

    @property
    def ilave_toplam(self) -> Decimal:
        return sum((x.vergi or SIFIR for x in self.ilave), SIFIR)

    @property
    def toplam_hesaplanan(self) -> Decimal:
        return self.hesaplanan + self.ilave_toplam

    @property
    def bu_donem_indirim(self) -> Decimal:
        return sum((x.vergi or SIFIR for x in self.indirimler), SIFIR)

    @property
    def indirimler_toplami(self) -> Decimal:
        return self.devreden + self.bu_donem_indirim

    @property
    def odenecek(self) -> Decimal:
        return max(self.toplam_hesaplanan - self.indirimler_toplami, SIFIR)

    @property
    def iade_edilmesi_gereken(self) -> Decimal:
        if not self.iade_edilebilir:
            return SIFIR
        return min(self.iade_edilebilir, max(self.indirimler_toplami - self.toplam_hesaplanan, SIFIR))

    @property
    def sonraki_doneme(self) -> Decimal:
        return max(self.indirimler_toplami - self.toplam_hesaplanan - self.iade_edilmesi_gereken, SIFIR)


def _oran(ad: str) -> Decimal | None:
    m = re.search(r"%\s*(\d+)", ad) or re.search(r"\b(\d{1,2})\s*%", ad)
    return Decimal(m.group(1)) if m else None


def _teslim_bedeli(muavin: list[MuavinSatiri], bas: date, bit: date) -> Decimal:
    """Teslim ve hizmet bedeli (matrah + kısmi tevkifatlı satış + ihracat) – muavine göre."""
    t = tahakkuk_fisleri(muavin, bas, bit)
    toplam = SIFIR
    for s in muavin:
        if not (bas <= s.fis_tarihi <= bit) or (s.fis_no, s.fis_tarihi) in t:
            continue
        ad = _buyuk(s.hesap_adi)
        if s.ana_hesap == "391":
            oran = _oran(s.hesap_adi)
            if oran and "TEVK" not in ad and not re.search(_ILAVE, ad):
                toplam += (s.alacak - s.borc) * YUZ / oran
        elif s.ana_hesap == "601" or (s.ana_hesap == "600" and "TEVK" in ad):
            toplam += s.alacak - s.borc
    return toplam.quantize(Decimal("0.01"))


_ILAVE = r"[İI]ADE|[İI]LAVE|DAHA [ÖO]NCE|GER[ÇC]EKLE[ŞS]MEYEN"


def indirim_turu(kod: str, ad: str) -> str:
    a = _buyuk(ad)
    if re.search(r"[İI]ADE|VAZGE[ÇC]|GER[ÇC]EKLE[ŞS]MEYEN", a) and "SORUMLU" not in a:
        return "102 - Satıştan İade Edilen, İşlemi Gerçekleşmeyen veya İşleminden Vazgeçilen Mal ve Hizmetler Nedeniyle İndirilecek KDV"
    if "SORUMLU" in a or kod.startswith("191.02"):
        return "109 - Sorumlu Sıfatıyla Beyan Edilerek Ödenen KDV"
    if "THAL" in a:
        return "İthalde Ödenen KDV"
    return "108 - Yurtiçi Alımlara İlişkin KDV"


def kdv_beyani(muavin: list[MuavinSatiri], bas: date, bit: date, faturalar: list[dict] | None = None,
               iade: dict | None = None) -> Beyan:
    """iade: kullanıcının cevabı {'cevap': 'evet'|'hayir', 'tutar': '388962.53'}; yoksa muavindeki 136 kullanılır."""
    b = Beyan()
    tahakkuk = tahakkuk_fisleri(muavin, bas, bit)
    donem = [s for s in muavin if bas <= s.fis_tarihi <= bit]
    normal = [s for s in donem if (s.fis_no, s.fis_tarihi) not in tahakkuk]

    hesaplar: dict[str, dict] = {}
    for s in normal:
        h = hesaplar.setdefault(s.hesap_kodu, {"ad": s.hesap_adi, "b": SIFIR, "a": SIFIR, "n": 0})
        h["b"] += s.borc
        h["a"] += s.alacak
        h["n"] += 1
    tevk_matrah = sum((h["a"] - h["b"] for k, h in hesaplar.items()
                       if k.startswith("600") and "TEVK" in _buyuk(h["ad"])), SIFIR)

    # Hesaplanan KDV (391)
    for kod, h in sorted(hesaplar.items()):
        if not kod.startswith("391"):
            continue
        vergi = h["a"] - h["b"]
        if not vergi:
            continue
        ad = _buyuk(h["ad"])
        oran = _oran(h["ad"])
        etiket = f"{kod} {h['ad']}"
        if "TEVK" in ad:
            b.kismi_tevkifat.append(BeyanSatiri(etiket, tevk_matrah or None, "", vergi, "kısmi tevkifatlı satış"))
            tevk_matrah = SIFIR
        elif oran and not re.search(_ILAVE, ad):
            b.teslimler.append(BeyanSatiri("1100 - Yurtiçi Teslim ve Hizmetler", (vergi * YUZ / oran).quantize(Decimal("0.01")),
                                           f"{oran}", vergi, etiket))
        else:
            b.ilave.append(BeyanSatiri(etiket, None, "", vergi))

    # Önceki dönemden devreden KDV: 190 hesabının dönem başı bakiyesi
    b.devreden = sum((s.borc - s.alacak for s in muavin if s.ana_hesap == "190" and s.fis_tarihi < bas), SIFIR)

    # Bu döneme ait indirilecek KDV (191)
    for kod, h in sorted(hesaplar.items()):
        if kod.startswith("191"):
            vergi = h["b"] - h["a"]
            if vergi:
                oran = _oran(h["ad"])
                tur = indirim_turu(kod, h["ad"])
                b.indirimler.append(BeyanSatiri(tur, (vergi * YUZ / oran).quantize(Decimal("0.01"))
                                                if oran and tur.startswith("108") else None,
                                                f"{oran}" if oran and tur.startswith("108") else "", vergi,
                                                f"{kod} {h['ad']} · {h['n']} kayıt"))
        elif kod.startswith("192"):
            b.ihrac_kayitli_kdv += h["b"] - h["a"]
        elif kod.startswith("360") and kdv2_hesabi(h["ad"]):
            b.kdv2 += h["a"]            # dönemde tahakkuk eden sorumlu sıfatıyla KDV (ödemeler borçtadır)
        elif kod[:3] in ("600", "601", "602", "610", "611"):
            net = (h["a"] - h["b"]) if kod[:3] in ("600", "601", "602") else (h["b"] - h["a"])
            if net:
                b.satis_hesaplari.append(BeyanSatiri(f"{kod} {h['ad']}", net))

    # KDV'siz satış uyarısı: 600-602 net satış, 391'den hesaplanan matrahtan belirgin büyükse (harç / yansıtma / istisna olabilir)
    satis_net = sum((x.matrah or SIFIR for x in b.satis_hesaplari if x.ad[:3] in ("600", "602")), SIFIR)
    iade_net = sum((x.matrah or SIFIR for x in b.satis_hesaplari if x.ad[:3] in ("610", "611")), SIFIR)
    kdvli = sum((x.matrah or SIFIR for x in b.teslimler), SIFIR) + (sum((x.matrah or SIFIR for x in b.kismi_tevkifat), SIFIR))
    kdvsiz = (satis_net - iade_net - kdvli).quantize(Decimal("0.01"))
    if kdvsiz > max(Decimal("100"), satis_net * Decimal("0.02")):
        tr = lambda v: f"{v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
        b.notlar.append(f"600-602 hesaplarındaki net satış ({tr(satis_net)} TL; iadeler düşülünce {tr(satis_net - iade_net)}) KDV'li "
                        f"matrahtan ({tr(kdvli)}) {tr(kdvsiz)} TL fazla: harç / masraf yansıtması gibi KDV'siz işlemler ya da "
                        "istisnalar (ör. 302 hizmet ihracı) olabilir. İstisna kapsamındaysa İstisnalar bölümüne girilmeli.")

    # İstisnalar: 601 yurt dışı satışlar (muavin) + e-faturalardaki istisna kodları (kontrol amaçlı)
    yurtdisi = sum((x.matrah or SIFIR for x in b.satis_hesaplari if x.ad.startswith("601")), SIFIR)
    if yurtdisi:
        b.istisnalar.append(BeyanSatiri("301 - Mal İhracatı (11/1-a)", yurtdisi, "", None, "muavin"))
    if faturalar:
        kodlar: dict[str, list] = defaultdict(lambda: [0, Decimal("0")])
        for f in faturalar:
            if f.get("yon") != "Satış":
                continue
            m = re.search(r"\b(3\d\d|70\d)\s*-\s*([^·]+)", f.get("fatura_tipi") or "")
            if m and not m.group(1).startswith("351"):
                k = f"{m.group(1)} - {m.group(2).strip()[:50]}"
                kodlar[k][0] += 1
                kodlar[k][1] += Decimal(str(f.get("matrah") or 0))
        b.efatura_istisna = [(k, adet, tutar.quantize(Decimal("0.01"))) for k, (adet, tutar) in sorted(kodlar.items())]

    # Muavindeki tahakkuk fişi
    if tahakkuk:
        t = [s for s in donem if (s.fis_no, s.fis_tarihi) in tahakkuk]
        b.tahakkuk = {
            "fisler": ", ".join(sorted({f"{n} ({d:%d.%m.%Y})" for n, d in tahakkuk})),
            "hesaplanan": sum((s.borc - s.alacak for s in t if s.ana_hesap == "391"), SIFIR),
            "indirilecek": sum((s.alacak - s.borc for s in t if s.ana_hesap == "191"), SIFIR),
            "devreden_kapanan": sum((s.alacak for s in t if s.ana_hesap == "190"), SIFIR),
            "sonraki_doneme": sum((s.borc for s in t if s.ana_hesap == "190"), SIFIR),
            "odenecek": sum((s.alacak - s.borc for s in t if s.ana_hesap == "360"), SIFIR),
            "iade": sum((s.borc - s.alacak for s in t if s.ana_hesap == "136"), SIFIR),
        }
        if b.tahakkuk["iade"]:
            b.iade_onerisi = b.tahakkuk["iade"]
    cevap = (iade or {}).get("cevap")
    if cevap == "hayir":
        b.iade_cevap, b.iade_edilebilir = "hayir", SIFIR
    elif cevap == "evet":
        tutar = _tr_sayi((iade or {}).get("tutar"))
        b.iade_cevap, b.iade_edilebilir = "evet", tutar.quantize(Decimal("0.01"))
    elif b.iade_onerisi:
        b.iade_edilebilir = b.iade_onerisi          # tahakkuk fişinde iade alacağı kaydedilmiş
    b.kumulatif_bedel = _teslim_bedeli(muavin, date(bit.year, 1, 1), bit)

    if not tahakkuk:
        b.notlar.append("Muavinde bu döneme ait KDV tahakkuk fişi henüz yok; taslak dönem kayıtlarından hesaplandı.")
    if b.istisnalar and b.iade_cevap is None and b.iade_edilebilir is None:
        b.notlar.append("İade talebi sorusu cevaplanmadı: iade edilebilir KDV 0 kabul edildi, tümü sonraki döneme "
                        "devrediyor. İade talep edilecekse yukarıdaki sorudan tutarı girin.")
    if b.ihrac_kayitli_kdv:
        b.notlar.append(f"192 İhraç kayıtlı alışlar KDV'si {tl(b.ihrac_kayitli_kdv)} TL – indirim olarak alınmaz.")
    if b.kdv2:
        b.notlar.append(f"KDV2 (sorumlu sıfatıyla) bu dönem tahakkuk eden tevkifat {tl(b.kdv2)} TL (360 alacak).")
    b.notlar.append("Matrahlar hesaplanan KDV'nin orana bölünmesiyle bulunur (kuruş farkı olabilir). Kümülatif bedel "
                    "muavine göre yaklaşık tutardır.")
    return b


# ------------------------------------------------------------------ KDV2 (sorumlu sıfatıyla) taslağı
@dataclass
class Kdv2Satiri:
    belge_no: str
    tarih: date
    unvan: str
    vkn: str
    islem: str             # beyanname işlem türü (ör. '224 - Yük Taşımacılığı Hizmeti')
    matrah: Decimal
    kdv_orani: str
    tevkifat_orani: str
    tutar: Decimal
    kaynak: str            # 'e-fatura' / 'muavin (hesaplandı)'


def _beyan_kodu(kod: str) -> str:
    """e-faturadaki tevkifat kodu (6xx) → KDV2 beyannamesindeki işlem türü kodu (2xx). Ör. 624 → 224."""
    return str(int(kod) - 400) if re.fullmatch(r"6\d\d", kod or "") else (kod or "")


def _islem_adi(kod: str, tur: str) -> str:
    ad = re.sub(r"^\s*\d+\s*-\s*", "", tur or "")
    ad = re.sub(r"%\s*\d+\s*", "", ad).strip()
    if ad.isupper():
        def kucuk(w):
            return w.replace("I", "ı").replace("İ", "i").lower()

        def bas(w):
            w = kucuk(w)
            return ({"i": "İ", "ı": "I"}.get(w[0], w[0].upper()) + w[1:]) if len(w) > 2 else w
        ad = " ".join(bas(w) for w in ad.split())
    k = _beyan_kodu(kod)
    return f"{k} - {ad}" if k else (ad or "Tevkifatlı işlem")


@dataclass
class Kdv2:
    satirlar: list[Kdv2Satiri] = field(default_factory=list)
    muavinde_yok: list[dict] = field(default_factory=list)     # tevkifatlı e-fatura, 360'ta kaydı yok
    odemeler: Decimal = SIFIR                                   # dönemde 360'a borç (önceki dönem KDV2 ödemeleri)

    @property
    def matrah(self) -> Decimal:
        return sum((x.matrah for x in self.satirlar), SIFIR)

    @property
    def tevkif(self) -> Decimal:
        return sum((x.tutar for x in self.satirlar), SIFIR)

    def ozet(self) -> list[tuple]:
        g: dict[tuple, list] = {}
        for x in self.satirlar:
            a = g.setdefault((x.islem, x.kdv_orani, x.tevkifat_orani), [SIFIR, SIFIR])
            a[0] += x.matrah
            a[1] += x.tutar
        return [(k[0], k[1], k[2], v[0], v[1]) for k, v in sorted(g.items())]


def kdv2_beyani(muavin: list[MuavinSatiri], bas: date, bit: date, tevkifatlar: list[dict] | None = None) -> Kdv2:
    """Dönemde 360 tevkifat hesabına alacak yazılan her belge bir satır; matrah/oran/tür bilgisi e-faturadan,
    fatura bulunamazsa hesap adındaki tevkifat oranından (KDV %20 varsayımıyla) hesaplanır."""
    k = Kdv2()
    tahakkuk = tahakkuk_fisleri(muavin, bas, bit)
    fatura = {}
    for t in tevkifatlar or []:
        if t.get("yon") == "Alış" and t.get("belge_no"):
            fatura.setdefault(t["belge_no"], []).append(t)
    kayitli = set()
    for s in muavin:
        if s.ana_hesap != "360" or not kdv2_hesabi(s.hesap_adi) or not (bas <= s.fis_tarihi <= bit) \
                or (s.fis_no, s.fis_tarihi) in tahakkuk:
            continue
        if s.borc and not s.alacak:
            k.odemeler += s.borc
            continue
        tutar = s.alacak - s.borc
        if not tutar:
            continue
        kalemler = fatura.get(s.belge_no or "")
        if kalemler and abs(sum(Decimal(str(x["tutar"])) for x in kalemler) - tutar) <= Decimal("0.05"):
            kayitli.add(s.belge_no)
            for x in kalemler:
                kdv, mat = Decimal(str(x.get("kdv") or 0)), Decimal(str(x.get("matrah") or 0))
                oran = (kdv * YUZ / mat).quantize(Decimal("1")) if mat else ""
                k.satirlar.append(Kdv2Satiri(s.belge_no, s.belge_tarihi or s.fis_tarihi, x.get("karsi_taraf") or s.unvan,
                                             x.get("vkn") or "", _islem_adi(x.get("kod", ""), x.get("tur", "")), mat,
                                             f"{oran}", x.get("oran") or "", Decimal(str(x["tutar"])), "e-fatura"))
            continue
        m = re.search(r"(\d+)\s*/\s*(\d+)", s.hesap_adi)
        pay, payda = (Decimal(m.group(1)), Decimal(m.group(2))) if m else (None, None)
        matrah = (tutar / (Decimal("0.20") * pay / payda)).quantize(Decimal("0.01")) if pay else SIFIR
        k.satirlar.append(Kdv2Satiri(s.belge_no or s.fis_no, s.belge_tarihi or s.fis_tarihi, s.unvan or s.aciklama[:40],
                                     "", "Tevkifatlı işlem (türü e-faturadan okunamadı)", matrah, "20" if pay else "",
                                     f"{pay}/{payda}" if pay else "", tutar, "muavin (hesaplandı)"))
    for no, kalemler in fatura.items():
        x = kalemler[0]
        if no not in kayitli and bas.isoformat() <= str(x.get("tarih") or "") <= bit.isoformat():
            k.muavinde_yok.append({"belge_no": no, "tarih": x.get("tarih"), "unvan": x.get("karsi_taraf"),
                                   "tutar": sum(Decimal(str(y["tutar"])) for y in kalemler)})
    k.satirlar.sort(key=lambda x: (x.tarih, x.belge_no))
    return k


def _kdv2_html(k: Kdv2, firma: str, vkn: str | None, donem_ad: str) -> str:
    p = [f"""<h2 class=yeni>4. KDV2 beyannamesi örneği (vergi sorumluları)</h2>
<div class=beyan-ust><div><div class=kucuk>Katma Değer Vergisi Beyannamesi · Vergi sorumluları için · Aylık</div>
<b>{_e(firma)}</b><div class=kucuk>VKN {_e(vkn or '')} · Dönem: {_e(donem_ad)}</div></div>
<span class=taslak>TASLAK · muavin + e-fatura</span></div>
<div class=kpi>
 <div><span>KDV matrahı</span><b>{tl(k.matrah, '0,00')}</b></div>
 <div><span>Tevkif edilen KDV</span><b>{tl(k.tevkif, '0,00')}</b></div>
 <div><span>İlave edilecek KDV</span><b>0,00</b></div>
 <div class='{'kirmizi' if k.tevkif else ''}'><span>Ödenmesi gereken KDV</span><b>{tl(k.tevkif, '0,00')}</b></div>
</div>"""]
    p.append(_tablo(["Kısmi tevkifat – işlem türü", "Matrah", "KDV %", "Tevkifat", "Vergi"],
                    [[_e(a), tl(m), _e(o), _e(t), tl(v)] for a, o, t, m, v in k.ozet()] +
                    [["<b>Toplam</b>", f"<b>{tl(k.matrah)}</b>", "", "", f"<b>{tl(k.tevkif)}</b>"]], {1, 2, 3, 4}))
    p.append("<h3>KDV kesintisi yapılanlara ait bildirim</h3>")
    p.append(_tablo(["Tarih", "Belge no", "Ünvan / VKN", "İşlem türü", "Matrah", "KDV %", "Tevk.", "Tevkif edilen"],
                    [[f"{x.tarih:%d.%m.%Y}", _e(x.belge_no), f"{_e(x.unvan[:38])}<div class=kucuk>{_e(x.vkn)}</div>",
                      f"<span class=kucuk>{_e(x.islem)}</span>" + ("" if x.kaynak == "e-fatura" else
                                                                 f"<div class=kucuk>⚠ {_e(x.kaynak)}</div>"),
                      tl(x.matrah), _e(x.kdv_orani), _e(x.tevkifat_orani), tl(x.tutar)] for x in k.satirlar] +
                    [["", "", "<b>Genel toplam</b>", "", f"<b>{tl(k.matrah)}</b>", "", "", f"<b>{tl(k.tevkif)}</b>"]],
                    {4, 5, 6, 7}, cls="dokum k2"))
    if k.muavinde_yok:
        p.append("<h3>Tevkifatlı e-fatura var, 360 tevkifat hesabında kaydı yok</h3>")
        p.append(_tablo(["Tarih", "Belge no", "Ünvan", "Tevkifat"],
                        [[_tarih(x["tarih"]), _e(x["belge_no"]), _e((x["unvan"] or "")[:45]), tl(x["tutar"])]
                         for x in k.muavinde_yok], {3}, cls="dokum"))
    p.append("<p class=not>• Satırlar dönemde 360 tevkifat hesabına alacak yazılan kayıtlardır; işlem türü, matrah ve "
             "oranlar e-faturadan alınır (e-faturadaki 6xx kodu beyannamede 2xx olarak gösterilir, ör. 624 → 224). "
             "Faturası bulunamayan satırda matrah, hesap adındaki tevkifat oranıyla ve KDV %20 varsayılarak hesaplanır.</p>")
    if k.odemeler:
        p.append(f"<p class=not>• Bu dönemde 360 hesabına borç yazılan KDV2 ödemeleri: {tl(k.odemeler)} TL "
                 "(önceki dönem beyannamesinin ödemesi).</p>")
    return "".join(p)


# ------------------------------------------------------------------ açıklamalı muavin dökümü
ACIKLAMALAR = [
    ("190", "Devreden KDV: önceki dönemlerden devreden, henüz indirilemeyen KDV. Dönem başı bakiyesi beyannamede "
            "'önceki dönemden devreden KDV' satırına yazılır."),
    ("191", "İndirilecek KDV: alış faturalarındaki KDV. Her kayıt e-faturasıyla karşılaştırılmıştır (sağ sütun)."),
    ("192", "Diğer KDV (ihraç kayıtlı alışlar): satıcının tahsil etmediği KDV; indirim konusu yapılmaz."),
    ("391", "Hesaplanan KDV: satış faturalarında hesaplanan KDV. Her kayıt e-faturasıyla karşılaştırılmıştır."),
    ("360", "Ödenecek vergiler – KDV tevkifatı (KDV2): alış faturalarında sorumlu sıfatıyla beyan edilecek KDV."),
    ("600", "Yurt içi satışlar (matrah karşılaştırması için)."),
    ("601", "Yurt dışı satışlar: ihracat – KDV'den istisna (301)."),
    ("602", "Diğer gelirler."),
    ("610", "Satıştan iadeler."),
]


def _aciklama(kod: str) -> str:
    return next((a for k, a in ACIKLAMALAR if kod.startswith(k)), "")


def _dokum_hesap_mi(s: MuavinSatiri) -> bool:
    return kdv_hesabi_mi(s) or s.ana_hesap in ("600", "601", "602", "610")


def muavin_dokumu(muavin: list[MuavinSatiri], bas: date, bit: date, rapor: dict | None = None):
    """Döner: (hesap özetleri, dönem satırları). Satış hesapları yalnız özet olarak verilir."""
    durumlar: dict[str, str] = {}
    if rapor:
        for x in rapor.get("sonuclar", []):
            durumlar.setdefault(x["belge_no"], x["durum"])
        for x in rapor.get("faturasi_olmayanlar", []):
            durumlar.setdefault(x.get("belge_no") or "", "Faturası bulunamadı")
    tahakkuk = tahakkuk_fisleri(muavin, bas, bit)
    ozet: dict[str, dict] = {}
    satirlar = []
    for s in muavin:
        if not _dokum_hesap_mi(s):
            continue
        o = ozet.setdefault(s.hesap_kodu, {"kod": s.hesap_kodu, "ad": s.hesap_adi, "acilis": SIFIR, "borc": SIFIR,
                                           "alacak": SIFIR, "adet": 0})
        if s.fis_tarihi < bas:
            o["acilis"] += s.borc - s.alacak
        elif s.fis_tarihi <= bit:
            o["borc"] += s.borc
            o["alacak"] += s.alacak
            o["adet"] += 1
            if kdv_hesabi_mi(s):
                if (s.fis_no, s.fis_tarihi) in tahakkuk:
                    kontrol = "KDV tahakkuk / mahsup fişi"
                elif s.belge_no and s.belge_no in durumlar:
                    kontrol = durumlar[s.belge_no]
                else:
                    kontrol = "—"
                satirlar.append((s, kontrol))
    for o in ozet.values():
        o["kapanis"] = o["acilis"] + o["borc"] - o["alacak"]
        o["aciklama"] = _aciklama(o["kod"])
    hesaplar = [o for o in sorted(ozet.values(), key=lambda o: o["kod"])
                if o["adet"] or (o["acilis"] and o["kod"][0] != "6")]
    satirlar.sort(key=lambda x: (x[0].hesap_kodu, x[0].fis_tarihi, x[0].fis_no))
    return hesaplar, satirlar


# ------------------------------------------------------------------ HTML
AYLAR = ["", "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım",
         "Aralık"]

STIL = """
@page{size:A4;margin:12mm 11mm}
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
:root{--ana:#1f3864;--acik:#eef2f9;--cizgi:#dfe3ea;--yazi:#1d2433;--soluk:#667085}
body{font:9.5pt 'Segoe UI',Arial,sans-serif;color:var(--yazi);margin:0;background:#f4f6fa}
.sayfa{max-width:188mm;margin:14px auto;padding:14mm 12mm;background:#fff;border-radius:10px;box-shadow:0 2px 10px #0001}
@media print{body{background:#fff}.sayfa{margin:0;padding:0;box-shadow:none;max-width:none}}
h1{font-size:16pt;margin:0;color:var(--ana);letter-spacing:.3px}
h2{font-size:11.5pt;margin:20px 0 8px;padding:0 0 4px;color:var(--ana);border-bottom:2px solid var(--ana)}
h3{font-size:10pt;margin:14px 0 4px;color:var(--ana)}
.ust{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
.ust small{color:var(--soluk)}
.kunye{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:12px 0 4px}
.kunye div{background:var(--acik);border-radius:8px;padding:6px 9px}
.kunye span{display:block;font-size:7.5pt;color:var(--soluk);text-transform:uppercase;letter-spacing:.4px}
.kunye .genis{grid-column:span 2}
table{border-collapse:separate;border-spacing:0;width:100%;margin:6px 0;border:1px solid var(--cizgi);border-radius:8px;overflow:hidden}
th,td{padding:4px 7px;vertical-align:top;border-bottom:1px solid var(--cizgi)}
tr:last-child td{border-bottom:none}
th{background:var(--acik);text-align:left;font-weight:600;font-size:8.5pt;color:#344054}
thead{display:table-header-group}
tr{page-break-inside:avoid}
td.s,th.s{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
.not{color:var(--soluk);font-size:8.5pt;margin:3px 0}
.uyari{background:#fff7ea;border-left:3px solid #f0a020;padding:6px 9px;margin:6px 0;font-size:8.5pt;border-radius:4px}
.ok{color:#137333}.kotu{color:#b3261e;font-weight:600}
.yeni{page-break-before:always}
.imza{display:flex;gap:20px;margin-top:34px}
.imza div{flex:1;border-top:1px solid #98a2b3;padding-top:4px;text-align:center;font-size:8.5pt;color:var(--soluk)}
.kucuk{font-size:7.8pt;color:var(--soluk)}
.taslak{border:1.5px solid #b3261e;color:#b3261e;padding:3px 9px;font-weight:700;border-radius:20px;font-size:8pt;white-space:nowrap}
.ozet{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin:8px 0}
.ozet div,.kpi div{border:1px solid var(--cizgi);border-radius:10px;padding:7px 10px}
.ozet span,.kpi span{display:block;font-size:7.5pt;color:var(--soluk);text-transform:uppercase;letter-spacing:.4px}
.ozet b,.kpi b{font-size:13pt;font-variant-numeric:tabular-nums}
.beyan-ust{display:flex;justify-content:space-between;align-items:center;gap:10px;background:var(--acik);
 border-radius:10px;padding:9px 12px;margin-bottom:8px}
.kpi{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:8px}
.kpi b{font-size:12pt}
.kpi .kirmizi{background:#fdecea;border-color:#f5c2bd}.kpi .mavi{background:#e8f0fe;border-color:#c6d7fb}
.izgara{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.kart{border:1px solid var(--cizgi);border-radius:10px;padding:8px 11px;page-break-inside:avoid}
.kart h4{margin:0 0 4px;font-size:8.5pt;text-transform:uppercase;letter-spacing:.5px;color:var(--ana)}
.liste{margin:0}
.liste div{display:flex;justify-content:space-between;gap:10px;padding:3px 0;border-bottom:1px dashed var(--cizgi)}
.liste div:last-child{border-bottom:none}
.liste dt{color:#344054}.liste dd{margin:0;font-variant-numeric:tabular-nums;white-space:nowrap}
.liste .vurgu dt,.liste .vurgu dd{font-weight:700;color:var(--ana)}
.detay{margin-top:6px}
.iade-soru{display:flex;flex-wrap:wrap;gap:10px;align-items:center;background:#fff7ea;border:1px solid #f0c27b;
 border-radius:10px;padding:8px 12px;margin-bottom:8px;font-size:9pt}
.iade-soru>div{flex:1 1 260px}
.iade-soru button{padding:5px 14px;border:0;border-radius:6px;background:var(--ana);color:#fff;font-weight:600;cursor:pointer}
@media print{.ekran{display:none!important}}
table.dokum td,table.dokum th{font-size:7.8pt;padding:3px 5px}
table.dokum td:nth-child(-n+3){white-space:nowrap}
table.k2 td:nth-child(3){white-space:normal}
table.k2 td:nth-child(4){min-width:32mm}
tr.grup td{background:#f8f9fc;color:var(--soluk);font-size:8pt;padding-top:6px}
table{table-layout:auto}
td{word-break:normal;overflow-wrap:anywhere}
"""

ARAC = """<div class="fk-arac" style="position:sticky;top:0;z-index:9;display:flex;gap:10px;align-items:center;
 padding:8px 14px;background:#1f3864;color:#fff;font:14px 'Segoe UI',sans-serif">
 <b style="flex:1">{baslik}</b>
 <button onclick="window.print()" style="padding:6px 14px;border:0;border-radius:6px;background:#fff;color:#1f3864;
  font-weight:600;cursor:pointer">🖨 Yazdır / PDF olarak kaydet</button></div>
<style>@media print{{.fk-arac{{display:none!important}}}}</style>"""


def _tablo(basliklar: list[str], satirlar: list[list], sag: set[int] = frozenset(), sinif: dict | None = None,
           cls: str = "") -> str:
    th = "".join(f"<th class='{'s' if i in sag else ''}'>{_e(b)}</th>" for i, b in enumerate(basliklar))
    govde = []
    for r in satirlar:
        tr_cls = (sinif or {}).get(id(r), "")
        govde.append(f"<tr class='{tr_cls}'>" + "".join(
            f"<td class='{'s' if i in sag else ''}'>{v}</td>" for i, v in enumerate(r)) + "</tr>")
    return f"<table class='{cls}'><thead><tr>{th}</tr></thead><tbody>{''.join(govde)}</tbody></table>"


def cikti_html(rapor: dict, muavin: list[MuavinSatiri] | None, buro: dict, firma_klasor_adi: str = "",
               iade: dict | None = None) -> str:
    d = rapor.get("donem", {})
    bas_s, bit_s = d.get("Alış") or d.get("Satış") or [None, None]
    bas = datetime.strptime(bas_s, "%Y-%m-%d").date() if bas_s else date.today().replace(day=1)
    bit = datetime.strptime(bit_s, "%Y-%m-%d").date() if bit_s else date.today()
    donem_ad = f"{AYLAR[bas.month]} {bas.year}" if (bas.year, bas.month) == (bit.year, bit.month) else \
        f"{bas:%d.%m.%Y} – {bit:%d.%m.%Y}"
    firma = rapor.get("firma") or firma_klasor_adi
    parca = []
    buro_ad = buro.get("buro_unvan") or buro.get("ad_soyad") or ""
    parca.append(f"""<div class="ust"><div><h1>KDV KONTROL RAPORU</h1><small>Fatura – muavin karşılaştırması,
 açıklamalı muavin dökümü, KDV ve KDV2 beyannamesi örnekleri</small></div>
 <div style="text-align:right"><b>{_e(buro_ad)}</b><br><small>{_e(buro.get('adres', ''))}<br>{_e(buro.get('telefon', ''))}
 {(' · ' + _e(buro.get('eposta'))) if buro.get('eposta') else ''}</small></div></div>
<div class="kunye">
<div class="genis"><span>Mükellef</span><b>{_e(firma)}</b></div>
<div><span>VKN / TCKN</span>{_e(rapor.get('vkn') or '')}</div>
<div><span>Dönem</span><b>{_e(donem_ad)}</b></div>
<div class="genis"><span>Kontrol aralığı</span>{bas:%d.%m.%Y} – {bit:%d.%m.%Y}</div>
<div><span>Kontrol zamanı</span>{_e((rapor.get('zaman') or '')[:16].replace('T', ' '))}</div>
<div><span>Hazırlanma</span>{datetime.now():%d.%m.%Y %H:%M}</div>
</div>""")

    # 1) Özet
    durumlar = [x for x in rapor.get("durumlar", []) if x["adet"]]
    sorunlu = sum(x["adet"] for x in durumlar if x["sorunlu"])
    uyumlu = sum(x["adet"] for x in durumlar if not x["sorunlu"])
    parca.append("<h2>1. Kontrol özeti</h2>")
    parca.append(f"""<div class=ozet><div><span>Alış faturası</span><b>{rapor.get('alis', 0)}</b></div>
<div><span>Satış faturası</span><b>{rapor.get('satis', 0)}</b></div><div><span>Toplam</span><b>{rapor.get('fatura_sayisi', 0)}</b></div>
<div><span>Uyumlu / bilgi</span><b class=ok>{uyumlu}</b></div>
<div><span>Kontrol edilmeli</span><b class="{'kotu' if sorunlu else 'ok'}">{sorunlu}</b></div></div>""")
    parca.append("<p class=not>Karşılaştırılan hesaplar: " + _e("; ".join(rapor.get("kontroller", []))) +
                 ". Faturadaki KDV ile muavindeki 191 / 391 kaydı belge numarasından eşleştirilmiştir.</p>")
    parca.append(_tablo(["Sonuç", "Adet", "Değerlendirme"],
                        [[_e(x["ad"]), x["adet"], "<span class=kotu>Kontrol edilmeli</span>" if x["sorunlu"]
                          else "<span class=ok>Uyumlu / bilgi</span>"] for x in durumlar], {1}))
    sorunlar = [x for x in rapor.get("sonuclar", []) if x.get("sorunlu")]
    bilgi = [x for x in rapor.get("sonuclar", []) if "muavinde kaydı yok" in x["durum"]]
    if sorunlar:
        parca.append("<h3>Kontrol edilmesi gereken belgeler</h3>")
        parca.append(_tablo(["Yön", "Tarih", "Belge no", "Karşı taraf", "Fatura KDV", "Muavin KDV", "Fark", "Sonuç / açıklama"],
                            [[x["yon"], _tarih(x["tarih"]), _e(x["belge_no"]), _e((x["karsi_taraf"] or "")[:40]),
                              tl(x["fatura_tutari"]), tl(x["muavin_tutari"]), tl(x["fark"]),
                              f"<b>{_e(x['durum'])}</b><div class=kucuk>{_e(x['aciklama'][:160])}</div>"]
                             for x in sorunlar], {4, 5, 6}, cls="dokum"))
    else:
        parca.append("<p class=ok><b>Kontrol edilmesi gereken belge yok.</b></p>")
    fy = rapor.get("faturasi_olmayanlar", [])
    if fy:
        parca.append("<h3>Muavinde olup e-faturası bulunamayan KDV kayıtları</h3>")
        parca.append(_tablo(["Hesap", "Fiş tarihi", "Fiş no", "Belge no", "Ünvan", "Tutar", "Kullanıcı kararı"],
                            [[_e(x["hesap"]), _tarih(x["fis_tarihi"]), _e(x["fis_no"]), _e(x["belge_no"]),
                              _e((x["unvan"] or "")[:40]), tl(x["tutar"]),
                              (f"<span class=ok><b>Uygun</b></span><div class=kucuk>{_e(x['uygun'][:160])}</div>" if x.get("uygun") is not None else "")]
                             for x in fy], {5}, cls="dokum"))
    red = rapor.get("red_iptal") or []
    if red:
        kayitli = [x for x in red if x.get("muavinde")]
        parca.append("<h3>Red / iptal edilmiş faturalar (e-fatura / e-arşiv listeleri)</h3>")
        parca.append(f"<p class=not>{len(red)} fatura red / iptal listesinde; "
                     + (f"<b class=kotu>{len(kayitli)} tanesi muavinde kayıtlı</b> (kayıt iptal edilmeli ya da ters kayıt yapılmalı)"
                        if kayitli else "<b class=ok>hiçbiri muavinde kayıtlı değil</b>") + ".</p>")
        parca.append(_tablo(["Yön", "Tarih", "Belge no", "Karşı taraf", "Matrah", "KDV", "Döviz", "Durum", "Muavin", "Sonuç"],
                            [[_e(x.get("yon") or ""), _tarih(x.get("tarih")), _e(x["belge_no"]), _e((x.get("karsi_taraf") or "")[:40]),
                              tl(x.get("matrah")), tl(x.get("kdv")), _e(x.get("doviz") or ""), _e((x.get("durum") or "")[:60]),
                              (f"<span class=kotu>Kayıtlı</span><div class=kucuk>{_e(x.get('fisler') or '')}</div>" if x.get("muavinde")
                               else "<span class=ok>Kayıt yok</span>"),
                              ("<span class=kotu>Kontrol edilmeli</span>" if x.get("muavinde") else "<span class=ok>Uyumlu</span>")]
                             for x in red], {4, 5}, cls="dokum"))
    kararlar = [x for x in rapor.get("sonuclar", []) if x["durum"] == "Uygun (kullanıcı kararı)"]
    if kararlar:
        parca.append("<h3>Kullanıcı kararıyla uygun kabul edilen belgeler</h3>")
        parca.append(_tablo(["Yön", "Tarih", "Belge no", "Karşı taraf", "Fatura KDV", "Muavin KDV", "Açıklama"],
                            [[x["yon"], _tarih(x["tarih"]), _e(x["belge_no"]), _e((x["karsi_taraf"] or "")[:40]),
                              tl(x["fatura_tutari"]), tl(x["muavin_tutari"]), _e(x["aciklama"][:220])] for x in kararlar], {4, 5}, cls="dokum"))
    if bilgi:
        parca.append("<h3>Bilgi: muavinde kaydı olmayan istisna / ihracat faturaları (KDV yok – uyumlu)</h3>")
        parca.append(_tablo(["Yön", "Tarih", "Belge no", "Karşı taraf", "Fatura tipi"],
                            [[x["yon"], _tarih(x["tarih"]), _e(x["belge_no"]), _e((x["karsi_taraf"] or "")[:40]),
                              _e((x.get("fatura_tipi") or "")[:70])] for x in bilgi], cls="dokum"))
    for u in rapor.get("uyarilar", []):
        parca.append(f"<div class=uyari>{_e(u[:300])}</div>")

    # 2) Açıklamalı muavin dökümü + 3) beyanname
    if muavin:
        hesaplar, satirlar = muavin_dokumu(muavin, bas, bit, rapor)
        parca.append("<h2 class=yeni>2. Açıklamalı muavin dökümü (KDV hesapları)</h2>")
        parca.append("<p class=not>Bakiye: borç (+) / alacak (−). Açılış: dönem başından önceki kayıtların toplamı.</p>")
        govde, grup = [], None
        for o in hesaplar:
            g = next((k for k, _ in ACIKLAMALAR if o["kod"].startswith(k)), o["kod"][:3])
            if g != grup:
                grup = g
                govde.append(f"<tr class=grup><td colspan=5><b>{_e(g)}</b> · {_e(o['aciklama'])}</td></tr>")
            govde.append(f"<tr><td><b>{_e(o['kod'])}</b> {_e(o['ad'][:45])}</td><td class=s>{tl(o['acilis'], '0,00')}</td>"
                         f"<td class=s>{tl(o['borc'], '—')}</td><td class=s>{tl(o['alacak'], '—')}</td>"
                         f"<td class=s><b>{tl(o['kapanis'], '0,00')}</b></td></tr>")
        parca.append("<table><thead><tr><th>Hesap</th><th class=s>Açılış</th><th class=s>Dönem borç</th>"
                     "<th class=s>Dönem alacak</th><th class=s>Kapanış</th></tr></thead><tbody>"
                     + "".join(govde) + "</tbody></table>")
        onceki = None
        for s, kontrol in satirlar:
            if s.hesap_kodu != onceki:
                if onceki is not None:
                    parca.append("</tbody></table>")
                onceki = s.hesap_kodu
                parca.append(f"<h3>{_e(s.hesap_kodu)} {_e(s.hesap_adi)}</h3><table class=dokum><thead><tr><th>Tarih</th>"
                             "<th>Fiş</th><th>Belge no</th><th>Açıklama</th><th class=s>Borç</th>"
                             "<th class=s>Alacak</th><th>Fatura kontrolü</th></tr></thead><tbody>")
            k_cls = "ok" if ("uyumlu" in kontrol.lower() or kontrol == "Uyumlu") else \
                ("kotu" if kontrol not in ("—", "KDV tahakkuk / mahsup fişi") and "dışı" not in kontrol
                 and "KDV'siz" not in kontrol else "")
            parca.append(f"<tr><td>{s.fis_tarihi:%d.%m.%Y}</td><td>{_e(s.fis_no)}</td><td>{_e(s.belge_no or '')}</td>"
                         f"<td class=kucuk>{_e((s.unvan or s.aciklama)[:55])}</td><td class=s>{tl(s.borc, '')}</td>"
                         f"<td class=s>{tl(s.alacak, '')}</td><td class='kucuk {k_cls}'>{_e(kontrol)}</td></tr>")
        if onceki is not None:
            parca.append("</tbody></table>")
        parca.append(_beyan_html(kdv_beyani(muavin, bas, bit, rapor.get("faturalar"), iade), firma, rapor.get("vkn"), donem_ad, buro))
        k2 = kdv2_beyani(muavin, bas, bit, rapor.get("tevkifatlar"))
        if k2.satirlar or k2.muavinde_yok:
            parca.append(_kdv2_html(k2, firma, rapor.get("vkn"), donem_ad))
    else:
        parca.append("<div class=uyari>Bu dönemin muavin dosyası bulunamadı; muavin dökümü ve KDV beyannamesi "
                     "örneği hazırlanamadı. 'Sadece muavin' ile muavini indirip tekrar deneyin.</div>")

    parca.append("""<div class="imza"><div>Hazırlayan<br><br><br></div><div>Kontrol eden<br><br><br></div>
<div>Mükellef / onay<br><br><br></div></div>""")
    baslik = f"{firma} – {donem_ad} KDV kontrol raporu"
    return (f"<!doctype html><html lang=tr><head><meta charset=utf-8><title>{_e(baslik)}</title><style>{STIL}</style>"
            f"</head><body>{ARAC.format(baslik=_e(baslik))}<div class=sayfa>{''.join(parca)}</div></body></html>")


def _tarih(s) -> str:
    try:
        return datetime.strptime(s, "%Y-%m-%d").strftime("%d.%m.%Y")
    except (TypeError, ValueError):
        return _e(s or "")


def _kart(baslik: str, govde: str, genis: bool = False) -> str:
    return f"<section class='kart{' genis' if genis else ''}'><h4>{baslik}</h4>{govde}</section>"


def _satirlar(liste: list[tuple]) -> str:
    """[(etiket, tutar, vurgu?)] → iki sütunlu sade liste"""
    return "<dl class=liste>" + "".join(
        f"<div class='{'vurgu' if len(x) > 2 and x[2] else ''}'><dt>{x[0]}</dt><dd>{x[1]}</dd></div>" for x in liste) + "</dl>"


def _beyan_html(b: Beyan, firma: str, vkn: str | None, donem_ad: str, buro: dict | None = None) -> str:
    buro = buro or {}
    tahsil = b.odenecek
    p = [f"""<h2 class=yeni>3. KDV beyannamesi örneği (KDV1)</h2>
<div class=beyan-ust><div><div class=kucuk>Katma Değer Vergisi Beyannamesi · Gerçek usul · Aylık</div>
<b>{_e(firma)}</b><div class=kucuk>VKN {_e(vkn or '')} · Dönem: {_e(donem_ad)}
{(' · Düzenleyen: ' + _e(buro.get('ad_soyad') or buro.get('buro_unvan'))) if (buro.get('ad_soyad') or buro.get('buro_unvan')) else ''}</div></div>
<span class=taslak>TASLAK · muavin kayıtlarından</span></div>
{_iade_sorusu(b)}
<div class=kpi>
 <div><span>Toplam KDV</span><b>{tl(b.toplam_hesaplanan, '0,00')}</b></div>
 <div><span>İndirimler toplamı</span><b>{tl(b.indirimler_toplami, '0,00')}</b></div>
 <div class='{'kirmizi' if tahsil else ''}'><span>Ödenmesi gereken</span><b>{tl(tahsil, '0,00')}</b></div>
 <div class=mavi><span>Sonraki döneme devreden</span><b>{tl(b.sonraki_doneme, '0,00')}</b></div>
</div><div class=izgara>"""]
    p.append(_kart("Matrah", _satirlar([
        ("Toplam matrah", tl(b.toplam_matrah, "0,00")),
        ("Hesaplanan KDV", tl(b.hesaplanan, "0,00")),
        ("Daha önce indirim konusu yapılan KDV'nin ilavesi", tl(b.ilave_toplam, "0,00")),
        ("Toplam KDV", tl(b.toplam_hesaplanan, "0,00"), True)])))
    p.append(_kart("Sonuç hesapları", _satirlar([
        ("Tecil edilecek KDV", "0,00"),
        ("Ödenmesi gereken KDV", tl(b.odenecek, "0,00"), bool(b.odenecek)),
        ("İade edilmesi gereken KDV", tl(b.iade_edilmesi_gereken, "0,00")),
        ("Sonraki döneme devreden KDV", tl(b.sonraki_doneme, "0,00"), True)])))
    p.append(_kart("İndirimler", _satirlar(
        [("Önceki dönemden devreden KDV <span class=kucuk>(190 bakiyesi)</span>", tl(b.devreden, "0,00"))] +
        [(k, tl(v, "0,00")) for k, v in _grupla(b.indirimler).items()] +
        [("İndirimler toplamı", tl(b.indirimler_toplami, "0,00"), True)])))
    p.append(_kart("İstisnalar – iade hakkı doğuran işlemler", _satirlar(
        [(_e(x.ad), tl(x.matrah, "0,00")) for x in b.istisnalar] or [("İstisna kapsamında işlem yok", "0,00")]) +
        _satirlar([("İade edilebilir KDV" + (" <span class=kucuk>(iade talebi yok)</span>" if b.iade_cevap == "hayir"
                     else " <span class=kucuk>(tahakkuk fişi 136)</span>" if b.iade_cevap is None and b.iade_edilebilir
                     else " <span class=kucuk>(cevaplanmadı)</span>" if b.iade_cevap is None else ""),
                     tl(b.iade_edilebilir or SIFIR, "0,00"))])))
    p.append("</div>")

    # Detaylar
    det = []
    if b.teslimler or b.kismi_tevkifat:
        det.append(_tablo(["Matrah detayı – işlem türü", "Matrah", "Oran %", "Vergi"],
                          [[_e(x.ad) + f"<div class=kucuk>{_e(x.not_)}</div>", tl(x.matrah), _e(x.oran), tl(x.vergi)]
                           for x in b.teslimler + b.kismi_tevkifat] +
                          [["<b>Toplam</b>", f"<b>{tl(b.toplam_matrah)}</b>", "", f"<b>{tl(b.hesaplanan)}</b>"]],
                          {1, 2, 3}))
    if b.ilave:
        det.append(_tablo(["İlave edilecek KDV", "Vergi"], [[_e(x.ad), tl(x.vergi)] for x in b.ilave], {1}))
    oranli = [x for x in b.indirimler if x.oran]
    if oranli:
        det.append(_tablo(["Bu döneme ait indirilecek KDV – oranlara göre", "Oran %", "Mal ve hizmet bedeli", "KDV"],
                          [[_e(x.ad) + f"<div class=kucuk>{_e(x.not_)}</div>", _e(x.oran), tl(x.matrah), tl(x.vergi)]
                           for x in oranli] +
                          [["<b>Toplam</b>", "", "", f"<b>{tl(sum((x.vergi for x in oranli), SIFIR))}</b>"]], {1, 2, 3}))
    if b.efatura_istisna:
        det.append(_tablo(["E-faturalara göre istisnalı satışlar (kontrol)", "Adet", "Tutar"],
                          [[_e(k), a, tl(t)] for k, a, t in b.efatura_istisna], {1, 2}))
    det.append(_tablo(["Diğer bilgiler", "Tutar"], [
        ["Teslim ve hizmetlerin karşılığını teşkil eden bedel (aylık)", tl(b.aylik_bedel, "0,00")],
        ["Teslim ve hizmetlerin karşılığını teşkil eden bedel (kümülatif, yaklaşık)", tl(b.kumulatif_bedel, "0,00")],
    ] + ([["KDV2 – sorumlu sıfatıyla bu dönem tahakkuk eden tevkifat (360)", tl(b.kdv2)]] if b.kdv2 else []), {1}))
    p.append("<div class=detay>" + "".join(det) + "</div>")

    if b.tahakkuk:
        t = b.tahakkuk

        def fark(a, c):
            f = (a - c).quantize(Decimal("0.01"))
            return f"<span class={'ok' if abs(f) < 1 else 'kotu'}>{tl(f, '0,00')}</span>"
        p.append(f"<h3>Muavindeki KDV tahakkuk fişi ile karşılaştırma <span class=kucuk>({_e(t['fisler'])})</span></h3>")
        p.append(_tablo(["Kalem", "Taslak", "Tahakkuk fişi", "Fark"], [
            ["Toplam KDV (391 kapanışı)", tl(b.toplam_hesaplanan), tl(t["hesaplanan"]), fark(b.toplam_hesaplanan, t["hesaplanan"])],
            ["Bu döneme ait indirimler (191 kapanışı)", tl(b.bu_donem_indirim), tl(t["indirilecek"]), fark(b.bu_donem_indirim, t["indirilecek"])],
            ["İade edilebilir KDV (136)", tl(b.iade_edilmesi_gereken), tl(t["iade"]), fark(b.iade_edilmesi_gereken, t["iade"])],
            ["Ödenecek KDV (360)", tl(b.odenecek), tl(t["odenecek"]), fark(b.odenecek, t["odenecek"])],
        ], {1, 2, 3}))
    for n in b.notlar:
        p.append(f"<p class=not>• {_e(n)}</p>")
    return "".join(p)


def _tr_sayi(x) -> Decimal:
    """'388.962,53' / '388962,53' / '388962.53' → Decimal"""
    t = str(x or "").strip().replace(" ", "")
    if "," in t:
        t = t.replace(".", "").replace(",", ".")
    try:
        return Decimal(t or "0")
    except Exception:
        return SIFIR


def _iade_sorusu(b: Beyan) -> str:
    """Ekranda (yazdırılmaz): iade talebi olacak mı? Cevap dönem klasörüne kaydedilir, taslak buna göre yenilenir."""
    if not b.istisnalar:
        return ""
    varsayilan = b.iade_edilebilir if b.iade_cevap == "evet" else (b.iade_onerisi or "")
    deger = f"{varsayilan:.2f}".replace(".", ",") if varsayilan != "" else ""
    durum = {"evet": f"Cevap: <b>Evet</b> – iade talep edilecek KDV {tl(b.iade_edilebilir)} TL",
             "hayir": "Cevap: <b>Hayır</b> – iade talebi yok, tümü sonraki döneme devrediyor"}.get(
        b.iade_cevap, "<b>Bu soruyu cevaplayın</b> – iade edilebilir KDV muavinden kesin olarak bilinemez"
        + (f" (tahakkuk fişinde 136'ya {tl(b.iade_onerisi)} TL alınmış)" if b.iade_onerisi else ""))
    return f"""<form class="iade-soru ekran" method=get onsubmit="if(this.cevap.value==='evet'&&!this.tutar.value){{alert('Tutarı girin');return false}}">
<input type=hidden name=id value="">
<div><b>Bu dönem için KDV iade talebiniz olacak mı?</b> <span class=kucuk>(ihracat / istisna – yüklenilen KDV)</span>
<div class=kucuk>{durum}</div></div>
<label><input type=radio name=cevap value=hayir {'checked' if b.iade_cevap == 'hayir' else ''}> Hayır</label>
<label><input type=radio name=cevap value=evet {'checked' if b.iade_cevap == 'evet' else ''}> Evet, tutar:</label>
<input name=tutar inputmode=decimal placeholder="0,00" value="{deger}" style="width:120px;text-align:right">
<button type=submit>Uygula</button>
<script>document.currentScript.parentElement.querySelector('[name=id]').value = new URLSearchParams(location.search).get('id') || '';</script>
</form>"""


def _grupla(satirlar: list[BeyanSatiri]) -> dict[str, Decimal]:
    g: dict[str, Decimal] = {}
    for x in satirlar:
        g[x.ad] = g.get(x.ad, SIFIR) + (x.vergi or SIFIR)
    return g
