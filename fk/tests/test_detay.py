"""Görev 43 Faz 2: Detay denetim (gider / gelir kontrolü), geçmişle uyum, kontrol kuralları, kararlar, rapor."""
import io
import sys
import zipfile
from datetime import date
from decimal import Decimal as D
from pathlib import Path

import pytest

from fatura_kontrol import detay
from fatura_kontrol import eslestirme as E
from tests.test_eslestirme import fatura, satir

sys.path.insert(0, str(Path(__file__).parent))


def fs(hesap, adi, borc="0", alacak="0", no="ABC2026000000001", fis_no="9", fis=date(2026, 9, 30), unvan="ÖRNEK GIDA LTD ŞTİ"):
    s = satir(no=no, hesap=hesap, adi=adi, tutar="0", unvan=unvan, fis_no=fis_no, fis=fis, belge_t=fis)
    s.borc, s.alacak = D(borc), D(alacak)
    return s


def fis(no, t, gider_hesap, tutar, belge):
    return [fs(gider_hesap, "Elektrik Gideri", borc=str(tutar), no=belge, fis_no=no, fis=t),
            fs("320.01.01.005", "ELEKTRİK AŞ", alacak=str(tutar * D("1.2")), no=belge, fis_no=no, fis=t)]


def bu_ay(gider="770.01.01.001", tutar="1000"):
    return [fs("191.01", "İndirilecek KDV %20", borc="200"), fs(gider, "Elektrik Gideri", borc=tutar),
            fs("320.01.01.005", "ELEKTRİK AŞ", alacak=str(D(tutar) + 200))]


def hazirla(muavin):
    f = fatura()
    r = E.esle([f], muavin, donem=(date(2026, 9, 1), date(2026, 9, 30)), kontrol_listesi=E.DENETIM_KONTROLLER)
    return detay.hazirla(r, [f], muavin, date(2026, 9, 1), date(2026, 9, 30))["gider"][0]


def test_gecmisle_uyumlu():
    m = fis("7", date(2026, 7, 15), "770.01.01.001", D(900), "ABC2026000000007") + \
        fis("8", date(2026, 8, 15), "770.01.01.001", D(1100), "ABC2026000000008") + bu_ay()
    x = hazirla(m)
    assert x["hesaplar"] == [{"kod": "770.01.01.001", "ad": "Elektrik Gideri", "tutar": 1000.0}]
    assert x["cari"]["kod"] == "320.01.01.005" and x["fisler"] == [{"no": "9", "tarih": "2026-09-30"}]
    assert x["gecmis"]["uyumlu"] and x["gecmis"]["aylar"] == 2, x["gecmis"]
    d = detay.uygula({"gider": [x]}, [], {})
    assert d["gider"][0]["durum"] == "gecmis" and d["ozet"]["gider"]["gecmis"] == 1


@pytest.mark.parametrize("gecmis, buay, neden", [
    ([("7", 7, "770.01.01.001", 900)], {}, "yalnız 1 ay"),
    ([("7", 7, "770.01.01.001", 900), ("8", 8, "760.01.01.001", 900)], {}, "farklı hesaplara"),
    ([("7", 7, "770.01.01.001", 900), ("8", 8, "770.01.01.001", 900)], {"gider": "760.01.01.001"}, "bu ay 760"),
    ([("7", 7, "770.01.01.001", 900), ("8", 8, "770.01.01.001", 900)], {"tutar": "3000"}, "aralığının dışında"),
])
def test_gecmisle_uyumsuz(gecmis, buay, neden):
    m = [s for no, ay, h, t in gecmis for s in fis(no, date(2026, ay, 15), h, D(t), f"ABC20260000000{no}{ay:02d}")] + bu_ay(**buay)
    x = hazirla(m)
    assert not x["gecmis"]["uyumlu"] and neden in x["gecmis"]["aciklama"], x["gecmis"]
    assert detay.uygula({"gider": [x]}, [], {})["gider"][0]["durum"] == "bekliyor"


