"""Fatura–Muavin Kontrol: pilot web arayüzü (Faz 2).

Çalıştırma:  python -m fatura_kontrol.web   ->  http://127.0.0.1:8000
Veriler (raporlar ve geçmiş) bilgisayarda 'veri' klasöründe tutulur; hiçbir yere gönderilmez.
"""
from __future__ import annotations

import json
import re
import os
import shutil
import tempfile
import uuid
import zipfile
import warnings
from datetime import date, datetime, timedelta
from decimal import Decimal
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from pydantic import BaseModel

from ..eslestirme import fatura_anahtari
from ..fatura_okuyucu import GirdiSiniri, faturalari_oku, vkn_tespit
from ..muavin_okuyucu import muavin_oku
from ..rapor_kayit import _db, _sayi, _t, _tarih, defter_turu, rapor_oku, rapor_yenile  # rapor kaydı web sunucusundan ayrı (Görev 08)

warnings.filterwarnings("ignore", module="openpyxl")

from .. import arsiv, ayarlar, bildirim, depo
from ..fis_cikti import FIS_EK_CSS, TDHP, ana_hesap_ozeti, fis_ek_html

VERI = depo.veri()
VERI.mkdir(parents=True, exist_ok=True)
STATIK = Path(__file__).parent / "static"
FATURA_UZANTI = {".zip", ".xml"}
MUAVIN_UZANTI = {".xlsx"}

app = FastAPI(title="Fatura–Muavin Kontrol")

# MuhaWin içinde: yalnız MuhaWin penceresinden gelen istekler kabul edilir (Electron her isteğe başlık ekler).
@app.middleware("http")
async def _muhawin_kapisi(request, call_next):
    anahtar = os.environ.get("FK_ANAHTAR") or ""
    if anahtar and request.url.path != "/api/saglik":
        import hmac
        esit = lambda x: hmac.compare_digest(str(x or "").encode(), anahtar.encode())
        # MuhaWin: X-MuhaWin başlığı. Bağımsız çalıştırma (python -m fatura_kontrol.web): açılış adresindeki
        # ?anahtar= bir kez çereze alınır (yalnız bu site, JavaScript'e kapalı); sonraki istekler çerezle gelir.
        if not (esit(request.headers.get("x-muhawin")) or esit(request.cookies.get("fk_anahtar"))):
            if request.method == "GET" and esit(request.query_params.get("anahtar")):
                from fastapi.responses import RedirectResponse
                r = RedirectResponse(request.url.path, status_code=303)
                r.set_cookie("fk_anahtar", anahtar, httponly=True, samesite="strict")
                return r
            return JSONResponse({"detail": "Bu sayfa yalnız MuhaWin içinden açılır."}, status_code=403)
    return await call_next(request)


# Yükleme üst sınırı (rapor-02 G-F, Görev 26): bir istekte en çok 2 GB (yıllık GİB arşivleri birkaç yüz MB)
YUKLEME_EN_COK = int(os.environ.get("FK_YUKLEME_SINIR_MB") or 2048) * 1024 * 1024
_YUKLEME_MESAJI = (f"Yüklenen dosyalar çok büyük (en çok {YUKLEME_EN_COK // 1024 // 1024} MB). "
                   "Dosyaları dönemlere bölüp ayrı ayrı yükleyin.")


@app.middleware("http")
async def _yukleme_siniri(request, call_next):
    try:
        boyut = int(request.headers.get("content-length") or 0)
    except ValueError:
        boyut = 0
    if boyut > YUKLEME_EN_COK:
        return JSONResponse({"detail": _YUKLEME_MESAJI}, status_code=413)
    return await call_next(request)


@app.exception_handler(GirdiSiniri)
async def _girdi_siniri(request, e: GirdiSiniri):
    return JSONResponse({"detail": str(e)}, status_code=400)


def _kopyala(kaynak, hedef: Path, sayac: list[int]):
    """Yüklenen dosyayı diske yazar; istek başına toplam boyut sınırı (Content-Length gelmeyen istekler için de)."""
    with hedef.open("wb") as out:
        while parca := kaynak.read(1024 * 1024):
            sayac[0] += len(parca)
            if sayac[0] > YUKLEME_EN_COK:
                raise HTTPException(413, _YUKLEME_MESAJI)
            out.write(parca)


async def _red_kaydet(dosyalar: list[UploadFile] | None, hedef: Path) -> list[Path]:
    """Red / iptal listeleri: dosya adı korunur (adındaki 'alış' / 'satış' yönü gösterir)."""
    from ..red_iptal import UZANTILAR
    hedef.mkdir(parents=True, exist_ok=True)
    yollar, sayac = [], [0]
    for i, d in enumerate(dosyalar or []):
        if not d.filename:
            continue
        ad = Path(d.filename).name
        if Path(ad).suffix.lower() not in UZANTILAR:
            raise HTTPException(400, f"Red / iptal listesi Excel olmalı (xls / xlsx): {ad}")
        ad = re.sub(r'[<>:"/\\|?*\x00-\x1f]+', "_", ad)[-80:]
        y = hedef / f"{i:02d}_{ad}"
        _kopyala(d.file, y, sayac)
        yollar.append(y)
    return yollar


async def _kaydet(dosyalar: list[UploadFile], hedef: Path, uzantilar: set[str]) -> list[Path]:
    yollar, sayac = [], [0]
    for i, d in enumerate(dosyalar):
        if not d.filename:
            continue
        uz = Path(d.filename).suffix.lower()
        if uz not in uzantilar:
            raise HTTPException(400, f"Desteklenmeyen dosya: {d.filename} (beklenen: {', '.join(sorted(uzantilar))})")
        y = hedef / f"{i:03d}{uz}"
        _kopyala(d.file, y, sayac)
        yollar.append(y)
    return yollar


@app.get("/", response_class=HTMLResponse)
def ana_sayfa():
    return (STATIK / "index.html").read_text(encoding="utf-8")


@app.get("/toplu", response_class=HTMLResponse)
def toplu_sayfa():
    return (STATIK / "toplu.html").read_text(encoding="utf-8")


@app.get("/beyanname", response_class=HTMLResponse)
def beyanname_sayfa():
    return (STATIK / "beyanname.html").read_text(encoding="utf-8")


@app.get("/denetim", response_class=HTMLResponse)
def denetim_sayfa():
    return (STATIK / "denetim.html").read_text(encoding="utf-8")


# İşletme / serbest meslek defterine fatura aktarımı (Luca fiş Excel'i, Luca'ya kaydet) şimdilik kapalı (kullanıcı kararı 23.10.2026)
ISLETME_AKTARIM_ACIK = os.environ.get("FK_ISLETME_AKTARIM") == "1"
_YAKINDA = """<!doctype html><html lang=tr><meta charset=utf-8><title>Çok yakında</title>
<body style="font:15px system-ui,Segoe UI,Arial;display:grid;place-items:center;min-height:90vh;margin:0;color:#334">
<div style="text-align:center;max-width:460px"><div style="font-size:40px">📒</div><h2 style="margin:8px 0">Çok yakında</h2>
<p>İşletme ve serbest meslek defterlerine Luca fiş aktarımı hazırlanıyor. Bu firmaların fatura – muavin kontrolü ve raporları
bilanço firmalarındaki gibi çalışır.</p></div></body></html>"""


@app.get("/isletme-fis", response_class=HTMLResponse)
def isletme_fis_sayfa():
    if not ISLETME_AKTARIM_ACIK:
        return HTMLResponse(_YAKINDA)
    return (STATIK / "isletme-fis.html").read_text(encoding="utf-8")


# ------------------------------------------------------------------ işletme / serbest meslek: Luca Excel'den fiş aktarma
def _ifis_donem(id: str = "", firma_id: str = "", bas: str = "") -> tuple[str, Path, date, date, set]:
    """Rapor kimliği (FİRMA/YYYY/AA) ya da Luca firması + dönem → (firma adı, dönem klasörü, bas, bit, firma kimlikleri)."""
    from calendar import monthrange
    if id:
        k = depo.rapor_klasoru(id)
        if not k:
            raise HTTPException(404, "Rapor bulunamadı")
        ad, yil, ay = id.split("/")
        b = date(int(yil), int(ay), 1)
    else:
        ad = depo.luca_ile_firma(firma_id) if firma_id else None
        b = _tarih(bas)
        if not ad or not b:
            raise HTTPException(400, "Firma ve dönem seçin")
        b = b.replace(day=1)
        k = depo.donem_klasoru(ad, b)
    e = b.replace(day=monthrange(b.year, b.month)[1])
    kim = set()
    try:
        fj = json.loads((depo.firma_klasoru(ad) / "firma.json").read_text(encoding="utf-8"))
        kim.add(str(fj.get("vkn") or ""))
    except (OSError, ValueError):
        pass
    try:
        kim.add(str(json.loads((k / depo.RAPOR_JSON).read_text(encoding="utf-8")).get("vkn") or ""))
    except (OSError, ValueError):
        pass
    return ad, k, b, e, {x for x in kim if x}


@app.get("/api/isletme-fis")
def isletme_fis_satirlar(id: str = "", firma_id: str = "", bas: str = ""):
    from .. import isletme_fis as I
    ad, k, b, e, kim = _ifis_donem(id, firma_id, bas)
    zipler = arsiv.donem_faturalari(k) or sorted(k.glob("gib_*.zip"))
    if not zipler:
        raise HTTPException(400, f"{ad} için {b:%m.%Y} döneminde fatura yok. Önce kontrolü yapın ya da faturaları Luca'dan alın.")
    v = I.satirlar_hazirla(zipler, ad, kim, b, e)
    return {**v, "firma": ad, "bas": b.isoformat(), "bit": e.isoformat(), "listeler": I.listeler_oku(),
            "kategoriler": I.KATEGORILER, "basliklar": I.BASLIKLAR, "anahtarlar": I.ANAHTAR}


@app.put("/api/isletme-fis/ayar")
def isletme_fis_ayar(b: dict):
    from .. import isletme_fis as I
    ad = str(b.get("firma") or "").strip()
    if not ad or not depo.firma_klasoru(ad).exists():
        raise HTTPException(404, "Firma bulunamadı")
    return I.ayar_yaz(ad, b)


