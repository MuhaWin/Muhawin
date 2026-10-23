"""Luca otomasyonu: faturaları ve muavini indirip kontrolü çalıştırır.

Akış (ayrıntılar: docs/luca_akis.md):
  1. Chrome açılır, kullanıcı Luca'ya kendisi girer (şifre/captcha programa girmez).
  2. Firma (ve gerekirse dönem yılı) seçilir; Luca'nın gösterdiği VKN okunur.
  3. e-Fatura / e-Arşiv alış-satış ekranlarının her birinde:
       GİB'den Getir (tarih aralığı) -> İşlem Takip bitene kadar bekle -> Kapat
       -> Tümünü seç -> Seçilenleri İndir (ZIP) ; sayfa sayfa
  4. Muavin Defter (100-999, Excel Liste) indirilir.
  5. Kontrol motoru çalışır, rapor web arayüzünün geçmişine eklenir ve açılır.

Güvenlik:
  * Belge Sil, Muhasebeleştir, Muhasebe İptal, Fiş Kes vb. düğmelere HİÇBİR koşulda basılmaz
    (her tıklama `guvenli_tikla` üzerinden yasak listesine karşı denetlenir).
  * Sayfadaki GİB/entegratör şifre alanları okunmaz.

Kullanım:
  python -m fatura_kontrol.luca.otomasyon --firma "EXPO İNŞ" --ay 2026-09
  python -m fatura_kontrol.luca.otomasyon --firma "EXPO İNŞ" --bas 01.09.2026 --bit 30.09.2026
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import unicodedata
import warnings
from calendar import monthrange
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path

from playwright.sync_api import Error as PWError
from playwright.sync_api import TimeoutError as PWTimeout
from playwright.sync_api import sync_playwright
from contextlib import contextmanager

from .kayit import PROFIL, tarayici_ac

BASLANGIC = os.environ.get("FK_LUCA_URL", "https://www.luca.com.tr")
# MuhaWin'de Luca'ya girilmişse oturum (çerezler) bu tarayıcıya aktarılır: Luca'nın ürün seçim sayfasından Mali Müşavir
# Paketi açılır, yeniden giriş / doğrulama kodu gerekmez (Luca aynı anda iki pencereye izin verir).
SSO_ANA = os.environ.get("FK_LUCA_SSO", "https://agiris.luca.com.tr/LUCASSO/main.erp")
_CEREZ: list | None = None


def muhawin_cerezleri() -> list:
    """MuhaWin'in verdiği Luca çerezleri (FK_LUCA_CEREZ geçici dosyası). Dosya okunur okunmaz silinir; liste yalnız bu
    süreçte bellekte tutulur, hiçbir yere yazılmaz ve günlüğe basılmaz."""
    global _CEREZ
    if _CEREZ is None:
        _CEREZ = []
        yol = os.environ.pop("FK_LUCA_CEREZ", "")
        if yol:
            try:
                v = json.loads(Path(yol).read_text(encoding="utf-8"))
                _CEREZ = [c for c in v if isinstance(c, dict) and c.get("name") and "value" in c] if isinstance(v, list) else []
            except (OSError, ValueError):
                _CEREZ = []
            try:
                Path(yol).unlink()
            except OSError:
                pass
    return _CEREZ


def muhawin_oturumuyla_ac(ctx, sayfa) -> bool:
    """MuhaWin'deki Luca oturumunu bu tarayıcıya aktarıp ürün seçim sayfasını açar; sayfa açıldıysa Mali Müşavir Paketi'ne
    otomatik basılır (_paket_sec). Oturum geçersizse (giriş sayfasına dönerse) False: normal giriş yapılır."""
    c = muhawin_cerezleri()
    if not c:
        return False
    try:
        ctx.add_cookies(c)
        sayfa.goto(SSO_ANA, wait_until="domcontentloaded")
    except PWError as e:
        print(f"  (MuhaWin oturumu aktarılamadı: {str(e).splitlines()[0][:100]})", flush=True)
        return False
    if "main.erp" not in sayfa.url or _sayfada_parola(sayfa):
        print("  MuhaWin'deki Luca oturumu bu tarayıcıda geçerli olmadı; normal giriş yapılacak.", flush=True)
        return False
    _OTO["paket"] = True
    print("» MuhaWin'deki Luca oturumu kullanılıyor (yeniden giriş gerekmedi).", flush=True)
    bildir("giris", "MuhaWin'deki Luca oturumuyla açılıyor…")
    return True
def _sayfada_parola(sayfa) -> bool:
    """Yalnız bu sayfada görünür parola kutusu var mı (eski giriş sekmeleri hesaba katılmaz)."""
    for f in sayfa.frames:
        try:
            if f.evaluate("() => [...document.querySelectorAll('input[type=password]')].some(e => e.getBoundingClientRect().width > 0)"):
                return True
        except PWError:
            continue
    return False


# ---- Doğrulama kodu (captcha) programda: Luca tarayıcısı arka planda (küçültülmüş) kalır; kodun resmi programın ekranında
# gösterilir, kullanıcı kodu orada yazar, program Luca'ya yazıp girişi tamamlar. Kodu her zaman kullanıcı okur ve yazar.
CIKTI: Path | None = None             # toplu sürecin çıktı klasörü (captcha.png / captcha_yanit.txt)
CAPTCHA_RESIM_JS = r"""(cap) => { const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const imgs = [...document.querySelectorAll('img, canvas')].filter(vis);
  let img = imgs.find(i => /captcha|kaptcha|guvenlik|g[üu]venlik|dogrulama|jcaptcha|kod|code|image\.(do|erp|jsp)/i.test((i.src || '') + ' ' + i.id + ' ' + i.className));
  if (!img) { const all = [...document.querySelectorAll('img, canvas, input')]; const k = all.indexOf(cap);
    for (let j = k; j >= 0; j--) if (all[j].tagName !== 'INPUT' && vis(all[j])) { img = all[j]; break; }
    if (!img) for (let j = k; j < all.length; j++) if (all[j].tagName !== 'INPUT' && vis(all[j])) { img = all[j]; break; } }
  if (img) img.setAttribute('data-mw-captcha', '1');
  return !!img; }"""


def _pencere_durumu(sayfa, durum: str):
    """Luca tarayıcı penceresini küçültür ('minimized') ya da öne getirir ('normal')."""
    try:
        cdp = sayfa.context.new_cdp_session(sayfa)
        w = cdp.send("Browser.getWindowForTarget")
        cdp.send("Browser.setWindowBounds", {"windowId": w["windowId"], "bounds": {"windowState": durum}})
        if durum == "normal":
            sayfa.bring_to_front()
    except Exception:
        pass


def captcha_programda(f, girdi, gonder) -> bool:
    """Captcha resmini programa verir, yanıtı bekleyip Luca'ya yazar ve girişe basar. Resim alınamazsa False
    (Luca penceresi öne getirilir, kullanıcı orada yazar)."""
    if CIKTI is None:
        return False
    resim, yanit = CIKTI / "captcha.png", CIKTI / "captcha_yanit.txt"
    for deneme in range(5):
        try:
            if not f.evaluate(CAPTCHA_RESIM_JS, girdi.element_handle()):
                return False
            gecici = resim.with_suffix(".tmp.png")
            f.locator("[data-mw-captcha]").first.screenshot(path=str(gecici))
            os.replace(gecici, resim)               # yarım yazılmış resim gösterilmesin
        except PWError:
            return False
        yanit.unlink(missing_ok=True)
        bildir("captcha", "Luca doğrulama kodu: programdaki kutuya resimdeki kodu yazıp Giriş'e basın." if not deneme
               else "Kod kabul edilmedi; yeni kodu yazın.")
        son = time.time() + 300
        kod = None
        while time.time() < son:
            if yanit.exists():
                kod = yanit.read_text(encoding="utf-8").strip()[:20]; yanit.unlink(missing_ok=True); break
            try:
                if not girdi.is_visible():        # kullanıcı Luca penceresinde kendisi girdi
                    resim.unlink(missing_ok=True); return True
                f.page.wait_for_timeout(700)
            except PWError:
                resim.unlink(missing_ok=True); return True
        if not kod:
            resim.unlink(missing_ok=True); return False
        try:
            girdi.fill(kod)
            if gonder is not None and gonder.count():
                guvenli_tikla(gonder.first, "GİRİŞ")
            else:
                girdi.press("Enter")
            f.page.wait_for_timeout(2500)
            if f.page.is_closed() or not girdi.is_visible():
                resim.unlink(missing_ok=True); return True
        except PWError:
            resim.unlink(missing_ok=True); return True
    resim.unlink(missing_ok=True)
    return False


DINLEYICI = None      # programın ilerleme ekranı için: fn(olay, ayrinti)


def bildir(olay: str, ayrinti: str = ""):
    if DINLEYICI:
        try:
            DINLEYICI(olay, ayrinti)
        except Exception:
            pass


TURLER = {
    "gib_efatura_alis": "e-Fatura Alış",
    "gib_efatura_satis": "e-Fatura Satış",
    "gib_ebelge_alis": "e-Arşiv Alış",
    "gib_ebelge_satis": "e-Arşiv Satış",
    "gib_esmm_alis": "e-SMM Alış",
    "gib_esmm_satis": "e-SMM Satış",
}
# Bu kalıpları içeren düğmelere asla basılmaz (id, onclick veya metin)
YASAK = re.compile(r"sil|muhasebe|fis-kes|fiş kes|kdv-window|iptal|itiraz|gonder\('excel'\)", re.I)
GIRIS_BEKLEME = int(os.environ.get("FK_GIRIS_SN", "900"))     # kullanıcı girişi için azami süre
GETIR_BEKLEME = int(os.environ.get("FK_GETIR_SN", "900"))     # GİB sorgusu için azami süre
INDIRME_BEKLEME = int(os.environ.get("FK_INDIR_SN", "600"))


class OtomasyonHatasi(Exception):
    pass


@dataclass
class Sonuc:
    klasor: Path
    vkn: str | None = None
    firma: str | None = None
    zipler: list[Path] = field(default_factory=list)
    muavin: Path | None = None
    adimlar: list[dict] = field(default_factory=list)

    def not_al(self, adim: str, durum: str, ayrinti: str = ""):
        self.adimlar.append({"adim": adim, "durum": durum, "ayrinti": ayrinti,
                             "zaman": datetime.now().isoformat(timespec="seconds")})
        isaret = {"tamam": "✓", "atlandı": "–", "hata": "✗"}.get(durum, "•")
        bildir("adim", f"{isaret} {adim}" + (f": {ayrinti}" if ayrinti else ""))
        print(f"  {isaret} {adim}" + (f": {ayrinti}" if ayrinti else ""), flush=True)


def sade(s: str) -> str:
    s = (s or "").replace("İ", "i").replace("I", "ı").lower().replace("ı", "i")
    s = unicodedata.normalize("NFD", s)
    return re.sub(r"\s+", " ", "".join(c for c in s if not unicodedata.combining(c))).strip()


# ---------------------------------------------------------------- yardımcılar
def guvenli_tikla(loc, ad: str):
    """Yasak listesindeki bir düğmeye tıklanmasını engeller."""
    bilgi = loc.evaluate("e => [e.id || '', e.getAttribute('onclick') || '', (e.innerText || e.value || '').trim()]")
    if any(YASAK.search(x) for x in bilgi):
        raise OtomasyonHatasi(f"GÜVENLİK: '{ad}' yasaklı bir düğmeye denk geldi, basılmadı ({bilgi})")
    loc.click()


def gorunur(f, css: str):
    """Aynı kimlikte gizli kopyalar olabildiği için yalnız görünür olanı seçer."""
    return f.locator(f"{css} >> visible=true").first


def _bilgi_penceresi(f3):
    """'Fatura bulunamadı' BİLGİ PENCERESİ: Tamam düğmesi olan, İşlem Takip panosunu içermeyen kutu."""
    desen = re.compile(r"bulunamad|bulunmamaktad", re.I)
    tamamli = f3.locator("div >> visible=true").filter(
        has=f3.locator("button:has-text('Tamam') >> visible=true")).filter(
        has_not=f3.locator("#luca-board")).filter(has_text=desen)
    return f3.locator("#confirm_window >> visible=true").filter(has_text=desen).or_(tamamli)


def uyari_kapat(f3, L=None):
    """Luca'nın 'Her hangi bir fatura bulunamadı' gibi bilgi pencerelerini kapatır.
    Önce 'Tamam'; o düğme yasak listesine takılırsa pencerenin × düğmesi, o da yoksa Esc."""
    bekle = (L or f3.page).wait_for_timeout
    for _ in range(3):
        try:
            # Yalnız bilgi PENCERESİ (#confirm_window / iletişim kutusu). İşlem Takip panosundaki ve köşedeki
            # kırmızı GİB uyarılarında da 'bulunamadı' yazar; onlar normaldir, dokunulmaz.
            mesaj = _bilgi_penceresi(f3)
            if not mesaj.count():
                return
            tamam = f3.locator("#confirm_window button.green >> visible=true").or_(
                f3.locator("button:has-text('Tamam') >> visible=true")).or_(
                f3.locator("input[value='Tamam'] >> visible=true"))
            try:
                if not tamam.count():
                    raise OtomasyonHatasi("Tamam yok")
                guvenli_tikla(tamam.first, "Bilgi penceresi: Tamam")
            except OtomasyonHatasi:
                kapat = f3.locator("#confirm_window .fa-window-close >> visible=true").or_(
                    f3.locator("text=× >> visible=true"))
                if kapat.count():
                    kapat.first.click()
                else:
                    f3.page.keyboard.press("Escape")
            bekle(700)
        except PWError:
            return


_ZAMAN_ASIMI = re.compile(r"zaman\s*a[şs][ıi]m", re.I)


def zaman_asimi(L, bekle_sn: float = 900) -> bool:
    """Luca'nın "Zaman Aşımı – Parola Girişi" kutusu (oturum bir süre boşta kalınca çıkar ve tüm ekranı kilitler).
    Ayarlarda parola kayıtlıysa parolayı yazıp Giriş'e basar; değilse kullanıcıdan ister ve kutu kapanana kadar
    bekler. Kutu yoksa False döner."""
    def bul():
        for f in L.frames:
            try:
                kutu = f.locator("div >> visible=true").filter(has_text=_ZAMAN_ASIMI).filter(
                    has=f.locator("input[type=password] >> visible=true"))
                if kutu.count():
                    return f, kutu.last
            except PWError:
                continue
        return None, None
    try:
        f, kutu = bul()
    except PWError:
        return False
    if f is None:
        return False
    print("  Luca 'Zaman Aşımı – Parola Girişi' kutusu açık.", flush=True)
    from .. import ayarlar
    bilgi = ayarlar.luca_girisi() or {}
    if bilgi.get("parola"):
        try:
            kutu.locator("input[type=password] >> visible=true").first.fill(bilgi["parola"])
            gir = kutu.locator("button, input[type=button], input[type=submit], a").filter(
                has_text=re.compile(r"g[iİı]r[iİı][şs]", re.I))
            gir = gir.or_(kutu.locator("input[value*='Giri'], input[value*='GİRİ']"))
            if gir.count():
                guvenli_tikla(gir.first, "Zaman aşımı: Giriş")
            else:
                kutu.locator("input[type=password] >> visible=true").first.press("Enter")
            L.wait_for_timeout(2500)
            if bul()[0] is None:
                print("  ✓ Parola girildi, Luca oturumu sürüyor.", flush=True)
                return True
        except PWError:
            pass
    bildir("giris", "Luca oturumu zaman aşımına uğradı: Luca penceresindeki 'Zaman Aşımı – Parola Girişi' kutusuna "
                    "parolanızı yazıp Giriş'e basın. Program kendiliğinden devam eder.")
    son = time.time() + bekle_sn
    while time.time() < son:
        L.wait_for_timeout(1000)
        try:
            if bul()[0] is None:
                bildir("giris_tamam", "Luca oturumu sürüyor")
                return True
        except PWError:
            return True
    raise OtomasyonHatasi("Luca 'Zaman Aşımı – Parola Girişi' kutusunda parola girilmedi")


def frame(L, ad: str, bekle: float = 30):
    son = time.time() + bekle
    while time.time() < son:
        f = L.frame(name=ad)
        if f is not None:
            return f
        L.wait_for_timeout(250)
    raise OtomasyonHatasi(f"Luca çerçevesi bulunamadı: {ad}")


def frame_yuklendi(L, ad: str, adres_parcasi: str, bekle: float = 60):
    """frm3 gibi bir çerçevenin belirtilen sayfayı yüklemesini bekler ve çerçeveyi döndürür."""
    son = time.time() + bekle
    while time.time() < son:
        f = L.frame(name=ad)
        if f is not None and adres_parcasi in f.url:
            try:
                f.wait_for_load_state("load", timeout=2000)
                if f.evaluate("document.readyState") == "complete":
                    return f
            except PWError:
                pass
        L.wait_for_timeout(300)
    raise OtomasyonHatasi(f"{ad} çerçevesinde {adres_parcasi} açılamadı")


# ---------------------------------------------------------------- otomatik giriş (isteğe bağlı)
_ALAN_JS = """() => [...document.querySelectorAll('input')].map((e, i) => {
  const r = e.getBoundingClientRect(), st = getComputedStyle(e);
  const lab = (e.id && document.querySelector('label[for="' + e.id + '"]')) || e.closest('label');
  let onceki = '';
  for (let n = e.previousSibling, k = 0; n && k < 3; n = n.previousSibling, k++) onceki += ' ' + (n.textContent || '');
  const td = e.closest('td'); if (td && td.previousElementSibling) onceki += ' ' + td.previousElementSibling.textContent;
  return {i, tip: (e.type || 'text').toLowerCase(), gorunur: r.width > 0 && r.height > 0 && st.visibility !== 'hidden',
          ipucu: [e.id, e.name, e.placeholder, e.getAttribute('aria-label'), e.title, lab && lab.textContent, onceki]
                 .filter(Boolean).join(' ')};
})"""
_CAPTCHA = re.compile(r"captcha|g[üu]venlik|do[ğg]rulama|resim|kod", re.I)


def _alanlar(p):
    return [a for a in p.evaluate(_ALAN_JS) if a["gorunur"] and a["tip"] not in ("hidden", "submit", "button",
                                                                                    "checkbox", "radio", "image")]


def _alan_bul(alanlar, desen, haric=()):
    for a in alanlar:
        if a["i"] not in haric and re.search(desen, a["ipucu"], re.I):
            return a
    return None


def _bekle(ctx, ms: int):
    """Açık bir sayfa üzerinden bekler (Playwright olayları işlensin diye). Kapanan pencerelerde hata vermez."""
    for p in reversed(list(ctx.pages)):
        try:
            if not p.is_closed():
                p.wait_for_timeout(ms)
                return
        except PWError:
            continue
    time.sleep(ms / 1000)


def _giris_cercevesi(ctx):
    """Görünür bir parola kutusu olan sayfa/çerçeve (Luca giriş formu iframe içinde de olabilir)."""
    for p in reversed(list(ctx.pages)):
        try:
            if p.is_closed():
                continue
            for f in p.frames:
                try:
                    if f.evaluate("() => [...document.querySelectorAll('input[type=password]')]"
                                  ".some(e => e.getBoundingClientRect().width > 0)"):
                        return f
                except PWError:
                    continue
        except PWError:
            continue
    return None


_OTO = {"paket": False}


def otomatik_giris(ctx, sayfa, bilgi: dict) -> bool:
    """Ayarlarda kayıtlı Luca bilgileriyle üye no / kullanıcı adı / parolayı doldurur ve GİRİŞ'e basar.
    Doğrulama kodunu (captcha) program doldurmaz: kutuya imleci getirip kullanıcıdan ister.
    Herhangi bir adım tutmazsa False döner; kullanıcı girişi elle tamamlar."""
    try:
        f = _giris_cercevesi(ctx)
        if f is None:                                         # www.luca.com.tr → "Sistem Giriş"
            dugme = sayfa.get_by_text(re.compile(r"s[iİı]stem\s*g[iİı]r[iİı]", re.I)).first
            try:
                dugme.wait_for(timeout=15000)
            except PWError:
                print("  (otomatik giriş: 'Sistem Giriş' bağlantısı bulunamadı; giriş elle yapılacak)", flush=True)
                return False
            guvenli_tikla(dugme, "Sistem Giriş")
            for _ in range(40):
                _bekle(ctx, 500)
                f = _giris_cercevesi(ctx)
                if f:
                    break
            if f is None:
                print("  (otomatik giriş: giriş formu açılmadı; giriş elle yapılacak)", flush=True)
                return False
        _bekle(ctx, 800)
        alanlar = _alanlar(f)
        parola = next((a for a in alanlar if a["tip"] == "password"), None)
        uye = _alan_bul(alanlar, r"[üu]ye|m[üu][şs]teri|member|customer")
        kul = _alan_bul(alanlar, r"kullan[ıi]c[ıi]|user|login", haric={uye["i"]} if uye else set())
        if not (parola and uye and kul):
            # tanı için yalnız alan adlarını yaz (değerler asla yazılmaz)
            print("  (otomatik giriş: alanlar tanınamadı; giriş elle yapılacak) alanlar: " +
                  "; ".join(f"{a['tip']}:{a['ipucu'][:60]}" for a in alanlar), flush=True)
            return False
        girdiler = f.locator("input")
        girdiler.nth(uye["i"]).fill(bilgi["uye_no"])
        girdiler.nth(kul["i"]).fill(bilgi["kullanici"])
        girdiler.nth(parola["i"]).fill(bilgi["parola"])
        _OTO["paket"] = True
        cap = _alan_bul(alanlar, _CAPTCHA.pattern, haric={uye["i"], kul["i"], parola["i"]})
        gonder = f.locator("button, input[type=submit], input[type=button], a").filter(
            has_text=re.compile(r"^\s*g[iİı]r[iİı][şs]\s*$", re.I))
        if not gonder.count():
            gonder = f.locator("button, input[type=submit], input[type=button], a").filter(has_text=re.compile(r"g[iİı]r[iİı][şs]", re.I))
        if cap:                                               # captcha aynı ekranda: kodu kullanıcı programda yazar
            print("  Bilgiler dolduruldu; doğrulama kodu programda soruluyor.", flush=True)
            if captcha_programda(f, girdiler.nth(cap["i"]), gonder):
                return True
            _pencere_durumu(f.page, "normal")
            girdiler.nth(cap["i"]).focus()
            bildir("captcha", "Luca bilgileriniz dolduruldu. Luca penceresinde doğrulama kodunu (captcha) yazıp Enter'a basın.")
            return True
        gonder = gonder.first
        if gonder.count():
            guvenli_tikla(gonder, "GİRİŞ")
        else:
            girdiler.nth(parola["i"]).press("Enter")
        for _ in range(20):                                   # captcha sonradan çıkabilir
            _bekle(ctx, 500)
            f2 = _giris_cercevesi(ctx) or f
            try:
                if f2.page.is_closed():
                    return True
                cap = _alan_bul(_alanlar(f2), _CAPTCHA.pattern)
            except PWError:
                return True
            if cap:
                dg = f2.locator("button, input[type=submit], input[type=button], a")
                g2 = dg.filter(has_text=re.compile(r"^\s*tamam\s*$", re.I))          # kod sonradan çıktıysa: önce "Tamam"
                if not g2.count():
                    g2 = dg.filter(has_text=re.compile(r"^\s*g[iİı]r[iİı][şs]\s*$", re.I))
                if captcha_programda(f2, f2.locator("input").nth(cap["i"]), g2):
                    return True
                _pencere_durumu(f2.page, "normal")
                f2.locator("input").nth(cap["i"]).focus()
                bildir("captcha", "Luca bilgileriniz dolduruldu. Luca penceresinde doğrulama kodunu (captcha) yazıp Tamam'a basın.")
                print("  Bilgiler dolduruldu; doğrulama kodunu siz yazın.", flush=True)
                return True
        return True
    except (PWError, OtomasyonHatasi) as e:
        print(f"  (otomatik giriş yapılamadı: {str(e).splitlines()[0][:120]}; giriş elle yapılacak)", flush=True)
        return False


def _paket_sec(ctx) -> None:
    """Otomatik girişte 'LUCA MALİ MÜŞAVİR PAKETİ' kutusuna bir kez basar. Elle girişte dokunmaz
    (kullanıcı da basarsa paket iki kez açılır ve Luca boş sayfa gösterebilir)."""
    if not _OTO["paket"]:
        return
    for p in list(ctx.pages):
        try:
            if p.is_closed() or "main.erp" not in p.url:
                continue
            kutu = p.get_by_text(re.compile(r"MAL.\s*M.{1,2}AV.R\s*PAKET", re.I)).first
            if kutu.count() and kutu.is_visible():
                _OTO["paket"] = False                         # yalnız bir kez
                p.wait_for_timeout(300)
                if any(re.search(r"/Luca/luca\.do", x.url) for x in ctx.pages if not x.is_closed()):
                    return                                    # kullanıcı zaten açtı
                guvenli_tikla(kutu, "Mali Müşavir Paketi")
                return
        except PWError:
            continue


def luca_sayfasini_bekle(ctx, muhawin: bool = False):
    if muhawin:
        print("» Mali Müşavir Paketi açılıyor (MuhaWin oturumu)...", flush=True)
    else:
        bildir("giris", "Açılan Chrome penceresinde Luca'ya giriş yapın")
        print(f"\n» Açılan tarayıcıda Luca'ya giriş yapın (en fazla {GIRIS_BEKLEME // 60} dk bekleniyor)...", flush=True)
    son = time.time() + GIRIS_BEKLEME
    while time.time() < son:
        _hata_sekmelerini_kapat(ctx)      # girişte 'www.luca.com.tr adresinden giriniz' gelirse
        _paket_sec(ctx)
        for p in list(ctx.pages):
            try:
                if not p.is_closed() and re.search(r"/Luca/luca\.do", p.url):
                    frame(p, "frm4", 60).wait_for_selector("#SirketCombo", timeout=60000)
                    bildir("giris_tamam", "Luca oturumu açık")
                    return p
            except (PWError, OtomasyonHatasi):
                continue
        if not ctx.pages:
            raise OtomasyonHatasi("Tarayıcı kapatıldı")
        _bekle(ctx, 400)                  # giriş penceresi kendiliğinden kapanabilir; hata sayılmaz
    raise OtomasyonHatasi("Luca girişi zaman aşımına uğradı")


# ---------------------------------------------------------------- firma / dönem
def firma_listesi(L) -> list[dict]:
    """Luca'daki firma açılır listesinin tamamı: [{'id', 'ad', 'secili'}]."""
    f4 = frame(L, "frm4")
    f4.wait_for_selector("#SirketCombo", timeout=60000)
    return [{"id": o[0], "ad": o[1], "secili": o[2]} for o in f4.eval_on_selector(
        "#SirketCombo", "e => [...e.options].map(o => [o.value, o.text.trim(), o.selected])") if o[0] and o[1]]


