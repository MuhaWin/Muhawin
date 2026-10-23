"""Mikro Denetim: KDV + matrah + cari kontrolü ve muhtasar taslağı (Mikro muavini + e-faturalar)."""
import io
import os
import sys
import zipfile
from datetime import datetime
from pathlib import Path

import pytest


@pytest.fixture
def c(tmp_path, monkeypatch):
    monkeypatch.setenv("FK_VERI", str(tmp_path / "veri"))
    from fastapi.testclient import TestClient
    from fatura_kontrol.web import app as A
    return TestClient(A.app)


def _mikro(y, satis_matrah=2000, cari_alis=1200):
    import openpyxl
    wb = openpyxl.Workbook(); ws = wb.active
    ws.append(["HESAP KODU", "Kayıt no", "Tarih", "Sıra", "Y.No", "Fiş tipi", "Belge türü", "Evrak no", "Cari ismi", "Entegrasyon kaynağı", "Açıklama", "TL Borç", "TL Alacak"])
    def hesap(kod, ad, satirlar):
        ws.append([f"{kod} {ad} Hesap hareket dökümü  (01.09.2026-30.09.2026)"])
        for s in satirlar:
            ws.append(s)
    d1, d2 = datetime(2026, 9, 5), datetime(2026, 9, 10)
    al = "Al.fat. : AAA2026000000001/SATICI"; sa = "Sat.fat : EX02026000000001/ALICI"
    hesap("120.01", "ALICI", [["", "K2", d2, 1, 11, "Mahsup", "Sat.fat", "1", "ALICI", "", sa, 2400, None]])
    hesap("191.01.20", "İndirilecek KDV %20", [["", "K1", d1, 1, 10, "Mahsup", "Al.fat.", "1", "SATICI", "", al, 200, None]])
    hesap("320.01", "SATICI", [["", "K1", d1, 1, 10, "Mahsup", "Al.fat.", "1", "SATICI", "", al, None, cari_alis]])
    hesap("360.03", "Serbest Meslek Stopajı", [["", "K3", d2, 1, 12, "Mahsup", "", "", "AV. ALİ", "", "Serbest meslek makbuzu", None, 500]])
    hesap("391.01.20", "Hesaplanan KDV %20", [["", "K2", d2, 1, 11, "Mahsup", "Sat.fat", "1", "ALICI", "", sa, None, 400]])
    hesap("600.01", "Yurtiçi Satışlar", [["", "K2", d2, 1, 11, "Mahsup", "Sat.fat", "1", "ALICI", "", sa, None, satis_matrah]])
    hesap("770.01", "Genel Yönetim Giderleri", [["", "K1", d1, 1, 10, "Mahsup", "Al.fat.", "1", "SATICI", "", al, 1000, None]])
    wb.save(y)