@app.post("/api/isletme-fis/excel")
def isletme_fis_excel(b: dict):
    """Ekranda düzenlenen satırlar → dönem klasörüne Luca aktarım Excel'i; seçimler karşı tarafa göre öğrenilir."""
    if not ISLETME_AKTARIM_ACIK:
        raise HTTPException(403, "Çok yakında: işletme / serbest meslek defterine Luca fiş aktarımı hazırlanıyor.")
    from .. import isletme_fis as I
    ad, k, bas_, _, _ = _ifis_donem(str(b.get("id") or ""), str(b.get("firma_id") or ""), str(b.get("bas") or ""))
    satirlar = [r for r in (b.get("satirlar") or []) if isinstance(r, dict)]
    if not satirlar:
        raise HTTPException(400, "Aktarılacak satır yok")
    for r in satirlar:
        for x in I.SAYISAL:
            try:
                r[x] = float(str(r.get(x) or 0).replace(",", "."))
            except ValueError:
                raise HTTPException(400, f"{r.get('evrak_no', '')}: {x} sayı olmalı")
    k.mkdir(parents=True, exist_ok=True)
    I.excel_yaz(satirlar, k / "luca_fis_aktarim.xlsx")
    I.secimleri_ogren(ad, satirlar)
    rid = f"{ad}/{bas_:%Y}/{bas_:%m}"
    return {"tamam": True, "adet": len(satirlar), "indir": f"/api/isletme-fis/indir?id={rid}", "yol": str(k / "luca_fis_aktarim.xlsx")}


@app.get("/api/isletme-fis/indir")
def isletme_fis_indir(id: str):
    k = depo.rapor_klasoru(id)
    y = k / "luca_fis_aktarim.xlsx" if k else None
    if not y or not y.exists():
        raise HTTPException(404, "Önce Excel'i hazırlayın")
    ad, yil, ay = id.split("/")
    kisa = "".join(c for c in ad.replace(" ", "_") if c.isalnum() or c == "_") or "firma"
    return FileResponse(y, filename=f"{kisa}_{yil}-{ay}_luca_fis.xlsx")


@app.get("/api/isletme-fis/listeler")
def isletme_fis_listeler():
    from .. import isletme_fis as I
    return I.listeler_oku()


@app.post("/api/isletme-fis/listeler")
def isletme_fis_listeler_kaydet(b: dict):
    """MuhaWin'in Luca penceresinde açık işletme fiş ekranındaki açılır listeler."""
    from .. import isletme_fis as I
    ham = [x for x in (b.get("listeler") or []) if isinstance(x, dict)]
    if not ham:
        raise HTTPException(400, "Luca ekranında açılır liste bulunamadı. İşletme defteri fiş giriş ekranını açıp tekrar deneyin.")
    return I.listeleri_kaydet(ham, datetime.now().isoformat(timespec="minutes"))


@app.get("/simge.ico")
def simge():
    return FileResponse(STATIK / "simge.ico")


@app.get("/imlec.css")
def imlec_css():
    return FileResponse(STATIK / "imlec.css", media_type="text/css")


@app.get("/tema.css")
def tema_css():
    return FileResponse(STATIK / "tema.css", media_type="text/css")


@app.get("/captcha.js")
def captcha_js():
    return FileResponse(STATIK / "captcha.js", media_type="application/javascript")


@app.get("/tema.js")
def tema_js():
    return FileResponse(STATIK / "tema.js", media_type="application/javascript")


@app.get("/api/saglik")
def saglik():
    return {"uygulama": "fatura-kontrol", "muhawin": bool(os.environ.get("FK_MUHAWIN"))}


from .toplu_api import router as _toplu_router   # noqa: E402
app.include_router(_toplu_router)


def _luca_fatura_arsivi(firma_id: str, bas: date | None) -> Path | None:
    """Firmanın dönem klasöründe Luca'dan (toplu otomasyonla) alınmış faturaların arşivi."""
    k = _luca_donem_klasoru(firma_id, bas)
    a = arsiv.donem_faturalari(k) if k else []
    return a[0] if a else None


def _luca_donem_klasoru(firma_id: str, bas: date | None) -> Path | None:
    ad = depo.luca_ile_firma(firma_id) if firma_id else None
    if not ad and firma_id:            # toplu listedeki Luca kısa adı (yalnız faturaları alınmış firma)
        from ..luca import toplu as T
        ad = next((depo.guvenli_ad(f["ad"]) for f in T.liste_oku() if str(f["id"]) == str(firma_id) and f.get("ad")), None)
    if not ad or not bas:
        return None
    return depo.donem_klasoru(ad, bas)


def _luca_muavini(firma_id: str, bas: date | None) -> Path | None:
    """Firmanın dönem klasöründe Luca'dan (toplu otomasyon, muavin adımı) alınmış muavin (xlsx; işletme defteri değil)."""
    from ..luca import toplu as T
    k = _luca_donem_klasoru(firma_id, bas)
    if not k or not (k / "muavin.xlsx").exists():
        return None
    if not any(a["kod"] == "muavin" and a["durum"] == "tamam" for a in T.adim_ozeti(T.adimlari_oku(k))):
        return None                          # dosya kullanıcının yüklediği muavin olabilir: Luca'dan alınmamış
    return k / "muavin.xlsx"


@app.get("/api/kontrol/luca-faturalari")
def luca_faturalari(firma_id: str, bas: str):
    """Tek firma › "Luca'dan al": seçili ayda firmanın klasöründe Luca'dan alınmış kaç fatura var."""
    from ..luca import toplu as T
    k = _luca_donem_klasoru(firma_id.strip(), _tarih(bas))
    # Luca'dan indirilemeyen türler (adım kayıtlarından): yalnız o tür yeniden denenebilir ya da XML olarak eklenebilir
    eksik = [{"kod": a["kod"], "ad": a["ad"], "durum": a["durum"]} for a in (T.adim_ozeti(T.adimlari_oku(k)) if k and k.exists() else [])
             if a.get("kod") and a["kod"] != "muavin" and a.get("durum") in ("hata", "yarim")]
    mv = _luca_muavini(firma_id.strip(), _tarih(bas))
    muavin = {"zaman": datetime.fromtimestamp(mv.stat().st_mtime).isoformat(timespec="minutes")} if mv else None
    y = _luca_fatura_arsivi(firma_id.strip(), _tarih(bas))
    if not y:
        return {"adet": 0, "eksik": eksik, "muavin": muavin}
    turler: dict[str, int] = {}
    kokler: set[str] = set()                 # aynı fatura arşivde iki adla bulunabilir (eski sürüm): bir kez sayılır
    with zipfile.ZipFile(y) as z:
        for ad in z.namelist():
            kok = ad.rsplit("/", 1)[-1].upper()
            if ad.lower().endswith(".xml") and kok not in kokler:
                kokler.add(kok)
                t = ad.split("/")[0]
                turler[t] = turler.get(t, 0) + 1
    adet = len(kokler)
    return {"adet": adet, "turler": turler, "eksik": eksik, "muavin": muavin,
            "zaman": datetime.fromtimestamp(y.stat().st_mtime).isoformat(timespec="minutes")}


# ------------------------------------------------------------------ Bilgisayardaki belgelerle yeniden kontrol / denetim
def _yerel_firma(firma_id: str = "", firma_ad: str = "", vkn: str = "") -> str | None:
    """Seçili firmanın bu bilgisayardaki klasör adı (Luca SIRKET_ID → VKN → ad → toplu listedeki Luca adı)."""
    firma_id, firma_ad, vkn = (firma_id or "").strip(), (firma_ad or "").strip(), (vkn or "").strip()
    adaylar = [depo.luca_ile_firma(firma_id) if firma_id else None, depo.vkn_ile_firma(vkn) if vkn else None,
               depo.guvenli_ad(firma_ad) if firma_ad else None]
    if firma_id:
        from ..luca import toplu as T
        adaylar.append(next((depo.guvenli_ad(f["ad"]) for f in T.liste_oku() if str(f["id"]) == firma_id and f.get("ad")), None))
    return next((a for a in adaylar if a and depo.firma_klasoru(a).is_dir()), None)


def _arsiv_adet(y: Path) -> int:
    try:
        with zipfile.ZipFile(y) as z:
            return len({n.rsplit("/", 1)[-1].upper() for n in z.namelist() if n.lower().endswith(".xml")})
    except (OSError, zipfile.BadZipFile):
        return 0


def _yerel_donem(k: Path) -> dict | None:
    from .. import muavin_programlari as MP, red_iptal
    from ..kontrol import muavin_dosyalari
    from ..denetim import DENETIM_JSON
    try:
        bas = date(int(k.parent.name), int(k.name), 1)
    except ValueError:
        return None
    zipler = arsiv.donem_faturalari(k) or sorted(k.glob("gib_*.zip"))
    muavin = muavin_dosyalari(k)
    if not zipler and not muavin:
        return None
    bit = (bas.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)
    rj = k / depo.RAPOR_JSON
    if rj.exists():                       # son kontrolün dönemi (ay içinde farklı aralık seçilmişse)
        try:
            d = [x for v in (json.loads(rj.read_text(encoding="utf-8")).get("donem") or {}).values() for x in v]
            if d:
                bas, bit = _tarih(min(d)) or bas, _tarih(max(d)) or bit
        except (OSError, ValueError):
            pass
    prog = MP.klasor_programi(k)
    zaman = lambda y: datetime.fromtimestamp(y.stat().st_mtime).isoformat(timespec="minutes") if y.exists() else None
    return {"ay": f"{k.parent.name}-{k.name}", "bas": bas.isoformat(), "bit": bit.isoformat(),
            "fatura": sum(_arsiv_adet(y) for y in zipler), "muavin": [y.name for y in muavin],
            "program": prog, "program_ad": MP.PROGRAMLAR.get(prog, {}).get("ad", prog),
            "red": len(red_iptal.dosyalari(k)), "rapor": zaman(rj), "denetim": zaman(k / DENETIM_JSON),
            "belge_zamani": max(zaman(y) for y in [*zipler, *muavin]),
            "hazir": bool(zipler and muavin), "id": depo.rapor_id(k)}


@app.get("/api/yerel-belgeler")
def yerel_belgeler(firma_id: str = "", firma_ad: str = "", vkn: str = ""):
    """Seçili firmanın bu bilgisayarda kayıtlı dönemleri (faturalar + muavin): yeni sorgu yapmadan yeniden kontrol için."""
    ad = _yerel_firma(firma_id, firma_ad, vkn)
    if not ad:
        return {"firma": None, "donemler": []}
    donemler = [d for k in sorted(depo.firma_klasoru(ad).glob("[0-9][0-9][0-9][0-9]/[0-9][0-9]"), reverse=True)
                if k.is_dir() and (d := _yerel_donem(k))]
    return {"firma": ad, "donemler": donemler}


