"""Fatura <-> muavin eşleştirme motoru."""
from __future__ import annotations

import re

from collections import defaultdict
from dataclasses import dataclass, field
from typing import Callable
from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from .fatura_okuyucu import Fatura
from .muavin_okuyucu import MuavinSatiri

SIFIR = Decimal("0")

# Durumlar (rapordaki sıralama ve renkler için sabit)
UYUMLU = "Uyumlu"
MUAVINDE_YOK = "Muavinde yok"
TUTAR_FARKI = "Tutar farkı"
ORAN_HATASI = "Yanlış KDV oranı hesabı"
MUKERRER = "Mükerrer kayıt"
BELGE_NO_SUPHELI = "Belge no farklı yazılmış olabilir"
DONEM_FARKI = "Sonraki dönemde kayıtlı"
ERKEN_KAYIT = "Fatura tarihinden önce kaydedilmiş"
DONEM_DISI = "Dönem dışı fatura (henüz kayıtsız)"
KDVSIZ = "KDV'siz fatura (kontrol dışı)"
KURUS_FARKI = "Küçük fark (≤1 TL)"
FATURASI_YOK = "Faturası bulunamadı"
DOVIZLI = "Dövizli fatura (kontrol dışı)"
DOVIZ_TL_UYUMLU = "Dövizli fatura (TL karşılığı) – uyumlu"
IHRACKAYITLI_UYUMLU = "İhraç kayıtlı (KDV tahsil edilmedi) – uyumlu"
ISTISNA_UYUMLU = "İstisna (KDV yok) – uyumlu"
ISTISNA_KAYITSIZ = "İstisna / ihracat (KDV yok) – muavinde kaydı yok, uyumlu"
KAYDEDILMEYECEK = "Kaydedilmeyecek (kullanıcı kararı)"
UYGUN_KULLANICI = "Uygun (kullanıcı kararı)"
KONAKLAMA_UYUMLU = "Konaklama vergili – uyumlu"
KONAKLAMA_FARK = "Konaklama vergili – fark"
IADE_610_UYUMLU = "İade (satış faturasıyla, 610) – uyumlu"
BELGE_NO_YAKIN = "Belge no farklı yazılmış (tutar ve tarih tutuyor) – uyumlu"
RED_KAYITSIZ = "Red / iptal – muavinde kaydı yok, uyumlu"
RED_KAYITLI = "Red / iptal edilmiş fatura muavinde kayıtlı"
TIP_ADLARI = {"SATIS": "Satış", "IADE": "İade", "TEVKIFAT": "Tevkifatlı", "ISTISNA": "İstisna",
              "IHRACKAYITLI": "İhraç kayıtlı", "OZELMATRAH": "Özel matrah", "SGK": "SGK",
              "KOMISYONCU": "Komisyoncu", "TEVKIFATIADE": "Tevkifat iade", "KONAKLAMAVERGISI": "Konaklama vergisi",
              "SERBESTMESLEK": "Serbest meslek makbuzu", "TEKNOLOJIDESTEK": "Teknoloji destek"}
BINEK_UYUMLU = "Binek araç (%70 KDV) – uyumlu"
BINEK_FARK = "Binek araç (%70 KDV) – fark"
BINEK_ORAN = Decimal("0.70")         # binek araç giderlerinde KDV'nin indirilebilen kısmı
TUM_DURUMLAR = [BELGE_NO_YAKIN, KONAKLAMA_UYUMLU, KONAKLAMA_FARK, IADE_610_UYUMLU, RED_KAYITSIZ, RED_KAYITLI, KAYDEDILMEYECEK, UYGUN_KULLANICI, UYUMLU, BINEK_UYUMLU, DOVIZ_TL_UYUMLU, IHRACKAYITLI_UYUMLU, ISTISNA_UYUMLU, ISTISNA_KAYITSIZ, KDVSIZ, DOVIZLI, DONEM_DISI, KURUS_FARKI, DONEM_FARKI, ERKEN_KAYIT, TUTAR_FARKI,
                ORAN_HATASI, MUKERRER, BELGE_NO_SUPHELI, MUAVINDE_YOK, FATURASI_YOK, BINEK_FARK]
BILGI_DURUMLARI = {BELGE_NO_YAKIN, KONAKLAMA_UYUMLU, IADE_610_UYUMLU, RED_KAYITSIZ, KAYDEDILMEYECEK, UYGUN_KULLANICI, UYUMLU, BINEK_UYUMLU, DOVIZ_TL_UYUMLU, IHRACKAYITLI_UYUMLU, ISTISNA_UYUMLU, ISTISNA_KAYITSIZ, KDVSIZ, DOVIZLI, DONEM_DISI, KURUS_FARKI}
KUCUK_FARK = Decimal("1.00")


def fatura_anahtari(f) -> str:
    """Faturanın kalıcı kimliği (ETTN; yoksa belge no + karşı VKN)."""
    return (f.ettn or "").lower() or f"{f.belge_no}|{f.karsi_vkn}"


def haric_uygula(rapor: "Rapor", haric) -> int:
    """Kullanıcının "kaydedilmeyecek" dediği faturalar muavinde yoksa eksik sayılmaz."""
    n = 0
    for s in rapor.sonuclar:
        if s.durum in (MUAVINDE_YOK, ISTISNA_KAYITSIZ, DONEM_DISI) and fatura_anahtari(s.fatura) in haric:
            s.durum = KAYDEDILMEYECEK
            h = haric.get(fatura_anahtari(s.fatura)) if isinstance(haric, dict) else None
            acik = (h or {}).get("aciklama") if isinstance(h, dict) else None
            s.aciklama = f"Kaydedilmeyecek (kullanıcı kararı): {acik}" if acik else "Kaydedilmeyecek olarak işaretlendi (MuhaWin → Faturaları Luca'ya kaydet)"
            n += 1
    return n


# ---- "Kaydedilmeyecek" kuralları (işletme / serbest meslekte şahsi faturalar: ev elektriği, su, telefon…)
KURAL_ALANLARI = {"icerik": "Fatura içeriğinde geçen", "vkn": "Karşı taraf VKN / TCKN", "unvan": "Karşı taraf ünvanında geçen"}


def _kural_metni(s: str) -> str:
    return re.sub(r"\s+", " ", _buyuk(s or "")).strip()


