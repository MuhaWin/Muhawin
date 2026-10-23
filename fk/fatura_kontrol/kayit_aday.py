"""Fatura → Luca kayıt: kontrol edilen dönemin faturalarını, kayıt durumlarını ve geçmiş kayıtlardan
öğrenilen hesap önerilerini hazırlar. Fişi MuhaWin (kurallar + mizan) kurar ve Luca'ya yazar.

Geçmiş: firmanın tüm dönem klasörlerindeki (faturalar.zip + muavin) faturalardan, Luca'da hangi hesaplarla
kaydedildikleri öğrenilir: karşı taraf VKN'si → cari hesap ve gider/gelir hesabı. KDV hesapları (191/391,
oran bazında) ve tevkifat hesabı (360) muavindeki hesap adlarından bulunur.
"""
from __future__ import annotations

import json
import warnings
from collections import Counter, defaultdict
from decimal import Decimal
from pathlib import Path

from . import arsiv, depo
from .eslestirme import ISTISNA_KAYITSIZ, MUAVINDE_YOK, esle, fatura_tipi, istisnali
from .fatura_okuyucu import faturalari_oku, vkn_tespit
from .kontrol import kimlik_sec, muavin_dosyalari, muavinleri_oku

KDV_ANA = {"191", "391"}
TEVKIFAT_ANA = {"360"}


def _f(x) -> float:
    return float(Decimal(x or 0).quantize(Decimal("0.01")))


def _os(o) -> str:
    """Oran metni: Decimal('20') → '20', Decimal('0.5') → '0.5' (bilimsel gösterim olmadan)."""
    return format(Decimal(o).normalize(), "f")


def _anahtar(f) -> str:
    from .eslestirme import fatura_anahtari
    return fatura_anahtari(f)


def _donemler(firma_klasoru: Path) -> list[Path]:
    return sorted(k for k in firma_klasoru.glob("*/*") if k.is_dir() and arsiv.donem_faturalari(k) and muavin_dosyalari(k))


_STOP = {"LTD", "STI", "SIRKETI", "SIRKET", "TIC", "SAN", "VE", "AS", "A", "S", "LIMITED", "ANONIM", "TICARET", "SANAYI",
         "SANAYII", "PAZ", "INS", "ITH", "IHR", "HIZ", "TUR", "NAK", "KOLL"}


def unvan_anahtari(unvan: str) -> str:
    """Ünvanın ilk iki anlamlı kelimesi (muavin açıklamasındaki kısaltılmış ünvanla eşleşsin diye)."""
    t = (unvan or "").upper().translate(str.maketrans("İIŞĞÜÖÇÂÎÛ", "IISGUOCAIU"))
    import re
    k = [w for w in re.split(r"[^A-Z0-9]+", t) if w and w not in _STOP]
    return " ".join(k[:2])


def _aciklama_unvani(aciklama: str) -> str:
    """Luca açıklaması "GG/AA/YYYY-BELGENO-ÜNVAN" (MuhaWin kaydında tekrar edebilir) → ÜNVAN."""
    import re
    return re.sub(r"^(?:\s*\d{2}[./]\d{2}[./]\d{4}\s*-\s*[^-]+-)+", "", aciklama or "").strip()


CARI_ANA = {"120", "121", "126", "127", "128", "136", "159", "195", "320", "321", "326", "329", "331", "335", "336", "340"}


def _tum_donemler(firma_klasoru: Path) -> list[Path]:
    """Faturası ya da muavini olan tüm dönem klasörleri (FİRMA/YYYY/AA), eskiden yeniye."""
    return sorted(k for k in firma_klasoru.glob("*/*") if k.is_dir() and (arsiv.donem_faturalari(k) or muavin_dosyalari(k)))


def _yeni():
    return {"cari": Counter(), "hesap": Counter(), "fark": Counter(), "kdv": defaultdict(Counter), "adet": 0}


