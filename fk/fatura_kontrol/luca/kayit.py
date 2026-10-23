"""Luca kayıt aracı (keşif).

Kullanıcı Luca'da normal işini yaparken, GİRİŞTEN SONRAKİ ekranlarda (auygs.luca.com.tr):
  * tıklanan öğeleri (etiket, id, name, sınıf, metin, CSS/XPath yolu, hangi iframe),
  * değiştirilen form alanlarını (açılır liste seçenekleri dahil),
  * her tıklamada ekran görüntüsünü ve sayfa yapısını (tüm iframe'lerin HTML'i),
  * indirilen dosyaları
kaydeder ve sonunda tek bir ZIP yapar. Otomasyonu yazmak için gereken "haritayı" çıkarır.

Gizlilik:
  * Giriş sayfaları (www.luca.com.tr, agiris.luca.com.tr) KAYDEDİLMEZ: üye no, kullanıcı adı,
    şifre ve captcha hiçbir şekilde yazılmaz.
  * Parola türündeki alanlar her durumda atlanır.

Çalıştırma:  python -m fatura_kontrol.luca.kayit
"""
from __future__ import annotations

import hashlib
import json
import re
import os
import shutil
import sys
import time
import zipfile
from datetime import datetime
from pathlib import Path

from playwright.sync_api import Error as PWError
from playwright.sync_api import sync_playwright

BASLANGIC = os.environ.get("FK_LUCA_URL", "https://www.luca.com.tr")
KAYIT_HOST = os.environ.get("FK_KAYIT_HOST", "auygs.luca.com.tr")   # yalnız bu sunucu kaydedilir
PROFIL = Path.home() / ".fatura_kontrol" / "luca_profil"

# Sayfaya enjekte edilen dinleyici: yalnız KAYIT_HOST üzerinde çalışır.
JS = r"""
(() => {
  const HOST = '%HOST%';
  if (!(location.host === HOST || location.host.endsWith('.' + HOST)) || window.__fkKayitKurulu) return;
  window.__fkKayitKurulu = true;
  const kisa = (s, n) => (s || '').replace(/\s+/g, ' ').trim().slice(0, n);
  const css = el => {
    const parca = [];
    for (let e = el; e && e.nodeType === 1 && parca.length < 8; e = e.parentElement) {
      let p = e.tagName.toLowerCase();
      if (e.id) { parca.unshift(p + '#' + CSS.escape(e.id)); break; }
      if (e.getAttribute('name')) p += `[name="${e.getAttribute('name')}"]`;
      else if (e.classList.length) p += '.' + [...e.classList].slice(0, 2).map(c => CSS.escape(c)).join('.');
      const kardes = e.parentElement ? [...e.parentElement.children].filter(c => c.tagName === e.tagName) : [];
      if (kardes.length > 1) p += `:nth-of-type(${kardes.indexOf(e) + 1})`;
      parca.unshift(p);
    }
    return parca.join(' > ');
  };
  const xpath = el => {
    const parca = [];
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      if (e.id) { parca.unshift(`//*[@id="${e.id}"]`); return parca.join('/'); }
      let i = 1; for (let s = e.previousElementSibling; s; s = s.previousElementSibling) if (s.tagName === e.tagName) i++;
      parca.unshift(`${e.tagName.toLowerCase()}[${i}]`);
    }
    return '/' + parca.join('/');
  };
  const bilgi = el => ({
    etiket: el.tagName.toLowerCase(), id: el.id || null, name: el.getAttribute('name'),
    sinif: kisa(el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className, 120),
    tip: el.getAttribute('type'), metin: kisa(el.innerText || el.getAttribute('value') || el.getAttribute('title') || el.getAttribute('alt'), 120),
    title: el.getAttribute('title'), href: el.getAttribute('href'),
    onclick: kisa(el.getAttribute('onclick'), 300), css: css(el), xpath: xpath(el),
    ataler: (() => { const a = []; for (let e = el.parentElement; e && a.length < 4; e = e.parentElement)
      a.push(e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.split(/\s+/)[0] : '')); return a; })(),
  });
  const gonder = v => { try { window.__fkOlay(v); } catch (e) {} };
  document.addEventListener('click', e => {
    if (!e.isTrusted) { window.__fkYapay = e.target; return; }   // sayfanın kendi ürettiği tıklamalar (ör. 'tümünü seç')
    const el = e.target.closest('a,button,input,select,option,label,td,th,tr,li,img,span,div') || e.target;
    if (el.type === 'password') return;
    gonder({ tur: 'tik', ...bilgi(el), x: e.clientX, y: e.clientY });
  }, true);
  document.addEventListener('change', e => {
    if (!e.isTrusted || e.target === window.__fkYapay) return;   // yapay tıklamanın doğurduğu değişiklik
    const el = e.target;
    if (!el || el.type === 'password') return;
    let deger;
    if (el.tagName === 'SELECT') deger = { secilen: el.value, secilen_metin: el.options[el.selectedIndex] && el.options[el.selectedIndex].text,
      secenekler: [...el.options].slice(0, 500).map(o => [o.value, kisa(o.text, 80)]) };
    else if (el.type === 'checkbox' || el.type === 'radio') deger = { isaretli: el.checked };
    else deger = { deger: kisa(el.value, 200) };
    gonder({ tur: 'degisim', ...bilgi(el), ...deger });
  }, true);
})();
"""


