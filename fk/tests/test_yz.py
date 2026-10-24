"""Görev 43 Faz 4: yapay zekâya gönderilecek verinin hazırlanması ve maskelenmesi; öneri önbelleği. Dışarıya istek yok."""
import io
import json
import sys
import zipfile
from pathlib import Path

import pytest

from fatura_kontrol import yz

sys.path.insert(0, str(Path(__file__).parent))


def test_maskele():
    m = yz.maskele("IBAN TR33 0006 1005 1978 6457 8413 26 · ali@ornek.com · TC 12345678901 · VKN 1234567890 · tel 0532 123 45 67")
    assert "TR33" not in m and "ali@" not in m and "12345678901" not in m and "1234567890" not in m and "0532" not in m
    assert m.count("[numara]") >= 3 and "[IBAN]" in m and "[e-posta]" in m
    assert yz.maskele("Tutar 1.234,56 TL · 15.09.2026 · Fatura 143") == "Tutar 1.234,56 TL · 15.09.2026 · Fatura 143"


@pytest.mark.parametrize("unvan, vkn, kisi", [
    ("AHMET YILMAZ", "12345678901", True), ("AHMET YILMAZ", "", True), ("Av. Ayşe Kaya", "1234567890", True),
    ("ENERJİSA ELEKTRİK PERAKENDE SATIŞ A.Ş.", "1234567890", False), ("ÖRNEK GIDA LTD ŞTİ", "1234567890", False),
    ("antalya büyükşehir belediyesi", "", False), ("YILMAZ İNŞAAT TİCARET", "", False)])
def test_gercek_kisi(unvan, vkn, kisi):
    assert yz.gercek_kisi_mi(unvan, vkn) is kisi
    assert (yz.unvan_maskele(unvan, vkn) == "[gerçek kişi]") is kisi


def _oge(**k):
    x = {"anahtar": "a1", "belge_no": "AAA2026000000001", "tarih": "2026-09-05", "yon": "ALIS", "karsi_taraf": "MEHMET DEMİR",
         "vkn": "12345678901", "matrah": 1000, "kdv": 200, "toplam": 1200, "kayitli": True,
         "kalemler": ["Danışmanlık hizmeti", "IBAN TR33 0006 1005 1978 6457 8413 26 hesabına"],
         "hesaplar": [{"kod": "770.01", "ad": "Genel Yönetim", "tutar": 1000}], "cari": {"kod": "320.01.005", "ad": "MEHMET DEMİR"},
         "gecmis": {"aylar": 2, "hesaplar": ["760.01"], "min": 900, "max": 1100, "aciklama": "Önceki aylarda 760.01; bu ay 770.01"}}
    x.update(k)
    return x


def test_fatura_istegi_kisisel_veri_gondermez():
    fis = [{"hesap": "770.01", "hesap_adi": "Genel Yönetim", "borc": 1000, "alacak": 0, "aciklama": "MEHMET DEMİR 12345678901"},
           {"hesap": "320.01.005", "hesap_adi": "MEHMET DEMİR", "borc": 0, "alacak": 1200}]
    i = yz.fatura_istegi(_oge(), fis)
    metin = json.dumps(i, ensure_ascii=False)
    assert "MEHMET" not in metin and "DEMİR" not in metin and "12345678901" not in metin and "TR33" not in metin
    assert "aciklama" not in json.dumps(i["bu_ay_kayit"]["fis_satirlari"])       # fiş açıklaması hiç gönderilmez
    assert i["fatura"]["karsi_taraf"] == "[gerçek kişi]" and i["bu_ay_kayit"]["cari"]["ad"] == "[cari hesap]"
    assert i["fatura"]["kalemler"][0] == "Danışmanlık hizmeti" and "[IBAN]" in i["fatura"]["kalemler"][1]
    assert i["gecmis"]["hesaplar"] == ["760.01"] and "belge_no" not in metin and "AAA2026000000001" not in metin
    t = yz.fatura_istegi(_oge(karsi_taraf="ENERJİSA ELEKTRİK A.Ş.", vkn="1234567890", cari={"kod": "320.01", "ad": "ENERJİSA ELEKTRİK A.Ş."}), [])
    assert t["fatura"]["karsi_taraf"] == "ENERJİSA ELEKTRİK A.Ş." and "1234567890" not in json.dumps(t)


def test_firma_baglami_cari_ve_personel_yok():
    from fatura_kontrol.muavin_okuyucu import MuavinSatiri
    from datetime import date
    from decimal import Decimal as D
    m = lambda k, a: MuavinSatiri("m", 1, k, a, date(2026, 9, 1), "", "1", "", D(1), D(0), None, None, "")
    b = yz.firma_baglami([m("770.01", "Genel Yönetim"), m("320.01.005", "MEHMET DEMİR"), m("120.01", "ALİ VELİ"),
                          m("335.01", "Personele Borçlar AYŞE"), m("600.01", "Yurtiçi Satışlar"), m("191.01", "İndirilecek KDV")])
    assert "770.01\tGenel Yönetim" in b and "600.01" in b and "191.01" in b
    assert "MEHMET" not in b and "ALİ" not in b and "AYŞE" not in b
    assert b == yz.firma_baglami(list(reversed([m("770.01", "Genel Yönetim"), m("600.01", "Yurtiçi Satışlar"), m("191.01", "İndirilecek KDV")])))