def test_denetim_kdv_matrah_cari_muhtasar(c, tmp_path):
    sys.path.insert(0, str(Path(__file__).parent))
    from test_luca_otomasyon import ubl, FIRMA_VKN
    zb = io.BytesIO()
    with zipfile.ZipFile(zb, "w") as z:
        z.writestr("a.xml", ubl("AAA2026000000001", "2026-09-05", "1", FIRMA_VKN, "1000.00", "200.00", 20))
        z.writestr("b.xml", ubl("EX02026000000001", "2026-09-10", FIRMA_VKN, "9", "2000.00", "400.00", 20))
    y = tmp_path / "m.xlsx"; _mikro(y, satis_matrah=1900, cari_alis=1150)
    r = c.post("/api/denetim", data={"bas": "2026-09-01", "bit": "2026-09-30", "firma_ad": "DENETİM A.Ş."},
               files=[("faturalar", ("p.zip", zb.getvalue(), "application/zip")), ("muavinler", ("m.xlsx", y.read_bytes(), "application/octet-stream"))])
    assert r.status_code == 200, r.text
    v = r.json()
    d = v["denetim"]
    durum = {(s["kontrol"], s["belge_no"]): s["durum"] for s in d["sonuclar"]}
    assert durum[("KDV", "AAA2026000000001")] == "Uyumlu" and durum[("KDV", "EX02026000000001")] == "Uyumlu"
    assert durum[("Matrah", "AAA2026000000001")] == "Uyumlu"                   # 770 gider = matrah
    assert durum[("Matrah", "EX02026000000001")] != "Uyumlu"                   # 600'de 1.900 ≠ 2.000
    assert durum[("Cari", "AAA2026000000001")] != "Uyumlu"                     # 320'de 1.150 ≠ 1.200
    assert durum[("Cari", "EX02026000000001")] == "Uyumlu"                     # 120'de 2.400
    assert d["ozet"]["Matrah"]["sorunlu"] == 1 and d["ozet"]["Cari"]["sorunlu"] == 1 and d["ozet"]["KDV"]["sorunlu"] == 0
    m = d["muhtasar"]["satirlar"]
    assert m[0]["kod"] == "serbest" and m[0]["vergi"] == 500 and m[0]["matrah"] == 2500
    assert c.get("/api/denetim", params={"id": v["rapor_id"]}).json()["ozet"]["Matrah"]["sorunlu"] == 1
    assert c.get("/api/denetim/liste").json()["liste"][0]["id"] == v["rapor_id"]
    assert c.get("/api/beyanname", params={"id": v["rapor_id"]}).status_code == 200
    # Hesap / fiş sütunundaki fiş → muavinden fiş penceresi + ana hesaplar
    import re as _re
    fisler = next(s["fisler"] for s in d["sonuclar"] if s["kontrol"] == "KDV" and s["belge_no"] == "AAA2026000000001")
    no, tr = _re.match(r"(.+?) \((\d{2}\.\d{2}\.\d{4})\)", fisler).groups()
    j = c.get("/api/denetim/fis", params={"id": v["rapor_id"], "fis": no, "tarih": tr}).json()
    assert {x["hesap"] for x in j["satirlar"]} == {"191.01.20", "320.01", "770.01"} and j["dengeli"] is False   # 1.150 ≠ 1.200
    assert [(x["hesap"], x["borc"], x["alacak"]) for x in j["ana"]] == [("191", 200, 0), ("320", 0, 1150), ("770", 1000, 0)]
    assert j["ana"][0]["ad"] == "İndirilecek KDV"
    h = c.get("/api/denetim/fis/yazdir", params={"id": v["rapor_id"], "fis": no, "tarih": tr}).text
    assert "Ana hesaplar görünümü" in h and "Hazırlayan" in h and "Onaylayan" in h and "770.01" in h and "print()" in h
    assert c.get("/api/denetim/fis", params={"id": v["rapor_id"], "fis": "YOK", "tarih": tr}).status_code == 404
    # Bilgisayardaki belgelerle yeniden denetim / kontrol (yükleme ve Luca olmadan)
    y = c.get("/api/yerel-belgeler", params={"firma_ad": "DENETİM A.Ş."}).json()
    assert y["firma"] == "DENETİM A.Ş" and len(y["donemler"]) == 1
    dn = y["donemler"][0]
    assert dn["ay"] == "2026-09" and dn["fatura"] == 2 and dn["hazir"] and dn["program"] == "mikro" and dn["rapor"] and dn["denetim"]
    assert (dn["bas"], dn["bit"]) == ("2026-09-01", "2026-09-30")
    j = c.post("/api/denetim/yerel", json={"firma_ad": "DENETİM A.Ş.", "ay": "2026-09"}).json()
    assert j["rapor_id"] == v["rapor_id"] and j["denetim"]["ozet"]["Matrah"]["sorunlu"] == 1
    k = c.post("/api/kontrol/yerel", json={"firma_ad": "DENETİM A.Ş.", "ay": "2026-09", "bas": "2026-09-01", "bit": "2026-09-15"}).json()
    assert k["id"] == v["rapor_id"] and k["donem"]["Alış"] == ["2026-09-01", "2026-09-15"]
    assert c.post("/api/kontrol/yerel", json={"firma_ad": "DENETİM A.Ş.", "ay": "2026-09", "bas": "2026-10-01"}).status_code == 400
    assert c.post("/api/kontrol/yerel", json={"firma_ad": "DENETİM A.Ş.", "ay": "2026-08"}).status_code == 400
    assert c.post("/api/kontrol/yerel", json={"firma_ad": "YOK FİRMA", "ay": "2026-09"}).status_code == 404
    assert c.get("/api/yerel-belgeler", params={"firma_ad": "YOK FİRMA"}).json() == {"firma": None, "donemler": []}