GIZLI_ALAN = re.compile(r"sifre|şifre|password|parola|secret|api_key|apikey|token|kullanici_adi|tckn_vkn", re.I)


def gizle(html: str) -> str:
    """Sayfa kopyasındaki şifre/kullanıcı adı/API anahtarı alanlarının değerlerini siler.
    (Luca, mükellefin GİB ve entegratör bilgilerini sayfaya gömülü olarak gönderiyor.)"""
    def temizle(m):
        etiket = m.group(0)
        tip_parola = re.search(r'type\s*=\s*["\']?password', etiket, re.I)
        ad = " ".join(re.findall(r'(?:id|name)\s*=\s*["\']([^"\']*)', etiket, re.I))
        if tip_parola or GIZLI_ALAN.search(ad):
            etiket = re.sub(r'(\bvalue\s*=\s*)("[^"]*"|\'[^\']*\'|[^\s>]+)', r'\1""', etiket, flags=re.I)
        return etiket
    return re.sub(r"<input\b[^>]*>", temizle, html, flags=re.I)


class Kaydedici:
    def __init__(self, klasor: Path):
        self.klasor = klasor
        (klasor / "ekran").mkdir(parents=True)
        (klasor / "sayfa").mkdir()
        (klasor / "indirilenler").mkdir()
        self.log = (klasor / "olaylar.jsonl").open("a", encoding="utf-8")
        self.kuyruk: list = []
        self.indirmeler: list = []
        self.sayac = 0
        self.son_goruntu = 0.0
        self.kapandi = False
        self.frame_ozet: dict[str, str] = {}   # frame adı -> son kaydedilen içeriğin özeti

    def yaz(self, kayit: dict):
        kayit["zaman"] = datetime.now().isoformat(timespec="milliseconds")
        self.log.write(json.dumps(kayit, ensure_ascii=False) + "\n")
        self.log.flush()

    @staticmethod
    def kayitli_mi(url: str) -> bool:
        try:
            host = url.split("/")[2]
        except IndexError:
            return False
        return host == KAYIT_HOST or host.endswith("." + KAYIT_HOST)

    # -- Playwright olayları (yalnız kuyruğa ekler; ağır işler ana döngüde)
    def olay(self, kaynak, veri):
        self.kuyruk.append((kaynak["page"], kaynak["frame"].url, kaynak["frame"].name, veri))

    def sayfa_baglan(self, sayfa):
        sayfa.on("download", lambda d: self.indirmeler.append(d))
        sayfa.on("dialog", self.diyalog)
        sayfa.on("framenavigated", lambda fr: self.kayitli_mi(fr.url) and self.yaz(
            {"tur": "gezinti", "frame": fr.name, "url": fr.url}))
        sayfa.on("popup", lambda p: self.yaz({"tur": "acilir_pencere", "url": p.url}))

    def diyalog(self, d):
        # Kullanıcının kendi tıklamasıyla açılan uyarı/onay pencereleri: içeriği kaydedilir ve kabul edilir
        if self.kayitli_mi(d.page.url):
            self.yaz({"tur": "diyalog", "diyalog_turu": d.type, "mesaj": d.message[:500]})
        try:
            d.accept()
        except PWError:
            pass

    # -- Ana döngüde işlenenler
    def isle(self):
        while self.kuyruk:
            sayfa, frame_url, frame_ad, veri = self.kuyruk.pop(0)
            self.sayac += 1
            no = f"{self.sayac:04d}"
            veri.update({"no": no, "frame": frame_ad, "frame_url": frame_url, "sayfa_url": sayfa.url})
            if veri["tur"] == "tik" and time.time() - self.son_goruntu > 0.7 and not sayfa.is_closed():
                self.son_goruntu = time.time()
                try:
                    sayfa.wait_for_timeout(600)   # menü/pencere açılsın
                    sayfa.screenshot(path=str(self.klasor / "ekran" / f"{no}.jpg"), type="jpeg", quality=60)
                    veri["ekran"] = f"ekran/{no}.jpg"
                    self.sayfa_yapisi(sayfa, no)
                    veri["sayfa"] = f"sayfa/{no}"
                except PWError as e:
                    veri["hata"] = str(e)[:200]
            self.yaz(veri)
        while self.indirmeler:
            d = self.indirmeler.pop(0)
            hedef = self.klasor / "indirilenler" / d.suggested_filename
            try:
                d.save_as(hedef)
                self.yaz({"tur": "indirme", "dosya": d.suggested_filename, "url": d.url[:300],
                          "boyut": hedef.stat().st_size})
                print(f"  İndirildi: {d.suggested_filename}")
                kopya = Path.home() / "Downloads" / d.suggested_filename   # kullanıcı da bulsun
                if kopya.parent.exists() and not kopya.exists():
                    shutil.copy2(hedef, kopya)
            except PWError as e:
                self.yaz({"tur": "indirme_hatasi", "dosya": d.suggested_filename, "hata": str(e)[:200]})

    def sayfa_yapisi(self, sayfa, no: str):
        hedef = self.klasor / "sayfa" / no
        hedef.mkdir()
        ozet = []
        for i, fr in enumerate(sayfa.frames):
            if not self.kayitli_mi(fr.url):
                continue
            try:
                html = gizle(fr.content())
            except PWError:
                continue
            anahtar = fr.name or f"#{i}"
            ozetle = hashlib.sha1(html.encode("utf-8", "ignore")).hexdigest()
            kayit = {"frame": fr.name, "url": fr.url, "ust": fr.parent_frame.name if fr.parent_frame else None}
            if self.frame_ozet.get(anahtar) == ozetle:
                kayit["degismedi"] = True          # aynı içerik tekrar yazılmaz (disk dolmasın)
            else:
                self.frame_ozet[anahtar] = ozetle
                ad = f"{i:02d}_{(fr.name or 'ana')[:30]}.html"
                (hedef / ad).write_text(html, encoding="utf-8")
                kayit["dosya"] = ad
            ozet.append(kayit)
        (hedef / "frameler.json").write_text(json.dumps(ozet, ensure_ascii=False, indent=1), encoding="utf-8")