class YerelIstek(BaseModel):
    firma_id: str = ""
    firma_ad: str = ""
    vkn: str = ""
    ay: str                      # YYYY-AA (dönem klasörü)
    bas: str = ""                # verilmezse son kontrolün / ayın aralığı
    bit: str = ""
    tolerans: str = "0.05"


def _yerel_hazirla(b: YerelIstek):
    ad = _yerel_firma(b.firma_id, b.firma_ad, b.vkn)
    if not ad or not re.fullmatch(r"20\d\d-(0[1-9]|1[0-2])", b.ay or ""):
        raise HTTPException(404, "Firmanın bu bilgisayarda kayıtlı belgesi bulunamadı.")
    k = depo.firma_klasoru(ad) / b.ay[:4] / b.ay[5:]
    d = _yerel_donem(k) if k.is_dir() else None
    if not d or not d["hazir"]:
        raise HTTPException(400, f"{b.ay[5:]}.{b.ay[:4]} için bilgisayarda faturalar ve muavin birlikte yok. Belgeleri yükleyip ya da Luca'dan alıp kontrol edin.")
    bas, bit = _tarih(b.bas) or _tarih(d["bas"]), _tarih(b.bit) or _tarih(d["bit"])
    if (bas.year, bas.month) != (int(b.ay[:4]), int(b.ay[5:])) or bit < bas:
        raise HTTPException(400, "Dönem, seçilen ayın içinde olmalı.")
    try:
        vkn = str(json.loads((depo.firma_klasoru(ad) / "firma.json").read_text(encoding="utf-8")).get("vkn") or "") or None
    except (OSError, ValueError):
        vkn = None
    return k, bas, bit, vkn, ad


@app.post("/api/kontrol/yerel")
def kontrol_yerel(b: YerelIstek):
    """Tek firma: bilgisayardaki faturalar ve muavinle (Luca'ya / dosya yüklemeye gerek olmadan) kontrolü yeniden yapar."""
    from .. import kontrol as K
    k, bas, bit, vkn, ad = _yerel_hazirla(b)
    try:
        tol = Decimal(b.tolerans or "0.05")
    except Exception:
        tol = Decimal("0.05")
    veri = K.calistir(k, bas, bit, vkn, ad, tolerans=tol)
    if veri is None:
        raise HTTPException(400, f"{bas:%m.%Y} dönemine ait fatura bulunamadı.")
    veri["defter"] = defter_turu(k)
    return JSONResponse(veri)


@app.post("/api/denetim/yerel")
def denetim_yerel(b: YerelIstek):
    """Muhasebe Denetimi: bilgisayardaki faturalar ve muavinle denetimi yeniden yapar."""
    from .. import kontrol as K
    from ..denetim import denetle
    k, bas, bit, vkn, ad = _yerel_hazirla(b)
    veri = K.calistir(k, bas, bit, vkn, ad)
    if veri is None:
        raise HTTPException(400, f"{bas:%m.%Y} dönemine ait fatura bulunamadı.")
    d = denetle(k, bas, bit, vkn, ad, veri.get("id", ""))
    return JSONResponse({"rapor_id": veri.get("id"), "denetim": d})


@app.post("/api/kontrol")
async def kontrol(
    faturalar: list[UploadFile] | None = File(None),
    muavinler: list[UploadFile] | None = File(None),
    vkn: str = Form(""), bas: str = Form(""), bit: str = Form(""), tolerans: str = Form("0.05"),
    program: str = Form(""), firma_id: str = Form(""), firma_ad: str = Form(""), fatura_kaynak: str = Form(""),
    red_iptal: list[UploadFile] | None = File(None),
):
    from .. import muavin_programlari as MP
    from ..kontrol import muavin_dosyalari
    klasorden = program == "klasor"          # Luca'dan (toplu otomasyonla) çekilmiş muavin: firmanın dönem klasöründen
    try:
        program = MP.VARSAYILAN if klasorden else MP.gecerli(program or MP.VARSAYILAN)
    except ValueError as e:
        raise HTTPException(400, str(e))
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        (tmp / "f").mkdir(); (tmp / "m").mkdir()
        f_yol = await _kaydet(faturalar or [], tmp / "f", FATURA_UZANTI)
        if fatura_kaynak == "luca":          # Tek firma › "Luca'dan al": firmanın dönem arşivindeki faturalar
            a0 = _luca_fatura_arsivi(firma_id.strip(), _tarih(bas))
            if not a0:
                raise HTTPException(400, "Bu dönem için Luca'dan alınmış fatura yok. Önce \"Faturaları Luca'dan Al\".")
            h = tmp / "f" / "luca_faturalar.zip"; shutil.copyfile(a0, h); f_yol.append(h)
        if klasorden:
            ad0 = depo.luca_ile_firma(firma_id) if firma_id else None
            if not ad0 or not _tarih(bas):
                raise HTTPException(400, "Luca'dan çekilmiş muavin için firma ve kontrol dönemi seçin.")
            k0 = depo.donem_klasoru(ad0, _tarih(bas))
            m_yol = []
            for y in muavin_dosyalari(k0):
                h = tmp / "m" / y.name; shutil.copyfile(y, h); m_yol.append(h)
            if not m_yol:
                raise HTTPException(400, f"{ad0} için {_tarih(bas):%m.%Y} döneminde Luca'dan çekilmiş muavin yok. Önce \"Muavini Luca'dan Çek\".")
            program = MP.klasor_programi(k0)
        else:
            m_yol = await _kaydet(muavinler or [], tmp / "m", set(MP.PROGRAMLAR[program]["uzantilar"]))
        if not f_yol or not m_yol:
            raise HTTPException(400, "En az bir fatura dosyası ve bir muavin dosyası yükleyin.")
        # Toplu kontrolle aynı yol: dosyalar firmanın dönem klasörüne yerleşir (arşiv + muavin), aynı kurallarla
        # kontrol edilir; böylece fatura görüntüsü, çıktı raporu (muavin dökümü, KDV/KDV2 beyannamesi) aynıdır.
        from .. import kontrol as K
        try:
            muavin, _ = K.muavinleri_oku(m_yol, program)
        except Exception as e:  # bozuk dosya vb.
            raise HTTPException(400, f"Muavin dosyası okunamadı: {e}")
        if not muavin:
            raise HTTPException(400, f"Muavin dosyasında hareket satırı bulunamadı. Dosyanın {MP.PROGRAMLAR[program]['ad']} muavin dökümü "
                                     f"olduğundan emin olun ({MP.PROGRAMLAR[program]['ipucu']}).")
        try:
            klasor, b, e, vkn, ad = K.yuklenenleri_yerlestir(f_yol, m_yol, _tarih(bas), _tarih(bit), vkn.strip() or None, program,
                                                            firma_id.strip() or None, firma_ad.strip() or None,
                                                            await _red_kaydet(red_iptal, tmp / "r"))
        except ValueError as e:
            raise HTTPException(400, str(e))
        except Exception as e:
            raise HTTPException(400, f"Dosya okunamadı: {e}")
        veri = K.calistir(klasor, b, e, vkn, ad, tolerans=Decimal(tolerans or "0.05"))
        if veri is None:
            raise HTTPException(400, f"{b:%m.%Y} dönemine ait fatura bulunamadı. Kontrol dönemini faturaların ayına göre seçin.")
    return JSONResponse(veri)


# ------------------------------------------------------------------ Firma denetimi (Ofisinize Özel Çözümler › Muhasebe Denetimi)
@app.post("/api/denetim")
async def denetim_calistir(
    faturalar: list[UploadFile] | None = File(None),
    muavinler: list[UploadFile] | None = File(None),
    vkn: str = Form(""), bas: str = Form(""), bit: str = Form(""),
    program: str = Form("mikro"), firma_id: str = Form(""), firma_ad: str = Form(""), fatura_kaynak: str = Form(""),
    red_iptal: list[UploadFile] | None = File(None), muavin_kaynak: str = Form(""),
):
    """E-belgeler + muavin (Mikro / Luca) → firma klasörüne yerleşir; standart kontrol raporu (beyanname / çıktı için) ve
    KDV + matrah + cari denetimi + muhtasar taslağı hazırlanır. fatura_kaynak / muavin_kaynak = "luca": masaüstünde
    Luca'dan (toplu otomasyonla) firmanın dönem klasörüne alınmış faturalar / muavin kullanılır."""
    from .. import muavin_programlari as MP
    from .. import kontrol as K
    from ..denetim import denetle
    try:
        program = MP.gecerli(program or "mikro")
    except ValueError as e:
        raise HTTPException(400, str(e))
    if not MP.denetimde_mi(program):
        raise HTTPException(400, f"{MP.PROGRAMLAR[program]['ad']} muavini Denetim ekranında desteklenmiyor.")
    if not MP.hazir_mi(program):
        raise HTTPException(400, MP.PROGRAMLAR[program]["ipucu"])
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        (tmp / "f").mkdir(); (tmp / "m").mkdir()
        f_yol = await _kaydet(faturalar or [], tmp / "f", FATURA_UZANTI)
        if fatura_kaynak == "luca":          # Muhasebe Denetimi › "Faturaları Luca'dan Al": firmanın dönem arşivi
            a0 = _luca_fatura_arsivi(firma_id.strip(), _tarih(bas))
            if not a0:
                raise HTTPException(400, "Bu dönem için Luca'dan alınmış fatura yok. Önce \"Faturaları Luca'dan Al\".")
            h = tmp / "f" / "luca_faturalar.zip"; shutil.copyfile(a0, h); f_yol.append(h)
        m_yol = await _kaydet(muavinler or [], tmp / "m", set(MP.PROGRAMLAR[program]["uzantilar"]))
        if muavin_kaynak == "luca" and not m_yol:      # Luca seçili › "Muavini Luca'dan Al": dönem klasöründeki muavin
            if program != "luca":
                raise HTTPException(400, "Luca'dan alınan muavin yalnız muhasebe programı Luca seçiliyken kullanılır.")
            m0 = _luca_muavini(firma_id.strip(), _tarih(bas))
            if not m0:
                raise HTTPException(400, "Bu dönem için Luca'dan alınmış muavin yok. Önce \"Muavini Luca'dan Al\".")
            h = tmp / "m" / "luca_muavin.xlsx"; shutil.copyfile(m0, h); m_yol.append(h)
        if not f_yol:
            raise HTTPException(400, "Alış / satış e-fatura dosyalarını (XML ya da ZIP) yükleyin.")
        if not m_yol:
            raise HTTPException(400, f"Firmanın {MP.PROGRAMLAR[program]['ad']} muavinini (xlsx) yükleyin.")
        try:
            muavin, _ = K.muavinleri_oku(m_yol, program)
        except Exception as e:
            raise HTTPException(400, f"Muavin dosyası okunamadı: {e}")
        if not muavin:
            raise HTTPException(400, f"Muavin dosyasında hareket satırı bulunamadı ({MP.PROGRAMLAR[program]['ipucu']}).")
        try:
            klasor, b, e, vkn, ad = K.yuklenenleri_yerlestir(f_yol, m_yol, _tarih(bas), _tarih(bit), vkn.strip() or None, program,
                                                            firma_id.strip() or None, firma_ad.strip() or None,
                                                            await _red_kaydet(red_iptal, tmp / "r"))
        except ValueError as x:
            raise HTTPException(400, str(x))
        except Exception as x:
            raise HTTPException(400, f"Dosya okunamadı: {x}")
        veri = K.calistir(klasor, b, e, vkn, ad)
        if veri is None:
            raise HTTPException(400, f"{b:%m.%Y} dönemine ait fatura bulunamadı. Dönemi faturaların ayına göre seçin.")
        d = denetle(klasor, b, e, vkn, ad, veri.get("id", ""))
    return JSONResponse({"rapor_id": veri.get("id"), "denetim": d})


