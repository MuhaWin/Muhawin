"""Tek firma ve toplu kontrolün ortak çekirdeği.

Her iki yol da aynı adımları izler: faturalar dönem klasöründeki aylık arşivden (faturalar.zip) okunur,
muavin(ler) dönem klasöründen okunur, şahıs firmasında TCKN'ye düşülür, aynı eşleştirme kurallarıyla
(fatura tipi, ihraç kayıtlı, istisna, binek, döviz, tevkifat…) karşılaştırılır ve rapor aynı biçimde
(Excel + JSON + çıktı raporu için muavin) dönem klasörüne yazılır.
"""
from __future__ import annotations

import shutil
import warnings
import zipfile
from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path

from . import arsiv, depo
from .eslestirme import esle
from .fatura_okuyucu import faturalari_oku, vkn_tespit
from .muavin_okuyucu import muavin_oku


def muavin_dosyalari(klasor: Path) -> list[Path]:
    """Dönem klasöründeki muavin dosyaları (muavin.xlsx, muavin_2.xlsx …)."""
    return sorted([*klasor.glob("muavin*.xlsx"), *klasor.glob("muavin_isletme*.json")], key=lambda p: (p.stem != "muavin", p.stem))


def muavinleri_oku(yollar: list[Path], program: str | None = None):
    """Muavin dosyalarını okur; program verilmezse dönem klasöründeki kayda göre (yoksa Luca)."""
    from . import muavin_programlari as MP
    satirlar, firma = [], ""
    for y in yollar:
        s, bilgi = MP.oku(y, program)
        satirlar.extend(s)
        firma = firma or bilgi.get("firma", "")
    return satirlar, {"firma": firma}


def kimlik_sec(zipler: list[Path], vkn: str | None):
    """Faturaları okur; Luca VKN'si faturalarda yoksa (şahıs firması) faturalardaki TCKN'ye düşer."""
    vkn = vkn or vkn_tespit(zipler)
    ft, uyarilar = faturalari_oku(zipler, vkn)
    atlanan = sum("Firma VKN'si faturada yok" in u for u in uyarilar)
    if atlanan > len(ft):
        tespit = vkn_tespit(zipler)
        if tespit and tespit != vkn and len(tespit) == 11:   # yalnız TCKN
            ft2, uy2 = faturalari_oku(zipler, tespit)
            if len(ft2) > len(ft):
                uy2.insert(0, f"Faturalarda firma kimliği {tespit} (Luca'daki VKN {vkn}); şahıs firması "
                              f"olabilir, kontrol {tespit} ile yapıldı.")
                return ft2, uy2, tespit
    return ft, uyarilar, vkn


def calistir(klasor: Path, bas: date, bit: date, vkn: str | None = None, firma: str = "",
             on_uyarilar: list[str] | None = None, tolerans: Decimal = Decimal("0.05"),
             zipler: list[Path] | None = None, muavinler: list[Path] | None = None) -> dict | None:
    """Dönem klasöründeki arşiv ve muavinle kontrolü yapar, raporu kaydeder."""
    warnings.filterwarnings("ignore", module="openpyxl")
    zipler = zipler or arsiv.donem_faturalari(klasor) or sorted(klasor.glob("gib_*.zip"))
    muavinler = muavinler or muavin_dosyalari(klasor)
    if not zipler or not muavinler:
        return None
    ft, uyarilar, vkn = kimlik_sec(zipler, vkn)
    muavin, bilgi = muavinleri_oku(muavinler)
    from . import red_iptal
    red, red_uyari = red_iptal.oku(red_iptal.dosyalari(klasor))
    uyarilar = uyarilar + red_uyari
    rapor = esle(ft, muavin, tolerans, (bas, bit), red=red)
    from .web.app import rapor_kaydet
    uyarilar = list(on_uyarilar or []) + arsiv.paket_uyarilari(klasor) + uyarilar
    if any(Path(m).suffix == ".json" for m in muavinler):
        uyarilar.insert(0, "İşletme / serbest meslek defteri: kayıtlar Luca Gelir ve Gider Listesi'nden alındı "
                           "(listede KDV oranı olmadığından oran kontrolü yapılmaz; KDV toplamı karşılaştırılır).")
    return rapor_kaydet(rapor, ft, uyarilar, bilgi.get("firma") or firma or "", vkn, klasor=klasor)


def yuklenenleri_yerlestir(fatura_yollari: list[Path], muavin_yollari: list[Path], bas: date | None,
                           bit: date | None, vkn: str | None, program: str = "luca", firma_id: str | None = None,
                           firma_ad: str | None = None, red_yollari: list[Path] | None = None) -> tuple[Path, date, date, str, str]:
    """Tek firma (dosyadan) kontrol: yüklenen dosyaları toplu kontroldeki gibi firmanın dönem klasörüne yerleştirir.
    Dönüş: (dönem klasörü, bas, bit, vkn, firma adı)."""
    vkn = vkn or vkn_tespit(fatura_yollari)
    if not vkn:
        raise ValueError("Yüklenen dosyalarda okunabilir fatura bulunamadı.")
    ft, _ = faturalari_oku(fatura_yollari, vkn)
    _, bilgi = muavinleri_oku(muavin_yollari, program)
    if not (bas and bit):
        tarihler = sorted(f.tarih for f in ft)
        if not tarihler:
            raise ValueError("Faturalarda tarih bulunamadı; kontrol dönemini seçin.")
        ilk = tarihler[0]
        bas = ilk.replace(day=1)
        bit = (bas.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)
    # seçilen firma (Luca SIRKET_ID): toplu kontrolle aynı klasör → rapor Luca firmasıyla ilişkili olur (fiş aktarımı)
    ad = (depo.luca_ile_firma(firma_id) if firma_id else None) or (firma_ad or "").strip() or depo.vkn_ile_firma(vkn) \
        or bilgi.get("firma") or vkn
    klasor = depo.donem_temizle(depo.donem_klasoru(ad, bas))
    depo.firma_bilgisi_yaz(ad, vkn, firma_id or None)
    # faturalar: toplu kontroldeki Luca paketleri gibi ZIP olarak, sonra aylık arşive
    for i, y in enumerate(fatura_yollari, 1):
        hedef = klasor / f"gib_yukleme_dosya_{i}.zip"
        if y.suffix.lower() == ".zip":
            shutil.copyfile(y, hedef)
        else:
            with zipfile.ZipFile(hedef, "w", zipfile.ZIP_DEFLATED) as z:
                z.write(y, y.name)
    arsiv.arsive_al(ad, sorted(klasor.glob("gib_*.zip")))
    for i, y in enumerate(muavin_yollari):
        if y.suffix.lower() == ".json":                    # işletme defteri listesi (Luca'dan çekilmiş)
            shutil.copyfile(y, klasor / ("muavin_isletme.json" if i == 0 else f"muavin_isletme_{i + 1}.json"))
        else:
            shutil.copyfile(y, klasor / ("muavin.xlsx" if i == 0 else f"muavin_{i + 1}.xlsx"))
    from . import muavin_programlari as MP
    MP.klasore_yaz(klasor, program)
    from .red_iptal import DOSYA_ON_EKI
    for i, y in enumerate(red_yollari or [], 1):       # red / iptal listeleri (Mikro Excel): kontrol ve rapor yenilemede okunur
        shutil.copyfile(y, klasor / f"{DOSYA_ON_EKI}{i}_{y.name}")
    return klasor, bas, bit, vkn, ad