def kural_eslesir(f, k: dict) -> bool:
    ifade = _kural_metni(k.get("ifade", ""))
    if len(ifade) < 3 or (k.get("yon") not in (None, "", "*") and k.get("yon") != f.yon):
        return False
    alan = k.get("alan") or "icerik"
    if alan == "vkn":
        return re.sub(r"\D", "", ifade) == re.sub(r"\D", "", f.karsi_vkn or "") != ""
    if alan == "unvan":
        return ifade in _kural_metni(f.karsi_unvan)
    metin = _kural_metni(" ".join([f.karsi_unvan or "", f.belge_no or "", *(f.kalemler or []), *(getattr(f, "notlar", None) or []),
                                   getattr(f, "metin", "") or ""]))
    if re.fullmatch(r"[0-9][0-9 .-]*", ifade):          # abone / tesisat no: boşluk-tire farkı önemsiz, başka sayının parçası değil
        rakam = re.sub(r"[ .-]", "", ifade)
        return len(rakam) >= 4 and re.search(rf"(?<!\d){re.escape(rakam)}(?!\d)", re.sub(r"(?<=\d)[ .-](?=\d)", "", metin)) is not None
    return ifade in metin


def haric_kurali(f, kurallar) -> dict | None:
    return next((k for k in kurallar or [] if kural_eslesir(f, k)), None)


def haric_kurallari_uygula(rapor: "Rapor", kurallar) -> int:
    """Kurala uyan faturalar muavinde yoksa eksik sayılmaz: "Kaydedilmeyecek" olur (her ay kendiliğinden)."""
    if not kurallar:
        return 0
    n = 0
    for s in rapor.sonuclar:
        if s.durum in (MUAVINDE_YOK, ISTISNA_KAYITSIZ, DONEM_DISI):
            k = haric_kurali(s.fatura, kurallar)
            if k:
                s.durum = KAYDEDILMEYECEK
                s.aciklama = f"Kaydedilmeyecek kuralı: {KURAL_ALANLARI.get(k.get('alan'), '')} \"{k.get('ifade', '')}\"" + \
                             (f" — {k['aciklama']}" if k.get("aciklama") else "")
                n += 1
    return n


def fis_anahtari(s) -> str:
    """Faturası bulunamayan muavin satırının kalıcı kimliği."""
    return f"FIS|{s.fis_no}|{s.fis_tarihi.isoformat() if s.fis_tarihi else ''}|{s.belge_no or ''}|{s.hesap_kodu}"


def uygun_uygula(rapor: "Rapor", uygun: dict) -> int:
    """Kullanıcının açıklama yazarak "uygun" kabul ettiği sorunlu sonuçlar ve faturası bulunamayan kayıtlar."""
    if not uygun:
        return 0
    n = 0
    for s in rapor.sonuclar:
        u = uygun.get(fatura_anahtari(s.fatura))
        if u and s.durum not in BILGI_DURUMLARI:
            s.aciklama = f"Kullanıcı kararı: {u.get('aciklama', '')} (önceki sonuç: {s.durum})"
            s.durum = UYGUN_KULLANICI
            n += 1
    for s in rapor.faturasi_olmayanlar:
        u = uygun.get(fis_anahtari(s))
        if u:
            s.uygun = u.get("aciklama", "")       # JSON'da işaretlenir; sayımda eksik sayılmaz
            n += 1
    return n


def ihrac_kayitli(f) -> bool:
    return (f.tip or "").upper() == "IHRACKAYITLI" or bool(re.match(r"70\d", getattr(f, "istisna", "") or ""))


def istisnali(f) -> bool:
    kod = getattr(f, "istisna", "") or ""
    if kod.startswith("351"):                 # GİB 351 = "İstisna olmayan diğer" → istisna değil
        return False
    return (f.tip or "").upper() in ("ISTISNA", "IHRACKAYITLI") or (f.profil or "").upper() == "IHRACAT" or bool(kod)


def fatura_tipi(f) -> str:
    """Rapor için: 'İhraç kayıtlı · 701 - ...', 'İstisna · 301 - Mal ihracatı', 'Satış' ..."""
    tip = TIP_ADLARI.get((f.tip or "").upper(), f.tip or "")
    if (f.tip or "").upper() == "TEVKIFAT" or getattr(f, "tevkifat", 0):
        tip = "Tevkifatlı satış" if getattr(f, "yon", "") == "SATIS" else "Tevkifatlı alış"
    if (f.profil or "").upper() == "IHRACAT":
        tip = f"İhracat ({tip})" if tip else "İhracat"
    return " · ".join(x for x in (tip, getattr(f, "istisna", "")) if x)


def _kdvsiz_durum(f):
    if istisnali(f):
        return ISTISNA_UYUMLU, f"KDV'siz {fatura_tipi(f)} – istisna kapsamında, KDV beklenmez"
    return KDVSIZ, f"KDV tutarı sıfır ({fatura_tipi(f) or f.tip}); KDV hesabına kayıt beklenmez"


def _buyuk(x: str) -> str:
    return x.replace("i", "İ").replace("ı", "I").upper()


@dataclass(frozen=True)
class Kontrol:
    ad: str
    yon: str
    secici: Callable[[MuavinSatiri], bool]   # hangi muavin satırları bu kontrole girer
    alan: str                                # Fatura üzerindeki beklenen tutar alanı
    oran_alani: str | None = None            # oran bazlı kontrol için Fatura sözlüğü
    fis_bazli: bool = False                  # faturanın fişindeki tüm satırlar
    aciklama: str = ""
    haric_tipler: tuple[str, ...] = ()       # bu fatura tiplerinde kontrol yapılmaz
    taraf: str | None = None                 # verilirse tutar bu taraftan: 'borc' (borç − alacak) / 'alacak' (alacak − borç)


KONTROLLER = [
    Kontrol("KDV", "ALIS", lambda s: s.hesap_kodu.startswith("191"), "kdv_toplam",
            "kdv_oranlari", aciklama="191 İndirilecek KDV"),
    Kontrol("KDV", "SATIS", lambda s: s.hesap_kodu.startswith("391"), "kdv_toplam",
            "kdv_oranlari", aciklama="391 Hesaplanan KDV"),
    # Alış matrahı: hesap planından bağımsız olsun diye adında "MATRAH" geçen hesaplar
    # (ör. 790.20 Atlas-Gib Alış Matrahı %20)
    Kontrol("Matrah", "ALIS", lambda s: "MATRAH" in _buyuk(s.hesap_adi) and not s.hesap_kodu.startswith("191"),
            "matrah", "matrah_oranlari", aciklama="adında 'Matrah' geçen hesaplar",
            haric_tipler=("IADE",)),
    Kontrol("Matrah", "SATIS", lambda s: s.hesap_kodu[:3] in ("600", "601", "602"), "matrah",
            aciklama="600-602 Satışlar",
            haric_tipler=("IADE",)),   # iade faturası 150/153/7xx'e alacak yazılır
    # Fiş toplamı: faturanın kaydedildiği fişte karşı taraf (alışta alacak, satışta borç)
    # toplamı = faturanın ödenecek tutarı. Cari hesap 320, 309, 102, 331 ... olabilir.
    Kontrol("Fiş toplamı", "ALIS", lambda s: True, "vergiler_dahil", fis_bazli=True,
            aciklama="fişteki alacak toplamı (320/309/102/331 vb.)"),
    Kontrol("Fiş toplamı", "SATIS", lambda s: True, "vergiler_dahil", fis_bazli=True,
            aciklama="fişteki borç toplamı (120/108/100 vb.)"),
]