def firma_sec(L, firma: str, yil: int, s: Sonuc):
    """firma: Luca kısa adı, 'id:<SIRKET_ID>' ya da boş (seçili firma)."""
    f4 = frame(L, "frm4")
    secenekler = [o for o in f4.eval_on_selector(
        "#SirketCombo", "e => [...e.options].map(o => [o.value, o.text.trim(), o.selected])") if o[1] and o[0]]
    if firma.startswith("id:"):
        hedef = [o for o in secenekler if o[0] == firma[3:]]
    elif not sade(firma):
        secili = [o for o in secenekler if o[2]]
        if not secili:
            raise OtomasyonHatasi("Firma adı girilmedi ve Luca'da seçili firma yok")
        hedef = secili
    else:
        hedef = [o for o in secenekler if sade(o[1]) == sade(firma)]
        if not hedef:
            hedef = [o for o in secenekler if sade(firma) in sade(o[1])]
    if len(hedef) != 1:
        adaylar = ", ".join(o[1] for o in hedef[:10]) or "yok"
        raise OtomasyonHatasi(f"'{firma}' firması tek olarak bulunamadı (eşleşenler: {adaylar}). "
                              "Luca'daki kısa adı tam yazın.")
    deger, ad, secili = hedef[0]
    if not secili:
        f4.select_option("#SirketCombo", deger)
        tamam_bas(L)
    s.firma = ad
    donem_sec(L, yil)
    s.vkn = vkn_oku(L)
    s.not_al("Firma seçildi", "tamam", f"{ad} – VKN {s.vkn}")