def test_sonuc_dogrula(tmp_path):
    with pytest.raises(ValueError):
        yz.sonuc_dogrula({"karar": "belki"})
    s = yz.sonuc_yaz(tmp_path, "a1", "oz", {"karar": "supheli", "guven": 1.7, "gerekce": "x" * 900, "onerilen_hesap": "760.01"}, "claude-opus-5-5")
    assert s["sonuc"]["guven"] == 1.0 and len(s["sonuc"]["gerekce"]) == 600 and yz.onbellek(tmp_path)["a1"]["ozet"] == "oz"


@pytest.fixture
def c(tmp_path, monkeypatch):
    monkeypatch.setenv("FK_VERI", str(tmp_path / "veri"))
    from fastapi.testclient import TestClient
    from fatura_kontrol.web import app as A
    return TestClient(A.app)


def test_api_kapali(c, tmp_path):
    """Görev 49: özellik kapalı (yz.ETKIN = False): uçlar 404, detay listesine öneri eklenmez."""
    from fatura_kontrol import yz
    assert yz.ETKIN is False
    rid = _denetim(c, tmp_path)
    assert c.get("/api/denetim/yz/bekleyen", params={"id": rid, "tur": "gider"}).status_code == 404
    d = c.get("/api/denetim/detay", params={"id": rid}).json()
    anahtar = d["gider"][0]["anahtar"]
    assert c.get("/api/denetim/yz/istek", params={"id": rid, "anahtar": anahtar}).status_code == 404
    assert c.post("/api/denetim/yz/sonuc", json={"id": rid, "anahtar": anahtar, "ozet": "x", "model": "m",
                                                 "sonuc": {"karar": "uygun", "guven": 1}}).status_code == 404
    assert "yz" not in d["gider"][0]


def _denetim(c, tmp_path):
    from test_denetim import _mikro
    from test_luca_otomasyon import ubl, FIRMA_VKN
    zb = io.BytesIO()
    with zipfile.ZipFile(zb, "w") as z:
        z.writestr("a.xml", ubl("AAA2026000000001", "2026-09-05", "1", FIRMA_VKN, "1000.00", "200.00", 20))
        z.writestr("b.xml", ubl("EX02026000000001", "2026-09-10", FIRMA_VKN, "9", "2000.00", "400.00", 20))
    y = tmp_path / "m.xlsx"; _mikro(y)
    return c.post("/api/denetim", data={"bas": "2026-09-01", "bit": "2026-09-30", "firma_ad": "YZ A.Ş."},
                  files=[("faturalar", ("p.zip", zb.getvalue(), "application/zip")), ("muavinler", ("m.xlsx", y.read_bytes(), "application/octet-stream"))]).json()["rapor_id"]


def test_api(c, tmp_path, monkeypatch):
    """Açıldığında (ileride) çalışacak yol: bayrak testte açılır."""
    from fatura_kontrol import yz
    monkeypatch.setattr(yz, "ETKIN", True)
    from test_luca_otomasyon import FIRMA_VKN
    rid = _denetim(c, tmp_path)
    b = c.get("/api/denetim/yz/bekleyen", params={"id": rid, "tur": "gider"}).json()
    assert b["adet"] == 1 and b["token"]["baglam"] > 0 and b["token"]["istek"] > 0
    i = c.get("/api/denetim/yz/istek", params={"id": rid, "anahtar": b["anahtarlar"][0]}).json()
    metin = json.dumps(i, ensure_ascii=False)
    assert FIRMA_VKN not in metin and "AAA2026000000001" not in metin and "320.01" in metin
    assert [h["kod"] for h in i["istek"]["bu_ay_kayit"]["hesaplar"]] == ["770.01"] and len(i["istek"]["bu_ay_kayit"]["fis_satirlari"]) == 3
    assert c.post("/api/denetim/yz/sonuc", json={"id": rid, "anahtar": i["anahtar"], "ozet": i["ozet"], "model": "m",
                                                 "sonuc": {"karar": "hayir"}}).status_code == 400
    r = c.post("/api/denetim/yz/sonuc", json={"id": rid, "anahtar": i["anahtar"], "ozet": i["ozet"], "model": "claude-opus-5-5",
                                              "sonuc": {"karar": "uygun", "guven": 0.9, "gerekce": "Gider hesabı uygun", "onerilen_hesap": "770.01"}})
    assert r.status_code == 200
    assert c.get("/api/denetim/yz/bekleyen", params={"id": rid, "tur": "gider"}).json()["adet"] == 0      # aynı veri yeniden sorulmaz
    d = c.get("/api/denetim/detay", params={"id": rid}).json()
    assert d["gider"][0]["yz"]["sonuc"]["karar"] == "uygun" and d["gider"][0]["durum"] == "bekliyor"      # öneri karar değildir


