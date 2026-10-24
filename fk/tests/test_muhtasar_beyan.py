"""Görev 43 Faz 2: Muhtasar ve Prim Hizmet Beyannamesi (1003A) PDF'i ↔ muavin. Sahte PDF (reportlab); kişisel veri saklanmaz."""
import io
import json
import sys
import zipfile
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent))
pytest.importorskip("reportlab")
pytest.importorskip("pypdf")
from muhtasar_ornek import GERCEK, muhtasar_yaz  # noqa: E402
from fatura_kontrol import muhtasar_beyan as MB  # noqa: E402

KISISEL = ["12345678901", "23456789012", "34567890123", "AHMET", "AYŞE", "MEHMET", "KONYAALTI", "MURATPAŞA", "ornek@ornek", "33030"]


@pytest.fixture
def pdf(tmp_path):
    y = tmp_path / "muhtasar.pdf"; muhtasar_yaz(y)
    return y.read_bytes()


def test_beyanname_okunur_calisan_bolumu_ve_kisisel_veri_yok(pdf):
    b = MB.oku(pdf)
    assert (b["form"], b["yil"], b["ay"], b["vkn"]) == ("1003A", 2026, 9, "3810463613")
    assert b["unvan"] == "DENETİM İNŞAAT SANAYİ VE TİCARET LİMİTED ŞİRKETİ" and b["onay"] == "12.10.2026 14:22:05"
    assert {k: (float(x["gayrisafi"]), float(x["vergi"])) for k, x in b["kodlar"].items()} == \
        {"011": (51747, 4123.45), "022": (2500, 500), "041": (10000, 2000), "302": (1000, 150)}
    assert float(b["kalan_vergi"]) == 6773.45 and float(b["damga"]) == 392.77 and float(b["toplam"]["vergi"]) == 6773.45
    assert [(x["ad"], float(x["tahakkuk"])) for x in b["icmal"]] == [("Gelir Vergisi Stopajı", 6773.45), ("Damga Vergisi", 392.77)]
    t = b["tevkifat"]
    assert {k: (x["adet"], float(x["gayrisafi"]), float(x["vergi"])) for k, x in t["kodlar"].items()} == {"022": (1, 2500, 500), "041": (1, 10000, 2000)}
    metin = json.dumps(MB.kayit_bicimi(b), ensure_ascii=False)
    assert not [x for x in KISISEL if x in metin], metin                  # TC, ad, adres, e-posta, çalışan ücreti yok
    assert "calisan" not in metin.lower() and "Toplam Çalışan" not in metin


def test_gercek_duzen(tmp_path):
    """Gerçek GİB PDF'inde görülen düzen: vergi dairesi iki satırda (etiket ikinci satırda, yanında dönem sütunları),
    "Onay Zamanı :", tür kodu satırında açıklama yok, icmal alt alta, damga başlığı altında "Ödenecek",
    kişi satırları çok satırlı ve belge türü "S.M." / "Makbuz" iki satırda."""
    y = tmp_path / "g.pdf"; muhtasar_yaz(y, GERCEK)
    b = MB.oku(y.read_bytes())
    assert b["vergi_dairesi"] == "ANTALYA KURUMLAR VERGİ DAİRESİ MÜDÜRLÜĞÜ"
    assert b["onay"] == "23.10.2026 12:18:17" and (b["yil"], b["ay"]) == (2026, 9)
    assert {k: x["ad"] for k, x in b["kodlar"].items()} == {"011": "Ücret Ödemeleri", "022": "Serbest Meslek Kazançları",
                                                            "041": "GMSİ Kira (Bina)", "302": ""}
    assert float(b["kodlar"]["041"]["gayrisafi"]) == 90625 and float(b["toplam"]["gayrisafi"]) == 148372
    assert [(x["ad"], float(x.get("tahakkuk", -1)), float(x["odenecek"])) for x in b["icmal"]] == \
        [("Gelir Vergisi Stopajı", 23448.45, 23448.45), ("Damga Vergisi", -1, 0)]
    assert float(b["damga_odenecek"]) == 0 and float(b["icmal"][0]["matrah"]) == 148372
    t = b["tevkifat"]
    assert {k: (x["adet"], float(x["gayrisafi"]), float(x["vergi"])) for k, x in t["kodlar"].items()} == \
        {"022": (1, 6000, 1200), "041": (1, 90625, 18125)}
    assert float(t["gayrisafi"]) == 96625 and float(t["vergi"]) == 19325
    metin = json.dumps(MB.kayit_bicimi(b), ensure_ascii=False)
    assert not [x for x in KISISEL + ["YILMAZ", "KAYA", "SMM2026000000022"] if x in metin], metin