def test_kural_ve_karar(tmp_path):
    x = hazirla(bu_ay())
    assert detay.uygula({"gider": [x]}, [], {})["gider"][0]["durum"] == "bekliyor"
    firma = tmp_path / "F"
    with pytest.raises(ValueError):
        detay.kural_ekle(firma, {"yon": "ALIS", "hesap": "770"})              # VKN / ünvan yok
    L = detay.kural_ekle(firma, {"yon": "ALIS", "vkn": x["vkn"], "hesap": "770", "aciklama": "elektrik"})
    d = detay.uygula({"gider": [x]}, L, {})["gider"][0]
    assert d["durum"] == "kural" and "770" in d["neden"] and "elektrik" in d["neden"]
    L2 = detay.kural_ekle(firma, {"yon": "ALIS", "unvan": "örnek gıda", "hesap": "760"})
    assert detay.uygula({"gider": [x]}, L2[1:], {})["gider"][0]["durum"] == "bekliyor"     # kural 760 bekliyor, kayıt 770
    K = detay.karar_yaz(firma, x["anahtar"], "uygun_degil", "yanlış hesap")
    d = detay.uygula({"gider": [x]}, L2, K)["gider"][0]
    assert d["durum"] == "uygun_degil" and d["neden"] == "yanlış hesap"                # karar kuraldan önce
    assert detay.kararlar(firma)[x["anahtar"]]["karar"] == "uygun_degil"
    assert detay.karar_yaz(firma, x["anahtar"], "") == {}
    assert [k["id"] for k in detay.kural_sil(firma, 1)] == [2]


def test_toplu_fis_baska_faturalar_karismaz():
    m = bu_ay() + [fs("770.02", "Kırtasiye", borc="50", no="XYZ2026000000099"), fs("320.01.01.009", "KIRTASİYE", alacak="60", no="XYZ2026000000099")]
    x = hazirla(m)
    assert [h["kod"] for h in x["hesaplar"]] == ["770.01.01.001"] and x["cari"]["kod"] == "320.01.01.005"


def ms(hesap, adi, borc="0", alacak="0", acik="", fis_no="9", fis=date(2026, 9, 30)):
    from fatura_kontrol.muavin_okuyucu import MuavinSatiri, aciklama_ayristir
    bt, bn, u = aciklama_ayristir(acik)
    return MuavinSatiri("m.xlsx", 1, hesap, adi, fis, "Mahsup", fis_no, acik, D(borc), D(alacak), bt, bn, u)


def _fis_numarasiz(acik, fis_no="9"):
    return [ms("191.01", "İndirilecek KDV %20", borc="200", acik=acik, fis_no=fis_no), ms("770.01.01.001", "Elektrik Gideri", borc="1000", acik=acik, fis_no=fis_no),
            ms("320.01.01.005", "ÖRNEK GIDA LTD ŞTİ", alacak="1200", acik=acik, fis_no=fis_no)]


@pytest.mark.parametrize("acik, nasil", [
    ("ELEKTRIK FATURASI 2026000000001 ÖRNEK GIDA", "numara farklı yazılmış"),       # seri ön eki yok
    ("ÖRNEK GIDA EYLÜL ELEKTRİK", "karşı taraf ve ödenecek tutar"),                 # numara hiç yok: cari + tutar + ay
])
def test_yedek_eslesme_muavinde_kayitli(acik, nasil):
    """Görev 49: belge no ile bulunamayan ama muavinde kayıtlı fatura "kayıtlı değil" sayılmaz; fişi ve hesabı bulunur."""
    x = hazirla(_fis_numarasiz(acik))
    assert x["kayitli"] and nasil in x["eslesme"], x
    assert [h["kod"] for h in x["hesaplar"]] == ["770.01.01.001"] and x["fisler"] == [{"no": "9", "tarih": "2026-09-30"}]
    assert detay.uygula({"gider": [x]}, [], {})["gider"][0]["neden"] != "Fatura muavinde bulunamadı (belge no, cari / tutar / tarih ile)"