def tamam_bas(L):
    """Firma/dönem değişince frm4 yeniden yüklenir ve 'Tamam' düğmesi çıkar."""
    L.wait_for_timeout(800)
    for _ in range(40):
        f4 = L.frame(name="frm4")
        if f4:
            try:
                btn = f4.locator("#SirName button", has_text="Tamam")
                if btn.count() and btn.first.is_visible():
                    guvenli_tikla(btn.first, "Tamam")
                    L.wait_for_timeout(1500)
                    return
            except PWError:
                pass
        L.wait_for_timeout(250)
    # Tamam çıkmadıysa seçim doğrudan uygulanmış olabilir


def donem_sec(L, yil: int):
    f4 = frame(L, "frm4")
    donemler = f4.evaluate("""() => [...document.querySelectorAll('select')].filter(s => s.id !== 'SirketCombo')
        .map(s => ({id: s.id, name: s.name, ops: [...s.options].map(o => [o.value, o.text.trim(), o.selected])}))
        .filter(s => s.ops.some(o => /\\d{2}\\/\\d{2}\\/\\d{4}/.test(o[1])))""")
    if not donemler:
        return
    sec = donemler[0]
    if any(o[2] and str(yil) in o[1] for o in sec["ops"]):
        return
    uygun = [o for o in sec["ops"] if f"01/01/{yil}" in o[1]] or [o for o in sec["ops"] if str(yil) in o[1]]
    if not uygun:
        raise OtomasyonHatasi(f"Luca'da {yil} dönemi bulunamadı")
    secici = f"#{sec['id']}" if sec["id"] else f"select[name='{sec['name']}']"
    f4.select_option(secici, uygun[0][0])
    tamam_bas(L)


