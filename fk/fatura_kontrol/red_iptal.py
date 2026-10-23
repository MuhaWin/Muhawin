"""Red / iptal edilen e-belgeler (Mikro'nun e-Fatura / e-Arşiv giden ve gelen kutusu Excel listeleri).

Kullanıcı Tek firma kontrol ya da Mikro Denetim ekranında bir ya da daha çok Excel (xls / xlsx) yükler. Örnek sütunlar
(Mikro): EFatura ID · Belge tarihi · Vergi kimlik no · Cari ünvanı · Vergi matrahı · Hesaplanan KDV · Yekün · Döviz Cinsi ·
Fatura türü · Fatura durum açıklaması · GİB durum açıklaması · Yanıt(Kabul/Red) GIB durum açıklama.

Kontrolde: listedeki fatura muavinde KAYITLI DEĞİLSE doğru ("Red / iptal – kayıt yok, uyumlu"); KAYITLIYSA sorun
("Red / iptal edilmiş fatura muavinde kayıtlı"). Listedeki faturalar e-fatura dosyalarında olmasa da muavine bakılır.
"""
from __future__ import annotations

import re
from datetime import date, datetime, timedelta
from decimal import Decimal, InvalidOperation
from pathlib import Path

DOSYA_ON_EKI = "red_iptal_"
UZANTILAR = {".xls", ".xlsx", ".xlsm"}

_BELGE = ["efatura id", "e-fatura id", "efatura no", "fatura no", "fatura numarası", "belge no", "evrak no", "ettn no", "e-belge no"]
_ALANLAR = {
    "tarih": ["belge tarihi", "fatura tarihi", "evrak tarihi", "tarih"],
    "vkn": ["vergi kimlik no", "vkn/tckn", "vkn", "tckn", "vergi no"],
    "unvan": ["cari ünvanı", "cari unvanı", "cari ünvan", "ünvan", "unvan", "alıcı", "satıcı"],
    "matrah": ["vergi matrahı", "matrah", "ara toplam"],
    "kdv": ["hesaplanan kdv", "kdv tutarı", "kdv"],
    "yekun": ["yekün", "yekun", "genel toplam", "toplam"],
    "doviz": ["döviz cinsi", "döviz", "para birimi"],
    "tur": ["fatura türü", "fatura tipi"],
}
_DURUM_SUTUN = re.compile(r"^(fatura|belge|e-?fatura|e-?ar[şs]iv)?\s*durum(u)?(\s*a[çc][ıi]klamas[ıi])?$|^iptal", re.I)
# Sütun düzenleri: muhasebe programına göre (muavin_programlari.PROGRAMLAR[...]["red_iptal"]). Yeni program = yeni kayıt.
#   belge: belge no sütun adları · alanlar: diğer sütunlar · isaret: başlık satırını tanıtan sütunlardan biri · durum: durum sütunları
DUZENLER: dict[str, dict] = {
    "mikro": {"ad": "Mikro e-Fatura / e-Arşiv giden ve gelen kutusu listesi", "belge": _BELGE, "alanlar": _ALANLAR,
              "isaret": ("belge tarihi", "fatura tarihi", "vergi kimlik no", "cari ünvanı", "evrak tarihi"), "durum": _DURUM_SUTUN},
}
VARSAYILAN_DUZEN = "mikro"
RED_RE = re.compile(r"red|ret|iptal|İPTAL|İptal", re.I)
_EBELGE = re.compile(r"^[A-Z0-9]{3}20\d{2}\d{9}$")


def _sade(s) -> str:
    return re.sub(r"\s+", " ", str(s or "")).strip()


def _k(s) -> str:
    return _sade(s).replace("İ", "i").lower()


def _sayi(v) -> Decimal:
    if v in (None, ""):
        return Decimal("0")
    if isinstance(v, (int, float)):
        return Decimal(str(round(v, 2))).quantize(Decimal("0.01"))
    t = str(v).strip().replace(" ", "")
    if "," in t and "." in t:
        t = t.replace(".", "").replace(",", ".")
    elif "," in t:
        t = t.replace(",", ".")
    try:
        return Decimal(t).quantize(Decimal("0.01"))
    except InvalidOperation:
        return Decimal("0")