def test_yedek_eslesme_baska_cari_ya_da_tutar_tutmazsa_bulunmaz():
    m = [ms("320.01.01.007", "BAŞKA TİCARET LTD", alacak="1200", acik="BAŞKA TİCARET EYLÜL"), ms("770.01", "Gider", borc="1200", acik="BAŞKA TİCARET EYLÜL")]
    m += [ms("320.01.01.005", "ÖRNEK GIDA LTD ŞTİ", alacak="999", acik="ÖRNEK GIDA", fis_no="10")]
    x = hazirla(m)
    assert not x["kayitli"] and x["eslesme"] == "" and x["kayit_satirlari"] == []
    assert detay.uygula({"gider": [x]}, [], {})["gider"][0]["neden"].startswith("Fatura muavinde bulunamadı")


def test_fis_no_olmayan_muavin():
    """Muavinde fiş no yoksa: aynı gün ve açıklamalı satırlardan kayıt bulunur, satırlar kontrol ekranına gelir."""
    x = hazirla(_fis_numarasiz("02/09/2026-ABC2026000000001-ÖRNEK GIDA LTD ŞTİ", fis_no=""))
    assert x["kayitli"] and x["fisler"] == [] and [h["kod"] for h in x["hesaplar"]] == ["770.01.01.001"]
    assert {s["hesap"] for s in x["kayit_satirlari"]} == {"191.01", "770.01.01.001", "320.01.01.005"}


def test_toplu_fiste_numarasiz_gider_satiri():
    """Toplu fiş: gider satırında belge no yok; faturanın matrahını tutan / karşı tarafı yazan satır bu faturanındır."""
    m = [fs("191.01", "İndirilecek KDV %20", borc="200"), fs("320.01.01.005", "ELEKTRİK AŞ", alacak="1200"),
         ms("770.01.01.001", "Elektrik Gideri", borc="1000", acik="EYLÜL GİDERLERİ"),
         fs("191.01", "İndirilecek KDV %20", borc="10", no="XYZ2026000000099"), fs("320.01.01.009", "KIRTASİYE", alacak="60", no="XYZ2026000000099"),
         ms("770.02", "Kırtasiye", borc="50", acik="EYLÜL GİDERLERİ")]
    x = hazirla(m)
    assert [h["kod"] for h in x["hesaplar"]] == ["770.01.01.001"], x["hesaplar"]


def test_kural_cok_sartli_ve_uygun_degil(tmp_path):
    """Görev 49: Kural yap gibi çok şartlı (VE) kural; şartın içinde | ve +; matrah aralığı; sonuç uygun / uygun değil."""
    x = hazirla(bu_ay())                                      # matrah 1000, kayıt 770.01.01.001, ÖRNEK GIDA LTD ŞTİ
    firma = tmp_path / "F"
    with pytest.raises(ValueError):
        detay.kural_ekle(firma, {"yon": "ALIS", "sartlar": [{"alan": "tutar", "deger": "-"}]})
    with pytest.raises(ValueError):
        detay.kural_ekle(firma, {"yon": "ALIS", "sartlar": [{"alan": "hesap", "deger": "abc"}]})
    L = detay.kural_ekle(firma, {"yon": "*", "sartlar": [{"alan": "unvan", "deger": "elektrik | örnek + gıda"},
                                                         {"alan": "tutar", "deger": "500-1.500"}, {"alan": "hesap", "deger": "770"}],
                                 "sonuc": "uygun", "aciklama": "elektrik"})
    d = detay.uygula({"gider": [x]}, L, {})["gider"][0]
    assert d["durum"] == "kural" and "Matrah aralığı" in d["neden"] and "elektrik" in d["neden"], d["neden"]
    assert detay.uygula({"gider": [{**x, "matrah": 2000.0}]}, L, {})["gider"][0]["durum"] == "bekliyor"      # aralık dışı
    y = detay.uygula({"gider": [{**x, "hesaplar": [{"kod": "760.01", "ad": "", "tutar": 1000.0}]}]}, L, {})["gider"][0]
    assert y["durum"] == "bekliyor" and "Kural 1 770 bekliyor" in y["neden"]                                 # yalnız hesap tutmadı
    L = detay.kural_ekle(firma, {"yon": "ALIS", "sartlar": [{"alan": "unvan", "deger": "örnek gıda"}, {"alan": "icerik", "deger": "elektrik"},
                                                            {"alan": "vkn", "deger": x["vkn"]}, {"alan": "hesap", "deger": "770"}], "sonuc": "uygun_degil"})
    d = detay.uygula({"gider": [{**x, "kalemler": ["Elektrik tüketim bedeli"]}]}, L, {})["gider"][0]
    assert d["durum"] == "uygun_degil" and d["neden"].startswith("Kural 2") and "uygun değil" in d["neden"]   # daha çok şartlı önce
    K = detay.karar_yaz(firma, x["anahtar"], "uygun", "baktım")
    assert detay.uygula({"gider": [{**x, "kalemler": ["Elektrik"]}]}, L, K)["gider"][0]["durum"] == "uygun"     # karar kuraldan önce