def vkn_oku(L) -> str | None:
    for _ in range(40):
        f3 = L.frame(name="frm3")
        try:
            metin = f3.inner_text("body", timeout=2000) if f3 else ""
        except PWError:
            metin = ""
        m = re.search(r"Vergi No\s*:?\s*(\d{10,11})", metin)
        if m:
            return m.group(1)
        L.wait_for_timeout(500)
    return None


def uye_no(L) -> str:
    for ad in ("frm2", "frm5", "frm3"):
        f = L.frame(name=ad)
        if f:
            m = re.search(r"c_musteri_id=(\d+)", f.content())
            if m:
                uye_denetle(m.group(1))
                return m.group(1)
    raise OtomasyonHatasi("Luca üye numarası menüden okunamadı")


def uye_denetle(uye: str):
    """MuhaWin ofis üyesi: yalnız ofisin Luca üye numarasıyla çalışılır (FK_LUCA_UYE)."""
    gerekli = re.sub(r"\D", "", os.environ.get("FK_LUCA_UYE", ""))
    if gerekli and re.sub(r"\D", "", uye or "") != gerekli:
        raise OtomasyonHatasi(f"Bu Luca oturumu {uye} üye numarasıyla açılmış. Ofisiniz yalnız {gerekli} üye "
                              "numarasıyla çalışabilir. Luca'dan çıkıp ofisin üye numarasıyla girin.")


# ---------------------------------------------------------------- e-belge indirme
def sorgu_araliklari(bas: date, bit: date, bugun: date | None = None) -> list[tuple[date, date]]:
    """Önce seçilen dönem, ardından (farklıysa) içinde bulunulan ayın başından bugüne."""
    bugun = bugun or date.today()
    araliklar = [(bas, min(bit, bugun))]
    ay_basi = bugun.replace(day=1)
    if ay_basi > bit:
        araliklar.append((ay_basi, bugun))
    return araliklar



# Luca e-belge listesi sayfa başına en çok 500 belge gösterir. Sonraki sayfaya sol alttaki sayfa değiştirme
# alanıyla geçilir: önce sayfa(+1) düğmesi, yoksa sayfa numarası seçimi, sayfa numarası bağlantısı ya da ›/» oku.
SONRAKI_SAYFA_JS = r"""(n) => {
  const gor = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
  const kapali = el => el.disabled || /disabled|pasif/i.test(el.className || '') || el.getAttribute('aria-disabled') === 'true';
  for (const el of document.querySelectorAll('[onclick]')) {
    const o = el.getAttribute('onclick') || '';
    if (/sayfa\s*\(\s*\+\s*1\s*\)/.test(o) && gor(el) && !kapali(el)) { el.click(); return 'sayfa(+1)'; }
  }
  for (const s of document.querySelectorAll('select')) {
    const ops = [...s.options]; if (ops.length < 2 || !gor(s)) continue;
    if (!ops.every(o => /^\s*\d+\s*$/.test(o.text))) continue;
    const secili = ops[s.selectedIndex]; if (!secili || Number(secili.text) !== n) continue;     // sayfa numarası listesi (sayfa boyu listesi değil)
    const hedef = ops.find(o => Number(o.text) === n + 1); if (!hedef) return '';
    s.value = hedef.value; s.dispatchEvent(new Event('change', {bubbles: true})); return 'sayfa listesi';
  }
  const pager = el => el.closest('[class*=pag],[id*=pag],[class*=sayfa],[id*=sayfa],[class*=Pag],[id*=Pag],tfoot,.ui-paginator');
  const numara = [...document.querySelectorAll('a,button,li,span,td,input[type=button]')]
    .filter(el => gor(el) && !kapali(el) && pager(el) && ((el.innerText || el.value || '').trim() === String(n + 1)) && !el.querySelector('a,button'));
  const nic = numara.filter(el => !numara.some(x => x !== el && el.contains(x)));
  if (nic.length) { const el = nic[0]; (el.closest('a,button,[onclick]') || el).click(); return 'sayfa ' + (n + 1); }
  const ok = [...document.querySelectorAll('a,button,input[type=button],span,li,i')]
    .filter(el => gor(el) && !kapali(el) && pager(el) && /^(›|»|>|>>|sonraki|ileri|next)$/i.test((el.innerText || el.value || el.title || '').trim()));
  const ic = ok.filter(el => !ok.some(x => x !== el && el.contains(x)));          // en içteki (bağlantının kendisi)
  if (ic.length) { (ic[0].closest('a,button,[onclick]') || ic[0]).click(); return 'ileri'; }
  return '';
}"""
TOPLAM_JS = r"""() => {
  const t = (document.body && document.body.innerText) || '';
  let m = t.match(/(\d[\d.]*)\s*-\s*(\d[\d.]*)\s*(?:\/|of|arası,?\s*toplam)\s*(\d[\d.]*)/i);
  if (m) return Number(m[3].replace(/\./g, ''));
  m = t.match(/toplam\s*:?\s*(\d[\d.]*)\s*(?:kay[ıi]t|belge|fatura)/i) || t.match(/(\d[\d.]*)\s*(?:kay[ıi]t|belge)\s*(?:bulundu|listelendi)/i);
  return m ? Number(m[1].replace(/\./g, '')) : null;
}"""