def _tarih(v, datemode=0) -> date | None:
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, date):
        return v
    if isinstance(v, (int, float)) and 20000 < v < 80000:      # Excel seri tarihi
        return (datetime(1899, 12, 30) + timedelta(days=float(v))).date()
    m = re.match(r"(\d{1,2})[./-](\d{1,2})[./-](\d{4})", str(v or "").strip())
    if m:
        try:
            return date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
        except ValueError:
            return None
    m = re.match(r"(\d{4})-(\d{2})-(\d{2})", str(v or ""))
    return date(int(m.group(1)), int(m.group(2)), int(m.group(3))) if m else None


def _satirlar(yol: Path) -> list[list]:
    if yol.suffix.lower() == ".xls":
        import xlrd
        wb = xlrd.open_workbook(str(yol))
        out = []
        for sh in wb.sheets():
            out += [[sh.cell_value(r, c) for c in range(sh.ncols)] for r in range(sh.nrows)]
            out.append([])
        return out
    import openpyxl
    wb = openpyxl.load_workbook(yol, data_only=True, read_only=True)
    out = []
    for ws in wb.worksheets:
        out += [list(r) for r in ws.iter_rows(values_only=True)]
        out.append([])
    wb.close()
    return out


def _sutun(baslik: list[str], adlar: list[str]) -> int | None:
    for ad in adlar:                       # önce tam eşleşme, sonra içeren
        for i, h in enumerate(baslik):
            if h == ad:
                return i
    for ad in adlar:
        for i, h in enumerate(baslik):
            if ad in h and "karşı" not in h:
                return i
    return None


def oku(yollar: list[Path], duzen: str | None = None) -> tuple[dict[str, dict], list[str]]:
    """Excel'lerden belge no → bilgi. duzen: DUZENLER anahtarı (muhasebe programına göre). Dönüş: (liste, uyarılar)."""
    D = DUZENLER.get(duzen or VARSAYILAN_DUZEN) or DUZENLER[VARSAYILAN_DUZEN]
    liste: dict[str, dict] = {}
    uyarilar: list[str] = []
    for yol in yollar:
        yol = Path(yol)
        try:
            satirlar = _satirlar(yol)
        except Exception as e:
            uyarilar.append(f"Red / iptal listesi okunamadı: {yol.name} ({type(e).__name__})")
            continue
        yon = "ALIS" if re.search(r"al[ıi][şs]|gelen", yol.name, re.I) else "SATIS" if re.search(r"sat[ıi][şs]|giden", yol.name, re.I) else ""
        baslik, bi, durum_s, sut, adet = None, None, [], {}, 0
        for r in satirlar:
            if not r or not any(str(x or "").strip() for x in r):
                baslik = None                                   # sayfa sonu
                continue
            h = [_k(x) for x in r]
            if baslik is None:
                b = _sutun(h, D["belge"])
                if b is not None and any(x in h for x in D["isaret"]):
                    baslik, bi = h, b
                    sut = {k: _sutun(h, v) for k, v in D["alanlar"].items()}
                    durum_s = [i for i, x in enumerate(h) if D["durum"].search(x)]
                continue
            no = re.sub(r"\s+", "", str(r[bi] if bi < len(r) else "")).upper()
            if not no:
                continue
            al = lambda k: (r[sut[k]] if sut.get(k) is not None and sut[k] < len(r) else "")
            durum = " · ".join(dict.fromkeys(_sade(r[i]) for i in durum_s if i < len(r) and _sade(r[i])))
            red = bool(RED_RE.search(durum))
            liste[no] = {"belge_no": no, "tarih": _tarih(al("tarih")), "vkn": re.sub(r"\D", "", str(al("vkn") or "")),
                         "unvan": _sade(al("unvan")), "matrah": _sayi(al("matrah")), "kdv": _sayi(al("kdv")),
                         "yekun": _sayi(al("yekun")), "doviz": _sade(al("doviz")) or "TRY", "tur": _sade(al("tur")),
                         "durum": durum or "Red / iptal listesinde", "red": red, "dosya": yol.name, "yon": yon}
            adet += 1
        if not adet:
            uyarilar.append(f"Red / iptal listesinde fatura satırı bulunamadı: {yol.name} (EFatura ID / belge no sütunu aranır)")
    return liste, uyarilar


def dosyalari(klasor: Path) -> list[Path]:
    return sorted(y for y in klasor.glob(DOSYA_ON_EKI + "*") if y.suffix.lower() in UZANTILAR)


def durum_metni(b: dict) -> str:
    d = b.get("durum") or ""
    if re.search(r"İPTAL|IPTAL", d, re.I):
        return "İptal"
    if re.search(r"RED|RET", d, re.I):
        return "Red"
    return "Red / iptal"
