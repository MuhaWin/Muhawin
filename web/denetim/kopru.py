"""MuhaWin sitesi · Denetim: Fatura Kontrol web uygulamasını (fk/fatura_kontrol/web/app.py) tarayıcıda çalıştırır.

Pyodide'de (Web Worker) yüklenir. Sunucu yoktur: sayfanın /api/... istekleri JavaScript köprüsünden (kopru.js →
calisan.js) buraya gelir ve app.py'deki uç nokta fonksiyonları doğrudan çağrılır. Böylece denetim kuralları ve
uç noktalar programdakiyle aynı kalır; burada yalnız küçük bir FastAPI taklidi vardır.

Tarayıcıda yalnız fastapi / pydantic yerine aşağıdaki taklit (yönlendirme tablosu + yanıt sınıfları) kullanılır.
Luca otomasyonu (playwright) ve geçmiş veritabanı (sqlite3) Görev 08'den beri yalnız gerektiğinde içe aktarılır;
tarayıcıda yoktur, Luca'ya bağlanan uç noktalar burada kapalıdır.
"""
from __future__ import annotations

import inspect
import io
import json
import re
import sys
import types
import typing
from dataclasses import is_dataclass, asdict
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path

ROTALAR: list[tuple[str, re.Pattern, object]] = []
ISLEYICILER: dict[type, object] = {}   # @app.exception_handler(Hata): uygulamanın kendi hata yanıtları
# Tarayıcıda kapalı: Luca'ya bağlanan ve bilgisayara özgü bölümler; yapay zekâ önerisi (anahtar tarayıcıya girmesin, Görev 43 Faz 4)
KAPALI = re.compile(r"^/api/(toplu|kontrol/luca-faturalari|isletme-fis|ayarlar|bildirim|verileri-sil|denetim/yz)(/|$)")


# ------------------------------------------------------------------ fastapi / pydantic taklidi
class _Isaret:
    def __init__(self, tur, varsayilan):
        self.tur, self.varsayilan = tur, varsayilan


def File(varsayilan=..., **k):
    return _Isaret("dosya", varsayilan)


def Form(varsayilan=..., **k):
    return _Isaret("form", varsayilan)


class HTTPException(Exception):
    def __init__(self, status_code=400, detail=""):
        super().__init__(detail)
        self.status_code, self.detail = status_code, detail


class UploadFile:
    def __init__(self, filename, veri: bytes):
        self.filename, self.file = filename, io.BytesIO(veri)

    async def read(self):
        return self.file.read()


class Request:
    def __init__(self, sorgu):
        self.query_params, self.headers, self.cookies, self.client = sorgu, {}, {}, None


class _Yanit:
    medya = "application/octet-stream"

    def __init__(self, content=None, status_code=200, headers=None, media_type=None, **k):
        self.content, self.status_code, self.headers = content, status_code, dict(headers or {})
        self.media_type = media_type or self.medya


class Response(_Yanit):
    pass


class JSONResponse(_Yanit):
    medya = "application/json"


class HTMLResponse(_Yanit):
    medya = "text/html; charset=utf-8"


class RedirectResponse(_Yanit):
    def __init__(self, url, status_code=307, **k):
        super().__init__(None, status_code, {"location": str(url)})


class FileResponse(_Yanit):
    def __init__(self, path, filename=None, media_type=None, headers=None, **k):
        super().__init__(None, 200, headers, media_type)
        self.path, self.filename = Path(path), filename or Path(path).name


class FastAPI:
    def __init__(self, *a, prefix="", **k):
        self.prefix = prefix

    def _dek(self, yontem):
        def dek(yol, **k):
            desen = re.compile("^" + re.sub(r"\{(\w+)\}", r"(?P<\1>[^/]+)", self.prefix + yol) + "$")

            def kaydet(fn):
                ROTALAR.append((yontem, desen, fn))
                return fn
            return kaydet
        return dek

    def get(self, yol, **k):
        return self._dek("GET")(yol, **k)

    def post(self, yol, **k):
        return self._dek("POST")(yol, **k)

    def put(self, yol, **k):
        return self._dek("PUT")(yol, **k)

    def delete(self, yol, **k):
        return self._dek("DELETE")(yol, **k)

    def middleware(self, *a, **k):
        return lambda f: f

    def exception_handler(self, hata):
        def kaydet(fn):
            ISLEYICILER[hata] = fn
            return fn
        return kaydet

    def on_event(self, *a, **k):
        return lambda f: f

    def include_router(self, *a, **k):
        pass


class BaseModel:
    def __init__(self, **veri):
        ipucu = typing.get_type_hints(type(self))
        for ad in ipucu:
            if ad in veri:
                setattr(self, ad, veri[ad])
            elif not hasattr(type(self), ad):
                raise HTTPException(422, f"Eksik alan: {ad}")


def _modul(ad, **icerik):
    m = types.ModuleType(ad)
    m.__dict__.update(icerik)
    sys.modules[ad] = m
    return m


def taklitleri_kur():
    yanitlar = dict(Response=Response, JSONResponse=JSONResponse, HTMLResponse=HTMLResponse,
                    RedirectResponse=RedirectResponse, FileResponse=FileResponse)
    fa = _modul("fastapi", FastAPI=FastAPI, APIRouter=FastAPI, File=File, Form=Form, HTTPException=HTTPException,
                UploadFile=UploadFile, Request=Request, **yanitlar)
    fa.responses = _modul("fastapi.responses", **yanitlar)
    _modul("pydantic", BaseModel=BaseModel)


# ------------------------------------------------------------------ istek → uç nokta
def _json_hazirla(o):
    if isinstance(o, Decimal):
        return float(o)
    if isinstance(o, (date, datetime)):
        return o.isoformat()
    if isinstance(o, Path):
        return str(o)
    if isinstance(o, (set, tuple)):
        return list(o)
    if is_dataclass(o):
        return asdict(o)
    raise TypeError(f"JSON'a çevrilemiyor: {type(o).__name__}")