def ebelge_indir(L, kok: str, uye: str, tur: str, bas: date, bit: date, s: Sonuc):
    ad = TURLER[tur]
    f3 = frame(L, "frm3")
    f3.goto(f"{kok}/gib530.do?tur={tur}&c_musteri_id={uye}")
    f3 = frame_yuklendi(L, "frm3", f"tur={tur}")
    menu_tur = f3.evaluate("typeof menu_tur !== 'undefined' ? menu_tur : null")
    if menu_tur and menu_tur != tur:
        raise OtomasyonHatasi(f"{ad} ekranı yerine '{menu_tur}' açıldı")

    L.wait_for_timeout(1500)
    # 1) GİB'den Getir: seçilen ay, sonra içinde bulunulan ay
    for ilk, son in sorgu_araliklari(bas, bit):
        uyari_kapat(f3, L)
        getir = f3.locator(f"button.{tur}-item:has-text(\"GİB'den Getir\") >> visible=true").first
        getir.wait_for(state="visible", timeout=30000)
        guvenli_tikla(getir, "GİB'den Getir")
        gorunur(f3, "#tarih1").wait_for(state="visible", timeout=30000)
        for alan, deger in (("#tarih1", ilk), ("#tarih2", son)):
            kutu = gorunur(f3, alan)
            kutu.fill(deger.strftime("%d/%m/%Y"))
            kutu.press("Tab")
        if f3.locator("#geceSorgula").is_visible() and f3.locator("#geceSorgula").is_checked():
            f3.uncheck("#geceSorgula")
        guvenli_tikla(gorunur(f3, "#faturalari-getir-btn"), "Belgeleri Getir")
        islem_takip_bekle(L, ad)
        s.not_al(f"{ad}: GİB sorgusu", "tamam", f"{ilk:%d.%m.%Y}–{son:%d.%m.%Y}")
        f3 = frame_yuklendi(L, "frm3", f"tur={tur}")

    # 2) Liste yenilensin, sayfa sayfa tümünü seç ve indir
    f3 = frame_yuklendi(L, "frm3", f"tur={tur}")
    L.wait_for_timeout(1000)
    uyari_kapat(f3, L)
    yenile = f3.locator("button[onclick='yenile()'] >> visible=true")
    if yenile.count():
        guvenli_tikla(yenile.first, "Yenile")
        L.wait_for_timeout(2000)
        f3 = frame_yuklendi(L, "frm3", f"tur={tur}")
    L.wait_for_timeout(1000)
    uyari_kapat(f3, L)
    sayfa_no, onceki_ilk, gorulen, indirilen = 1, None, set(), 0
    try:
        toplam = f3.evaluate(TOPLAM_JS)
    except PWError:
        toplam = None
    while True:
        satirlar = f3.locator(".tab-1 .sec")
        adet = satirlar.count()
        if adet == 0:
            if sayfa_no == 1:
                s.not_al(f"{ad}: indirme", "atlandı", "listede belge yok")
            break
        ilk = f3.evaluate("() => { const r = document.querySelector('.tab-1 .sec'); return r ? r.closest('tr').innerText : null }")
        if ilk == onceki_ilk or ilk in gorulen:
            break   # son sayfa (ya da liste başa döndü)
        gorulen.add(ilk)
        hepsi = f3.locator('input.hepsi[onclick*="tab-1"]').first
        if not hepsi.is_checked():
            guvenli_tikla(hepsi, "Tümünü seç")
        L.wait_for_timeout(500)
        secili = f3.locator(".tab-1 .sec:checked").count()
        guvenli_tikla(f3.locator("button[onclick=\"gonder('zip-window')\"]").first, "Seçilenleri İndir")
        zip_btn = gorunur(f3, "#zip-btn")
        zip_btn.wait_for(state="visible", timeout=30000)
        with L.expect_download(timeout=INDIRME_BEKLEME * 1000) as dl:
            guvenli_tikla(zip_btn, "Seçilenleri İndir (onay)")
        hedef = s.klasor / f"{tur}_{sayfa_no}.zip"
        dl.value.save_as(hedef)
        s.zipler.append(hedef)
        indirilen += secili
        s.not_al(f"{ad}: sayfa {sayfa_no} indirildi", "tamam", f"{secili} belge, {hedef.stat().st_size // 1024} KB"
                 + (f" ({indirilen}/{toplam})" if toplam else ""))
        pencere_kapat(f3)
        # sonraki sayfa: sol alttaki sayfa değiştirme alanı
        onceki_ilk = ilk
        try:
            nasil = f3.evaluate(SONRAKI_SAYFA_JS, sayfa_no)
        except PWError:
            nasil = ""
        if not nasil:
            break
        print(f"   » {ad}: sonraki sayfa ({nasil})", flush=True)
        L.wait_for_timeout(2500)
        f3 = frame_yuklendi(L, "frm3", f"tur={tur}")
        L.wait_for_timeout(500)
        uyari_kapat(f3, L)
        sayfa_no += 1
        if sayfa_no > 60:
            raise OtomasyonHatasi("60'tan fazla sayfa; döngü durduruldu")
    if toplam and toplam > 500 and indirilen < toplam:
        s.not_al(f"{ad}: eksik indirme", "hata", f"listede {toplam} belge var, {indirilen} belge indirilebildi "
                 "(sonraki sayfaya geçilemedi)")


def islem_takip_bekle(L, ad: str):
    """'İşlem Takip' penceresi (div#luca-board) bitene kadar bekler, sonra Kapat'a basar.
    Sorgu sırasında 'Her hangi bir fatura bulunamadı' penceresi çıkarsa Tamam'a basıp devam eder."""
    baslangic = time.time()
    son = baslangic + GETIR_BEKLEME
    onceki, sabit = None, 0
    while time.time() < son:
        L.wait_for_timeout(2000)
        f3 = L.frame(name="frm3")
        if f3 is None:
            continue
        # 1) 'bulunamadı' bilgi penceresi: Tamam -> sorgu bitti sayılır
        try:
            pencere = _bilgi_penceresi(f3)          # pano/köşe uyarıları değil, yalnız bilgi penceresi
            if pencere.count():
                uyari_kapat(f3, L)
                L.wait_for_timeout(1000)
                _board_kapat(f3)
                return
        except PWError:
            pass
        # 2) İşlem Takip metni
        try:
            gorunur = f3.locator("#luca-board >> visible=true").count() > 0
            metin = f3.inner_text("#luca-board", timeout=2000) if gorunur else ""
        except PWError:
            gorunur, metin = False, ""
        bitti = re.search(r"sona erdi|\[OK\]|adet belge kaydı bulundu|işlem tamamlandı", metin, re.I)
        sabit = sabit + 1 if metin == onceki else 0
        onceki = metin
        if bitti and sabit >= 2:
            _board_kapat(f3)
            L.wait_for_timeout(1000)
            uyari_kapat(f3, L)
            return
        # 3) Pencere hiç açılmadıysa/kapandıysa ve 30 sn'dir değişiklik yoksa sorgu bitmiş sayılır
        if not gorunur and time.time() - baslangic > 30 and sabit >= 5:
            uyari_kapat(f3, L)
            return
    raise OtomasyonHatasi(f"{ad}: GİB sorgusu {GETIR_BEKLEME} saniyede bitmedi")


def _board_kapat(f3):
    try:
        kapat = f3.locator("#luca-board button", has_text="Kapat")
        if kapat.count() and kapat.first.is_visible():
            guvenli_tikla(kapat.first, "Kapat")
    except PWError:
        pass


def pencere_kapat(f3):
    try:
        for b in f3.locator("button[onclick='hide_window()']").all():
            if b.is_visible():
                b.click()
    except PWError:
        pass


# ---------------------------------------------------------------- muavin
MUAVIN_MENU = ["Muhasebe", "Raporlar", "Defterler", "Tüm Yazıcılar", "Muavin Defter"]
_HATA_METNI = re.compile(r"adresinden\s+giri[şs]\s+yap[ıi]n[ıi]z|LUCA\s+HATA", re.I)


def luca_hatasi(sayfa) -> bool:
    """'LUCA HATA – Lütfen www.luca.com.tr adresinden giriş yapınız' sayfası mı? (oturum düşmüş)"""
    try:
        if sayfa.is_closed():
            return False
        for f in sayfa.frames:
            try:
                if _HATA_METNI.search(f.evaluate("() => (document.body && document.body.innerText || '').slice(0, 400)")):
                    return True
            except PWError:
                continue
    except PWError:
        return False
    return False


