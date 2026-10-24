"""Luca 'Muavin Defter' Excel dökümü okuyucu.

Beklenen yapı (Luca standart çıktısı):
    MUAVİN DEFTER / Firma adı / Dönem / Tarih Aralığı
    <hesap kodu> <hesap adı>           <- her alt hesap için başlık
    TARİH | TİP | FİŞ NO | AÇIKLAMA | BORÇ | ALACAK | BAKİYE | B/A
    ... satırlar ...
    Nakli Yekün Hariç / Genel Toplam

Açıklama alanı Luca'da genelde  'GG/AA/YYYY-BELGENO-ÜNVAN'  biçimindedir.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path

import openpyxl

# Hesap kodu: 3 haneli ana hesap + alt gruplar; alt gruplar rakam ya da harf olabilir (harfli cari düzeni: 320.P.0006, 120.Ş.001).
# Yalnız rakam kabul edilince harfli carilerin başlığı tanınmıyor, satırları önceki hesaba (ör. 302) yazılıyordu (Görev 40).
_ALT = r"[0-9A-Za-zÇĞİÖŞÜçğıöşü]+"
HESAP_RE = re.compile(rf"^(\d{{3}}(?:\.{_ALT})*)\s+(.*)$")
ACIKLAMA_RE = re.compile(r"^\s*(\d{2}/\d{2}/\d{4})\s*-\s*([^-]+?)\s*-\s*(.*)$")
# GİB e-belge numarası: 3 karakter seri + 4 hane yıl + 9 hane sıra = 16 karakter
EBELGE_RE = re.compile(r"^[A-Z0-9]{3}20\d{2}\d{9}$")
ORAN_RE = re.compile(r"%\s*(\d+)")


@dataclass
class MuavinSatiri:
    dosya: str
    satir: int
    hesap_kodu: str
    hesap_adi: str
    fis_tarihi: date
    fis_tipi: str
    fis_no: str
    aciklama: str
    borc: Decimal
    alacak: Decimal
    belge_tarihi: date | None
    belge_no: str | None        # normalize edilmiş (büyük harf, boşluksuz)
    unvan: str
    kod_orani: Decimal | None = None    # Denetim: hesap adında oran yoksa koddan (191.01.20 → %20); denetim.kod_oranlari

    @property
    def ana_hesap(self) -> str:
        return self.hesap_kodu[:3]

    @property
    def kdv_orani(self) -> Decimal | None:
        """Hesap adından KDV oranı (%1, %10, %20 ...); adda yoksa (Denetim'de) hesap kodundan bulunan oran."""
        m = ORAN_RE.search(self.hesap_adi)
        return Decimal(m.group(1)) if m else self.kod_orani

    @property
    def e_belge_mi(self) -> bool:
        return bool(self.belge_no and EBELGE_RE.match(self.belge_no))

    @property
    def net(self) -> Decimal:
        """Hesabın normal yönünde tutar: 1xx/2xx/7xx ve 610-612 borç; diğerleri alacak."""
        if self.ana_hesap[0] in "127" or self.ana_hesap in ("610", "611", "612"):
            return self.borc - self.alacak
        return self.alacak - self.borc


# Başlık / etiket karşılaştırması: Türkçe büyük-küçük harf ve aksan farkı gözetilmez ("Tarih" = "TARİH" = "TARIH")
_KATLA = str.maketrans("çğıöşüâîû", "cgiosuaiu")


def _kat(v) -> str:
    s = str(v or "").replace("İ", "i").replace("I", "ı").lower().replace("i̇", "i").translate(_KATLA)
    return re.sub(r"\s+", " ", s).strip(" .:")


# Luca sürümlerine göre başlık adları değişebiliyor; her alan için kabul edilen adlar (katlanmış)
KOLONLAR = {
    "tarih": ("tarih", "fis tarihi", "fis tarih", "yevmiye tarihi", "islem tarihi"),
    "tip": ("tip", "fis tipi", "fis turu", "tur"),
    "fis_no": ("fis no", "fis numarasi", "fis no su", "yevmiye no", "yevmiye numarasi", "fis"),
    "aciklama": ("aciklama", "aciklamasi"),
    "borc": ("borc", "borc tutari", "borc tutar"),
    "alacak": ("alacak", "alacak tutari", "alacak tutar"),
}
# Hareket olmayan satırlar (devir, nakli yekün, ara / genel toplam): fiş numarası boşsa ve metin bunlardan biriyle başlıyorsa
_OZET_RE = re.compile(r"^(devreden|devir|onceki donem|nakli yekun|nakl[iı] yekun|ara toplam|toplam|genel toplam|donem toplami|hesap toplami)")
# Hesap başlığı: "191.10.20 %20 İndirilecek KDV", "Hesap Kodu: 191.10.20 - ...", ya da kod ve ad ayrı hücrelerde
_KOD_RE = re.compile(rf"^\d{{3}}(?:[.\-]{_ALT})*$")
_HESAP_ONEK_RE = re.compile(r"^hesap(\s*kodu)?\s*:?\s*", re.I)
# Yalnız 3 haneli kodla başlayan metin satırı ("320 nolu fatura", "100 adet …") hesap başlığı sayılmaz: ad küçük harfle
# başlıyorsa ya da numara / miktar sözcüğüyle başlıyorsa
_METIN_RE = re.compile(r"^(?:[a-zçğıöşü]|(?i:no|nr|nolu|no'lu|no’lu|numaral[ıi]|numarali|adet|tl|tane)\b)")


def _dec(v) -> Decimal:
    """Tutar: sayı ya da metin ("1.234,56", "1,234.56", "1234.56", "(1.234,56)", "1.234,56-", "1.234,56 TL")."""
    if v is None or v == "":
        return Decimal("0")
    if isinstance(v, bool):
        raise ValueError(f"Tutar okunamadı: {v!r}")
    if isinstance(v, (int, float)):
        return Decimal(str(v))
    s = re.sub(r"\s+|TL|TRY|₺", "", str(v).strip(), flags=re.I)
    if s in ("", "-"):
        return Decimal("0")
    eksi = s.startswith("(") and s.endswith(")") or s.endswith("-")
    s = s.strip("()").rstrip("-")
    if s.startswith("-"):
        eksi, s = not eksi, s[1:]
    if "," in s and "." in s:                       # son ayraç ondalık ayracıdır
        s = s.replace(".", "").replace(",", ".") if s.rfind(",") > s.rfind(".") else s.replace(",", "")
    elif "," in s:
        s = s.replace(",", ".") if s.count(",") == 1 else s.replace(",", "")
    elif s.count(".") > 1 or re.fullmatch(r"\d{1,3}\.\d{3}", s):   # "1.234.567" ya da "1.234": binlik ayracı
        s = s.replace(".", "")
    try:
        d = Decimal(s)
    except Exception:
        raise ValueError(f"Tutar okunamadı: {v!r}") from None
    return -d if eksi else d


def _tarih(v) -> date | None:
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, date):
        return v
    if isinstance(v, str):
        t = v.strip().split(" ")[0] if v.strip() else ""
        for bc in ("%d/%m/%Y", "%d.%m.%Y", "%d-%m-%Y", "%Y-%m-%d", "%Y.%m.%d", "%d/%m/%y", "%d.%m.%y"):
            try:
                return datetime.strptime(t, bc).date()
            except ValueError:
                continue
    return None