def test_gercek_pdf_metni_maskeli():
    """Gerçek GİB PDF'inin pypdf (layout) metni; kişisel alanlar maskeli (99999999999 / XXXX), çalışan bölümleri çıkarılmış."""
    b = MB.ayristir((Path(__file__).parent / "muhtasar_gercek_maskeli.txt").read_text(encoding="utf-8"))
    assert b["vergi_dairesi"] == "ANTALYA KURUMLAR VERGİ DAİRESİ MÜDÜRLÜĞÜ"
    assert (b["form"], b["yil"], b["ay"], b["onay"], b["vkn"]) == ("1003A", 2026, 9, "23.10.2026 12:18:17", "99999999999")
    assert {k: (float(x["gayrisafi"]), float(x["vergi"])) for k, x in b["kodlar"].items()} == \
        {"011": (51747, 0), "022": (6000, 1200), "041": (90625, 18125), "302": (51747, 0)}
    assert all(not any(ch.isdigit() for ch in x["ad"]) for x in b["kodlar"].values())
    assert float(b["toplam"]["gayrisafi"]) == 148372 and float(b["toplam"]["vergi"]) == 19325
    assert float(b["kalan_vergi"]) == 19325 and float(b["damga"]) == 0 and float(b["damga_odenecek"]) == 0
    assert [(x["ad"], float(x["odenecek"])) for x in b["icmal"]] == [("Gelir Vergisi Stopajı", 19325), ("Damga Vergisi", 0)]
    assert float(b["icmal"][0]["matrah"]) == 148372 and float(b["icmal"][0]["tahakkuk"]) == 19325
    t = b["tevkifat"]
    assert {k: (x["adet"], float(x["gayrisafi"]), float(x["vergi"])) for k, x in t["kodlar"].items()} == \
        {"022": (1, 6000, 1200), "041": (1, 90625, 18125)}
    assert (float(t["gayrisafi"]), float(t["vergi"])) == (96625, 19325)
    assert "SMM9999999999999" not in json.dumps(MB.kayit_bicimi(b), ensure_ascii=False)


def test_baska_pdf_reddedilir(tmp_path):
    y = tmp_path / "x.pdf"; muhtasar_yaz(y, [("KATMA DEĞER VERGİSİ BEYANNAMESİ", "KDV1")])
    with pytest.raises(MB.BeyannameHatasi, match="1003A"):
        MB.oku(y.read_bytes())
    with pytest.raises(MB.BeyannameHatasi, match="PDF okunamadı"):
        MB.oku(b"%PDF-1.4 bozuk")


def test_iki_satirli_kisi_tutari_ayni_satirda_da_okunur():
    m = "\n".join(["MUHTASAR VE PRİM HİZMET BEYANNAMESİ 1003A", "TEVKİFATA TABİ ÖDEMELERE AİT BİLDİRİM",
                   "1 A B   022 S.M. Makbuz 01.09.2026 A-1   1.000,00   200,00", "GAYRİSAFİ TUTAR TOPLAMI 1.000,00"])
    b = MB.ayristir(m)
    x = b["tevkifat"]["kodlar"]["022"]
    assert (x["adet"], float(x["gayrisafi"]), float(x["vergi"])) == (1, 1000, 200)


@pytest.fixture
def c(tmp_path, monkeypatch):
    monkeypatch.setenv("FK_VERI", str(tmp_path / "veri"))
    from fastapi.testclient import TestClient
    from fatura_kontrol.web import app as A
    return TestClient(A.app)


def test_api_karsilastirma(c, tmp_path, pdf):
    from test_denetim import _mikro
    from test_luca_otomasyon import ubl, FIRMA_VKN
    zb = io.BytesIO()
    with zipfile.ZipFile(zb, "w") as z:
        z.writestr("a.xml", ubl("AAA2026000000001", "2026-09-05", "1", FIRMA_VKN, "1000.00", "200.00", 20))
        z.writestr("b.xml", ubl("EX02026000000001", "2026-09-10", FIRMA_VKN, "9", "2000.00", "400.00", 20))
    y = tmp_path / "m.xlsx"; _mikro(y)
    r = c.post("/api/denetim", data={"bas": "2026-09-01", "bit": "2026-09-30", "firma_ad": "MUHTASAR A.Ş."},
               files=[("faturalar", ("p.zip", zb.getvalue(), "application/zip")), ("muavinler", ("m.xlsx", y.read_bytes(), "application/octet-stream"))])
    rid = r.json()["rapor_id"]
    assert c.get("/api/denetim/muhtasar", params={"id": rid}).status_code == 404
    assert c.post("/api/denetim/muhtasar", data={"id": rid}, files=[("beyanname", ("b.txt", b"merhaba", "text/plain"))]).status_code == 400
    j = c.post("/api/denetim/muhtasar", data={"id": rid}, files=[("beyanname", ("b.pdf", pdf, "application/pdf"))]).json()
    serbest = next(x for x in j["satirlar"] if x["ad"].startswith("022 Serbest meslek · vergi"))
    assert serbest["beyan"] == 500 and serbest["muavin"] == 500 and serbest["durum"] == "uyumlu"          # 360.03 serbest meslek 500
    oran = next(x for x in j["satirlar"] if x["ad"].startswith("022 Serbest meslek · stopaj oranı"))
    assert oran["durum"] == "uyumlu"
    toplam = next(x for x in j["satirlar"] if x["ad"].startswith("Ödenecek toplam"))
    assert toplam["beyan"] == round(6773.45 + 392.77, 2) and toplam["muavin"] == 500 and toplam["durum"] == "fark"
    assert any(x["ad"].startswith("302") for x in j["satirlar"]) and j["sorunlu"] >= 1
    assert j["uyarilar"] == []                                               # dönem ve VKN tutuyor
    kayit = (tmp_path / "veri").rglob("muhtasar_beyan.json").__next__().read_text(encoding="utf-8")
    assert not [x for x in KISISEL if x in kayit]
    assert not list((tmp_path / "veri").rglob("*.pdf"))                      # PDF saklanmaz
    g = c.get("/api/denetim/muhtasar", params={"id": rid}).json()
    assert g["sorunlu"] == j["sorunlu"] and g["beyan"]["kodlar"]["022"]["vergi"] == 500
    h = c.get("/api/denetim/detay/rapor", params={"id": rid}).text
    assert "Muhtasar beyannamesi ↔ muavin" in h and "09/2026" in h and "AHMET" not in h