KOMISYONCU_KONTROLLER = [
    Kontrol("KDV", "ALIS", lambda s: s.hesap_kodu.startswith("391"), "kdv_toplam", "kdv_oranlari",
            aciklama="391 Hesaplanan KDV (komisyoncu faturasındaki mal satışı)"),
    Kontrol("KDV", "ALIS", lambda s: s.hesap_kodu.startswith("191"), "masraf_kdv", "masraf_kdv_oranlari",
            aciklama="191 İndirilecek KDV (komisyon / masraf KDV'si)"),
]


# Firma denetimi (Mikro Denetim): KDV + matrah (gelir / gider hesapları) + cari (faturanın ödenecek tutarı)
_GIDER_ON = ("15", "25", "26", "62", "63", "65", "66", "68", "69", "7")
_GELIR_ON = ("60", "64", "67")
_CARI_ON = ("100", "101", "102", "103", "108", "120", "121", "126", "127", "131", "136", "159", "195",
            "300", "309", "320", "321", "326", "329", "331", "336", "340", "431")


def _gider_mi(s: MuavinSatiri) -> bool:
    return (s.hesap_kodu.startswith(_GIDER_ON) or "MATRAH" in _buyuk(s.hesap_adi)) and not s.hesap_kodu.startswith(("191", "391"))


DENETIM_KONTROLLER = [
    KONTROLLER[0], KONTROLLER[1],
    Kontrol("Matrah", "ALIS", _gider_mi, "matrah", aciklama="gider / stok / duran varlık hesapları (15x, 25x, 26x, 6xx gider, 7xx; binek KKEG dahil)",
            haric_tipler=("IADE",), taraf="borc"),
    Kontrol("Matrah", "SATIS", lambda s: s.hesap_kodu.startswith(_GELIR_ON), "matrah", aciklama="gelir hesapları (60x, 64x, 67x)",
            haric_tipler=("IADE",), taraf="alacak"),
    Kontrol("Cari", "ALIS", lambda s: s.hesap_kodu.startswith(_CARI_ON), "odenecek",
            aciklama="cari / ödeme hesapları alacağı (320, 329, 336, 100, 102, 300 …)", taraf="alacak"),
    Kontrol("Cari", "SATIS", lambda s: s.hesap_kodu.startswith(_CARI_ON), "odenecek",
            aciklama="cari / tahsilat hesapları borcu (120, 121, 100, 102, 108 …)", taraf="borc"),
]


# Şimdilik yalnız KDV (191 / 391) karşılaştırılır. Matrah ve fiş toplamı kontrolleri kodda duruyor;
# yeniden açmak için buraya eklemek yeterli: ("KDV", "Matrah", "Fiş toplamı")
AKTIF_KONTROLLER: tuple[str, ...] = ("KDV",)


@dataclass
class Sonuc:
    fatura: Fatura
    kontrol: str
    durum: str
    fatura_tutari: Decimal
    muavin_tutari: Decimal
    satirlar: list[MuavinSatiri] = field(default_factory=list)
    aciklama: str = ""

    @property
    def fark(self) -> Decimal:
        return self.muavin_tutari - self.fatura_tutari


@dataclass
class Rapor:
    sonuclar: list[Sonuc]
    faturasi_olmayanlar: list[MuavinSatiri]
    fatura_disi: list[MuavinSatiri]
    donem: dict[str, tuple[date, date]]
    calisan_kontroller: list[str]
    red_iptal: list = field(default_factory=list)      # Mikro red / iptal listelerindeki faturalar ve muavin durumu