def _cevir(deger, tip):
    if tip in (bool, "bool"):          # FastAPI gibi: 1 / true / on / yes → True
        return str(deger).strip().lower() in ("1", "true", "on", "yes")
    if tip in (int, "int"):
        return int(deger)
    if tip in (float, "float"):
        return float(deger)
    return deger


def _degiskenler(fn, sorgu, govde, form, yol_degiskeni):
    imza = inspect.signature(fn)
    try:
        ipucu = typing.get_type_hints(fn)
    except Exception:
        ipucu = {}
    kw = {}
    for ad, p in imza.parameters.items():
        tip = ipucu.get(ad, p.annotation)
        isaret = p.default if isinstance(p.default, _Isaret) else None
        if ad in yol_degiskeni:
            kw[ad] = yol_degiskeni[ad]
        elif tip is Request or tip == "Request":
            kw[ad] = Request(sorgu)
        elif inspect.isclass(tip) and issubclass(tip, BaseModel):
            kw[ad] = tip(**(govde or {}))
        elif isaret and isaret.tur == "dosya":
            dosyalar = [UploadFile(d["ad"], bytes(d["veri"])) for d in form.get(ad, []) if isinstance(d, dict)]
            if not dosyalar:
                if isaret.varsayilan is ...:
                    raise HTTPException(422, f"Dosya eksik: {ad}")
                kw[ad] = isaret.varsayilan
            else:
                kw[ad] = dosyalar if typing.get_origin(tip) in (list, typing.Union, types.UnionType) or "list" in str(tip) else dosyalar[0]
        elif isaret and isaret.tur == "form":
            degerler = [d for d in form.get(ad, []) if not isinstance(d, dict)]
            if degerler:
                kw[ad] = degerler[0]
            elif isaret.varsayilan is ...:
                raise HTTPException(422, f"Alan eksik: {ad}")
            else:
                kw[ad] = isaret.varsayilan
        elif ad in sorgu:
            kw[ad] = _cevir(sorgu[ad], tip)
        elif p.default is inspect.Parameter.empty:
            raise HTTPException(422, f"Eksik değer: {ad}")
    return kw


def _yanit(sonuc):
    if isinstance(sonuc, FileResponse):
        return {"durum": 200, "tur": "dosya", "medya": sonuc.media_type, "dosya_adi": sonuc.filename,
                "govde": sonuc.path.read_bytes()}
    if isinstance(sonuc, _Yanit):
        icerik = sonuc.content
        if isinstance(sonuc, JSONResponse) or (not isinstance(icerik, (str, bytes)) and icerik is not None):
            return {"durum": sonuc.status_code, "tur": "metin", "medya": "application/json",
                    "govde": json.dumps(icerik, ensure_ascii=False, default=_json_hazirla)}
        tur = "metin" if isinstance(icerik, str) or icerik is None else "dosya"
        cevap = {"durum": sonuc.status_code, "tur": tur, "medya": sonuc.media_type, "govde": icerik or ""}
        ad = re.search(r'filename\*?=(?:UTF-8\'\')?"?([^";]+)', sonuc.headers.get("Content-Disposition", ""))
        if ad:
            from urllib.parse import unquote
            cevap["dosya_adi"] = unquote(ad.group(1))
        return cevap
    if isinstance(sonuc, str):
        return {"durum": 200, "tur": "metin", "medya": "text/html; charset=utf-8", "govde": sonuc}
    return {"durum": 200, "tur": "metin", "medya": "application/json",
            "govde": json.dumps(sonuc, ensure_ascii=False, default=_json_hazirla)}


def _hata(durum, metin):
    return {"durum": durum, "tur": "metin", "medya": "application/json", "govde": json.dumps({"detail": metin}, ensure_ascii=False)}


async def cagir(yontem: str, yol: str, sorgu: dict, govde, form: dict):
    """Bir /api isteğini app.py'deki uç noktaya verir; yanıtı {durum, tur, medya, govde, dosya_adi} olarak döner."""
    if KAPALI.match(yol):
        return _hata(404, "Bu bölüm web sürümünde yok; MuhaWin programında kullanın.")
    if yol == "/api/saglik":
        return _yanit({"uygulama": "fatura-kontrol", "muhawin": False, "web": True, "tarayici": True})
    for y, desen, fn in ROTALAR:
        m = desen.match(yol)
        if y != yontem or not m:
            continue
        try:
            kw = _degiskenler(fn, sorgu or {}, govde, form or {}, m.groupdict())
            sonuc = fn(**kw)
            if inspect.isawaitable(sonuc):
                sonuc = await sonuc
            return _yanit(sonuc)
        except HTTPException as e:
            return _hata(e.status_code, str(e.detail))
        except Exception as e:
            isleyici = next((ISLEYICILER[t] for t in type(e).__mro__ if t in ISLEYICILER), None)
            if isleyici:                # ör. GirdiSiniri → 400 ve Türkçe ileti (app.py ile aynı)
                yanit = isleyici(Request(sorgu or {}), e)
                if inspect.isawaitable(yanit):
                    yanit = await yanit
                return _yanit(yanit)
            import traceback   # programdaki gibi kullanıcıya kısa ileti
            traceback.print_exc()
            return _hata(500, f"Beklenmeyen hata: {e}")
    return _hata(404, "Bulunamadı")


def yukle():
    """Taklitleri kurar ve uygulamayı içe aktarır (rotalar ROTALAR'a yazılır)."""
    taklitleri_kur()
    import fatura_kontrol.web.app  # noqa: F401
    return len(ROTALAR)