@app.get("/api/denetim")
def denetim_getir(id: str):
    from ..denetim import DENETIM_JSON
    k = depo.rapor_klasoru(id)
    if not k or not (k / DENETIM_JSON).exists():
        raise HTTPException(404, "Bu dönemin denetimi yok")
    return JSONResponse(json.loads((k / DENETIM_JSON).read_text(encoding="utf-8")))


_FIS_ONBELLEK: dict = {}


def _denetim_muavini(k: Path):
    from ..kontrol import muavin_dosyalari, muavinleri_oku
    yollar = muavin_dosyalari(k)
    anahtar = tuple((str(y), y.stat().st_mtime_ns) for y in yollar)
    if _FIS_ONBELLEK.get("k") != anahtar:
        _FIS_ONBELLEK.clear()
        _FIS_ONBELLEK.update(k=anahtar, m=muavinleri_oku(yollar)[0] if yollar else [])
    return _FIS_ONBELLEK["m"]


def _fis_verisi(id: str, fis: str, tarih: str) -> dict:
    k = depo.rapor_klasoru(id)
    if not k or not k.exists():
        raise HTTPException(404, "Rapor bulunamadı")
    t = None
    for bc in ("%d.%m.%Y", "%Y-%m-%d"):
        try:
            t = datetime.strptime(tarih, bc).date(); break
        except ValueError:
            pass
    satirlar = [s for s in _denetim_muavini(k) if s.fis_no == fis and (t is None or s.fis_tarihi == t)]
    if not satirlar:
        raise HTTPException(404, "Fiş muavinde bulunamadı")
    satirlar.sort(key=lambda s: (s.satir, s.hesap_kodu))
    oz = ana_hesap_ozeti(((s.hesap_kodu, s.borc, s.alacak) for s in satirlar),
                         lambda k: TDHP.get(k) or next((s.hesap_adi for s in satirlar if s.hesap_kodu == k), ""))
    b, al = sum((s.borc for s in satirlar), Decimal(0)), sum((s.alacak for s in satirlar), Decimal(0))
    return {"fis_no": fis, "tarih": _t(satirlar[0].fis_tarihi), "tip": satirlar[0].fis_tipi,
            "satirlar": [{"tarih": _t(s.fis_tarihi), "hesap": s.hesap_kodu, "hesap_adi": s.hesap_adi, "aciklama": s.aciklama, "belge_no": s.belge_no or "",
                          "borc": _sayi(s.borc), "alacak": _sayi(s.alacak)} for s in satirlar],
            "ana": [{**a, "borc": _sayi(a["borc"]), "alacak": _sayi(a["alacak"])} for a in oz["ana"]],
            # yazdırmada ana hesap özeti yalnız aynı ana hesap birden çok satırdaysa (Görev 53)
            "ozet": oz["goster"],
            "borc": _sayi(b), "alacak": _sayi(al), "dengeli": abs(b - al) <= Decimal("0.01")}


@app.get("/api/denetim/fis")
def denetim_fis(id: str, fis: str, tarih: str = ""):
    """Muavinden fiş: faturanın kaydedildiği fişin tüm satırları ve ana hesap (100, 191 …) toplamları."""
    return _fis_verisi(id, fis, tarih)


@app.get("/api/denetim/fis/yazdir", response_class=HTMLResponse)
def denetim_fis_yazdir(id: str, fis: str, tarih: str = "", oto: int = 1):
    """Yazdırılabilir fiş: üstte fişin aslı (muavinden); aynı ana hesap birden çok satırdaysa altta ana hesap özeti;
    en altta Hazırlayan / Kontrol Eden / Onaylayan imza alanları."""
    import html as H
    v = _fis_verisi(id, fis, tarih)
    firma = id.split("/")[0]
    tl = lambda x: f"{x:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".") if x else ""
    tr = lambda d: "-".join(reversed((d or "").split("-"))).replace("-", ".")
    sat = "".join(f"<tr><td class=m>{H.escape(x['hesap'])}</td><td>{H.escape(x['hesap_adi'])}</td><td>{H.escape(x['aciklama'])}</td>"
                  f"<td class=n>{tl(x['borc'])}</td><td class=n>{tl(x['alacak'])}</td></tr>" for x in v["satirlar"])
    ek = fis_ek_html({"goster": v["ozet"], "ana": v["ana"], "borc": v["borc"], "alacak": v["alacak"], "dengeli": v["dengeli"]})
    return f"""<!doctype html><html lang=tr><head><meta charset=utf-8><title>Fiş {H.escape(fis)} – {H.escape(firma)}</title>
<style>body{{font:12px/1.35 Arial,sans-serif;margin:24px;color:#111}}h1{{font-size:16px;margin:0}}h2{{font-size:13px;margin:22px 0 6px}}
.ust{{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #222;padding-bottom:6px;margin-bottom:8px}}
table{{width:100%;border-collapse:collapse}}th,td{{border:1px solid #999;padding:4px 6px;text-align:left;vertical-align:top}}th{{background:#eee}}
td.n,th.n{{text-align:right;white-space:nowrap}}td.m{{font-family:Consolas,monospace;white-space:nowrap}}tfoot td{{font-weight:700;background:#f4f4f4}}
.not{{color:#555;font-size:11px}}{FIS_EK_CSS}@media print{{.yok{{display:none}}body{{margin:10mm}}}}</style></head><body>
<div class=yok style="margin-bottom:12px"><button onclick="print()">Yazdır / PDF olarak kaydet</button></div>
<div class=ust><div><h1>{H.escape(firma)}</h1><div class=not>Muavinden oluşturulan fiş görüntüsü</div></div>
<div style="text-align:right"><b>Fiş no:</b> {H.escape(fis)} &nbsp; <b>Tarih:</b> {tr(v['tarih'])}<br><span class=not>{H.escape(v['tip'] or '')}</span></div></div>
<table><thead><tr><th>Hesap</th><th>Hesap adı</th><th>Açıklama</th><th class=n>Borç</th><th class=n>Alacak</th></tr></thead><tbody>{sat}</tbody>
<tfoot><tr><td colspan=3>Toplam{'' if v['dengeli'] else ' — fiş dengesiz'}</td><td class=n>{tl(v['borc'])}</td><td class=n>{tl(v['alacak'])}</td></tr></tfoot></table>
{ek}
{'<script>addEventListener("load",()=>setTimeout(()=>print(),300))</script>' if oto else ''}</body></html>"""


