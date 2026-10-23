"""Sitedeki Denetim, gerçek tarayıcıda uçtan uca (sahte veri, sahte Supabase; gerçek sunucuya istek gitmez).

Önce derleme:  node tools/site_uret.js --denetim   (web/denetim/KURULUM ayrıntısı: web/KURULUM.md)
Çalıştırma:    python3 web/denetim/site_e2e.py      (Playwright + Chromium gerekir; PW_CHROMIUM ile yol verilebilir)
"""
import fnmatch
import functools
import http.server
import json
import os
import subprocess
import sys
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

KOK = Path(__file__).resolve().parents[2]
SITE = KOK / "web" / "site"
ORNEK = KOK / "web" / "tarayici-deneme" / "ornek"
SUPA = "https://rupwlypoblungdfajrya.supabase.co"
PAROLA = "Sifre1234"
LISANSLI, LISANSSIZ = "denetci@ornek.com", "lisanssiz@ornek.com"
hatalar = []


def kontrol(kosul, ad):
    print(("  ✓ " if kosul else "  ✗ ") + ad)
    if not kosul:
        hatalar.append(ad)


def _basliklar():
    out, desen = [], None
    for satir in (SITE / "_headers").read_text(encoding="utf-8").splitlines():
        if not satir.strip() or satir.lstrip().startswith("#"):
            continue
        if not satir.startswith(" "):
            desen = satir.strip(); out.append((desen, []))
        else:
            k, v = satir.strip().split(":", 1); out[-1][1].append((k.strip(), v.strip()))
    return out


BASLIKLAR = _basliklar()


def bekle(sayfa, ifade, timeout=30000):
    """wait_for_function CSP'ye takılır (eval); evaluate (CDP) takılmaz: ifade aralıklarla denenir."""
    import time
    son = time.time() + timeout / 1000
    while True:
        try:
            if sayfa.evaluate(ifade):
                return
        except Exception:
            pass
        if time.time() > son:
            raise TimeoutError("beklenen olmadı: " + ifade)
        sayfa.wait_for_timeout(200)


def sunucu():
    class Sessiz(http.server.SimpleHTTPRequestHandler):
        extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, ".wasm": "application/wasm", ".mjs": "text/javascript"}

        def log_message(self, *a):
            pass

        def end_headers(self):           # Cloudflare Pages gibi _headers dosyasını uygula (CSP dahil)
            yol = self.path.split("?")[0]
            for desen, basliklar in BASLIKLAR:
                if fnmatch.fnmatch(yol, desen):
                    for k, v in basliklar:
                        self.send_header(k, v)
            super().end_headers()
    class Sunucu(http.server.ThreadingHTTPServer):
        def handle_error(self, *a):      # tarayıcı yarıda kesince (BrokenPipe) sessiz geç
            pass
    s = Sunucu(("127.0.0.1", 0), functools.partial(Sessiz, directory=str(SITE)))
    threading.Thread(target=s.serve_forever, daemon=True).start()
    return s, f"http://127.0.0.1:{s.server_address[1]}"


def sahte_supabase(route, supa_istekleri):
    """Supabase yerine: parola girişi, yenileme, app_status, çıkış. Gövdeler kaydedilir (belge gitmediğini sınamak için)."""
    r = route.request
    govde = r.post_data or ""
    supa_istekleri.append((r.method, r.url, len(govde)))
    j = json.loads(govde) if govde.startswith("{") else {}
    yanit = lambda kod, veri: route.fulfill(status=kod, content_type="application/json", body=json.dumps(veri),
                                            headers={"access-control-allow-origin": "*", "access-control-allow-headers": "*"})
    if r.method == "OPTIONS":
        return route.fulfill(status=204, headers={"access-control-allow-origin": "*", "access-control-allow-headers": "*",
                                                  "access-control-allow-methods": "GET,POST,PUT,OPTIONS"})
    if "grant_type=password" in r.url:
        if j.get("password") != PAROLA:
            return yanit(400, {"error_code": "invalid_credentials", "msg": "Invalid login credentials"})
        return yanit(200, {"access_token": "erisim-" + j["email"], "refresh_token": "yenile-" + j["email"], "expires_in": 3600,
                           "user": {"email": j["email"]}})
    if "grant_type=refresh_token" in r.url:
        e = j.get("refresh_token", "").removeprefix("yenile-")
        return yanit(200, {"access_token": "erisim-" + e, "refresh_token": "yenile-" + e, "expires_in": 3600, "user": {"email": e}})
    if r.url.endswith("/rest/v1/rpc/app_status"):
        e = (r.headers.get("authorization") or "").removeprefix("Bearer erisim-")
        if e == LISANSLI:
            return yanit(200, {"valid": True, "office": {"ozel": ["mikro"]},
                               "modules": {"ozel": {"active": True, "valid": True, "type": "pool", "daysLeft": 200}}})
        return yanit(200, {"valid": True, "office": {"ozel": []}, "modules": {"ozel": {"active": True, "valid": True, "type": "pool"}}})
    if r.url.endswith("/auth/v1/logout"):
        return route.fulfill(status=204, headers={"access-control-allow-origin": "*"})
    return yanit(404, {"msg": "sahte supabase: bilinmeyen istek"})