def test_denetim_faturalari_lucadan(c, tmp_path):
    """Mikro Denetim › 2. Belgeler: e-faturalar Luca'dan alınmışsa (firmanın dönem arşivi) XML yüklemeden denetlenir."""
    from datetime import date
    from fatura_kontrol import depo
    from fatura_kontrol.luca import toplu as T
    from test_luca_otomasyon import ubl, FIRMA_VKN
    T.liste_yaz([{"ad": "DENETİM AŞ", "id": "77"}])
    y = tmp_path / "m.xlsx"; _mikro(y)
    yok = c.post("/api/denetim", data={"bas": "2026-09-01", "bit": "2026-09-30", "firma_id": "77", "fatura_kaynak": "luca"},
                 files=[("muavinler", ("m.xlsx", y.read_bytes(), "application/octet-stream"))])
    assert yok.status_code == 400 and "Luca'dan alınmış fatura yok" in yok.text
    k = depo.donem_klasoru("DENETİM AŞ", date(2026, 9, 1)); k.mkdir(parents=True)       # toplu otomasyonun yazdığı arşiv
    with zipfile.ZipFile(k / "faturalar.zip", "w") as z:
        z.writestr("gib_efatura_alis/AAA2026000000001.xml", ubl("AAA2026000000001", "2026-09-05", "1", FIRMA_VKN, "1000.00", "200.00", 20))
        z.writestr("gib_efatura_satis/EX02026000000001.xml", ubl("EX02026000000001", "2026-09-10", FIRMA_VKN, "9", "2000.00", "400.00", 20))
    assert c.get("/api/kontrol/luca-faturalari", params={"firma_id": "77", "bas": "2026-09-01"}).json()["adet"] == 2   # firma.json olmadan da (toplu listesi)
    r = c.post("/api/denetim", data={"bas": "2026-09-01", "bit": "2026-09-30", "firma_id": "77", "firma_ad": "DENETİM AŞ", "fatura_kaynak": "luca"},
               files=[("muavinler", ("m.xlsx", y.read_bytes(), "application/octet-stream"))])
    assert r.status_code == 200, r.text
    d = r.json()["denetim"]
    assert {s["belge_no"] for s in d["sonuclar"]} == {"AAA2026000000001", "EX02026000000001"}


def test_denetim_red_iptal(c, tmp_path):
    """Mikro Denetim › red / iptal listeleri: kayıtlı red fatura KDV, matrah ve cari kontrolünde sorun; listede olup hiç kaydı olmayan uyumlu."""
    from test_luca_otomasyon import ubl, FIRMA_VKN
    from test_red_iptal import red_xlsx
    zb = io.BytesIO()
    with zipfile.ZipFile(zb, "w") as z:
        z.writestr("a.xml", ubl("AAA2026000000001", "2026-09-05", "1", FIRMA_VKN, "1000.00", "200.00", 20))
        z.writestr("b.xml", ubl("EX02026000000001", "2026-09-10", FIRMA_VKN, "9", "2000.00", "400.00", 20))
    m = tmp_path / "m.xlsx"; _mikro(m)
    r1 = red_xlsx(tmp_path / "red_satis.xlsx", [("EX02026000000001", 46275, "9", "ALICI 9", 2000, 400, "Fatura red edildi"),
                                                ("QQQ2026000000009", 46272, "8", "X", 50, 10, "Fatura iptal edildi")])
    r = c.post("/api/denetim", data={"bas": "2026-09-01", "bit": "2026-09-30", "firma_ad": "DENETİM A.Ş."},
               files=[("faturalar", ("p.zip", zb.getvalue(), "application/zip")), ("muavinler", ("m.xlsx", m.read_bytes(), "application/octet-stream")),
                      ("red_iptal", (r1.name, r1.read_bytes(), "application/octet-stream"))])
    assert r.status_code == 200, r.text
    d = r.json()["denetim"]
    assert {x["belge_no"]: x["muavinde"] for x in d["red_iptal"]} == {"EX02026000000001": True, "QQQ2026000000009": False}
    assert {s["durum"] for s in d["sonuclar"] if s["belge_no"] == "EX02026000000001"} == {"Red / iptal edilmiş fatura muavinde kayıtlı"}