@app.get("/api/denetim/liste")
def denetim_listesi():
    """Denetimi yapılmış firma-dönemler (yeniden eskiye)."""
    from ..denetim import DENETIM_JSON
    kok = depo.firmalar_kok(); out = []
    if kok.exists():
        for y in kok.glob(f"*/*/*/{DENETIM_JSON}"):
            try:
                v = json.loads(y.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                continue
            out.append({"id": depo.rapor_id(y.parent), "firma": v.get("firma"), "vkn": v.get("vkn"), "bas": v.get("bas"), "bit": v.get("bit"),
                        "sorunlu": {k2: x["sorunlu"] for k2, x in (v.get("ozet") or {}).items()},
                        "zaman": datetime.fromtimestamp(y.stat().st_mtime).isoformat(timespec="minutes")})
    out.sort(key=lambda x: x.get("zaman") or "", reverse=True)
    return {"liste": out}


# ------------------------------------------------------------------ Yarım kalan denetim (Görev 49 · 9)
# Kaldığı yer (bölüm, süzgeç, kaydırma, açık fatura, yazılmış not) dönem klasöründe ayrı dosyada; kararlar / kurallar zaten
# firma klasöründe (detay-kararlar.json, detay-kurallari.json), evrak ve muavin dönem klasöründe. Görev 51 taşıyacak.
YARIM_JSON = "denetim-yarim.json"


class YarimDurum(BaseModel):
    id: str
    durum: dict = {}
    sil: bool = False


@app.post("/api/denetim/yarim")
def denetim_yarim_kaydet(b: YarimDurum):
    k, v = _denetim_veri(b.id)
    y = k / YARIM_JSON
    if b.sil:
        y.unlink(missing_ok=True)
        return {"tamam": True}
    d = b.durum if isinstance(b.durum, dict) else {}
    kontrol = d.get("kontrol") if isinstance(d.get("kontrol"), dict) else None
    temiz = {"gor": str(d.get("gor") or "ozet")[:20], "filtre": {t: str((d.get("filtre") or {}).get(t) or "bekliyor")[:20] for t in ("gider", "gelir")},
             "yalnizSorun": bool(d.get("yalnizSorun")), "kaydir": max(0, int(d.get("kaydir") or 0)), "detay": bool(d.get("detay")),
             "kontrol": {"tur": "gelir" if kontrol.get("tur") == "gelir" else "gider", "anahtar": str(kontrol.get("anahtar") or "")[:200],
                         "not": str(kontrol.get("not") or "")[:500]} if kontrol else None,
             "zaman": datetime.now().isoformat(timespec="seconds")}
    y.write_text(json.dumps({"rapor_id": b.id, "firma": v.get("firma"), "bas": v.get("bas"), "bit": v.get("bit"), **temiz},
                            ensure_ascii=False, indent=1), encoding="utf-8")
    return {"tamam": True, "zaman": temiz["zaman"]}


@app.get("/api/denetim/yarim")
def denetim_yarim(id: str = ""):
    """id verilirse o denetimin kaldığı yer; yoksa detay denetimde kontrol bekleyen faturası kalmış yarım denetimler."""
    from .. import detay
    if id:
        k = depo.rapor_klasoru(id)
        try:
            return json.loads((k / YARIM_JSON).read_text(encoding="utf-8")) if k else {}
        except (OSError, ValueError):
            return {}
    kok = depo.firmalar_kok(); out = []
    if kok.exists():
        for y in kok.glob(f"*/*/*/{YARIM_JSON}"):
            try:
                d = json.loads(y.read_text(encoding="utf-8"))
                k, v = _denetim_veri(depo.rapor_id(y.parent))
            except (OSError, ValueError, HTTPException):
                continue
            if not d.get("detay"):
                continue
            u = detay.uygula(v["detay"], detay.kurallar(k.parent.parent), detay.kararlar(k.parent.parent))
            bek = sum(u["ozet"][t].get("bekliyor", 0) for t in ("gider", "gelir"))
            if bek:
                out.append({"id": depo.rapor_id(y.parent), "firma": d.get("firma"), "bas": d.get("bas"), "bit": d.get("bit"),
                            "bekleyen": bek, "zaman": d.get("zaman"), "gor": d.get("gor")})
    out.sort(key=lambda x: x.get("zaman") or "", reverse=True)
    return {"liste": out}


# ------------------------------------------------------------------ Detay denetim (gider / gelir kontrolü; Görev 43 Faz 2)
def _denetim_veri(id: str) -> tuple[Path, dict]:
    from ..denetim import DENETIM_JSON
    k = depo.rapor_klasoru(id)
    if not k or not (k / DENETIM_JSON).exists():
        raise HTTPException(404, "Bu dönemin denetimi yok")
    v = json.loads((k / DENETIM_JSON).read_text(encoding="utf-8"))
    if "detay" not in v:
        raise HTTPException(409, "Bu denetim detay denetimden önce yapılmış; denetimi yeniden çalıştırın.")
    return k, v


@app.get("/api/denetim/detay")
def denetim_detay(id: str):
    """Gider ve gelir kontrolü: her faturanın kaydı, durumu (kural / geçmiş / karar / bekliyor), firmanın kuralları."""
    from .. import detay
    k, v = _denetim_veri(id)
    firma = k.parent.parent
    d = detay.uygula(v["detay"], detay.kurallar(firma), detay.kararlar(firma))
    from .. import yz
    ob = yz.onbellek(firma) if yz.ETKIN else {}  # yapay zekâ önerileri (masaüstünde sorulmuşsa; Görev 49: kapalı)
    for t in ("gider", "gelir"):
        for x in d.get(t, []):
            if x["anahtar"] in ob:
                x["yz"] = ob[x["anahtar"]]
    kl = [{**k, "metin": detay.kural_metni(k), "sonuc": k.get("sonuc") or "uygun"} for k in detay.kurallar(firma)]
    return {**d, "kurallar": kl, "durum_ad": detay.DURUM_AD, "sart_ad": detay.SART_AD}


class DetayKarar(BaseModel):
    id: str
    anahtar: str
    karar: str = ""              # uygun / uygun_degil / "" (kararı kaldır)
    notu: str = ""


@app.post("/api/denetim/detay/karar")
def denetim_detay_karar(b: DetayKarar):
    from .. import detay
    k, v = _denetim_veri(b.id)
    x = next((x for t in ("gider", "gelir") for x in v["detay"].get(t, []) if x["anahtar"] == b.anahtar), None)
    if not x:
        raise HTTPException(404, "Fatura bu denetimde yok")
    try:
        detay.karar_yaz(k.parent.parent, b.anahtar, b.karar, b.notu,
                        {"belge_no": x["belge_no"], "tarih": x["tarih"], "karsi_taraf": x["karsi_taraf"]})
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"tamam": True}


class DetayKural(BaseModel):
    id: str
    yon: str = ""
    vkn: str = ""
    unvan: str = ""
    hesap: str = ""
    aciklama: str = ""
    sartlar: list = []           # Görev 49: [{alan: unvan / vkn / icerik / tutar / hesap, deger}] (hepsi VE)
    sonuc: str = ""              # uygun / uygun_degil
    sil: int = 0                 # verilirse bu kural silinir


@app.post("/api/denetim/detay/kural")
def denetim_detay_kural(b: DetayKural):
    """Kontrol kuralı ekle / sil (kayıt değil: kurala uyan fatura otomatik "uygun" sayılır)."""
    from .. import detay
    k, _ = _denetim_veri(b.id)
    firma = k.parent.parent
    try:
        L = detay.kural_sil(firma, int(b.sil)) if b.sil else \
            detay.kural_ekle(firma, {"yon": b.yon, "vkn": b.vkn, "unvan": b.unvan, "hesap": b.hesap, "aciklama": b.aciklama,
                                     "sonuc": b.sonuc, **({"sartlar": b.sartlar} if b.sartlar else {})})
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"kurallar": L}


# ------------------------------------------------------------------ Detay denetim › yapay zekâ önerisi (Görev 43 Faz 4; yalnız masaüstü)
def _yz_kapali():
    from .. import yz
    if not yz.ETKIN:
        raise HTTPException(404, "Yapay zekâ önerisi bu sürümde kapalı")


def _yz_istek(k: Path, v: dict, x: dict) -> dict:
    from .. import yz
    rid = depo.rapor_id(k)
    fis = []
    for f in x.get("fisler", []):
        try:
            fis += _fis_verisi(rid, f["no"], f["tarih"])["satirlar"]
        except HTTPException:
            pass
    baglam = yz.firma_baglami(_denetim_muavini(k))
    istek = yz.fatura_istegi(x, fis)
    metin = json.dumps(istek, ensure_ascii=False)
    return {"anahtar": x["anahtar"], "baglam": baglam, "istek": istek, "ozet": yz.istek_ozeti(baglam, istek),
            "token": {"baglam": yz.token_tahmini(baglam), "istek": yz.token_tahmini(metin)}}


def _detay_ogesi(v: dict, anahtar: str) -> dict:
    x = next((x for t in ("gider", "gelir") for x in v["detay"].get(t, []) if x["anahtar"] == anahtar), None)
    if not x:
        raise HTTPException(404, "Fatura bu denetimde yok")
    return x


@app.get("/api/denetim/yz/istek")
def denetim_yz_istek(id: str, anahtar: str):
    """Claude'a gönderilecek veri (maskeli). Gönderimi masaüstünün ana süreci yapar; burada dışarıya bağlanılmaz."""
    _yz_kapali()
    k, v = _denetim_veri(id)
    return _yz_istek(k, v, _detay_ogesi(v, anahtar))


@app.get("/api/denetim/yz/bekleyen")
def denetim_yz_bekleyen(id: str, tur: str = "gider"):
    """Toplu değerlendirme öncesi: önerisi olmayan bekleyen faturalar ve tahmini token (maliyeti program hesaplar)."""
    _yz_kapali()
    from .. import detay, yz
    k, v = _denetim_veri(id)
    firma = k.parent.parent
    d = detay.uygula(v["detay"], detay.kurallar(firma), detay.kararlar(firma))
    ob = yz.onbellek(firma)
    L, tok = [], 0
    baglam_tok = 0
    for x in d.get(tur if tur in ("gider", "gelir") else "gider", []):
        if x["durum"] != "bekliyor":
            continue
        i = _yz_istek(k, v, x)
        if (ob.get(x["anahtar"]) or {}).get("ozet") == i["ozet"]:
            continue                                     # aynı veriyle daha önce soruldu: yeniden sorulmaz
        L.append(x["anahtar"]); tok += i["token"]["istek"]; baglam_tok = i["token"]["baglam"]
    return {"anahtarlar": L, "adet": len(L), "token": {"baglam": baglam_tok, "istek": tok}}


class YzSonuc(BaseModel):
    id: str
    anahtar: str
    ozet: str
    model: str
    sonuc: dict


@app.post("/api/denetim/yz/sonuc")
def denetim_yz_sonuc(b: YzSonuc):
    from .. import yz
    _yz_kapali()
    k, v = _denetim_veri(b.id)
    _detay_ogesi(v, b.anahtar)
    try:
        return yz.sonuc_yaz(k.parent.parent, b.anahtar, b.ozet, b.sonuc, b.model)
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.get("/api/denetim/detay/rapor", response_class=HTMLResponse)
def denetim_detay_rapor(id: str):
    """Yazdırılabilir rapor: KDV ve matrah kontrolü + detay denetim (uygun / uygun değil / bekleyen)."""
    from .. import detay
    from ..detay_rapor import rapor_html
    k, v = _denetim_veri(id)
    firma = k.parent.parent
    try:
        mb = denetim_muhtasar_getir(id) if (k / MUHTASAR_BEYAN_JSON).exists() else None
    except Exception:                    # beyanname özeti bozuksa rapor yine çıkar
        mb = None
    return HTMLResponse(rapor_html(v, detay.uygula(v["detay"], detay.kurallar(firma), detay.kararlar(firma)), mb))


# ------------------------------------------------------------------ Yönetici raporu (Görev 43 Faz 3)
@app.get("/api/denetim/yonetici", response_class=HTMLResponse)
def denetim_yonetici(id: str):
    """Yıllık muavinden aylık satış / gider grafikleri, o ayın vergileri ve rasyolar (yazdırılabilir)."""
    from .. import yonetici
    from ..denetim import DENETIM_JSON
    from ..yonetici_rapor import rapor_html
    k = depo.rapor_klasoru(id)
    if not k or not (k / DENETIM_JSON).exists():
        raise HTTPException(404, "Bu dönemin denetimi yok")
    v = json.loads((k / DENETIM_JSON).read_text(encoding="utf-8"))
    y = yonetici.hazirla(_denetim_muavini(k), date.fromisoformat(v["bas"]), date.fromisoformat(v["bit"]))
    return HTMLResponse(rapor_html(v, y))


# ------------------------------------------------------------------ Muhtasar beyannamesi (1003A PDF) ↔ muavin
MUHTASAR_BEYAN_JSON = "muhtasar_beyan.json"      # yalnız tutarlar / adetler; PDF ve kişisel alanlar saklanmaz