def _gorunur_metin(L, ad: str, yakin=None):
    """Tüm çerçevelerde tam metni 'ad' olan görünür öğe. yakin=(çerçeve, kutu) verilirse aynı çerçevede ve
    ona en yakın olan seçilir (sağ paneldeki aynı adlı kısayollara değil, açılan menüdekine tıklamak için)."""
    adaylar = []
    for fr in L.frames:
        try:
            loc = fr.get_by_text(ad, exact=True)
            for i in range(min(loc.count(), 12)):
                e = loc.nth(i)
                if e.is_visible():
                    adaylar.append((fr, e, e.bounding_box()))
        except PWError:
            continue
    if not adaylar:
        return None
    if yakin:
        yfr, ykutu = yakin
        def uzaklik(a):
            fr, _, k = a
            if not k or not ykutu:
                return 1e9
            return (0 if fr == yfr else 5000) + abs(k["x"] - ykutu["x"] - ykutu["width"]) + abs(k["y"] - ykutu["y"])
        adaylar.sort(key=uzaklik)
    else:
        adaylar.sort(key=lambda a: 0 if a[0].name == "frm2" else 1)     # önce üst menü çerçevesi
    return adaylar[0]


_MENU_YASAK = re.compile(r"sil|iptal|itiraz|muhasebele[şs]tir|fis-kes|fi[şs]\s*kes|kdv-window|gonder\(", re.I)


def _menu_tikla(e, ad: str):
    """Menü öğesine tıklama: yalnız metni tam olarak beklenen menü adı olan ve arkasında silme/iptal/
    muhasebeleştirme gibi bir işlem bulunmayan öğeye basılır."""
    metin, ek = e.evaluate("e => [(e.innerText || e.textContent || '').trim(),"
                           " [e.id, e.getAttribute('onclick'), e.getAttribute('href'),"
                           "  e.closest('[onclick]') && e.closest('[onclick]').getAttribute('onclick')].join(' ')]")
    if metin != ad or _MENU_YASAK.search(ek or ""):
        raise OtomasyonHatasi(f"GÜVENLİK: menü öğesi beklenenden farklı, basılmadı ({metin!r})")
    e.click()


def menu_ile_ac(L, yol: list[str]) -> bool:
    """Üst menüde sırayla üzerine gelip (gerekirse tıklayıp) son öğeye tıklar."""
    onceki = None
    for i, ad in enumerate(yol):
        bulunan = None
        for _ in range(16):
            bulunan = _gorunur_metin(L, ad, onceki)
            if bulunan:
                break
            L.wait_for_timeout(250)
        if not bulunan:
            return False
        fr, e, kutu = bulunan
        if i < len(yol) - 1:
            e.hover()
            L.wait_for_timeout(500)
            sonraki = _gorunur_metin(L, yol[i + 1], (fr, kutu))
            if not sonraki or sonraki[0] != fr:      # alt menü (aynı çerçevede) açılmadıysa
                _menu_tikla(e, ad)                   # bazı menüler tıklamayla açılır
                L.wait_for_timeout(600)
        else:
            _menu_tikla(e, ad)
        onceki = (fr, kutu)
    return True


def _muavin_formu(L, bekle: float = 40):
    son = time.time() + bekle
    while time.time() < son:
        if luca_hatasi(L):
            raise OtomasyonHatasi("LUCA_OTURUM: Luca oturumu düştü (www.luca.com.tr adresinden giriş uyarısı)")
        for f in L.frames:
            try:
                if "raporMizan" in f.url or f.locator("#hesap_kodu_ilk >> visible=true").count():
                    f.wait_for_load_state("load", timeout=3000)
                    return f
            except PWError:
                continue
        L.wait_for_timeout(400)
    raise OtomasyonHatasi("Muavin Defter ekranı açılamadı")


def muavin_indir(L, kok: str, uye: str, s: Sonuc):
    if luca_hatasi(L):
        raise OtomasyonHatasi("LUCA_OTURUM: Luca oturumu düştü")
    if menu_ile_ac(L, MUAVIN_MENU):
        f3 = _muavin_formu(L)
    else:                                            # yedek: menü bulunamazsa doğrudan adres
        f3 = frame(L, "frm3")
        menu = L.frame(name="frm2")
        f3.goto(f"{kok}/raporMizanDetayHazirla.do?c_musteri_id={uye}", referer=menu.url if menu else None)
        f3 = _muavin_formu(L)
    L.wait_for_timeout(1500)
    uyari_kapat(f3, L)
    for alan, etiket, deger in (("#hesap_kodu_ilk", "Başlangıç Hesap Kodu", "100"),
                                ("#hesap_kodu_son", "Bitiş Hesap Kodu", "999")):
        kutu = gorunur(f3, alan)
        try:
            kutu.wait_for(state="visible", timeout=15000)
        except PWTimeout:
            # yedek: etiketin hemen sağındaki görünür metin kutusu
            kutu = f3.locator(f"xpath=//*[normalize-space(text())='{etiket}']/following::input[@type='text' or not(@type)][1]").first
            kutu.wait_for(state="visible", timeout=15000)
        kutu.fill(deger)
        kutu.press("Tab")
    excel = f3.evaluate("""() => {
        for (const s of document.querySelectorAll('select')) {
            const i = [...s.options].findIndex(o => /excel\\s*liste/i.test(o.text));
            if (i >= 0) { s.selectedIndex = i; s.dispatchEvent(new Event('change', {bubbles: true})); return s.options[i].text; }
        }
        return null; }""")
    if not excel:
        raise OtomasyonHatasi("Muavin formunda 'Excel Liste' rapor türü bulunamadı")
    rapor = f3.locator("button:has-text('Rapor') >> visible=true").last
    with L.expect_download(timeout=INDIRME_BEKLEME * 1000) as dl:
        guvenli_tikla(rapor, "Rapor")
    hedef = s.klasor / "muavin.xlsx"
    dl.value.save_as(hedef)
    s.muavin = hedef
    s.not_al("Muavin indirildi", "tamam", f"{hedef.stat().st_size // 1024} KB")


# ---------------------------------------------------------------- işletme / serbest meslek defteri
ISLETME_LISTE_JS = """() => {
    const tb = document.querySelector('tbody.data-table') || document.querySelector('tbody.form_table');
    if (!tb) return null;
    const sayi = t => (t || '').replace(/\\s+/g, ' ').trim();
    return [...tb.querySelectorAll('tr[id^=tr]')].map(tr => {
        const td = [...tr.querySelectorAll('td')].map(x => sayi(x.innerText || x.textContent));
        const m = (tr.getAttribute('onclick') || '').match(/sec\\(this,\\s*'(\\d+)'/);
        return {fid: m ? m[1] : '', tarih: td[1], evrak_no: td[2], kategori: td[3], belge_turu: td[4],
                aciklama: td[5], cari: td[6], tutar: td[7], kdv: td[8], toplam: td[9]};
    });
}"""


def isletme_mi(L) -> bool:
    """Seçili firma işletme / serbest meslek defteri tutuyor mu? (üst menüde 'İşletme Defteri' / 'Ser.Mes.Defteri')"""
    desen = re.compile(r"^\s*(İşl(etme)?\.?\s*Def(t(eri)?)?\.?|Ser\.?\s*Mes(lek)?\.?\s*Def(t(eri)?)?\.?|Serbest\s*Meslek(\s*Def(t(eri)?)?\.?)?)\s*$", re.I)
    for fr in L.frames:
        try:
            loc = fr.get_by_text(desen)
            for i in range(min(loc.count(), 6)):
                if loc.nth(i).is_visible():
                    return True
        except PWError:
            continue
    return False


def _isletme_liste(L, kok: str, tur: int, bas: date, bit: date) -> list[dict]:
    """Gelir (TUR=0) / Gider (TUR=1) Listesi: tarihe göre filtrelenip satırlar okunur (yalnız okuma)."""
    f3 = frame(L, "frm3")
    menu = L.frame(name="frm2")
    f3.goto(f"{kok}/listIsletmeFisFilitreAction.do?time={int(time.time() * 1000)}&TUR={tur}",
            referer=menu.url if menu else None)
    f3 = frame_yuklendi(L, "frm3", "IsletmeFis")
    f3.wait_for_selector("form[name=isletmeFisParametreForm]", state="attached", timeout=30000)
    uyari_kapat(f3, L)
    with f3.expect_navigation(timeout=60000):
        f3.evaluate("""([b, e]) => { const f = document.forms.isletmeFisParametreForm;
            f.evrakTarih1.value = b; f.evrakTarih2.value = e; f.evrakNo1.value = ''; f.evrakNo2.value = '';
            f.kategori.value = ''; f.durum.value = ''; f.submit(); }""", [f"{bas:%d/%m/%Y}", f"{bit:%d/%m/%Y}"])
    f3 = frame_yuklendi(L, "frm3", "IsletmeFis")
    f3.wait_for_load_state("load", timeout=30000)
    if luca_hatasi(L):
        raise OtomasyonHatasi("LUCA_OTURUM: Luca oturumu düştü")
    satirlar = f3.evaluate(ISLETME_LISTE_JS)
    if satirlar is None:
        raise OtomasyonHatasi(("Gelir" if tur == 0 else "Gider") + " Listesi tablosu bulunamadı")
    return [r for r in satirlar if r.get("tarih")]