def esle(faturalar: list[Fatura], muavin: list[MuavinSatiri],
         tolerans: Decimal = Decimal("0.05"),
         donem: tuple[date, date] | None = None,
         kontroller: tuple[str, ...] | None = None, kontrol_listesi: list[Kontrol] | None = None,
         red: dict | None = None) -> Rapor:
    belge_index: dict[str, list[MuavinSatiri]] = defaultdict(list)
    fis_index: dict[tuple, list[MuavinSatiri]] = defaultdict(list)
    kisa_index: dict[tuple, list[MuavinSatiri]] = defaultdict(list)
    for s in muavin:
        if s.belge_no:
            belge_index[s.belge_no].append(s)
        fis_index[(s.fis_no, s.fis_tarihi)].append(s)
        for k_ in muavin_kisa_anahtarlar(s):
            kisa_index[k_].append(s)
    reddedilen_tum: set[int] = set()     # aynı no'lu ama başka firmaya / aya ait (eşleştirilmeyen) kayıtlar

    yonler = {f.yon for f in faturalar}
    tam_muavin = any(s.hesap_kodu[0] in "13" and s.hesap_kodu[:3] not in ("191", "391")
                     for s in muavin)
    adlar = kontroller or AKTIF_KONTROLLER
    aktif = [k for k in (kontrol_listesi or KONTROLLER) if (kontrol_listesi or k.ad in adlar) and k.yon in yonler
             and (tam_muavin if k.fis_bazli else any(k.secici(s) for s in muavin))]

    # Dönem: verilmediyse her yön için yüklenen faturaların tarih aralığı
    donemler: dict[str, tuple[date, date]] = {}
    for yon in ("ALIS", "SATIS"):
        tarihler = [f.tarih for f in faturalar if f.yon == yon]
        if donem:
            donemler[yon] = donem
        elif tarihler:
            donemler[yon] = (min(tarihler), max(tarihler))

    sonuclar: list[Sonuc] = []
    kisa_notlar: dict[int, str] = {}
    yakinlar: dict[int, str] = {}
    fatura_nolari_u = {f.belge_no.upper() for f in faturalar}
    kullanilan: set[int] = set()

    for f in faturalar:
        adaylar_b = belge_index.get(f.belge_no, [])
        kisa_not = ""
        fk_ = fatura_kisa(f.belge_no)
        if not adaylar_b and fk_:            # muavinde evrak no kısa yazılmış olabilir (AAA-889)
            adaylar_b = kisa_index.get(fk_, []) + kisa_index.get((fk_[0], None, fk_[2]), [])
            if adaylar_b:
                ornek = next((x.belge_no or x.aciklama for x in adaylar_b), "")
                kisa_not = f"Muavinde evrak no kısa/farklı yazılmış: '{ornek}' (fatura {f.belge_no})"
        yakin_ = None
        if not adaylar_b:                     # tek karakter farklı belge no (LIL ↔ LII): tutar ve tarih tutuyorsa
            yakin_ = _yakin_belge(f, belge_index, fatura_nolari_u, tolerans)
            if yakin_:
                adaylar_b = belge_index[yakin_]
                yakinlar[id(f)] = yakin_
        satirlar, reddedilen = _faturanin_satirlari(f, adaylar_b, fis_index)
        if yakin_ and not satirlar:           # ayın / carinin dışında kaldıysa bile: tutar + tarih tuttuğu için kabul
            satirlar, reddedilen = list(adaylar_b), []
        if kisa_not and satirlar and _cari_uyar(f, [x for k_ in {(y.fis_no, y.fis_tarihi) for y in satirlar} for x in fis_index.get(k_, [])]) is False:
            reddedilen, satirlar, kisa_not = reddedilen + satirlar, [], ""      # kısa no başka cariye ait
        if kisa_not and satirlar:
            kisa_notlar[id(f)] = kisa_not
        reddedilen_tum.update(id(s) for s in reddedilen)
        if getattr(f, "doviz", None) and not getattr(f, "tl_kaynak", None) and f.kdv_toplam:   # TL karşılığı/kur yok
            sonuclar.append(Sonuc(f, "Kayıt", DOVIZLI, SIFIR, SIFIR, satirlar,
                                  f"{f.doviz} cinsinden fatura; faturada TL tutar ya da kur yok, karşılaştırılmadı"))
            kullanilan.update(id(s) for s in satirlar)
            continue
        kontroller = [k for k in aktif if k.yon == f.yon and f.tip not in k.haric_tipler]
        if getattr(f, "komisyoncu", False) and f.yon == "ALIS" and any(k.ad == "KDV" for k in kontroller):
            # komisyoncu faturası: mal bedelinin KDV'si mal sahibinin SATIŞ KDV'sidir (391); komisyon / masraf KDV'leri 191
            kontroller = KOMISYONCU_KONTROLLER
        if not kontroller:
            continue
        donem_ici = f.yon in donemler and donemler[f.yon][0] <= f.tarih <= donemler[f.yon][1]

        if not satirlar:
            ana = next((k for k in kontroller if not k.fis_bazli), kontroller[0])
            beklenen = getattr(f, ana.alan)
            if f.kdv_toplam == 0 and all(k.ad == "KDV" for k in kontroller) and not tam_muavin:
                d, a = _kdvsiz_durum(f)
                sonuclar.append(Sonuc(f, "Kayıt", d, beklenen, SIFIR, [], a))
            elif not donem_ici:
                sonuclar.append(Sonuc(f, "Kayıt", DONEM_DISI, beklenen, SIFIR, [],
                                      "Fatura kontrol aralığının dışında; kayıt sonraki dönemde beklenir"))
            elif fk_ and (aday := _kisa_no_adayi(f, fk_, kisa_index, belge_index, ana, beklenen, tolerans)):
                sonuclar.append(Sonuc(f, ana.ad, BELGE_NO_SUPHELI, beklenen, aday.net, [aday],
                                      f"Muavinde '{aday.belge_no or aday.aciklama}' olarak (sıra no'da yazım hatasıyla) kayıtlı olabilir"))
                kullanilan.add(id(aday))
            elif (aday := _belge_no_adayi(f, muavin, ana, beklenen, tolerans)):
                sonuclar.append(Sonuc(f, ana.ad, BELGE_NO_SUPHELI, beklenen, aday.net, [aday],
                                      f"Muavinde '{aday.belge_no}' olarak kayıtlı olabilir"))
                kullanilan.add(id(aday))
            elif all(k.ad == "KDV" for k in kontroller) and \
                    ((f.kdv_toplam == 0 and istisnali(f)) or ihrac_kayitli(f)):
                # KDV'siz istisna / ihracat (ya da KDV'si tahsil edilmeyen ihraç kayıtlı) fatura: KDV hesabına
                # kayıt beklenmez → KDV açısından uyumlu; kayıt henüz yapılmamış olabilir diye not düşülür
                sonuclar.append(Sonuc(f, "Kayıt", ISTISNA_KAYITSIZ, beklenen, SIFIR, [],
                                      f"{fatura_tipi(f)}: KDV hesaplanmadığı/tahsil edilmediği için KDV kontrolü "
                                      "açısından uyumlu. Bu belge no ile muavinde kayıt yok – "
                                      + ("ihracat kaydı GÇB / fiili ihraç tarihinde yapılıyor olabilir"
                                         if f.yon == "SATIS" else "alış kaydını ayrıca kontrol edin")))
            else:
                sonuclar.append(Sonuc(f, "Kayıt", MUAVINDE_YOK, beklenen, SIFIR, [],
                                      ("Bu belge numarasıyla bu firmaya ait kayıt bulunamadı"
                                       + _reddedilen_notu(reddedilen) if reddedilen else
                                       "Bu belge numarasıyla hiçbir hesapta kayıt bulunamadı")
                                      + (f" ({fatura_tipi(f)})" if fatura_tipi(f) and f.tip != "SATIS" else "")
                                      + (" – KDV'siz fatura" if f.kdv_toplam == 0 else "")))
            continue

        kullanilan.update(id(s) for s in satirlar)
        once = len(sonuclar)
        # Faturanın fiş(ler)i: KDV/matrah satırlarının bulunduğu fişler
        fisler = {s.fis_no for s in satirlar
                  if any(k.secici(s) for k in kontroller if not k.fis_bazli)} \
            or {s.fis_no for s in satirlar}

        # Binek araç: faturanın fişinde adında 'BİNEK' geçen bir hesap varsa KDV'nin %70'i beklenir.
        # Fişte bu faturaya ait 689 (KKEG) satırında araç / yakıt / binek geçiyorsa da binek araç gideri sayılır.
        binek = f.yon == "ALIS" and any(re.search(r"B[İI]NEK", _buyuk(x.hesap_adi)) for x in satirlar)
        binek_not = ""
        if f.yon == "ALIS" and not binek:
            for key in sorted({(x.fis_no, x.fis_tarihi) for x in satirlar if x.fis_no}, key=str):
                fis_tum = fis_index.get(key, [])
                baska = {x.belge_no for x in fis_tum if x.belge_no and x.belge_no != f.belge_no and x not in satirlar}
                for x in fis_tum:
                    if not x.hesap_kodu.startswith("689") or not BINEK_689_RE.search(_buyuk(f"{x.hesap_adi} {x.aciklama}")):
                        continue
                    if x in satirlar or (not x.belge_no and not baska):     # bu faturaya ait 689 satırı
                        binek, binek_not = True, f"fişte 689 kaydı: {x.hesap_kodu} {x.hesap_adi}".strip()
                        break
                if binek:
                    break
        for k in kontroller:
            beklenen: Decimal = getattr(f, k.alan)
            oranlar_f = getattr(f, k.oran_alani) if k.oran_alani else None
            if binek and k.ad == "Matrah" and k.taraf:
                # binek araç: indirilemeyen KDV (%30) gider hesabına yazılır → gider = matrah + KDV × %30
                beklenen = (beklenen + f.kdv_toplam * (1 - BINEK_ORAN)).quantize(Decimal("0.01"), ROUND_HALF_UP)
            if binek and k.ad == "KDV":
                beklenen = (beklenen * BINEK_ORAN).quantize(Decimal("0.01"), ROUND_HALF_UP)
                oranlar_f = {o: (v * BINEK_ORAN).quantize(Decimal("0.01"), ROUND_HALF_UP)
                             for o, v in (oranlar_f or {}).items()}
            if k.fis_bazli:
                ilgili = [s for s in satirlar if s.fis_no in fisler]
                taraf = "alacak" if f.yon == "ALIS" else "borc"
                toplam = sum((getattr(s, taraf) for s in ilgili), SIFIR)
            elif k.taraf:
                ilgili = [s for s in satirlar if k.secici(s)]
                toplam = sum(((s.borc - s.alacak) if k.taraf == "borc" else (s.alacak - s.borc) for s in ilgili), SIFIR)
            else:
                ilgili = [s for s in satirlar if k.secici(s)]
                toplam = sum((s.net for s in ilgili), SIFIR)
            on_not, iade_eslesti = [], False
            if iade_notlu(f) and k.ad in ("Matrah", "KDV", "Cari"):
                i610 = [s for s in satirlar if s.hesap_kodu.startswith(("610", "611"))] if k.ad == "Matrah" else []
                if i610:                      # iade, satış faturasıyla kesilmiş: matrah 610 borcunda
                    ilgili, toplam = i610, sum((s.borc - s.alacak for s in i610), SIFIR)
                    iade_eslesti = True
                elif k.ad != "Matrah" and abs(toplam + beklenen) <= tolerans and beklenen:
                    toplam, iade_eslesti = -toplam, True          # KDV 391 / cari 120 ters yönde (iade)
            konak = konaklama_vergisi(f) if k.ad == "Matrah" else SIFIR
            if konak:
                on_not.append(f"Konaklama vergisi: matrah {beklenen} + konaklama vergisi {konak} = {beklenen + konak} beklenir")
                beklenen = beklenen + konak
            oiv = oiv_tutari(f) if k.ad == "Matrah" and k.taraf == "borc" else SIFIR
            if oiv and abs(toplam - (beklenen + oiv)) <= tolerans:
                on_not.append(f"ÖİV {oiv} gider / 689 hesabına yazılmış; matraha eklendi")
                beklenen = beklenen + oiv
            if k.ad == "KDV" and ihrac_kayitli(f) and abs(toplam) <= tolerans:
                # ihraç kayıtlı teslim: KDV faturada hesaplanır ama tahsil edilmez → 191'de kayıt beklenmez
                sonuclar.append(Sonuc(f, k.ad, IHRACKAYITLI_UYUMLU, beklenen, toplam, ilgili,
                                      f"{fatura_tipi(f)}: faturada hesaplanan KDV {beklenen} tahsil edilmemiş, "
                                      f"muavinde KDV kaydı yok (beklenen)"))
                continue
            if not ilgili:
                if k.ad == "KDV" and beklenen == 0:
                    continue
                if k.ad == "Matrah" and not k.taraf:
                    continue   # belge doğrudan gider/stok hesabına kaydedilmiş; tutarı fiş toplamı denetler
                sonuclar.append(Sonuc(f, k.ad, TUTAR_FARKI, beklenen, SIFIR, [],
                                      f"Belge muavinde var ama {k.aciklama} içinde satırı yok"))
                continue
            durum, notlar = UYUMLU, []

            if abs(toplam - beklenen) > tolerans:
                if beklenen and abs(toplam - 2 * beklenen) <= tolerans and len(ilgili) >= 2:
                    durum = MUKERRER
                    notlar.append(f"{len(ilgili)} satır, tutar faturanın iki katı")
                elif abs(toplam - beklenen) <= KUCUK_FARK:
                    durum = KURUS_FARKI
                elif (k.ad == "KDV" and f.tevkifat and f.yon == "SATIS"
                      and abs(toplam - (beklenen - f.tevkifat)) <= tolerans):
                    notlar.append(f"Tevkifatlı satış: tahsil edilen KDV (KDV {beklenen} − tevkifat {f.tevkifat}) kaydedilmiş")
                else:
                    durum = TUTAR_FARKI
            elif k.oran_alani:
                hatali = _oran_kontrol(oranlar_f, ilgili, tolerans)
                if hatali:
                    durum = ORAN_HATASI if k.ad == "KDV" else TUTAR_FARKI
                    notlar.append(hatali)
            if k.fis_bazli:
                b = sum((s.borc for s in ilgili), SIFIR)
                a = sum((s.alacak for s in ilgili), SIFIR)
                if abs(b - a) > tolerans:
                    notlar.append(f"Bu belgeye ait fiş satırları dengesiz (borç {b}, alacak {a})")

            if k.fis_bazli and f.odenecek != f.vergiler_dahil:
                notlar.append(f"Ödenecek tutar {f.odenecek} (yuvarlama/iskonto/depozito sonrası)")
            if durum == UYUMLU and k is kontroller[0]:   # dönem kontrolü fatura başına bir kez
                aylar = {(s.fis_tarihi.year, s.fis_tarihi.month) for s in ilgili}
                fa_ay = (f.tarih.year, f.tarih.month)
                if any(a < fa_ay for a in aylar):
                    durum = ERKEN_KAYIT
                    notlar.append("Fiş tarihi faturadan önceki ayda: "
                                  + ", ".join(f"{a:02d}/{y}" for y, a in sorted(aylar))
                                  + (" – KDV indirimi fatura tarihinden önceki döneme alınamaz"
                                     if f.yon == "ALIS" else ""))
                elif aylar != {fa_ay}:
                    durum = DONEM_FARKI
                    notlar.append("Fiş tarihi: " + ", ".join(f"{a:02d}/{y}" for y, a in sorted(aylar)))
            for s in ilgili:
                if s.belge_tarihi and s.belge_tarihi != f.tarih:
                    notlar.append(f"Açıklamadaki tarih {s.belge_tarihi:%d.%m.%Y}, fatura {f.tarih:%d.%m.%Y}")
                    break
            if f.tevkifat and k.ad == "KDV" and not any("Tevkifatlı satış" in n for n in notlar):
                notlar.append(f"Tevkifatlı fatura (tevkifat {f.tevkifat}) – KDV kaydını ayrıca kontrol edin")
            if f.diger_vergiler and k.fis_bazli:
                notlar.append("Diğer vergiler: " + ", ".join(f"{a} {v}" for a, v in f.diger_vergiler.items()))
            if binek and k.ad == "KDV":
                notlar.insert(0, f"Binek araç{' (' + binek_not + ')' if binek_not else ''}: faturadaki KDV {getattr(f, k.alan)} × %70 = {beklenen} beklenir")
                if durum in (UYUMLU, KURUS_FARKI):
                    durum = BINEK_UYUMLU
                elif durum in (TUTAR_FARKI, ORAN_HATASI, MUKERRER):
                    durum = BINEK_FARK          # dönem/erken kayıt gibi durumlar olduğu gibi kalır
            if getattr(f, "doviz", None) and k.ad == "KDV":
                notlar.insert(0, f"{f.doviz} fatura; KDV {f.tl_kaynak}"
                              + (f" – döviz KDV {f.doviz_kdv} {f.doviz}" if f.doviz_kdv else ""))
                if durum in (UYUMLU, KURUS_FARKI):
                    durum = DOVIZ_TL_UYUMLU
            notlar[:0] = on_not
            if iade_eslesti:
                notlar.insert(0, "Faturada 'iade' geçiyor: satış faturasıyla kesilmiş iade "
                              + ("610 Satıştan İadeler borcuna kaydedilmiş" if k.ad == "Matrah" else "ters yönde kaydedilmiş"))
                if durum in (UYUMLU, KURUS_FARKI):
                    durum = IADE_610_UYUMLU
            elif konak:
                if durum in (UYUMLU, KURUS_FARKI):
                    durum = KONAKLAMA_UYUMLU
                elif durum in (TUTAR_FARKI, ORAN_HATASI):
                    durum = KONAKLAMA_FARK
            sonuclar.append(Sonuc(f, k.ad, durum, beklenen, toplam, ilgili, "; ".join(notlar)))
        if len(sonuclar) == once:          # KDV'siz ve muavinde kayıtlı: listede görünsün
            fis = ", ".join(sorted({f"{x.fis_no} ({x.hesap_kodu})" for x in satirlar})[:3])
            d, a = _kdvsiz_durum(f)
            sonuclar.append(Sonuc(f, "Kayıt", d, f.kdv_toplam, SIFIR, satirlar, f"{a}; muavinde kayıtlı: {fis}"))

    for so in sonuclar:                     # tek karakter farklı belge no ile bulunanlar ayrı kategoride
        y_ = yakinlar.get(id(so.fatura))
        if y_:
            n_ = f"Muavinde '{y_}' olarak kayıtlı (fatura {so.fatura.belge_no}); tutar ve tarih tutuyor"
            if so.durum in (UYUMLU, KURUS_FARKI, BINEK_UYUMLU, DOVIZ_TL_UYUMLU):
                so.durum = BELGE_NO_YAKIN
            so.aciklama = f"{n_}; {so.aciklama}" if so.aciklama else n_
    for so in sonuclar:                     # kısa / farklı yazılmış evrak no ile bulunan faturalar raporda belirtilir
        n_ = kisa_notlar.get(id(so.fatura))
        if n_ and n_ not in so.aciklama:
            so.aciklama = f"{n_}; {so.aciklama}" if so.aciklama else n_
    fatura_nolari = {f.belge_no for f in faturalar}
    faturasi_olmayan, fatura_disi = [], []
    for s in muavin:
        k_yon = _satir_yonu(s, aktif)
        if k_yon is None or k_yon not in donemler:
            continue
        bas, bit = donemler[k_yon]
        t = s.belge_tarihi or s.fis_tarihi
        if not (bas <= t <= bit):
            continue
        if s.e_belge_mi:
            # aynı numaralı fatura başka bir firmaya / başka aya aitse (eşleşmeden kaldıysa) bu kayıt da faturasız sayılır
            if id(s) not in kullanilan and (s.belge_no not in fatura_nolari or id(s) in reddedilen_tum):
                faturasi_olmayan.append(s)
        elif s.net > 0 and id(s) not in kullanilan:
            fatura_disi.append(s)    # Z raporu, kağıt belge, açıklaması standart dışı kayıtlar
    rapor = Rapor(sonuclar, faturasi_olmayan, fatura_disi, donemler,
                  [f"{'Alış' if k.yon == 'ALIS' else 'Satış'} {k.ad}: {k.aciklama}" for k in aktif])
    if red:
        red_iptal_uygula(rapor, red, belge_index, kisa_index, faturalar)
    return rapor