def _muhtasar_karsilastir(k: Path, v: dict, b: dict) -> dict:
    from .. import muhtasar_beyan as MB
    bas, bit = date.fromisoformat(v["bas"]), date.fromisoformat(v["bit"])
    return MB.kayit_bicimi({"beyan": b, **MB.karsilastir(b, v, _denetim_muavini(k), bas, bit),
                            "zaman": datetime.now().isoformat(timespec="minutes")})


@app.post("/api/denetim/muhtasar")
async def denetim_muhtasar(id: str = Form(...), beyanname: UploadFile = File(...)):
    """Muhtasar ve Prim Hizmet Beyannamesi PDF'i okunur (çalışan bölümleri hariç), muavinle karşılaştırılır.
    PDF kaydedilmez; yalnız özet tutarlar dönem klasörüne yazılır."""
    from .. import muhtasar_beyan as MB
    from ..denetim import DENETIM_JSON
    k = depo.rapor_klasoru(id)
    if not k or not (k / DENETIM_JSON).exists():
        raise HTTPException(404, "Bu dönemin denetimi yok")
    veri = await beyanname.read()
    if not veri.startswith(b"%PDF"):
        raise HTTPException(400, "Beyannameyi PDF olarak yükleyin (GİB › Beyanname görüntüle › PDF).")
    try:
        b = MB.oku(veri)
    except MB.BeyannameHatasi as e:
        raise HTTPException(400, str(e))
    v = json.loads((k / DENETIM_JSON).read_text(encoding="utf-8"))
    sonuc = _muhtasar_karsilastir(k, v, b)
    (k / MUHTASAR_BEYAN_JSON).write_text(json.dumps(sonuc, ensure_ascii=False), encoding="utf-8")
    return sonuc


@app.get("/api/denetim/muhtasar")
def denetim_muhtasar_getir(id: str):
    """Yüklenmiş beyanname özeti; karşılaştırma güncel denetim ve muavinle yeniden yapılır."""
    from .. import muhtasar_beyan as MB
    from ..denetim import DENETIM_JSON
    k = depo.rapor_klasoru(id)
    if not k or not (k / MUHTASAR_BEYAN_JSON).exists() or not (k / DENETIM_JSON).exists():
        raise HTTPException(404, "Bu dönem için muhtasar beyannamesi yüklenmedi")
    eski = json.loads((k / MUHTASAR_BEYAN_JSON).read_text(encoding="utf-8"))
    v = json.loads((k / DENETIM_JSON).read_text(encoding="utf-8"))
    return {**_muhtasar_karsilastir(k, v, MB.kayittan(eski["beyan"])), "zaman": eski.get("zaman")}


@app.get("/api/gecmis")
def gecmis():
    with _db() as con:
        rows = con.execute("SELECT id, zaman, firma, vkn, bas, bit, fatura_sayisi, sorunlu "
                           "FROM calisma ORDER BY zaman DESC LIMIT 50").fetchall()
    return [dict(zip(["id", "zaman", "firma", "vkn", "bas", "bit", "fatura_sayisi", "sorunlu"], r))
            for r in rows]


@app.get("/api/rapor")
def rapor_getir(id: str):
    v = rapor_oku(id)
    if v is None:
        raise HTTPException(404, "Rapor bulunamadı")
    k = depo.rapor_klasoru(id)
    v["defter"] = defter_turu(k)
    try:                                   # "Luca'da aç" (Görev 37): firmanın Luca kimliği (firma.json, yalnız okuma)
        v["luca_id"] = str(json.loads((k.parent.parent / "firma.json").read_text(encoding="utf-8")).get("luca_id") or "")
    except (OSError, ValueError, AttributeError):
        v["luca_id"] = ""
    return JSONResponse(v)


@app.get("/api/rapor/excel")
def rapor_excel(id: str):
    k = depo.rapor_klasoru(id)
    if not k or not (k / depo.RAPOR_EXCEL).exists():
        raise HTTPException(404, "Rapor bulunamadı")
    firma, yil, ay = id.split("/")
    kisa = "".join(c for c in firma.replace(" ", "_") if c.isalnum() or c == "_") or "firma"
    return FileResponse(k / depo.RAPOR_EXCEL, filename=f"{kisa}_{yil}-{ay}_kontrol.xlsx")


@app.get("/api/fatura/goruntu", response_class=HTMLResponse)
def fatura_goruntu(id: str, belge: str):
    """Faturayı GİB görsel şablonuyla tarayıcıda açar (yazdır → PDF olarak kaydet)."""
    from ..goruntu import arsivden_bul, goruntu_csp, goruntu_html
    from ..fatura_okuyucu import _hamlar, xml_oku
    k = depo.rapor_klasoru(id)
    if not k:
        raise HTTPException(404, "Rapor bulunamadı")
    veri = arsivden_bul(k / "faturalar.zip", belge)
    if veri is None:                     # eski düzen: ham Luca ZIP'leri
        for ham, kaynak in _hamlar(sorted(k.glob("gib_*.zip"))):
            f = xml_oku(ham, kaynak)
            if f and f.belge_no == belge:
                veri = ham
                break
    if veri is None:
        raise HTTPException(404, "Fatura dosyası bulunamadı")
    # şablon faturayla gelir (güvenilmez): script çalışmasın
    return HTMLResponse(goruntu_html(veri, f"Fatura {belge}"), headers={"Content-Security-Policy": goruntu_csp()})