def _hucre_tarih(v) -> date | None:
    """Hareket satırının tarih hücresi: ayrıca tarih biçimi verilmemiş Excel seri sayısı (ör. 46295)."""
    if isinstance(v, (int, float)) and not isinstance(v, bool) and 20000 <= v <= 80000:
        from openpyxl.utils.datetime import from_excel
        try:
            return from_excel(v).date()
        except (ValueError, OverflowError):
            return None
    return _tarih(v)


def aciklama_ayristir(acik: str) -> tuple[date | None, str | None, str]:
    m = ACIKLAMA_RE.match(acik or "")
    if not m:
        return None, None, acik or ""
    return _tarih(m.group(1)), re.sub(r"\s+", "", m.group(2)).upper(), m.group(3).strip()


def _baslik(r) -> dict[str, int] | None:
    """Sütun başlığı satırı mı? (tarih, borç ve alacak sütunları bulunmalı)"""
    k = {}
    for i, h in enumerate(r):
        a = _kat(h)
        for alan, adlar in KOLONLAR.items():
            if a in adlar and alan not in k:
                k[alan] = i
    return k if {"tarih", "borc", "alacak"} <= k.keys() else None


def _hesap(r) -> tuple[str, str] | None:
    """Hesap başlığı satırı: ilk dolu hücre "kod ad" ya da yalnız kod (ad sonraki dolu hücrede)."""
    dolu = [(i, str(x).strip()) for i, x in enumerate(r) if x is not None and str(x).strip()]
    if not dolu or not isinstance(r[dolu[0][0]], str):
        return None
    ilk = _HESAP_ONEK_RE.sub("", dolu[0][1]) if _kat(dolu[0][1]).startswith("hesap") else dolu[0][1]
    if m := HESAP_RE.match(ilk):
        if "." not in m.group(1) and _METIN_RE.match(m.group(2)):    # "320 nolu fatura …": açıklama satırı, hesap başlığı değil
            return None
        return m.group(1), m.group(2).strip(" -:")
    if _KOD_RE.match(ilk) and len(dolu) > 1 and not _sayi_mi(dolu[1][1]):
        return ilk.replace("-", "."), dolu[1][1].strip(" -:")
    return None