def red_iptal_uygula(rapor: Rapor, red: dict, belge_index: dict, kisa_index: dict, faturalar) -> None:
    """Red / iptal listesindeki faturalar: muavinde kayıt yoksa uyumlu, kayıtlıysa sorun. Listedeki fatura
    e-fatura dosyalarında olmasa da muavine bakılır; faturası bulunamayan kayıtlardan çıkarılıp bu listede gösterilir."""
    from .red_iptal import durum_metni
    sonuc_b: dict[str, list[Sonuc]] = defaultdict(list)
    for s in rapor.sonuclar:
        sonuc_b[s.fatura.belge_no.upper()].append(s)
    fat = {f.belge_no.upper() for f in faturalar}
    for no, b in sorted(red.items(), key=lambda x: (x[1].get("tarih") or date.min, x[0])):
        ne = durum_metni(b)
        L = sonuc_b.get(no, [])
        satirlar = [x for s in L for x in s.satirlar]
        if not L:                                           # e-fatura dosyalarında yok: doğrudan muavinde ara
            satirlar = list(belge_index.get(no, []))
            fk_ = fatura_kisa(no)
            if not satirlar and fk_:
                satirlar = kisa_index.get(fk_, []) + kisa_index.get((fk_[0], None, fk_[2]), [])
                if b.get("vkn") or b.get("unvan"):      # kısa no: cari tutmalı
                    kok = _kok(b.get("unvan") or "")
                    satirlar = [x for x in satirlar if (kok & _kok(f"{x.unvan} {x.hesap_adi} {x.aciklama}"))
                                or (b.get("vkn") and b["vkn"] in re.sub(r"\D", " ", f"{x.aciklama} {x.hesap_adi}").split())]
        kayitli = bool(satirlar)
        for s in L:
            if kayitli:
                s.durum = RED_KAYITLI
                s.aciklama = (f"Fatura {ne.lower()} edilmiş ({b.get('durum')}); muavinde kayıtlı — kayıt iptal / ters kayıt edilmeli"
                              + (f". Önceki sonuç: {s.aciklama}" if s.aciklama else ""))
            else:
                s.durum = RED_KAYITSIZ
                s.aciklama = f"Fatura {ne.lower()} edilmiş ({b.get('durum')}); muavinde kayıt yok — doğru"
        ids = {id(x) for x in satirlar}
        if ids:
            rapor.faturasi_olmayanlar = [x for x in rapor.faturasi_olmayanlar if id(x) not in ids]
            rapor.fatura_disi = [x for x in rapor.fatura_disi if id(x) not in ids]
        rapor.red_iptal.append({**b, "ne": ne, "faturada": no in fat, "muavinde": kayitli, "satirlar": satirlar,
                                "sonuc": RED_KAYITLI if kayitli else RED_KAYITSIZ})