def test_eski_kural_gecerli(tmp_path):
    """Eski biçimde (Görev 43) kaydedilmiş kural aynen çalışır ve yeni biçimde metniyle gösterilir."""
    x = hazirla(bu_ay())
    eski = [{"id": 1, "yon": "ALIS", "vkn": x["vkn"], "unvan": "", "hesap": "770", "aciklama": "elektrik", "zaman": "2026-09-01T10:00"}]
    d = detay.uygula({"gider": [x]}, eski, {})["gider"][0]
    assert d["durum"] == "kural" and detay.kural_metni(eski[0]) == f"VKN/TCKN eşittir “{x['vkn']}” VE Kayıt hesabı ile başlar “770”"
    assert detay.uygula({"gider": [x]}, [{**eski[0], "hesap": "760"}], {})["gider"][0]["neden"].startswith("Kural 1 760 bekliyor")


@pytest.fixture
def c(tmp_path, monkeypatch):
    monkeypatch.setenv("FK_VERI", str(tmp_path / "veri"))
    from fastapi.testclient import TestClient
    from fatura_kontrol.web import app as A
    return TestClient(A.app)


def test_api_detay_karar_kural_rapor(c, tmp_path):
    from test_denetim import _mikro
    from test_luca_otomasyon import ubl, FIRMA_VKN
    zb = io.BytesIO()
    with zipfile.ZipFile(zb, "w") as z:
        z.writestr("a.xml", ubl("AAA2026000000001", "2026-09-05", "1", FIRMA_VKN, "1000.00", "200.00", 20))
        z.writestr("b.xml", ubl("EX02026000000001", "2026-09-10", FIRMA_VKN, "9", "2000.00", "400.00", 20))
    y = tmp_path / "m.xlsx"; _mikro(y, satis_matrah=1900)
    r = c.post("/api/denetim", data={"bas": "2026-09-01", "bit": "2026-09-30", "firma_ad": "DETAY A.Ş."},
               files=[("faturalar", ("p.zip", zb.getvalue(), "application/zip")), ("muavinler", ("m.xlsx", y.read_bytes(), "application/octet-stream"))])
    assert r.status_code == 200, r.text
    rid = r.json()["rapor_id"]
    d = c.get("/api/denetim/detay", params={"id": rid}).json()
    g, s = d["gider"][0], d["gelir"][0]
    assert g["belge_no"] == "AAA2026000000001" and [h["kod"] for h in g["hesaplar"]] == ["770.01"] and g["durum"] == "bekliyor"
    assert s["belge_no"] == "EX02026000000001" and s["hesaplar"][0]["tutar"] == 1900 and s["cari"]["kod"] == "120.01"
    assert c.post("/api/denetim/detay/karar", json={"id": rid, "anahtar": g["anahtar"], "karar": "uygun"}).status_code == 200
    assert c.post("/api/denetim/detay/karar", json={"id": rid, "anahtar": "yok", "karar": "uygun"}).status_code == 404
    assert c.post("/api/denetim/detay/karar", json={"id": rid, "anahtar": g["anahtar"], "karar": "belki"}).status_code == 400
    assert c.post("/api/denetim/detay/kural", json={"id": rid, "yon": "SATIS", "vkn": s["vkn"], "hesap": "600", "aciklama": "satış"}).status_code == 200
    assert c.post("/api/denetim/detay/kural", json={"id": rid, "yon": "SATIS", "hesap": "600"}).status_code == 400
    d = c.get("/api/denetim/detay", params={"id": rid}).json()
    assert d["gider"][0]["durum"] == "uygun" and d["gelir"][0]["durum"] == "kural" and len(d["kurallar"]) == 1
    assert d["ozet"]["gider"]["uygun"] == 1 and d["ozet"]["gelir"]["kural"] == 1
    h = c.get("/api/denetim/detay/rapor", params={"id": rid}).text
    assert "DETAY A" in h and "KDV kontrolü" in h and "Matrah kontrolü" in h and "Gider kontrolü" in h and "Hazırlayan" in h
    assert "EX02026000000001" in h                              # matrah farkı (1.900 ≠ 2.000) raporda
    # kararlar ve kurallar firmada: yeniden denetimde de geçerli
    assert c.post("/api/denetim/yerel", json={"firma_ad": "DETAY A.Ş.", "ay": "2026-09", "bas": "2026-09-01", "bit": "2026-09-30"}).status_code == 200
    d = c.get("/api/denetim/detay", params={"id": rid}).json()
    assert d["gider"][0]["durum"] == "uygun" and d["gelir"][0]["durum"] == "kural"
    assert c.post("/api/denetim/detay/kural", json={"id": rid, "sil": 1}).json()["kurallar"] == []