@app.get("/api/rapor/cikti", response_class=HTMLResponse)
def rapor_cikti(id: str, cevap: str | None = None, tutar: str | None = None, sorumlu: str | None = None):
    """Dosyaya konulacak rapor: kontrol özeti + açıklamalı muavin dökümü + KDV beyannamesi örneği.
    Bir kopyası dönem klasörüne 'kdv_kontrol_raporu.html' olarak da kaydedilir."""
    from ..cikti import cikti_html
    v = rapor_oku(id)
    k = depo.rapor_klasoru(id)
    if v is None or not k:
        raise HTTPException(404, "Rapor bulunamadı")
    from ..kontrol import muavin_dosyalari, muavinleri_oku
    muavin, bilgi = None, {}
    if muavin_dosyalari(k):
        try:
            muavin, bilgi = muavinleri_oku(muavin_dosyalari(k))
        except Exception:
            muavin = None
    iade_yolu = k / "iade_talebi.json"           # "iade talebiniz olacak mı?" cevabı dönem klasöründe saklanır
    if cevap in ("evet", "hayir"):
        iade = {"cevap": cevap, "tutar": tutar or ""}
        iade_yolu.write_text(json.dumps(iade, ensure_ascii=False), encoding="utf-8")
    else:
        try:
            iade = json.loads(iade_yolu.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            iade = None
    # KDV2: önceki aylarda kesilip bu ay kaydedilen tevkifatlı faturaların bilgisi önceki ayların raporlarından
    v = dict(v)
    firma_ad, yil, ay = id.split("/")
    ek = []
    for geri in (1, 2):
        y, a = int(yil), int(ay) - geri
        if a < 1:
            y, a = y - 1, a + 12
        onceki = depo.rapor_klasoru(f"{firma_ad}/{y}/{a:02d}")
        if onceki and (onceki / depo.RAPOR_JSON).exists():
            try:
                ek += json.loads((onceki / depo.RAPOR_JSON).read_text(encoding="utf-8")).get("tevkifatlar", [])
            except ValueError:
                pass
    v["tevkifatlar"] = list(v.get("tevkifatlar", [])) + ek
    from ..beyanname import _cevap
    sor = _cevap(k / "sorumlu_odeme.json", {"cevap": sorumlu} if sorumlu else None, ("odendi", "odenmedi"))
    sayfa = cikti_html(v, muavin, ayarlar.oku(), firma_ad, iade, sor, (bilgi.get("aralik") or (None,))[0])
    try:
        (k / "kdv_kontrol_raporu.html").write_text(sayfa, encoding="utf-8")
    except OSError:
        pass
    return HTMLResponse(sayfa)


# ------------------------------------------------------------------ muavin görüntüleme (MuhaWin: Mizan / Muavin sayfası)
@app.get("/api/muavin/programlar")
def muavin_programlari(denetim: bool = False):
    """denetim=1: yalnız Denetim ekranında seçilebilen programlar (denetim.html program seçimi)."""
    from .. import muavin_programlari as MP
    return {"programlar": MP.liste(denetim)}


@app.get("/api/muavin/donemler")
def muavin_donemleri():
    """Luca'dan indirilmiş (ya da tek firmada yüklenmiş) muavini olan firma-dönemler, yeniden eskiye."""
    from ..kontrol import muavin_dosyalari
    kok = depo.firmalar_kok()
    cikti = []
    if kok.exists():
        for k in kok.glob("*/*/*"):
            if k.is_dir() and muavin_dosyalari(k):
                firma, yil, ay = k.relative_to(kok).parts
                boyut = sum(y.stat().st_size for y in muavin_dosyalari(k))
                try:
                    lid = json.loads((kok / firma / "firma.json").read_text(encoding="utf-8")).get("luca_id")
                except (OSError, ValueError):
                    lid = None
                from .. import muavin_programlari as MP
                cikti.append({"id": f"{firma}/{yil}/{ay}", "firma": firma, "yil": yil, "ay": ay, "kb": boyut // 1024,
                              "luca_id": lid, "program": MP.klasor_programi(k),
                              "zaman": datetime.fromtimestamp(max(y.stat().st_mtime for y in muavin_dosyalari(k))).isoformat(timespec="minutes")})
    cikti.sort(key=lambda x: (x["yil"], x["ay"], x["firma"]), reverse=True)
    return {"donemler": cikti}


@app.get("/api/muavin")
def muavin_getir(id: str):
    from ..kontrol import muavin_dosyalari, muavinleri_oku
    k = depo.rapor_klasoru(id)
    if not k or not muavin_dosyalari(k):
        raise HTTPException(404, "Bu dönemin muavini bulunamadı")
    satirlar, bilgi = muavinleri_oku(muavin_dosyalari(k))
    return {"id": id, "firma": bilgi.get("firma") or id.split("/")[0], "satirlar": [{
        "tarih": _t(s.fis_tarihi), "fis_tipi": s.fis_tipi, "fis_no": s.fis_no, "hesap_kodu": s.hesap_kodu,
        "hesap_adi": s.hesap_adi, "aciklama": s.aciklama, "belge_no": s.belge_no or "", "belge_tarihi": _t(s.belge_tarihi),
        "unvan": s.unvan, "borc": _sayi(s.borc), "alacak": _sayi(s.alacak), "dosya": s.dosya} for s in satirlar]}


@app.post("/api/muavin/yukle")
def muavin_yukle(b: dict):
    """Muavini elle (Excel) yükler. b: {ad, luca_id?, yil, ay, program, dosya_adi, b64}.
    Dosya seçilen programın okuyucusuyla denetlenir, firmanın dönem klasörüne muavin.xlsx olarak yazılır
    (o dönemin önceki muavin dosyalarının yerine); faturalar ve raporlar korunur."""
    import base64, tempfile
    from datetime import date as _date
    from .. import muavin_programlari as MP
    from ..kontrol import muavin_dosyalari
    try:
        program = MP.gecerli(b.get("program"))
        yil, ay = int(b.get("yil")), int(b.get("ay"))
        bas = _date(yil, ay, 1)
    except (TypeError, ValueError) as e:
        raise HTTPException(400, str(e) or "Dönem geçersiz")
    ad = str(b.get("ad") or "").strip()
    lid = str(b.get("luca_id") or "").strip() or None
    if not ad:
        raise HTTPException(400, "Firma seçilmedi")
    uz = Path(str(b.get("dosya_adi") or "muavin.xlsx")).suffix.lower()
    if uz not in MP.PROGRAMLAR[program]["uzantilar"]:
        raise HTTPException(400, f"{MP.PROGRAMLAR[program]['ad']} muavini için {', '.join(MP.PROGRAMLAR[program]['uzantilar'])} dosyası seçin")
    try:
        veri = base64.b64decode(str(b.get("b64") or ""), validate=True)
    except ValueError:
        raise HTTPException(400, "Dosya okunamadı")
    if not veri:
        raise HTTPException(400, "Dosya boş")
    with tempfile.TemporaryDirectory() as td:
        gecici = Path(td) / ("muavin" + uz)
        gecici.write_bytes(veri)
        try:
            satirlar, _ = MP.oku(gecici, program)
        except Exception as e:  # okuyucu hatası kullanıcıya anlaşılır biçimde
            raise HTTPException(400, f"Muavin okunamadı ({MP.PROGRAMLAR[program]['ad']}): {e}")
        if not satirlar:
            raise HTTPException(400, "Dosyada muavin satırı bulunamadı; doğru program ve dosya seçildi mi?")
        klasor_ad = None
        kok = depo.firmalar_kok()
        if lid and kok.exists():
            for y in kok.glob("*/firma.json"):
                try:
                    if str(json.loads(y.read_text(encoding="utf-8")).get("luca_id") or "") == lid:
                        klasor_ad = y.parent.name
                        break
                except (OSError, ValueError):
                    continue
        klasor_ad = klasor_ad or depo.guvenli_ad(ad)
        k = depo.donem_klasoru(klasor_ad, bas)
        k.mkdir(parents=True, exist_ok=True)
        for eski in muavin_dosyalari(k):
            eski.unlink(missing_ok=True)
        shutil.copyfile(gecici, k / ("muavin_isletme.json" if uz == ".json" else "muavin.xlsx"))
    MP.klasore_yaz(k, program)
    depo.firma_bilgisi_yaz(klasor_ad, None, lid)
    return {"tamam": True, "id": f"{klasor_ad}/{bas:%Y}/{bas:%m}", "satir": len(satirlar)}


# ------------------------------------------------------------------ firma verisini sil (MuhaWin: Ayarlar → Firma sil)
@app.post("/api/firma/sil")
def firma_verisi_sil(b: dict):
    """b: {luca_id, ad, muavin: bool, belgeler: bool}. muavin: tüm dönemlerin muavin dosyaları; belgeler: firmanın
    tüm klasörü (indirilen faturalar, muavinler, raporlar). Firma toplu kontrol listesinden çıkarılmaz."""
    from ..kontrol import muavin_dosyalari
    kok = depo.firmalar_kok()
    hedef = []
    if kok.exists():
        for k in kok.iterdir():
            if not k.is_dir():
                continue
            try:
                bilgi = json.loads((k / "firma.json").read_text(encoding="utf-8"))
            except (OSError, ValueError):
                bilgi = {}
            if (b.get("luca_id") and str(bilgi.get("luca_id") or "") == str(b["luca_id"])) or \
                    (b.get("ad") and k.name == depo.guvenli_ad(str(b["ad"]))):
                hedef.append(k)
    silinen = 0
    for k in hedef:
        if b.get("belgeler"):
            shutil.rmtree(k, ignore_errors=True); silinen += 1
            with _db() as con:
                con.execute("DELETE FROM calisma WHERE id LIKE ?", (k.name + "/%",))
        elif b.get("muavin"):
            for d in k.glob("*/*"):
                for y in muavin_dosyalari(d):
                    y.unlink(missing_ok=True); silinen += 1
    return {"tamam": True, "klasor": len(hedef), "silinen": silinen}


# ------------------------------------------------------------------ Fatura → Luca kayıt (MuhaWin)
@app.post("/api/kayit/haric")
def kayit_haric(b: dict):
    """"Kaydedilmeyecek" faturalar. b: {id: rapor kimliği, ekle: [{anahtar, belge_no, tarih, karsi_unvan, karsi_vkn, yon}],
    cikar: [anahtar]}. Liste firmaya aittir (tüm dönemler); ardından bu dönemin kontrolü Luca'ya bağlanmadan yenilenir
    ve toplu kontrol özetindeki satırı güncellenir."""
    k = depo.rapor_klasoru(str(b.get("id") or ""))
    if not k or not k.exists():
        raise HTTPException(404, "Rapor bulunamadı")
    firma_k = k.parent.parent
    h = depo.haric_oku(firma_k)
    for x in b.get("ekle") or []:
        if x.get("anahtar"):
            acik = " ".join(str(x.get("aciklama") or "").split())[:300]   # isteğe bağlı açıklama (toplu işaretlemede ortak)
            h[str(x["anahtar"])] = {kk: x.get(kk) for kk in ("belge_no", "tarih", "karsi_unvan", "karsi_vkn", "yon")} | \
                ({"aciklama": acik} if acik else {}) | {"zaman": datetime.now().isoformat(timespec="seconds")}
    for a in b.get("cikar") or []:
        h.pop(str(a), None)
    depo.haric_yaz(firma_k, h)
    veri = None
    try:
        eski = json.loads((k / depo.RAPOR_JSON).read_text(encoding="utf-8"))
        veri = rapor_yenile(depo.rapor_id(k), eski)
    except (OSError, ValueError):
        pass
    if veri:
        try:
            from ..luca.toplu import ozet_satiri_guncelle
            ozet_satiri_guncelle(veri)
        except Exception:
            pass
    return {"tamam": True, "adet": len(h), "durumlar": (veri or {}).get("durumlar", [])}


# ---- "Kaydedilmeyecek" kuralları: işletme / serbest meslekte şahsi faturalar (ev elektriği, su, telefon…) her ay kendiliğinden
_IPUCU_RE = re.compile(r"(ABONE|TES[İI]SAT|S[ÖO]ZLE[ŞS]ME(\s*HESAP)?|M[ÜU][ŞS]TER[İI]|HİZMET|HIZMET|SAYA[ÇC]|HAT|TELEFON|GSM|KURULUM|TEK[İI]L)"
                       r"\s*(NO|NUMARASI|NUMARA|KODU|ID)?\s*[:：.]?\s*([A-Z]{0,3}\d[\d -]{3,24}\d)", re.I)


def _rapor_faturasi(k: Path, anahtar: str):
    from ..arsiv import donem_faturalari
    zipler = donem_faturalari(k) or sorted(k.glob("gib_*.zip"))
    if not zipler:
        return None
    try:
        vkn = json.loads((k / depo.RAPOR_JSON).read_text(encoding="utf-8")).get("vkn")
    except (OSError, ValueError):
        vkn = None
    ft, _ = faturalari_oku(zipler, vkn or vkn_tespit(zipler))
    return next((f for f in ft if fatura_anahtari(f) == anahtar), None)


@app.get("/api/kayit/fatura-ipucu")
def kayit_fatura_ipucu(id: str, anahtar: str):
    """Kural önerisi için faturadaki abone / tesisat / sözleşme / müşteri numaraları ve karşı taraf bilgisi."""
    k = depo.rapor_klasoru(id)
    if not k or not k.exists():
        raise HTTPException(404, "Rapor bulunamadı")
    f = _rapor_faturasi(k, anahtar)
    if not f:
        raise HTTPException(404, "Fatura bulunamadı")
    gor, out = set(), []
    for m in _IPUCU_RE.finditer(f.metin or ""):
        deger = re.sub(r"[ -]", "", m.group(4))
        if len(deger) >= 5 and deger not in gor and deger != (f.karsi_vkn or "") and not re.fullmatch(r"20\d\d\d{0,2}", deger):
            gor.add(deger); out.append({"etiket": " ".join(x for x in (m.group(1), m.group(3)) if x).title(), "deger": deger})
    return {"oneriler": out[:8], "karsi_unvan": f.karsi_unvan, "karsi_vkn": f.karsi_vkn, "kalemler": f.kalemler[:5], "yon": f.yon}


@app.get("/api/kayit/haric-kural")
def kayit_haric_kural_liste(id: str):
    k = depo.rapor_klasoru(id)
    if not k or not k.exists():
        raise HTTPException(404, "Rapor bulunamadı")
    return {"kurallar": depo.haric_kurallari_oku(k.parent.parent)}


@app.post("/api/kayit/haric-kural")
def kayit_haric_kural(b: dict):
    """b: {id, ekle?: {alan: icerik|vkn|unvan, ifade, yon: ALIS|SATIS|*, aciklama?}, sil?: [kural id]}. Kural firmaya aittir
    (tüm dönemler); bu dönemin kontrolü Luca'ya bağlanmadan yenilenir."""
    from ..eslestirme import KURAL_ALANLARI
    k = depo.rapor_klasoru(str(b.get("id") or ""))
    if not k or not k.exists():
        raise HTTPException(404, "Rapor bulunamadı")
    firma_k = k.parent.parent
    L = depo.haric_kurallari_oku(firma_k)
    e = b.get("ekle")
    if e:
        alan = str(e.get("alan") or "icerik")
        ifade = " ".join(str(e.get("ifade") or "").split())[:120]
        yon = str(e.get("yon") or "*").upper()
        if alan not in KURAL_ALANLARI:
            raise HTTPException(400, "Bilinmeyen kural alanı")
        if len(ifade) < 3:
            raise HTTPException(400, "Kural için en az 3 karakterlik bir ifade (kelime ya da abone / tesisat no) yazın.")
        if alan == "vkn" and len(re.sub(r"\D", "", ifade)) not in (10, 11):
            raise HTTPException(400, "VKN 10, TCKN 11 haneli olmalı.")
        if yon not in ("ALIS", "SATIS", "*"):
            yon = "*"
        if not any(x.get("alan") == alan and x.get("ifade") == ifade and x.get("yon") == yon for x in L):
            L.append({"id": uuid.uuid4().hex[:10], "alan": alan, "ifade": ifade, "yon": yon,
                      "aciklama": " ".join(str(e.get("aciklama") or "").split())[:200], "zaman": datetime.now().isoformat(timespec="seconds")})
    sil = {str(x) for x in b.get("sil") or []}
    L = [x for x in L if x.get("id") not in sil]
    depo.haric_kurallari_yaz(firma_k, L)
    veri = None
    try:
        eski = json.loads((k / depo.RAPOR_JSON).read_text(encoding="utf-8"))
        veri = rapor_yenile(depo.rapor_id(k), eski)
    except (OSError, ValueError):
        pass
    if veri:
        try:
            from ..luca.toplu import ozet_satiri_guncelle
            ozet_satiri_guncelle(veri)
        except Exception:
            pass
    n = len({s.get("anahtar") for s in (veri or {}).get("sonuclar", []) if str(s.get("aciklama") or "").startswith("Kaydedilmeyecek kuralı")})
    return {"tamam": True, "kurallar": L, "eslesen": n, "durumlar": (veri or {}).get("durumlar", [])}


@app.post("/api/kayit/uygun")
def kayit_uygun(b: dict):
    """Kullanıcı kararıyla "uygun" kabul edilen kayıtlar. b: {id, ekle: [{anahtar, aciklama (5–300 karakter), belge_no, tarih,
    karsi_unvan, durum}], cikar: [anahtar]}. Firmaya aittir (tüm dönemler); ardından bu dönemin kontrolü yenilenir."""
    k = depo.rapor_klasoru(str(b.get("id") or ""))
    if not k or not k.exists():
        raise HTTPException(404, "Rapor bulunamadı")
    firma_k = k.parent.parent
    u = depo.uygun_oku(firma_k)
    for x in b.get("ekle") or []:
        a = str(x.get("anahtar") or "").strip()
        acik = " ".join(str(x.get("aciklama") or "").split())
        if not a:
            continue
        if not 5 <= len(acik) <= 300:
            raise HTTPException(400, "Açıklama 5 ile 300 karakter arasında olmalı")
        u[a] = {kk: x.get(kk) for kk in ("belge_no", "tarih", "karsi_unvan", "durum", "fis_no")} | \
            {"aciklama": acik, "zaman": datetime.now().isoformat(timespec="seconds")}
    for a in b.get("cikar") or []:
        u.pop(str(a), None)
    depo.uygun_yaz(firma_k, u)
    veri = None
    try:
        eski = json.loads((k / depo.RAPOR_JSON).read_text(encoding="utf-8"))
        veri = rapor_yenile(depo.rapor_id(k), eski)
    except (OSError, ValueError):
        pass
    if veri:
        try:
            from ..luca.toplu import ozet_satiri_guncelle
            ozet_satiri_guncelle(veri)
        except Exception:
            pass
    return {"tamam": True, "adet": len(u), "durumlar": (veri or {}).get("durumlar", [])}


@app.get("/api/beyanname")
def beyanname_getir(id: str, cevap: str | None = None, tutar: str | None = None, sorumlu: str | None = None):
    """Kontrolü yapılmış dönem için KDV 1 / KDV 2 beyannamesi (GİB yeni biçim kutuları). cevap/tutar: iade talebi.
    sorumlu: sorumlu sıfatıyla indirilen KDV ödendi mi (odendi / odenmedi)."""
    from ..beyanname import hazirla
    try:
        return JSONResponse(hazirla(id, {"cevap": cevap, "tutar": tutar or ""} if cevap else None,
                                    {"cevap": sorumlu} if sorumlu else None))
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))