def _satir_yonu(s: MuavinSatiri, aktif: list[Kontrol]) -> str | None:
    """Faturası aranacak satırlar: KDV kontrolü varsa yalnız KDV satırları,
    yoksa matrah satırları (aynı belge birden fazla kez listelenmesin)."""
    for yon in ("ALIS", "SATIS"):
        adaylar = [k for k in aktif if k.yon == yon and not k.fis_bazli]
        kdv = [k for k in adaylar if k.ad == "KDV"]
        for k in (kdv or adaylar):
            if k.secici(s):
                return yon
    return None


def _oran_kontrol(fatura_oran: dict[Decimal, Decimal], satirlar: list[MuavinSatiri],
                  tolerans: Decimal) -> str:
    """Faturadaki her oran, aynı oranlı alt hesaba mı kaydedilmiş?"""
    if any(s.kdv_orani is None for s in satirlar):
        return ""  # oran bilgisi olmayan hesap (iade vb.) -> oran kontrolü yapılamaz
    muavin_oran: dict[Decimal, Decimal] = defaultdict(lambda: SIFIR)
    for s in satirlar:
        muavin_oran[s.kdv_orani] += s.net
    hatalar = []
    for oran in sorted(set(fatura_oran) | set(muavin_oran)):
        fa = fatura_oran.get(oran, SIFIR)
        mu = muavin_oran.get(oran, SIFIR)
        if abs(fa - mu) > tolerans:
            hatalar.append(f"%{oran}: fatura {fa}, muavin {mu}")
    return "; ".join(hatalar)