def main():
    subprocess.run([sys.executable, str(KOK / "web" / "tarayici-deneme" / "ornek_uret.py")], check=True)
    srv, ADRES = sunucu()
    supa, digerleri = [], []
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=os.environ.get("PW_CHROMIUM") or None)
        ctx = b.new_context(accept_downloads=True)
        ctx.route(SUPA + "/**", lambda route: sahte_supabase(route, supa))
        ctx.on("request", lambda r: None if r.url.startswith((ADRES, SUPA, "blob:", "data:", "about:")) else digerleri.append(r.url))
        pg = ctx.new_page()
        csp = []
        pg.on("console", lambda m: (print("    [konsol]", m.text), csp.append(m.text) if "Content Security Policy" in m.text else None) if m.type == "error" else None)

        print("Giriş")
        pg.goto(ADRES + "/denetim/")
        pg.wait_for_url("**/giris.html?geri=*")
        kontrol("/giris.html" in pg.url, "oturumsuz denetim → giriş sayfası")
        pg.fill("#eposta", LISANSLI); pg.fill("#parola", "yanlis"); pg.click("#gir")
        bekle(pg, "document.querySelector('#hata').textContent.length > 0")
        kontrol("hatalı" in pg.inner_text("#hata"), "yanlış şifre reddedilir")
        pg.fill("#parola", PAROLA); pg.click("#gir")
        pg.wait_for_url("**/denetim/")
        kontrol(pg.inner_text("#mwEposta") == LISANSLI, "girişten sonra denetim, e-posta üst çubukta")
        kontrol(pg.title().startswith("Muhasebe Denetimi") and "Muhasebe Denetimi" in pg.inner_text("header h1"), "sayfa adı Muhasebe Denetimi")
        kontrol(pg.evaluate("sessionStorage.getItem('mw-oturum')").count("yenile-") == 1 and
                pg.evaluate("Object.keys(localStorage).some(k => /oturum|token/i.test(k))") is False,
                "yenileme belirteci sessionStorage'da; localStorage'da oturum yok")

        print("Denetim")
        bekle(pg, "window.MW_KOPRU && document.querySelector('#mwFirmaEkle')", 60000)
        bekle(pg, "window.MW_KOPRU && window.MW_KOPRU.hazir", 120000)
        pg.fill("#mwYeniFirma", "ÖRNEK TİCARET A.Ş."); pg.click("#mwFirmaEkle")
        bekle(pg, "[...document.querySelectorAll('#firma option')].some(o => o.textContent === 'ÖRNEK TİCARET A.Ş.')")
        pg.select_option("#firma", "ÖRNEK TİCARET A.Ş.")
        pg.set_input_files("#xml", str(ORNEK / "faturalar.zip")); pg.set_input_files("#muavin", str(ORNEK / "muavin.xlsx"))
        pg.fill("#bas", "2026-09-01"); pg.fill("#bit", "2026-09-30"); pg.click("#basla")
        bekle(pg, "!document.querySelector('#yukle').classList.contains('acik')", 120000)
        icerik = pg.inner_text("#icerik")
        kontrol(pg.inner_text("#hata") == "", "denetim hatasız: " + pg.inner_text("#hata"))
        kontrol("ÖRNEK TİCARET A.Ş." in icerik and "Matrah kontrolü" in icerik, "özet görünür")
        kontrol("Tutar farkı" in icerik, "sorunlu kayıtlar listelenir")
        pg.screenshot(path=os.environ.get("EKRAN", "/tmp") + "/site-denetim.png")

        print("Çıktılar")
        pg.click("#nav [data-g=beyan]")
        with pg.expect_download() as d:
            pg.click("a[href^='/api/rapor/excel']")
        indirilen = d.value
        yol = indirilen.path()
        kontrol(indirilen.suggested_filename.endswith(".xlsx") and open(yol, "rb").read(2) == b"PK", "Excel raporu indirilir (" + indirilen.suggested_filename + ")")
        with pg.expect_popup() as pp:
            pg.click("[data-ac^='/api/rapor/cikti']")
        cikti = pp.value
        cikti.wait_for_selector("iframe")
        cerceve = cikti.frame_locator("iframe")
        cerceve.locator("body").wait_for()
        kontrol("ÖRNEK TİCARET" in cerceve.locator("body").inner_text(), "çıktı raporu ayrı pencerede")
        kontrol(cikti.get_attribute("iframe", "sandbox") == "allow-scripts allow-modals", "rapor kum havuzlu çerçevede")
        kontrol(cikti.frames[1].evaluate("(() => { try { return String(sessionStorage.length) } catch (e) { return 'engelli' } })()") == "engelli",
                "çerçeve sitenin oturum deposuna erişemez")
        cikti.close()
        with pg.expect_popup() as pp:
            pg.click("[data-ac^='/beyanname']")
        beyan = pp.value
        beyan.wait_for_url("**/denetim/beyanname.html?id=*")
        bekle(beyan, "window.MW_KOPRU && window.MW_KOPRU.hazir", 120000)
        beyan.wait_for_timeout(1500)
        kontrol("KDV" in beyan.inner_text("body"), "KDV beyannamesi sayfası açılır")
        beyan.close()

        print("Kalıcılık")
        pg.reload()
        bekle(pg, "window.MW_KOPRU && window.MW_KOPRU.hazir", 120000)
        bekle(pg, "!document.querySelector('#gecmisKart').hidden", 30000)
        kontrol("ÖRNEK TİCARET" in pg.inner_text("#gecmis"), "sayfa yenilenince önceki denetim bu tarayıcıda duruyor")

        print("Çıkış ve lisans")
        pg.click("#mwCikis"); pg.wait_for_url("**/giris.html")
        kontrol(pg.evaluate("sessionStorage.getItem('mw-oturum')") is None, "çıkışta oturum silinir")
        pg.fill("#eposta", LISANSSIZ); pg.fill("#parola", PAROLA); pg.click("#gir")
        pg.wait_for_url("**/denetim/")
        pg.wait_for_selector("text=Muhasebe Denetimi'ne erişim yok")
        kontrol("ofisinize tanımlı değil" in pg.inner_text("body"), "ofisine Denetim tanımlı olmayan hesap giremez")

        print("Gizlilik")
        kontrol(any("Content-Security-Policy" in k for d, L in BASLIKLAR for k, _ in L), "güvenlik başlıkları (_headers) uygulandı")
        kontrol(not csp, "CSP ihlali yok: " + "; ".join(csp[:2]))
        kontrol(not digerleri, "site ve Supabase dışında istek yok: " + ", ".join(digerleri[:3]))
        kontrol(supa and max(n for _, _, n in supa) < 2000, f"Supabase'e yalnız küçük JSON gider (en büyük {max(n for _, _, n in supa)} bayt)")
        kontrol(all("/auth/v1/" in u or "/rest/v1/rpc/app_status" in u for _, u, _ in supa), "Supabase'e yalnız giriş ve lisans istekleri")
        b.close()
    srv.shutdown()
    print(f"\n{'TAMAM' if not hatalar else str(len(hatalar)) + ' HATA'}")
    sys.exit(1 if hatalar else 0)


if __name__ == "__main__":
    main()