def test_tarayicida_oneri_kapali(tmp_path):
    """Görev 49: MuhaWin içinde (üst sayfa programı taklit eder; yapay zekâ "açık" yanıtı verse bile) listede toplu sorma,
    rozet, kontrol ekranında öneri bölümü görünmez ve programa hiçbir yapay zekâ mesajı gitmez."""
    import os
    from test_fis_ve_tumu import _sunucu
    from test_denetim import _mikro
    from test_luca_otomasyon import ubl, FIRMA_VKN
    pw = pytest.importorskip("playwright.sync_api")
    p = pw.sync_playwright().start()
    try:
        b = p.chromium.launch(executable_path=os.environ.get("PW_CHROMIUM") or None)
    except Exception as e:
        p.stop(); pytest.skip(f"Chromium yok: {e}")
    z = tmp_path / "f.zip"
    with zipfile.ZipFile(z, "w") as zz:
        zz.writestr("a.xml", ubl("AAA2026000000001", "2026-09-05", "1", FIRMA_VKN, "1000.00", "200.00", 20))
        zz.writestr("b.xml", ubl("EX02026000000001", "2026-09-10", FIRMA_VKN, "9", "2000.00", "400.00", 20))
    m = tmp_path / "m.xlsx"; _mikro(m)
    srv, adres = _sunucu(tmp_path / "veri")
    try:
        ctx = b.new_context(user_agent="Mozilla/5.0 Electron/31.7.7", viewport={"width": 1400, "height": 900})
        pg = ctx.new_page(); hatalar = []; pg.on("pageerror", lambda e: hatalar.append(str(e)))
        diyaloglar = []; pg.on("dialog", lambda d: (diyaloglar.append(d.message), d.accept()))
        pg.goto(f"{adres}/api/saglik")
        pg.evaluate("""a => { window.__istekler = []; window.__tipler = [];
          addEventListener('message', e => { const d = e.data, w = e.source; if (!d || !d.fk) return; window.__tipler.push(d.tip);
            if (d.tip === 'yzDurum') w.postMessage({muhawin: true, tip: 'yzDurum', durum: {acik: true, model: 'kalite', ciktiTahmin: 900,
              modeller: {kalite: {ad: 'Claude Opus 5.5 (kalite)', id: 'claude-opus-5-5', girdi: 4, cikti: 20, onbellek: 0.2, yazma: 5}}}}, '*');
            if (d.tip === 'yzDegerlendir') { window.__istekler.push(d.baglam + d.istek);
              w.postMessage({muhawin: true, tip: 'yzSonuc', no: d.no, model: 'claude-opus-5-5', maliyet: 0.012,
                sonuc: {karar: 'supheli', guven: 0.62, gerekce: 'Deneme gerekçesi: hesap kontrol edilmeli.', onerilen_hesap: '760.01'}}, '*'); }
            if (d.tip === 'yzGoster') w.postMessage({muhawin: true, tip: 'yzGosterim', no: d.no, gosterim: {sistem: 'TALİMAT', baglam: d.baglam, istek: d.istek}}, '*');
          });
          document.body.innerHTML = '<iframe id=f style="width:1380px;height:880px" src="' + a + '"></iframe>'; }""", f"{adres}/denetim")
        fr = None
        for _ in range(100):
            fr = next((f for f in pg.frames if f.url.endswith("/denetim")), None)
            if fr:
                break
            pg.wait_for_timeout(100)
        fr.wait_for_function("document.querySelectorAll('#program option').length === 3")
        fr.fill("#bas", "2026-09-01"); fr.fill("#bit", "2026-09-30")
        fr.set_input_files("#xml", str(z)); fr.set_input_files("#muavin", str(m))
        fr.click("#basla")
        fr.wait_for_selector("#nGider .rozet", timeout=30000)
        fr.click("#nav [data-g=gider]")
        fr.wait_for_selector("#kBasla", timeout=10000)
        assert not fr.query_selector("#yzToplu") and not fr.query_selector("#yzAyar") and "Yapay zekâ" not in fr.inner_text("#icerik")
        fr.click("#kBasla")
        fr.wait_for_selector("#kontrolPen.acik #kUygun", timeout=10000)
        assert not fr.query_selector(".yzk") and "Yapay zekâ" not in fr.inner_text("#kontrolPen")
        fr.click("#kSira"); pg.keyboard.press("a")                 # Görev 49: A = uygun
        fr.wait_for_selector("#kontrolPen.acik", state="detached", timeout=10000)
        assert pg.evaluate("window.__tipler.filter(t => /^yz/.test(t))") == []
        assert not hatalar, hatalar
        ctx.close()
    finally:
        srv.should_exit = True
        b.close(); p.stop()