def _kisa_no_adayi(f: Fatura, fk_: tuple, kisa_index: dict, belge_index: dict, k: Kontrol,
                   beklenen: Decimal, tolerans: Decimal) -> MuavinSatiri | None:
    """Evrak no'da tek hane hatası (AAA2026000000889 ↔ 'AAA-899' ya da AAA2026000000899): aynı seri, aynı ay,
    aynı tutar ve tek kayıt varsa öner."""
    seri, yil, sira = fk_
    adaylar = []
    for (s_, y_, q_), L in kisa_index.items():
        if s_ == seri and y_ in (None, yil) and _tek_hane_farki(sira, q_):
            adaylar += L
    for bno, L in belge_index.items():
        b = fatura_kisa(bno)
        if b and b[0] == seri and b[1] == yil and _tek_hane_farki(sira, b[2]):
            adaylar += L
    fa_ay = (f.tarih.year, f.tarih.month)
    uygun = [s for s in adaylar if k.secici(s) and abs(s.net - beklenen) <= tolerans
             and ((s.fis_tarihi.year, s.fis_tarihi.month) == fa_ay or (s.belge_tarihi and (s.belge_tarihi.year, s.belge_tarihi.month) == fa_ay))]
    return uygun[0] if len(uygun) == 1 else None


def _belge_no_adayi(f: Fatura, muavin: list[MuavinSatiri], k: Kontrol,
                    beklenen: Decimal, tolerans: Decimal) -> MuavinSatiri | None:
    """Belge no tutmuyorsa: aynı hesap grubu, aynı belge tarihi, aynı tutar ve
    benzer ünvanlı tek bir kayıt varsa onu öner (yazım hatası ihtimali)."""
    unvan_kok = _kok(f.karsi_unvan)
    adaylar = [s for s in muavin
               if k.secici(s) and s.belge_tarihi == f.tarih
               and abs(s.net - beklenen) <= tolerans and s.belge_no != f.belge_no
               and (_kok(s.unvan) & unvan_kok)]
    return adaylar[0] if len(adaylar) == 1 else None


# Ünvan karşılaştırmasında ayırt edici olmayan kelimeler
_GENEL = {"limited", "sirketi", "sirket", "ticaret", "sanayi", "anonim", "insaat", "pazarlama", "turizm", "hizmetleri",
          "hizmet", "ithalat", "ihracat", "nakliyat", "nakliye", "taahhut", "dagitim", "muhendislik", "danismanlik",
          "organizasyon", "yatirim", "uretim", "imalat", "ticari", "isletmesi", "isletmeleri", "magazasi", "magazacilik",
          "subesi", "merkez", "grup", "group", "serbest", "meslek", "erbabi", "kooperatifi", "vakfi", "dernegi"}


# Evrak no kısa yazılmışsa (AAA2026000000889 → "AAA-889", "aaa889", "AAA 2026/889"): seri (3 karakter) + yıl + sıra no
_EBELGE_PARCA = re.compile(r"^([A-Z0-9]{3})(20\d{2})(\d{9})$")
_KISA_RE = re.compile(r"(?<![A-Z0-9])([A-Z][A-Z0-9]{2})[\s\-_/.]*(?:(20\d{2})[\s\-_/.]+)?0*(\d{1,9})(?![\d/.])")
_TARIH_RE = re.compile(r"\d{1,2}[./]\d{1,2}[./]\d{2,4}")


def fatura_kisa(belge_no: str) -> tuple[str, int, int] | None:
    m = _EBELGE_PARCA.match((belge_no or "").upper())
    return (m.group(1), int(m.group(2)), int(m.group(3))) if m and int(m.group(3)) else None


def muavin_kisa_anahtarlar(s: MuavinSatiri) -> set[tuple]:
    """Muavin satırındaki kısa evrak no adayları: {(seri, yıl|None, sıra)}. Tam e-belge no'lu satırlar katılmaz."""
    if s.belge_no and _EBELGE_PARCA.match(s.belge_no):
        return set()
    metin = _TARIH_RE.sub(" ", _buyuk(" ".join(x for x in (s.belge_no, s.aciklama) if x)))
    out = set()
    for m in _KISA_RE.finditer(metin):
        seri, yil, sira = m.group(1), m.group(2), int(m.group(3))
        if sira and not seri.isdigit():
            out.add((seri, int(yil) if yil else None, sira))
    return out


def _tek_hane_farki(a: int, b: int) -> bool:
    """Sıra no'da tek hane yanlış ya da iki komşu hane yer değiştirmiş (889 ↔ 899, 889 ↔ 898)."""
    x, y = str(a), str(b)
    if x == y or len(x) != len(y):
        return False
    fark = [i for i in range(len(x)) if x[i] != y[i]]
    return len(fark) == 1 or (len(fark) == 2 and fark[1] == fark[0] + 1 and x[fark[0]] == y[fark[1]] and x[fark[1]] == y[fark[0]])


