"""Web sürümü (FK_WEB=1): sitede yayınlanan Mikro Denetim için giriş ve Luca'sız çalışma.

Masaüstünde (MuhaWin içinde) hiçbir şey değişmez; bu modül yalnız FK_WEB=1 ile devreye girer.
  * Giriş MuhaWin hesabıyla yapılır (Supabase e-posta / parola). Yalnız FK_WEB_IZINLI'deki e-postalar girebilir.
  * Oturum imzalı, HttpOnly bir çerezde tutulur (FK_WEB_ANAHTAR ile imzalanır; sunucu yeniden başlasa da geçerli kalır).
  * Luca'ya bağlanan, bilgisayara özgü ayar okuyan bölümler kapalıdır; ana sayfa Mikro Denetim'e gider.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import time
import urllib.error
import urllib.request
from pathlib import Path

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from pydantic import BaseModel

CEREZ = "fk_oturum"
SURE = 12 * 3600                       # oturum süresi (sn)
KILIT_DENEME, KILIT_SURE = 5, 15 * 60  # 15 dakikada 5 hatalı denemede kilit
STATIK = Path(__file__).parent / "static"

# Oturumsuz açılan adresler (giriş sayfası ve görünüm dosyaları)
ACIK = {"/giris", "/api/giris", "/api/saglik", "/simge.ico", "/tema.css", "/tema.js", "/imlec.css"}
# Web sürümünde kapalı: Luca otomasyonu, Luca'ya fiş aktarımı, bilgisayardaki ayarlar
KAPALI_ON = ("/toplu", "/api/toplu", "/api/kontrol", "/isletme-fis", "/api/isletme-fis", "/api/ayarlar",
             "/api/bildirim", "/api/verileri-sil", "/api/firma/sil", "/api/kayit/adaylar")


def acik() -> bool:
    return os.environ.get("FK_WEB") == "1"


def _izinli() -> set[str]:
    return {e.strip().lower() for e in os.environ.get("FK_WEB_IZINLI", "").split(",") if e.strip()}


def _anahtar() -> bytes:
    a = os.environ.get("FK_WEB_ANAHTAR", "")
    if len(a) < 32:
        raise RuntimeError("FK_WEB_ANAHTAR en az 32 karakter olmalı (ör. openssl rand -hex 32).")
    return a.encode()


def _imza(veri: str) -> str:
    return base64.urlsafe_b64encode(hmac.new(_anahtar(), veri.encode(), hashlib.sha256).digest()).decode().rstrip("=")


def oturum_yaz(eposta: str, simdi: float | None = None) -> str:
    veri = base64.urlsafe_b64encode(json.dumps({"e": eposta, "s": int((time.time() if simdi is None else simdi) + SURE)}).encode()).decode().rstrip("=")
    return f"{veri}.{_imza(veri)}"


def oturum_oku(deger: str | None, simdi: float | None = None) -> str | None:
    """Geçerli oturumun e-postası; imza bozuk, süre dolmuş ya da e-posta artık izinli değilse None."""
    if not deger or "." not in deger:
        return None
    veri, imza = deger.rsplit(".", 1)
    if not hmac.compare_digest(imza, _imza(veri)):
        return None
    try:
        j = json.loads(base64.urlsafe_b64decode(veri + "=" * (-len(veri) % 4)))
    except ValueError:
        return None
    if int(j.get("s", 0)) < (time.time() if simdi is None else simdi) or str(j.get("e", "")).lower() not in _izinli():
        return None
    return j["e"]


def supabase_dogrula(eposta: str, parola: str) -> bool:
    """MuhaWin hesabının e-posta / parolası Supabase'de doğru mu."""
    url = os.environ.get("FK_SUPABASE_URL", "").rstrip("/")
    anon = os.environ.get("FK_SUPABASE_ANON", "")
    if not (url and anon):
        raise RuntimeError("FK_SUPABASE_URL / FK_SUPABASE_ANON tanımlı değil.")
    istek = urllib.request.Request(
        f"{url}/auth/v1/token?grant_type=password", method="POST",
        data=json.dumps({"email": eposta, "password": parola}).encode(),
        headers={"apikey": anon, "Authorization": f"Bearer {anon}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(istek, timeout=15) as r:
            return r.status == 200
    except urllib.error.HTTPError as e:
        if e.code in (400, 401, 403, 422):
            return False
        raise


_hatalar: dict[str, list[float]] = {}


def _kilitli(anahtar: str, simdi: float) -> bool:
    L = [t for t in _hatalar.get(anahtar, []) if simdi - t < KILIT_SURE]
    _hatalar[anahtar] = L
    return len(L) >= KILIT_DENEME


def _istemci(request: Request) -> str:
    # Caddy arkasında gerçek adres X-Forwarded-For'un ilk öğesidir
    ileri = request.headers.get("x-forwarded-for", "")
    return ileri.split(",")[0].strip() or (request.client.host if request.client else "")


class GirisIstek(BaseModel):
    eposta: str
    parola: str


router = APIRouter()


@router.get("/giris", response_class=HTMLResponse)
def giris_sayfa():
    return (STATIK / "giris.html").read_text(encoding="utf-8")


@router.post("/api/giris")
def giris(b: GirisIstek, request: Request):
    eposta, simdi = b.eposta.strip().lower(), time.time()
    anahtar = f"{_istemci(request)}|{eposta}"
    if _kilitli(anahtar, simdi):
        return JSONResponse({"detail": "Çok fazla hatalı deneme. 15 dakika sonra yeniden deneyin."}, 429)
    if eposta not in _izinli():
        _hatalar.setdefault(anahtar, []).append(simdi)
        return JSONResponse({"detail": "Bu hesapla web denetimine giriş izni yok."}, 403)
    try:
        dogru = supabase_dogrula(eposta, b.parola)
    except Exception:
        return JSONResponse({"detail": "Giriş sunucusuna ulaşılamadı. Biraz sonra yeniden deneyin."}, 502)
    if not dogru:
        _hatalar.setdefault(anahtar, []).append(simdi)
        return JSONResponse({"detail": "E-posta ya da parola yanlış."}, 401)
    _hatalar.pop(anahtar, None)
    r = JSONResponse({"tamam": True, "eposta": eposta})
    r.set_cookie(CEREZ, oturum_yaz(eposta), max_age=SURE, httponly=True, samesite="lax",
                 secure=os.environ.get("FK_WEB_GUVENLI_CEREZ", "1") == "1")
    return r


@router.post("/api/cikis")
def cikis():
    r = JSONResponse({"tamam": True})
    r.delete_cookie(CEREZ)
    return r


@router.get("/api/oturum")
def oturum(request: Request):
    return {"eposta": oturum_oku(request.cookies.get(CEREZ))}


async def denetci(request: Request, call_next):
    """Her istekte: kapalı bölümleri engeller, oturum yoksa giriş sayfasına gönderir."""
    yol = request.url.path
    if yol == "/":
        return RedirectResponse("/denetim", 303)
    if any(yol == k or yol.startswith(k + "/") for k in KAPALI_ON):
        return JSONResponse({"detail": "Bu bölüm web sürümünde kapalı; MuhaWin programında kullanın."}, 404)
    if yol in ACIK:
        return await call_next(request)
    if not oturum_oku(request.cookies.get(CEREZ)):
        if yol.startswith("/api/"):
            return JSONResponse({"detail": "Oturum kapalı; yeniden giriş yapın."}, 401)
        return RedirectResponse("/giris", 303)
    return await call_next(request)