def tarayici_ac(p, profil: Path):
    son_hata = None
    gizli = bool(os.environ.get("FK_HEADLESS"))          # yalnız testler için
    for kanal in ((None,) if gizli else ("chrome", "msedge", None)):
        try:
            return p.chromium.launch_persistent_context(
                str(profil), channel=kanal, headless=gizli, accept_downloads=True,
                no_viewport=True, args=["--start-maximized"])
        except PWError as e:
            son_hata = e
    raise SystemExit(f"Tarayıcı açılamadı: {son_hata}")


def calistir(surucu=None, profil: Path = PROFIL, cikti: Path | None = None):
    """surucu: testlerde kullanıcının yerine tarayıcıyı süren üreteç fonksiyonu (ctx, sayfa)."""
    zaman = datetime.now().strftime("%Y%m%d_%H%M%S")
    calisma = (cikti or Path.cwd() / "luca_kayitlari") / f"kayit_{zaman}"
    k = Kaydedici(calisma)
    k.yaz({"tur": "baslangic", "surum": 1, "platform": sys.platform})
    profil.mkdir(parents=True, exist_ok=True)

    print("\nLuca kayıt aracı başladı.")
    print("1) Açılan tarayıcıda Luca'ya her zamanki gibi giriş yapın (giriş bilgileri KAYDEDİLMEZ).")
    print("2) Firmayı seçin; gelen/giden e-fatura ve e-arşiv indirme ile muavin raporunu normal şekilde yapın.")
    print("   Not: indirmelerde 'Farklı kaydet' penceresi çıkmayabilir; dosyalar otomatik alınır.")
    print("3) Bitince TARAYICIYI KAPATIN. Kayıt dosyası otomatik oluşturulur.\n")

    with sync_playwright() as p:
        ctx = tarayici_ac(p, profil)
        ctx.on("close", lambda _: setattr(k, "kapandi", True))
        ctx.expose_binding("__fkOlay", k.olay)
        ctx.add_init_script(JS.replace("%HOST%", KAYIT_HOST))
        for s in ctx.pages:
            k.sayfa_baglan(s)
        ctx.on("page", k.sayfa_baglan)
        sayfa = ctx.pages[0] if ctx.pages else ctx.new_page()
        sayfa.goto(BASLANGIC)
        # Testlerde 'surucu' bir üreteçtir: her adımdan sonra gerçek ana döngü bir tur çalışır
        adimlar = surucu(ctx, sayfa) if surucu else None
        # Luca girişte yeni pencere açıp eskisini kapatabilir; bu yüzden döngü yalnız
        # TÜM pencereler kapanınca biter, tek bir sekmenin kapanması kaydı durdurmaz.
        while not k.kapandi:
            acik = [s for s in ctx.pages if not s.is_closed()]
            if not acik:
                break
            try:
                if adimlar is not None:
                    try:
                        next(adimlar)
                    except StopIteration:
                        k.isle()
                        ctx.close()
                        break
                k.isle()
                acik[-1].wait_for_timeout(300)
            except PWError as e:
                k.yaz({"tur": "dongu_uyari", "hata": str(e)[:300]})
        try:
            ctx.close()
        except PWError:
            pass

    k.log.close()
    zip_yol = calisma.with_suffix(".zip")
    with zipfile.ZipFile(zip_yol, "w", zipfile.ZIP_DEFLATED) as z:
        for f in calisma.rglob("*"):
            z.write(f, f.relative_to(calisma.parent))
    print(f"\nKayıt tamamlandı ({k.sayac} olay): {zip_yol}")
    print("Bu ZIP dosyasını Claude'a gönderin.")
    return zip_yol


if __name__ == "__main__":
    try:
        calistir()
    except Exception:
        import traceback
        hata = traceback.format_exc()
        (Path.cwd() / "luca_kayit_hata.txt").write_text(hata, encoding="utf-8")
        print("\nBEKLENMEYEN HATA (luca_kayit_hata.txt dosyasına yazıldı):\n" + hata)