def _yakin_no(a: str, b: str) -> bool:
    """Seri harflerinde (ilk 3 karakter) tek karakter farklı (LIL ↔ LII) ya da komşu iki harf yer değiştirmiş; yıl ve
    sıra numarası aynı. Sıra numarası farklıysa (…001 ↔ …010) ayrı fatura olabilir → 'belge no şüpheli' kuralına kalır."""
    if a == b or len(a) != len(b) or len(a) < 8 or a[3:] != b[3:]:
        return False
    fark = [i for i in range(len(a)) if a[i] != b[i]]
    return len(fark) == 1 or (len(fark) == 2 and fark[1] == fark[0] + 1 and a[fark[0]] == b[fark[1]] and a[fark[1]] == b[fark[0]])


def _yakin_belge(f, belge_index: dict, fatura_nolari: set, tolerans: Decimal) -> str | None:
    """Muavinde fatura no'ya çok yakın (tek karakter) bir belge no varsa ve o kaydın KDV (KDV yoksa matrah / toplam) tutarı
    ile belge tarihi faturayla aynıysa o belge no (ünvan / cari aranmaz; serbest meslek makbuzlarında sık görülür)."""
    no = (f.belge_no or "").upper()
    if len(no) < 8:
        return None
    adaylar = []
    for k_, L in belge_index.items():
        if k_ in fatura_nolari or not _yakin_no(no, k_):
            continue
        tarih_ok = any(x.belge_tarihi == f.tarih or (x.belge_tarihi is None and (x.fis_tarihi.year, x.fis_tarihi.month) == (f.tarih.year, f.tarih.month)) for x in L)
        if not tarih_ok:
            continue
        kdv = sum((x.net for x in L if x.hesap_kodu[:3] in ("191", "391")), SIFIR)
        if f.kdv_toplam:
            tutar_ok = abs(kdv - f.kdv_toplam) <= tolerans
        else:
            tutar_ok = any(abs(x.borc + x.alacak - t) <= tolerans for x in L for t in (f.matrah, f.vergiler_dahil, f.odenecek) if t)
        if tutar_ok:
            adaylar.append(k_)
    return adaylar[0] if len(adaylar) == 1 else None


def konaklama_vergisi(f) -> Decimal:
    return sum((v for k_, v in (getattr(f, "diger_vergiler", None) or {}).items() if "KONAKLAMA" in _buyuk(k_)), Decimal("0"))


OIV_RE = re.compile(r"[İI]LET[İI][ŞS][İI]M|ÖİV|OIV|Ö\.İ\.V")


def oiv_tutari(f) -> Decimal:
    return sum((v for k_, v in (getattr(f, "diger_vergiler", None) or {}).items() if OIV_RE.search(_buyuk(k_))), Decimal("0"))


def iade_notlu(f) -> bool:
    """Satış faturası tipinde kesilmiş iade: faturanın notunda / kaleminde 'iade' geçiyor (firma 610 borcuna kaydeder)."""
    if getattr(f, "yon", "") != "SATIS" or (f.tip or "").upper() == "IADE":
        return False
    return any(re.search(r"(?<![A-ZÇĞİÖŞÜ])[İI]ADE", _buyuk(x)) for x in (getattr(f, "notlar", None) or []) + (getattr(f, "kalemler", None) or []))


BINEK_689_RE = re.compile(r"ARA[CÇ]|YAKIT|AKARYAKIT|B[İI]NEK|OTOMOB[İI]L|\bOTO\b|TA[ŞS]IT")


def _kok(unvan: str) -> set[str]:
    tablo = str.maketrans("İIŞĞÜÖÇışğüöç", "iisguocisguoc")
    kelimeler = re.sub(r"[^\w\s]", " ", (unvan or "").translate(tablo).lower()).split()
    return {w for w in kelimeler if len(w) >= 4 and w not in _GENEL and not w.isdigit()}


def _cari_uyar(f: Fatura, fis_satirlari: list[MuavinSatiri]) -> bool | None:
    """Fişteki satırlar faturanın karşı tarafına mı ait? (ünvan kelimesi ya da VKN). Bilgi yoksa None."""
    vkn = re.sub(r"\D", "", getattr(f, "karsi_vkn", "") or "")
    kok = _kok(f.karsi_unvan or "")
    if not kok and len(vkn) < 10:
        return None
    for s in fis_satirlari:
        metin = " ".join(x for x in (s.unvan, s.hesap_adi, s.aciklama) if x)
        if len(vkn) >= 10 and vkn in re.sub(r"\D", " ", metin).split():
            return True
        if kok & _kok(metin):
            return True
    return False


def _faturanin_satirlari(f: Fatura, adaylar: list[MuavinSatiri], fis_index: dict) -> tuple[list, list]:
    """Fatura no ile bulunan muavin satırlarından faturaya ait olanları seçer:
    1) faturanın ayındaki (fiş tarihi ya da belge tarihi) kayıtlar — birden çok fiş varsa karşı tarafı tutanlar;
    2) o ayda yoksa yılın diğer aylarındaki kayıtlardan yalnız aynı cariye (ünvan / VKN) ait olanlar.
    Dönen: (seçilen satırlar, reddedilen satırlar)."""
    if not adaylar:
        return [], []
    gruplar: dict[tuple, list[MuavinSatiri]] = defaultdict(list)
    for s in adaylar:
        gruplar[(s.fis_no, s.fis_tarihi)].append(s)
    fa_ay = (f.tarih.year, f.tarih.month)

    def ayni_ay(g):
        return any((s.fis_tarihi.year, s.fis_tarihi.month) == fa_ay
                   or (s.belge_tarihi and (s.belge_tarihi.year, s.belge_tarihi.month) == fa_ay) for s in g)

    def uyar(anahtar):
        return _cari_uyar(f, fis_index.get(anahtar) or gruplar[anahtar])

    ay_g = [k for k, g in gruplar.items() if ayni_ay(g)]
    if ay_g:
        sec = ay_g
        if len(ay_g) > 1:
            u = [k for k in ay_g if uyar(k) is not False]
            if u:
                sec = u
    else:
        sec = [k for k in gruplar if uyar(k) is not False]
    secilen = [s for k in sec for s in gruplar[k]]
    reddedilen = [s for k in gruplar if k not in sec for s in gruplar[k]]
    return secilen, reddedilen


def _reddedilen_notu(reddedilen: list[MuavinSatiri]) -> str:
    fisler = sorted({(s.fis_tarihi, s.fis_no) for s in reddedilen})
    ad = next((s.unvan or s.hesap_adi for s in reddedilen if (s.unvan or "").strip()), "")
    return (" (aynı numara muavinde başka kayıtta var: "
            + ", ".join(f"{t:%d.%m.%Y} fiş {n}" for t, n in fisler[:3])
            + (f" – {ad}" if ad else "") + "; ay ya da cari tutmadığı için eşleştirilmedi)")