def test_tarayicida_kontrol_ekrani(tmp_path):
    """Gider kontrolü → kontrol ekranı (solda kayıt + fiş, sağda genişliğe sığan fatura), Esc ile listeye dönüş, A ile karar;
    gelirde "Kural yap" gibi kural penceresi (şartlar faturadan, + Şart ekle); kurallar sekmesi; rapor."""
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
        pg = b.new_page(viewport={"width": 1400, "height": 900}); hatalar = []; pg.on("pageerror", lambda e: hatalar.append(str(e)))
        pg.goto(f"{adres}/denetim")
        pg.wait_for_function("document.querySelectorAll('#program option').length === 3")
        pg.fill("#bas", "2026-09-01"); pg.fill("#bit", "2026-09-30")
        pg.set_input_files("#xml", str(z)); pg.set_input_files("#muavin", str(m))
        pg.click("#basla")
        pg.wait_for_selector("#nGider .rozet", timeout=30000)
        assert "1 açık" in pg.inner_text("#nGider") and "1 açık" in pg.inner_text("#nGelir")
        pg.click("#nav [data-g=gider]")
        assert "AAA2026000000001" in pg.inner_text("#icerik") and "770.01" in pg.inner_text("#icerik")
        pg.click("#kBasla")
        pg.wait_for_selector("#kontrolPen.acik #kFis table", timeout=15000)
        assert "770.01" in pg.inner_text("#kFis") and "1 / 1" in pg.inner_text("#kSira")
        pg.wait_for_function("document.querySelector('#kFatura').srcdoc.includes('AAA2026000000001')", timeout=15000)
        assert pg.get_attribute("#kFatura", "sandbox") == "allow-same-origin"          # betik çalışmaz; yalnız ölçmek için
        # Görev 49: fatura genişliğe sığar (yatay kaydırma yok); + / Sığdır
        pg.wait_for_function("document.querySelector('#kzOran').textContent.includes('sığdırıldı')", timeout=10000)
        sig = pg.evaluate("""() => { const f = document.querySelector('#kFatura'), h = f.contentDocument.documentElement;
          return {w: h.scrollWidth * (parseFloat(h.style.zoom) || 1), c: f.clientWidth, x: getComputedStyle(h).overflowX}; }""")
        assert sig["w"] <= sig["c"] + 2 and sig["x"] == "hidden", sig
        pg.click("#kzArti"); assert "sığdırıldı" not in pg.inner_text("#kzOran")
        pg.click("#kzSigdir"); assert "sığdırıldı" in pg.inner_text("#kzOran")
        assert "A" in pg.inner_text("#kUygun") and "S" in pg.inner_text("#kDegil") and not pg.query_selector(".yzk")
        # Esc / Kapat: geldiği listeye (Gider kontrolü, kontrol bekleyen) döner; MuhaWin'e "geri" gitmez
        pg.keyboard.press("Escape")
        pg.wait_for_selector("#kontrolPen.acik", state="detached", timeout=5000)
        assert pg.get_attribute("#nav [data-g=gider]", "aria-pressed") == "true" and pg.is_visible("#icerik #kBasla")
        assert "← Özet" in pg.inner_text("#icerik .konum")
        pg.click("#kBasla"); pg.wait_for_selector("#kontrolPen.acik #kFis table", timeout=15000)
        pg.fill("#kNot", "elektrik faturası, doğru hesap")
        pg.keyboard.press("Escape")                                # kutudayken Esc yalnız kutudan çıkar (Görev 47)
        assert pg.is_visible("#kontrolPen.acik")
        pg.keyboard.press("a")                                     # Görev 49: A = uygun
        pg.wait_for_selector("#kontrolPen.acik", state="detached", timeout=15000)   # tek bekleyen vardı: ekran kapandı
        pg.wait_for_function("document.querySelector('#nGider').textContent.includes('tamam')")
        pg.click("#icerik [data-dfiltre=uygun]")
        assert "elektrik faturası" in pg.inner_text("#icerik")
        # gelir: kontrol ekranından kural (Kural yap penceresi gibi: şartlar faturadan dolar, + Şart ekle, sonuç)
        pg.click("#nav [data-g=gelir]"); pg.click("#kBasla")
        pg.wait_for_selector("#kontrolPen.acik #kKural")
        pg.click("#kKural"); pg.wait_for_selector("#kuralPen.acik")
        sart = lambda: pg.eval_on_selector_all("#kuralPen .ksart", "L => L.map(x => [x.querySelector('select').value, x.querySelector('input').value])")
        assert sart() == [["vkn", "9"], ["hesap", "600.01"]], sart()
        assert "1 fatura bu şartlara uyuyor" in pg.inner_text("#kSay")
        pg.click("#kSartEkle"); assert [a for a, _ in sart()] == ["vkn", "hesap", "icerik"]
        pg.select_option("#kuralPen .ksart:nth-child(3) select", "tutar")
        assert sart()[2][1] == "1.000-3.000", sart()                   # matrah 2.000 → aralık faturadan dolar
        pg.click("#kuralPen .ksart:nth-child(3) [data-ksil]"); assert len(sart()) == 2
        pg.keyboard.press("Escape"); assert not pg.is_visible("#kuralPen")   # Esc yalnız kural penceresini kapatır (odak kutudaysa önce kutudan çıkar)
        assert pg.is_visible("#kontrolPen.acik")
        pg.click("#kKural"); pg.wait_for_selector("#kuralPen.acik")
        pg.fill("#kAcik", "her ay aynı müşteri"); pg.click("#kKaydet")
        pg.wait_for_selector("#kontrolPen.acik", state="detached", timeout=15000)
        pg.click("#nav [data-g=kurallar]")
        assert "600.01" in pg.inner_text("#icerik") and "her ay aynı müşteri" in pg.inner_text("#icerik") and "VKN/TCKN eşittir" in pg.inner_text("#icerik")
        pg.click("#krYeni"); pg.wait_for_selector("#kuralPen.acik")
        assert sart() == [["unvan", ""]]
        pg.click("#kuralPen [data-kx]"); assert not pg.is_visible("#kuralPen")
        pg.click("#nav [data-g=gelir]")
        pg.click("#icerik [data-dfiltre=kural]")
        assert "EX02026000000001" in pg.inner_text("#icerik")
        pg.click("#nav [data-g=rapor]")
        with pg.expect_popup() as pp:
            pg.click("#icerik [data-ac^='/api/denetim/detay/rapor']")
        pp.value.wait_for_load_state()
        icerik = pp.value.content()
        assert "Gider kontrolü" in icerik and "elektrik faturası" in icerik             # uygunlar notlarıyla (details içinde)
        assert "Kurala uygun" in icerik and "Hazırlayan" in icerik
        assert not hatalar, hatalar
    finally:
        srv.should_exit = True
        b.close(); p.stop()