def _grup_ogren(g: dict, satirlar, gider_borcta: bool, w: float = 1.0):
    """Bir faturanın muavindeki satırlarından: matrah hesabı, cari, KDV hesapları (oran bazında), fark hesapları.
    w: yakınlık ağırlığı (yeni dönemlerdeki kayıtlar daha ağır basar)."""
    g["adet"] += 1
    yan: dict[bool, Counter] = {True: Counter(), False: Counter()}
    for s in satirlar:
        if s.ana_hesap in KDV_ANA:
            if s.kdv_orani is not None:
                g["kdv"][_os(s.kdv_orani)][s.hesap_kodu] += w
            continue
        if s.ana_hesap in TEVKIFAT_ANA:
            continue
        yan[(s.borc > 0) == gider_borcta][s.hesap_kodu] += float(s.borc or s.alacak)
    for matrah_yani, c in yan.items():
        if not c:
            continue
        ana, _ = c.most_common(1)[0]
        if not matrah_yani:             # cari tarafında yalnız cari hesap grupları (302 vb. değil)
            cariler = [(h, t) for h, t in c.most_common() if h[:3] in CARI_ANA]
            if not cariler:
                continue
            ana = cariler[0][0]
        (g["hesap"] if matrah_yani else g["cari"])[ana] += 1 + w     # tutar yerine kayıt sayısı (yeni kayıt ağır)
        for h in c:                 # aynı faturadaki küçük satırlar (gecikme bedeli, yuvarlama…) → fark hesabı
            if h != ana:
                g["fark"][h] += w


def ogren(firma_klasoru: Path, vkn: str | None):
    """Geçmiş kayıtlar. Dönüş: (VKN'ye göre, ünvana göre, KDV hesapları, tevkifat hesabı, hesap adları).
    VKN'ye göre: dönem klasöründeki faturalar muavinde belge no ile bulunur. Ünvana göre: faturası elde olmayan
    önceki aylar için muavin açıklamasındaki ünvandan (Luca: "tarih-belge no-ünvan")."""
    gecmis: dict[str, dict] = defaultdict(_yeni)
    unv: dict[str, dict] = defaultdict(_yeni)
    kdv = {"ALIS": defaultdict(Counter), "SATIS": defaultdict(Counter)}
    tevk = Counter()
    adlar: dict[str, str] = {}
    gorulen: set = set()
    kelime: dict[tuple, Counter] = defaultdict(Counter)      # (yön, kalem kelimesi) → matrah hesabı
    # Muavin artık yıllık indirilir: tüm dönem klasörlerinin muavinleri ve faturaları birleştirilir (aynı satır bir kez),
    # böylece bir ayın faturası başka ayın klasöründeki (ya da yıllık) muavinde bulunsa da öğrenilir.
    muavin, gor_s = [], set()
    ft_tum, gor_f = [], set()
    for k in reversed(_tum_donemler(firma_klasoru)):        # yeniden eskiye
        try:
            md = muavin_dosyalari(k)
            if md:
                for s in muavinleri_oku(md)[0]:
                    a = (s.hesap_kodu, s.fis_tarihi, s.fis_no, s.borc, s.alacak, s.belge_no, s.aciklama)
                    if a not in gor_s:
                        gor_s.add(a)
                        muavin.append(s)
        except Exception:
            pass
        try:
            fz = arsiv.donem_faturalari(k)
            if fz:
                for f in kimlik_sec(fz, vkn)[0]:
                    a = (f.yon, f.belge_no.upper().replace(" ", ""))
                    if a not in gor_f:
                        gor_f.add(a)
                        ft_tum.append(f)
        except Exception:
            pass
    son = max((s.fis_tarihi for s in muavin if s.fis_tarihi), default=None)

    def agirlik(t) -> float:                                # yakın tarihli kayıt daha ağır
        if not son or not t:
            return 0.5
        ay = max(0, (son.year - t.year) * 12 + son.month - t.month)
        return 1.0 / (1 + 0.15 * ay)

    idx = defaultdict(list)
    fis_idx = defaultdict(list)
    for s in muavin:
        fis_idx[(s.fis_no, s.fis_tarihi)].append(s)
    for s in muavin:
        adlar.setdefault(s.hesap_kodu, s.hesap_adi)
        if s.belge_no:
            idx[s.belge_no].append(s)
        if s.ana_hesap == "191" and s.kdv_orani is not None and s.borc:
            kdv["ALIS"][_os(s.kdv_orani)][s.hesap_kodu] += agirlik(s.fis_tarihi)
        if s.ana_hesap == "391" and s.kdv_orani is not None and s.alacak:
            kdv["SATIS"][_os(s.kdv_orani)][s.hesap_kodu] += agirlik(s.fis_tarihi)
        if s.ana_hesap in TEVKIFAT_ANA and ("TEVK" in s.hesap_adi.upper() or "KDV" in s.hesap_adi.upper()):
            tevk[s.hesap_kodu] += 1
    for f in ft_tum:
        b = f.belge_no.upper().replace(" ", "")
        satirlar = idx.get(b) or idx.get(f.belge_no)
        if satirlar:    # aynı numara başka firmaya / aya aitse öğrenmeye katılmaz (fatura no + ay, yoksa aynı cari)
            from .eslestirme import _faturanin_satirlari
            satirlar = _faturanin_satirlari(f, satirlar, fis_idx)[0]
        if not satirlar or f.yon not in ("ALIS", "SATIS") or b in gorulen:
            continue
        gorulen.add(b)
        w = agirlik(satirlar[0].fis_tarihi)
        # matrah hesabı alış faturasında borçta, satış faturasında alacakta (iadelerde de aynı yön kuralı)
        _grup_ogren(gecmis[f.karsi_vkn], satirlar, f.yon == "ALIS", w)
        _grup_ogren(unv[unvan_anahtari(f.karsi_unvan)], satirlar, f.yon == "ALIS", w)
        mh = [x for x in satirlar if x.ana_hesap not in KDV_ANA and x.ana_hesap not in TEVKIFAT_ANA
              and x.ana_hesap not in CARI_ANA and ((x.borc > 0) == (f.yon == "ALIS"))]
        if mh:
            ana = max(mh, key=lambda x: x.borc or x.alacak).hesap_kodu
            for t in kalem_kelimeleri(f.kalemler):
                kelime[(f.yon, t)][ana] += w
    for b, satirlar in idx.items():               # faturası elde olmayan kayıtlar: ünvan açıklamadan
        bb = b.upper().replace(" ", "")
        if bb in gorulen:
            continue
        anah = {s.ana_hesap for s in satirlar}
        if "191" in anah and "391" not in anah:
            alis = True
        elif "391" in anah and "191" not in anah:
            alis = False
        else:
            continue
        u = unvan_anahtari(_aciklama_unvani(satirlar[0].aciklama))
        if not u:
            continue
        gorulen.add(bb)
        _grup_ogren(unv[u], satirlar, alis, agirlik(satirlar[0].fis_tarihi))

    def en(c):
        return c.most_common(1)[0][0] if c else None

    def ozet(d):
        return {v: {"cari": en(x["cari"]), "hesap": en(x["hesap"]), "fark": en(x["fark"]), "adet": x["adet"],
                    "kdv": {o: en(c) for o, c in x["kdv"].items()}} for v, x in d.items()}
    ogren.kelime = kelime          # adaylar() için (dönüş biçimi değişmesin)
    return (ozet(gecmis), ozet(unv), {y: {o: en(c) for o, c in d.items()} for y, d in kdv.items()}, en(tevk), adlar)