def isletme_indir(L, kok: str, uye: str, bas: date, bit: date, s: Sonuc):
    """İşletme defterli firmada muavin yerine Gelir ve Gider Listesi (fiş başına tutar ve KDV) alınır."""
    if luca_hatasi(L):
        raise OtomasyonHatasi("LUCA_OTURUM: Luca oturumu düştü")
    gelir = _isletme_liste(L, kok, 0, bas, bit)
    gider = _isletme_liste(L, kok, 1, bas, bit)
    hedef = s.klasor / "muavin_isletme.json"
    hedef.write_text(json.dumps({"firma": s.firma or "", "bas": bas.isoformat(), "bit": bit.isoformat(),
                                 "gelir": gelir, "gider": gider}, ensure_ascii=False, indent=1), encoding="utf-8")
    (s.klasor / "muavin_program.json").write_text(json.dumps({"program": "luca_isletme"}), encoding="utf-8")
    eski = s.klasor / "muavin.xlsx"
    if eski.exists():
        eski.unlink()
    s.muavin = hedef
    s.not_al("Muavin (işletme defteri gelir / gider listesi) indirildi", "tamam", f"{len(gelir)} gelir, {len(gider)} gider fişi")


# ---------------------------------------------------------------- ana akış
# ---------------------------------------------------------------- açık kalan Luca penceresi
CDP_PORT = int(os.environ.get("FK_CDP_PORT", "9333"))


def _tarayici_yolu() -> str | None:
    if os.environ.get("FK_TARAYICI_EXE"):
        return os.environ["FK_TARAYICI_EXE"]
    import shutil
    adaylar = [os.path.expandvars(x) for x in (
        r"%ProgramFiles%\Google\Chrome\Application\chrome.exe",
        r"%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe",
        r"%LocalAppData%\Google\Chrome\Application\chrome.exe",
        r"%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe",
        r"%ProgramFiles%\Microsoft\Edge\Application\msedge.exe")] if sys.platform == "win32" else []
    for a in adaylar:
        if os.path.exists(a):
            return a
    return shutil.which("google-chrome") or shutil.which("chromium") or shutil.which("msedge")


def _cdp_adres() -> str:
    return f"http://127.0.0.1:{CDP_PORT}"


def _cdp_acik() -> bool:
    import urllib.request
    try:
        with urllib.request.urlopen(_cdp_adres() + "/json/version", timeout=1) as r:
            return b"Browser" in r.read()
    except Exception:
        return False