def _sayi_mi(s: str) -> bool:
    return bool(re.fullmatch(r"[\d.,\s()-]+", s))


def muavin_oku(yol: Path) -> tuple[list[MuavinSatiri], dict]:
    wb = openpyxl.load_workbook(yol, data_only=True)  # Luca dosyalarında boyut bilgisi eksik; read_only kullanılamaz
    satirlar: list[MuavinSatiri] = []
    bilgi: dict = {"dosya": yol.name}
    hesap_kodu = hesap_adi = None
    kolon: dict[str, int] = {}

    # Luca büyük muavinleri birden çok sayfaya bölebilir: tüm sayfalar sırayla okunur (hesap ve sütun bilgisi sayfadan sayfaya geçer)
    for sn, ws in enumerate(wb.worksheets):
        for no, r in enumerate(ws.iter_rows(values_only=True), start=1):
            if not r:
                continue
            ilk = r[0]
            if sn == 0 and no == 2 and isinstance(ilk, str):
                bilgi["firma"] = ilk.strip()
            if isinstance(ilk, str) and _kat(ilk).startswith("donem") and "donem" not in bilgi:
                bilgi["donem"] = r[1] if len(r) > 1 else None
            if isinstance(ilk, str) and _kat(ilk).startswith("tarih araligi") and "aralik" not in bilgi:
                # Luca: "Tarih Aralığı : 01/01/2026-31/12/2026" (değer aynı hücrede ya da yanındakinde)
                metin = " ".join(str(x) for x in r if x is not None)
                t = [_tarih(m) for m in re.findall(r"\d{2}[./]\d{2}[./]\d{4}", metin)]
                if len(t) >= 2 and t[0] and t[1]:
                    bilgi["aralik"] = (t[0], t[1])
            if (k := _baslik(r)) is not None:
                kolon = k
                continue
            fis_t = _hucre_tarih(r[kolon["tarih"]]) if kolon and kolon["tarih"] < len(r) else None
            if fis_t is None:
                h = _hesap(r)
                if h is not None and not (h[0] == hesap_kodu and "toplam" in _kat(h[1])):   # "191.10.20 Toplamı" satırı değil
                    hesap_kodu, hesap_adi = h
                continue
            if hesap_kodu is None:
                continue
            al = lambda alan: r[kolon[alan]] if alan in kolon and kolon[alan] < len(r) else None
            acik = str(al("aciklama") or "").strip()
            fis_no = str(al("fis_no") or "").strip()
            fis_no = re.sub(r"\.0+$", "", fis_no)          # sayı olarak gelen fiş no (12.0)
            tip = str(al("tip") or "").strip()
            if not fis_no and any(_OZET_RE.match(_kat(x)) for x in (acik, tip)):
                continue
            try:
                borc, alacak = _dec(al("borc")), _dec(al("alacak"))
            except ValueError as e:
                raise ValueError(f"{yol.name} {ws.title} satır {no}: {e}") from None
            b_t, b_no, unvan = aciklama_ayristir(acik)
            satirlar.append(MuavinSatiri(
                dosya=yol.name, satir=no if sn == 0 else (sn + 1) * 1_000_000 + no, hesap_kodu=hesap_kodu, hesap_adi=hesap_adi,
                fis_tarihi=fis_t, fis_tipi=tip, fis_no=fis_no, aciklama=acik,
                borc=borc, alacak=alacak, belge_tarihi=b_t, belge_no=b_no, unvan=unvan,
            ))
    wb.close()
    return satirlar, bilgi