@app.get("/api/beyanname/excel")
def beyanname_excel(id: str, tur: str = "kdv1"):
    from fastapi.responses import Response
    from ..beyanname import excel, hazirla
    k = depo.rapor_klasoru(id)
    if not k:
        raise HTTPException(404, "Rapor bulunamadı")
    try:
        out = json.loads((k / "beyanname.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        try:
            out = hazirla(id)
        except FileNotFoundError as e:
            raise HTTPException(404, str(e))
    tur = "kdv2" if tur == "kdv2" else "kdv1"
    from urllib.parse import quote
    ad = f"{tur.upper()}_{k.parent.parent.name}_{k.parent.name}-{k.name}.xlsx".replace(" ", "_")
    return Response(excel(out, tur), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    headers={"Content-Disposition": f"attachment; filename=\"{tur.upper()}_beyanname.xlsx\"; filename*=UTF-8''{quote(ad)}"})


@app.get("/api/beyanname/toplu")
def beyanname_toplu(yil: int, ay: int, temiz: int = 0):
    """Bir dönemde kontrolü yapılmış tüm firmaların KDV 1 / KDV 2 kutuları (gönderim öncesi toplu kontrol listesi)."""
    from ..beyanname import toplu
    if not (1 <= ay <= 12 and 2000 <= yil <= 2100):
        raise HTTPException(400, "Dönem geçersiz")
    return JSONResponse(toplu(yil, ay, bool(temiz)))


@app.get("/api/beyanname/toplu/excel")
def beyanname_toplu_excel(yil: int, ay: int, temiz: int = 0):
    from fastapi.responses import Response
    from ..beyanname import toplu, toplu_excel
    if not (1 <= ay <= 12 and 2000 <= yil <= 2100):
        raise HTTPException(400, "Dönem geçersiz")
    ad = f"KDV_Ozet_{yil}-{ay:02d}.xlsx"
    return Response(toplu_excel(toplu(yil, ay, bool(temiz))), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    headers={"Content-Disposition": f"attachment; filename=\"{ad}\""})


@app.post("/api/beyanname/karsilastir")
def beyanname_karsilastir(b: dict):
    """GİB'den indirilen beyanname PDF'inin metni (MuhaWin pdf.js ile çıkarır) ile MuhaWin beyannamesini kutu kutu karşılaştırır.
    b: {id, tur: kdv1|kdv2, metin}."""
    from ..beyanname import karsilastir
    metin = str(b.get("metin") or "")
    if len(metin) < 20:
        raise HTTPException(400, "PDF metni boş; taranmış PDF olabilir")
    try:
        return JSONResponse(karsilastir(str(b.get("id") or ""), metin[:400000], str(b.get("tur") or "kdv1")))
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))


@app.get("/api/beyanname/donemler")
def beyanname_donemler():
    """Beyanname hazırlanabilecek dönemler: muavini olan kontrol raporları (temiz / sorunlu bilgisiyle)."""
    from ..kontrol import muavin_dosyalari
    out = []
    with _db() as con:
        rows = con.execute("SELECT id, zaman, firma, vkn, bas, bit, fatura_sayisi, sorunlu FROM calisma ORDER BY firma, bas DESC").fetchall()
    gor = set()
    for r in rows:
        d = dict(zip(["id", "zaman", "firma", "vkn", "bas", "bit", "fatura_sayisi", "sorunlu"], r))
        if d["id"] in gor:
            continue
        gor.add(d["id"])
        k = depo.rapor_klasoru(d["id"])
        d["muavin"] = bool(k and muavin_dosyalari(k))
        d["beyanname"] = bool(k and (k / "beyanname.json").exists())
        try:   # firmanın Luca numarası (MuhaWin'deki firma seçimiyle eşleşmek için)
            d["luca_id"] = json.loads((k.parent.parent / "firma.json").read_text(encoding="utf-8")).get("luca_id") if k else None
        except (OSError, ValueError):
            d["luca_id"] = None
        out.append(d)
    return out


@app.post("/api/beyanname/dosya")
async def beyanname_dosyadan(muavinler: list[UploadFile] = File(...), program: str = Form(""), bas: str = Form(...), bit: str = Form(...),
                             firma: str = Form(""), vkn: str = Form("")):
    """Muhasebe programı olmayan firma: yüklenen muavin dosyasından (tüm hesaplar) KDV 1 / KDV 2."""
    from .. import muavin_programlari as MP
    from ..beyanname import dosyadan
    program = MP.gecerli(program or MP.VARSAYILAN)
    with tempfile.TemporaryDirectory(prefix="fk_byn_") as tmp:
        yollar = await _kaydet(muavinler, Path(tmp), set(MP.PROGRAMLAR[program]["uzantilar"]))
        if not yollar:
            raise HTTPException(400, "Muavin dosyası seçin")
        try:
            return JSONResponse(dosyadan(yollar, program, _tarih(bas), _tarih(bit), firma, vkn))
        except Exception as e:
            raise HTTPException(400, f"Muavin okunamadı: {e}")


@app.get("/api/kayit/adaylar")
def kayit_adaylari(id: str):
    from ..kayit_aday import adaylar
    try:
        return adaylar(id)
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))


# ------------------------------------------------------------------ ayarlar
@app.get("/api/ayarlar")
def ayarlar_getir():
    return ayarlar.oku()


@app.put("/api/ayarlar")
def ayarlar_kaydet(yeni: dict):
    try:
        ayarlar.kaydet(yeni)
    except OSError as e:
        raise HTTPException(400, str(e))
    bildirim.arka_planda_gonder()          # kullanıcı bilgileri değiştiyse sağlayıcıya e-posta (Luca bilgileri hariç)
    return ayarlar.oku()


@app.get("/api/bildirim")
def bildirim_durumu():
    return bildirim.durum()


@app.on_event("startup")
def _acilis():
    bildirim.arka_planda_gonder()          # önceki gönderim internet yokken başarısız olduysa yeniden dene


@app.get("/api/depolama")
def depolama():
    return {"klasor": str(depo.veri()), "firmalar_mb": round(depo.klasor_boyutu(depo.firmalar_kok()) / 1e6, 1),
            "toplu_mb": round(depo.klasor_boyutu(depo.toplu_kok()) / 1e6, 1)}


@app.post("/api/verileri-sil")
def verileri_sil(onay: dict):
    if onay.get("onay") != "SİL":
        raise HTTPException(400, "Onay metni hatalı")
    from .toplu_api import _calisiyor
    if _calisiyor():
        raise HTTPException(409, "Çalışan bir işlem varken veriler silinemez.")
    depo.tum_verileri_sil()
    return depolama()