def kalem_kelimeleri(kalemler) -> set[str]:
    import re
    out = set()
    for k in kalemler or []:
        for t in re.split(r"[^0-9A-ZÇĞİÖŞÜ]+", str(k).upper().replace("I", "I")):
            if len(t) >= 4 and not t.isdigit() and t not in _STOP:
                out.add(t)
    return out


def kelime_onerisi(kelime: dict, yon: str, kalemler) -> str | None:
    """Geçmişte benzer kalemli faturaların kaydedildiği matrah hesabı (kelime oylaması)."""
    oy: Counter = Counter()
    ts = kalem_kelimeleri(kalemler)
    for t in ts:
        c = kelime.get((yon, t))
        if c:
            top = sum(c.values())
            for h, n in c.items():
                oy[h] += n / top
    if not oy:
        return None
    h, n = oy.most_common(1)[0]
    return h if n >= max(1.0, len(ts) * 0.3) else None


def adaylar(rapor_id: str) -> dict:
    warnings.filterwarnings("ignore", module="openpyxl")
    k = depo.rapor_klasoru(rapor_id)
    if not k:
        raise FileNotFoundError("Rapor bulunamadı")
    zipler = arsiv.donem_faturalari(k) or sorted(k.glob("gib_*.zip"))
    muavinler = muavin_dosyalari(k)
    if not zipler:
        raise FileNotFoundError("Bu dönemin faturaları bulunamadı")
    rapor_json = {}
    try:
        rapor_json = json.loads((k / depo.RAPOR_JSON).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        pass
    firma_k = k.parent.parent
    try:
        bilgi_f = json.loads((firma_k / "firma.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        bilgi_f = {}
    vkn = rapor_json.get("vkn") or bilgi_f.get("vkn") or vkn_tespit(zipler)
    ft, uyarilar, vkn = kimlik_sec(zipler, vkn)
    muavin, bilgi = muavinleri_oku(muavinler) if muavinler else ([], {})
    d = rapor_json.get("donem") or {}
    aralik = d.get("Alış") or d.get("Satış")
    from datetime import date, timedelta
    if aralik:
        bas, bit = date.fromisoformat(aralik[0]), date.fromisoformat(aralik[1])
    else:                                   # rapor yoksa dönem klasöründen (FİRMA/YYYY/AA)
        bas = date(int(k.parent.name), int(k.name), 1)
        bit = (bas.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)
    rapor = esle(ft, muavin, Decimal("0.05"), (bas, bit) if bas else None)
    durum = {}
    for s in rapor.sonuclar:
        a = _anahtar(s.fatura)
        if a not in durum or s.durum in (MUAVINDE_YOK, ISTISNA_KAYITSIZ):
            durum[a] = s.durum
    gecmis, gecmis_u, kdv_h, tevk_h, adlar = ogren(firma_k, vkn)
    kelime = getattr(ogren, "kelime", {})

    def _kelime_gecmis(f):
        h = kelime_onerisi(kelime, f.yon, f.kalemler)
        return {"hesap": h, "cari": None, "fark": None, "adet": 0, "kdv": {}, "kaynak": "benzer kalem"} if h else None
    haric = depo.haric_oku(firma_k)
    from .eslestirme import haric_kurali, KURAL_ALANLARI
    kurallar = depo.haric_kurallari_oku(firma_k)
    faturalar = []
    for f in sorted(ft, key=lambda f: (f.tarih, f.belge_no)):
        if bas and not (bas <= f.tarih <= bit):
            continue
        a = _anahtar(f)
        dr = durum.get(a, "")
        faturalar.append({
            "anahtar": a, "belge_no": f.belge_no, "ettn": f.ettn, "tarih": f.tarih.isoformat(), "yon": f.yon,
            "tip": (f.tip or "").upper(), "profil": f.profil, "fatura_tipi": fatura_tipi(f), "istisna": istisnali(f),
            "ihrac_kayitli": (f.tip or "").upper() == "IHRACKAYITLI",
            "karsi_vkn": f.karsi_vkn, "karsi_unvan": f.karsi_unvan, "kalemler": f.kalemler,
            "matrah": _f(f.matrah), "kdv": _f(f.kdv_toplam), "odenecek": _f(f.odenecek), "vergiler_dahil": _f(f.vergiler_dahil),
            "tevkifat": _f(f.tevkifat),
            "oranlar": [{"oran": _os(o), "matrah": _f(f.matrah_oranlari.get(o, 0)), "kdv": _f(v)}
                        for o, v in sorted(f.kdv_oranlari.items())],
            "diger_vergiler": {ad: _f(v) for ad, v in f.diger_vergiler.items() if v},
            "komisyoncu": bool(getattr(f, "komisyoncu", False)),
            "masraflar": [{"ad": m["ad"], "tutar": _f(m["tutar"]), "oran": _os(m["oran"]) if m.get("oran") is not None else None,
                           "kdv": _f(m["kdv"]), "kdv_oran": _os(m["kdv_oran"]) if m.get("kdv_oran") is not None else None}
                          for m in getattr(f, "masraflar", [])],
            "doviz": f.doviz, "tl_yok": bool(f.doviz and f.tl_kaynak is None),
            "durum": dr, "kayitli": dr not in (MUAVINDE_YOK, ISTISNA_KAYITSIZ, ""),
            "haric": haric.get(a) or ((lambda k: {"kural": True, "aciklama": f"Kural: {KURAL_ALANLARI.get(k.get('alan'), '')} \"{k.get('ifade', '')}\""}
                                                   if k else None)(haric_kurali(f, kurallar))),
            "gecmis": gecmis.get(f.karsi_vkn) or gecmis_u.get(unvan_anahtari(f.karsi_unvan)) or _kelime_gecmis(f),
        })
    return {"id": rapor_id, "firma": rapor_json.get("firma") or bilgi.get("firma") or firma_k.name, "klasor_ad": firma_k.name,
            "luca_id": bilgi_f.get("luca_id"), "vkn": vkn, "donem": [bas.isoformat() if bas else None, bit.isoformat() if bit else None],
            "muavin_var": bool(muavinler), "isletme": any(m.suffix == ".json" for m in muavinler), "kdv_hesaplari": kdv_h, "tevkifat_hesabi": tevk_h,
            "hesaplar": adlar, "faturalar": faturalar, "uyarilar": uyarilar[:20]}