def _cdp_baslat(profil: Path):
    """Luca için ayrı bir Chrome açar. Program bitince KAPANMAZ; sonraki sorgular aynı pencereye bağlanır,
    böylece Luca'ya her seferinde yeniden girmek gerekmez."""
    exe = _tarayici_yolu()
    if not exe:
        raise OtomasyonHatasi("Chrome ya da Edge bulunamadı")
    profil.mkdir(parents=True, exist_ok=True)
    args = [exe, f"--remote-debugging-port={CDP_PORT}", "--remote-debugging-address=127.0.0.1",
            f"--user-data-dir={profil}", "--no-first-run", "--no-default-browser-check", "--start-maximized",
            *os.environ.get("FK_TARAYICI_EK", "").split(), "about:blank"]
    import subprocess
    if sys.platform == "win32":
        # 'start' ile açılır: sorgu süreci durdurulsa (Durdur) bile Chrome kapanmaz
        subprocess.Popen(["cmd", "/c", "start", "", *args], creationflags=0x08000000)
    else:
        subprocess.Popen(args, start_new_session=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(60):
        if _cdp_acik():
            return
        time.sleep(0.5)
    raise OtomasyonHatasi("Luca tarayıcısı açılamadı. Daha önce açılmış bir Luca Chrome penceresi varsa kapatıp "
                          "tekrar deneyin.")


def _luca_acik_mi(ctx):
    for p in list(ctx.pages):
        try:
            if not p.is_closed() and re.search(r"/Luca/luca\.do", p.url) and p.frame(name="frm4") \
                    and not luca_hatasi(p):
                p.frame(name="frm4").wait_for_selector("#SirketCombo", timeout=3000)
                return p
        except PWError:
            continue
    return None


@contextmanager
def oturum(profil: Path = PROFIL, ctx_hazirla=None):
    """Luca tarayıcısını açar (ya da açık olana bağlanır), oturum yoksa girişi bekler; (ctx, Luca sayfası) verir.
    Gerçek kullanımda tarayıcı sorgu bitince açık kalır (FK_HEADLESS testlerinde kapanır)."""
    with sync_playwright() as p:
        kalici = not os.environ.get("FK_HEADLESS") or os.environ.get("FK_CDP") == "1"
        if kalici:
            if not _cdp_acik():
                _cdp_baslat(profil)
            tarayici = p.chromium.connect_over_cdp(_cdp_adres())
            ctx = tarayici.contexts[0] if tarayici.contexts else tarayici.new_context()
        else:
            ctx = tarayici_ac(p, profil)
        for sayfa in ctx.pages:
            sayfa.on("dialog", lambda d: d.accept())
        ctx.on("page", lambda pg: pg.on("dialog", lambda d: d.accept()))
        L = _luca_acik_mi(ctx) if kalici else None
        if L:
            print("» Açık Luca oturumu kullanılıyor (yeniden giriş gerekmedi).", flush=True)
            bildir("giris_tamam", "Açık Luca oturumu kullanılıyor")
        else:
            bos = [x for x in ctx.pages if not x.is_closed() and x.url in ("about:blank", "chrome://newtab/")]
            ilk = bos[0] if bos else (ctx.pages[0] if ctx.pages and not kalici else ctx.new_page())
            if kalici:
                _pencere_durumu(ilk, "minimized")          # Luca tarayıcısı ekrana gelmez; arka planda çalışır
            mw = muhawin_oturumuyla_ac(ctx, ilk)
            if not mw:
                ilk.goto(BASLANGIC)
                from .. import ayarlar
                if not ayarlar.luca_girisi() and kalici:
                    _pencere_durumu(ilk, "normal")         # kayıtlı bilgi yok: kullanıcı Luca penceresinde girecek
                _giris_dene(ctx, ilk)
                if ctx_hazirla:
                    ctx_hazirla(ctx, ilk)        # testler: girişi taklit eder
            L = luca_sayfasini_bekle(ctx, mw)
        try:
            yield ctx, L
        finally:
            if not kalici:
                try:
                    ctx.close()
                except PWError:
                    pass
            # kalıcı modda tarayıcıya dokunulmaz: yalnız bağlantı kesilir, Luca açık kalır


def _giris_dene(ctx, sayfa):
    from .. import ayarlar
    bilgi = ayarlar.luca_girisi()
    if bilgi:
        print("» Ayarlardaki Luca bilgileriyle giriş deneniyor...", flush=True)
        otomatik_giris(ctx, sayfa, bilgi)


def _hata_sekmelerini_kapat(ctx) -> bool:
    """'Lütfen www.luca.com.tr adresinden giriş yapınız' sekmelerini kapatır."""
    kapandi = False
    acik = [p for p in ctx.pages if not p.is_closed()]
    hatali = [p for p in acik if luca_hatasi(p)]
    if hatali and len(hatali) == len(acik):
        ctx.new_page()                # son sekme kapanınca tarayıcı da kapanmasın
    for p in hatali:
        if True:
            try:
                p.close()
                kapandi = True
            except PWError:
                pass
    if kapandi:
        print("  Luca hata sekmesi kapatıldı; Mali Müşavir Paketi'ne yeniden giriliyor.", flush=True)
        _OTO["paket"] = True          # açık giriş sayfasındaki paket kutusuna yeniden basılabilir
    return kapandi


def _giris_sayfasi_acik(ctx) -> bool:
    for p in list(ctx.pages):
        try:
            if not p.is_closed() and "main.erp" in p.url:
                return True
        except PWError:
            continue
    return False


def oturum_canli(ctx, L):
    """Luca sayfası kapandıysa / oturum düştüyse: hata sekmesini kapatır; giriş sayfası (paket seçimi) hâlâ
    açıksa Mali Müşavir Paketi'ne yeniden girer; değilse girişi baştan yapar/bekler."""
    try:
        if not L.is_closed() and not luca_hatasi(L) and re.search(r"/Luca/luca\.do", L.url) and L.frame(name="frm4"):
            L.frame(name="frm4").wait_for_selector("#SirketCombo", timeout=5000)
            return L
    except PWError:
        pass
    _hata_sekmelerini_kapat(ctx)
    acik = _luca_acik_mi(ctx)
    if acik:
        return acik
    if _giris_sayfasi_acik(ctx):
        _OTO["paket"] = True
        return luca_sayfasini_bekle(ctx)
    print("\n! Luca oturumu kapanmış görünüyor; lütfen tekrar giriş yapın.", flush=True)
    ilk = ctx.new_page()
    mw = muhawin_oturumuyla_ac(ctx, ilk)
    if not mw:
        ilk.goto(BASLANGIC)
        _giris_dene(ctx, ilk)
    return luca_sayfasini_bekle(ctx, mw)


def firma_isle(L, firma: str, bas: date, bit: date, turler: list[str], cikti: Path, muavin: bool = True,
               defter: str | None = None) -> Sonuc:
    """Açık Luca oturumunda tek firmanın belgelerini ve (muavin=True ise) muavinini indirir.
    Luca oturumu düşerse ('www.luca.com.tr adresinden giriş yapınız') hata sekmesi kapatılır, Mali Müşavir
    Paketi'ne yeniden girilir, firma yeniden seçilir ve o adım bir kez daha denenir. Güncel sayfa s.L'dedir."""
    s = Sonuc(cikti)
    s.L = L
    cikti.mkdir(parents=True, exist_ok=True)
    durum = {"kok": None, "uye": None}

    def hazirla():
        durum["kok"] = s.L.url.split("/Luca/")[0] + "/Luca"
        firma_sec(s.L, firma, bas.year, s)
        durum["uye"] = uye_no(s.L)

    def dene(ad: str, gorev, resim: str):
        for deneme in (1, 2):
            try:
                zaman_asimi(s.L)
                gorev()
                return
            except (OtomasyonHatasi, PWError, PWTimeout) as e:
                if "GÜVENLİK" in str(e):
                    raise
                if deneme == 1 and zaman_asimi(s.L):   # işlem sırasında oturum zaman aşımı kutusu çıktı
                    s.not_al("Luca zaman aşımı", "bilgi", "parola girildi, adım yeniden deneniyor")
                    hazirla()
                    continue
                dustu = "LUCA_OTURUM" in str(e) or luca_hatasi(s.L) or "detached" in str(e) or \
                    "has been closed" in str(e)
                if dustu and deneme == 1:
                    s.not_al("Luca oturumu düştü", "bilgi", "hata sekmesi kapatılıp yeniden giriliyor")
                    s.L = oturum_canli(s.L.context, s.L)
                    hazirla()
                    continue
                s.not_al(ad, "hata", str(e).splitlines()[0][:200])
                _goruntu(s.L, s, resim)
                return

    try:
        s.not_al("Luca oturumu bulundu", "tamam")
        if luca_hatasi(s.L):
            s.L = oturum_canli(s.L.context, s.L)
        zaman_asimi(s.L)
        hazirla()
        for tur in turler:
            if tur == "gib_esmm_satis" and defter != "serbest":
                # e-SMM satış (firmanın kestiği serbest meslek makbuzu) yalnız serbest meslek defterli firmada sorgulanır;
                # bilanço ve işletme defterlerinde sorgulanmaz. e-SMM alış bütün firmalarda sorgulanır (kullanıcı kararı 23.10.2026).
                s.not_al(f"{TURLER[tur]}: indirme", "atlandı", "firma serbest meslek defteri değil; e-SMM satış sorgulanmadı")
                continue
            dene(TURLER[tur], lambda tur=tur: ebelge_indir(s.L, durum["kok"], durum["uye"], tur, bas, bit, s), tur)
        if muavin:
            if defter in ("isletme", "serbest") or (defter != "bilanco" and isletme_mi(s.L)):
                s.not_al("İşletme / serbest meslek defteri", "bilgi", "muavin yerine Gelir ve Gider Listesi alınıyor")
                # muavin yılın tamamı alınır (kayıt önerileri için); karşılaştırma dönem içinden süzülür
                yb, ys = date(bas.year, 1, 1), date(bas.year, 12, 31)
                dene("Muavin (işletme defteri)", lambda: isletme_indir(s.L, durum["kok"], durum["uye"], yb, ys, s), "isletme")
            else:
                dene("Muavin", lambda: muavin_indir(s.L, durum["kok"], durum["uye"], s), "muavin")
    finally:
        (cikti / "adimlar.json").write_text(json.dumps(s.adimlar, ensure_ascii=False, indent=1), encoding="utf-8")
        hata_goruntulerini_sil(cikti)
    return s


def hata_goruntulerini_sil(klasor: Path):
    """Hata ekran görüntüleri ve sayfa kopyaları (VKN, unvan, fatura içerebilir) iş bitince silinir; yalnız
    tanılama modunda (FK_TANILAMA=1) bırakılır (rapor-02 D10). Eski sürümlerden kalanlar da silinir."""
    if os.environ.get("FK_TANILAMA") == "1":
        return
    for y in list(klasor.glob("hata_*.jpg")) + list(klasor.glob("hata_*_frm3.html")):
        try:
            y.unlink()
        except OSError:
            pass


def indir(firma: str, bas: date, bit: date, turler: list[str], cikti: Path,
          profil: Path = PROFIL, ctx_hazirla=None) -> Sonuc:
    with oturum(profil, ctx_hazirla) as (ctx, L):
        return firma_isle(L, firma, bas, bit, turler, cikti)


def _goruntu(L, s: Sonuc, ad: str):
    from .kayit import gizle
    try:
        L.screenshot(path=str(s.klasor / f"hata_{ad}.jpg"), type="jpeg", quality=60)
        f3 = L.frame(name="frm3")
        if f3:
            (s.klasor / f"hata_{ad}_frm3.html").write_text(gizle(f3.content()), encoding="utf-8")
    except PWError:
        pass


def kontrol_et(s: Sonuc, bas: date, bit: date) -> dict | None:
    """Dönem klasöründeki arşiv ve muavinle kontrol (tek firma kontrolüyle aynı çekirdek: fatura_kontrol.kontrol)."""
    if not s.zipler or not s.muavin:
        print("\n! Kontrol çalıştırılamadı: fatura ZIP'i ya da muavin indirilemedi.")
        return None
    from .. import kontrol as K
    hatalar = [a for a in s.adimlar if a["durum"] == "hata"]
    on = [f"Luca indirme hatası – {a['adim']}: {a['ayrinti']}" for a in hatalar]
    klasor = Path(s.muavin).parent
    return K.calistir(klasor, bas, bit, s.vkn, s.firma or "", on_uyarilar=on,
                      zipler=list(s.zipler), muavinler=[Path(s.muavin)])


def _tarih(t: str) -> date:
    return datetime.strptime(t, "%d.%m.%Y").date()


def main(argv=None):
    ap = argparse.ArgumentParser(description="Luca'dan fatura ve muavin indirip kontrol eder.")
    ap.add_argument("--firma", help="Luca'daki firma kısa adı (ör. 'EXPO İNŞ')")
    ap.add_argument("--ay", help="YYYY-AA (ör. 2026-09)")
    ap.add_argument("--bas", type=_tarih)
    ap.add_argument("--bit", type=_tarih)
    ap.add_argument("--turler", default=",".join(TURLER), help="virgülle: " + ", ".join(TURLER))
    a = ap.parse_args(argv)
    firma = a.firma if a.firma is not None else input(
        "Firma kısa adı (ör. EXPO INS) – boş bırakırsanız Luca'da seçili firma kullanılır: ").strip()
    if a.bas and a.bit:
        bas, bit = a.bas, a.bit
    else:
        ay = a.ay or input("Ay (YYYY-AA, ör. 2026-09): ").strip()
        y, m = map(int, ay.split("-"))
        bas, bit = date(y, m, 1), date(y, m, monthrange(y, m)[1])
    turler = [t.strip() for t in a.turler.split(",") if t.strip()]
    bilinmeyen = set(turler) - set(TURLER)
    if bilinmeyen:
        raise SystemExit(f"Bilinmeyen tür: {', '.join(bilinmeyen)}")

    from .. import depo
    klasor = depo.donem_temizle(depo.donem_klasoru(firma or "SECILI_FIRMA", bas))   # önceki indirmeler silinir
    print(f"\nLuca otomasyonu: {firma or '(Luca’da seçili firma)'}, {bas:%d.%m.%Y}–{bit:%d.%m.%Y}")
    print("Program Belge Sil / Muhasebeleştir / Muhasebe İptal düğmelerine asla basmaz.")
    s = indir(firma, bas, bit, turler, klasor)
    from .. import arsiv
    arsiv.arsive_al(firma or "SECILI_FIRMA", sorted(klasor.glob("gib_*.zip")))
    s.zipler = arsiv.donem_faturalari(klasor)
    veri = kontrol_et(s, bas, bit)
    print(f"\nİndirilen dosyalar: {klasor}")
    if veri:
        sorunlu = [d for d in veri["durumlar"] if d["sorunlu"] and d["adet"]]
        print("Kontrol sonucu: " + (", ".join(f"{d['ad']} {d['adet']}" for d in sorunlu) or "sorun yok"))
        excel = klasor / "kontrol_raporu.xlsx"
        print(f"Excel raporu: {excel}")
        if sys.platform == "win32" and excel.exists():
            os.startfile(excel)   # noqa
    return s, veri


if __name__ == "__main__":
    try:
        main()
    except OtomasyonHatasi as e:
        print(f"\nDURDURULDU: {e}")
    except KeyboardInterrupt:
        print("\nİptal edildi.")
