"""Görev 56: KDV2 raporu PDF (yazdırılabilir HTML) — seçilen firmalar, her firma yeni sayfadan, başta firma / dönem / toplam."""
import re

from fatura_kontrol.luca import toplu as T


def _rapor(sonuclar, bas=None, bit=None):
    sat = lambda n, t: {"tarih": "2026-09-1" + str(n), "belge_no": f"ABC202600000000{n}", "karsi_taraf": f"SATICI {n}", "vkn": "1111111111",
                        "matrah": 1000.0 * n, "kdv": 200.0 * n, "kod": "624", "tur": "Yapım işleri", "oran": "4/10", "tutar": t, "yon": "Alış"}
    return [{"ad": "A FİRMA", "vkn": "1", "rapor_id": "A/2026/09", "satirlar": [sat(1, 80.0), sat(2, 160.0)], "toplam": 240.0, "adet": 2},
            {"ad": "B FİRMA", "vkn": "2", "rapor_id": "B/2026/09", "satirlar": [sat(3, 240.0)], "toplam": 240.0, "adet": 1},
            {"ad": "C FİRMA", "vkn": "3", "rapor_id": "C/2026/09", "satirlar": [sat(4, 320.0)], "toplam": 320.0, "adet": 1}]


def test_secilen_firmalar_ayri_sayfada(monkeypatch):
    monkeypatch.setattr(T, "kdv2_raporu", _rapor)
    h = T.kdv2_html([], "2026-09-01", "2026-09-30", ["A/2026/09", "C/2026/09"])
    firmalar = re.findall(r'<section class=firma data-rapor="([^"]+)"', h)
    assert firmalar == ["A/2026/09", "C/2026/09"]                         # 3 firmadan 2'si seçildi → PDF'te 2 firma
    assert "B FİRMA" not in h and "A FİRMA" in h and "C FİRMA" in h
    assert "page-break-before:always" in h and ".firma:first-child" in h   # her firma yeni sayfadan
    a = h.split('data-rapor="A/2026/09"')[1].split("</section>")[0]
    assert "01.09.2026 – 30.09.2026" in a and "240,00 TL" in a and "3.000,00" in a and all(x in a for x in ("Hazırlayan", "Kontrol Eden", "Onaylayan")) and "fisimza" in a   # dönem, toplam, matrah, ortak imza alanı
    assert "@page{size:A4 landscape" in h


def test_tumu_ve_bos(monkeypatch):
    monkeypatch.setattr(T, "kdv2_raporu", _rapor)
    assert len(re.findall(r"<section class=firma", T.kdv2_html([], None, None, None))) == 3
    assert "tevkifatlı alış faturası yok" in T.kdv2_html([], None, None, ["YOK/2026/09"])


def test_tarayicida_firma_secimi(tmp_path, monkeypatch):
    """Toplu kontrol › KDV2 Raporu › PDF'e aktar: firma listesi, Tümünü seç / Hiçbirini seçme (seçim yoksa düğme pasif);
    3 firmadan 2'si seçilince programa giden PDF'te 2 firma."""
    import json
    import os
    import pytest
    from test_fis_ve_tumu import _sunucu
    pw = pytest.importorskip("playwright.sync_api")
    monkeypatch.setattr(T, "kdv2_raporu", _rapor)
    srv, adres = _sunucu(tmp_path / "veri")
    from fatura_kontrol import depo
    k = depo.toplu_kok() / "2026-09"; k.mkdir(parents=True, exist_ok=True)
    (k / "ozet.json").write_text(json.dumps({"bas": "2026-09-01", "bit": "2026-09-30", "sonuclar": []}), encoding="utf-8")
    p = pw.sync_playwright().start()
    try:
        b = p.chromium.launch(executable_path=os.environ.get("PW_CHROMIUM") or None)
    except Exception as e:
        p.stop(); srv.should_exit = True; pytest.skip(f"Chromium yok: {e}")
    try:
        pg = b.new_page(viewport={"width": 1366, "height": 800}); hatalar = []; pg.on("pageerror", lambda e: hatalar.append(str(e)))
        pg.goto(f"{adres}/api/saglik")
        # MuhaWin taklidi: toplu sayfası çerçevede, program htmlPdf mesajını yakalar
        pg.evaluate("""a => { window.__pdf = []; addEventListener('message', e => { if (e.data && e.data.fk && e.data.tip === 'htmlPdf') window.__pdf.push(e.data); });
          document.body.innerHTML = '<iframe id=f style="width:1360px;height:790px" src="' + a + '"></iframe>'; }""", f"{adres}/toplu")
        fr = None
        for _ in range(100):
            fr = next((f for f in pg.frames if f.url.endswith("/toplu")), None)
            if fr: break
            pg.wait_for_timeout(100)
        fr.wait_for_load_state()
        fr.evaluate("calismaGoster({klasor: '2026-09', ay: '2026-09', sonuclar: []}); sekme('kdv2')")
        fr.wait_for_selector("#kdv2Icerik .kdv2-firma")
        fr.click("#kdv2Pdf"); fr.wait_for_selector("#kdv2PdfPen[open]")
        assert fr.eval_on_selector_all("#kdv2Liste input", "L => L.map(x => x.checked)") == [True, True, True]
        fr.click("#kdv2Hic"); assert fr.is_disabled("#kdv2PdfOlustur") and "0 / 3" in fr.inner_text("#kdv2Say")
        fr.click("#kdv2Tumu"); assert not fr.is_disabled("#kdv2PdfOlustur")
        fr.click("#kdv2Liste label:nth-child(2) input")                  # B FİRMA çıkarıldı
        fr.click("#kdv2PdfOlustur")
        pg.wait_for_function("window.__pdf.length === 1", timeout=10000)
        m = pg.evaluate("window.__pdf[0]")
        assert m["yatay"] is True and m["ad"].startswith("KDV2_Raporu_2026-09")
        assert re.findall(r'<section class=firma data-rapor="([^"]+)"', m["html"]) == ["A/2026/09", "C/2026/09"]
        assert not fr.is_visible("#kdv2PdfPen")
        assert not hatalar, hatalar
    finally:
        srv.should_exit = True
        b.close(); p.stop()
