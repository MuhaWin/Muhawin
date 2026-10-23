"""MuhaWin içinde çalışma: anahtar kapısı ve Luca bilgilerinin MuhaWin'den gelmesi."""
import importlib
import json


def _uygulama(monkeypatch, tmp_path, **env):
    monkeypatch.setenv("FK_VERI", str(tmp_path))
    for k, v in env.items():
        monkeypatch.setenv(k, v)
    import fatura_kontrol.web.app as A
    A = importlib.reload(A)
    from fastapi.testclient import TestClient
    return TestClient(A.app)


def test_anahtarsiz_istek_reddedilir(monkeypatch, tmp_path):
    c = _uygulama(monkeypatch, tmp_path, FK_ANAHTAR="gizli", FK_MUHAWIN="1")
    assert c.get("/api/saglik").json() == {"uygulama": "fatura-kontrol", "muhawin": True}
    assert c.get("/toplu").status_code == 403
    assert c.get("/api/ayarlar", headers={"X-MuhaWin": "yanlis"}).status_code == 403
    assert c.get("/toplu", headers={"X-MuhaWin": "gizli"}).status_code == 200


def test_muhawin_luca_girisi(monkeypatch, tmp_path):
    monkeypatch.setenv("FK_VERI", str(tmp_path))
    monkeypatch.setenv("FK_MUHAWIN", "1")
    from fatura_kontrol import ayarlar
    monkeypatch.delenv("FK_LUCA_GIRIS", raising=False)
    assert ayarlar.luca_girisi() is None
    assert ayarlar.oku()["kurulum_tamam"] is True and ayarlar.oku()["muhawin_luca_girisi"] is False
    monkeypatch.setenv("FK_LUCA_GIRIS", json.dumps({"uye_no": "12", "kullanici": "ali", "parola": "p"}))
    assert ayarlar.luca_girisi() == {"uye_no": "12", "kullanici": "ali", "parola": "p"}
    assert ayarlar.oku()["muhawin_luca_girisi"] is True
    monkeypatch.setenv("FK_LUCA_GIRIS", json.dumps({"uye_no": "12", "kullanici": "", "parola": "p"}))
    assert ayarlar.luca_girisi() is None          # eksik bilgi → elle giriş


def test_muhawin_disinda_kapi_yok(monkeypatch, tmp_path):
    monkeypatch.delenv("FK_ANAHTAR", raising=False)
    monkeypatch.delenv("FK_MUHAWIN", raising=False)
    c = _uygulama(monkeypatch, tmp_path)
    assert c.get("/toplu").status_code == 200


def test_muhawin_firma_listesi(monkeypatch, tmp_path):
    c = _uygulama(monkeypatch, tmp_path, FK_ANAHTAR="k", FK_MUHAWIN="1")
    h = {"X-MuhaWin": "k"}
    r = c.post("/api/toplu/firmalar/muhawin", headers=h,
               json={"firmalar": [{"id": "1", "ad": "EXPO İNŞ"}, {"id": "2", "ad": "UKİ MADEN"}]}).json()
    assert r["eklenen"] == 2
    c.put("/api/toplu/firmalar", headers=h, json={"firmalar": [{"id": "2", "dahil": False, "not": "kapalı"}]})
    # ana programdan gelen eşitleme yalnız ekler, seçimleri bozmaz
    assert c.post("/api/toplu/firmalar/muhawin", headers=h, json={"firmalar": [{"id": "1", "ad": "EXPO İNŞ"}]}).json()["eklenen"] == 0
    # Luca'nın tam listesi: listede olmayan çıkar, yeni eklenir, seçim/not korunur
    r = c.post("/api/toplu/firmalar/muhawin", headers=h,
               json={"firmalar": [{"id": "2", "ad": "UKİ MADEN"}, {"id": "3", "ad": "YENİ"}], "tam": True}).json()
    assert r == {"tamam": True, "eklenen": 1, "toplam": 2}
    f = c.get("/api/toplu/firmalar", headers=h).json()["firmalar"]
    assert [(x["id"], x["dahil"], x["not"]) for x in f] == [("2", False, "kapalı"), ("3", True, "")]


def test_ofis_uye_numarasi(monkeypatch):
    import pytest
    from fatura_kontrol.luca import otomasyon as O
    monkeypatch.delenv("FK_LUCA_UYE", raising=False)
    O.uye_denetle("999")                       # ofis yoksa her üye no serbest
    monkeypatch.setenv("FK_LUCA_UYE", "1212-207")
    O.uye_denetle("1212207")
    with pytest.raises(O.OtomasyonHatasi, match="yalnız 1212207"):
        O.uye_denetle("5555")
    from fatura_kontrol import ayarlar
    monkeypatch.setenv("FK_LUCA_GIRIS", json.dumps({"uye_no": "5555", "kullanici": "ali", "parola": "p"}))
    assert ayarlar.luca_girisi()["uye_no"] == "1212-207"


def test_muavin_goruntuleme(monkeypatch, tmp_path):
    import sys
    from datetime import date
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).parent))
    from test_luca_otomasyon import muavin_yaz
    c = _uygulama(monkeypatch, tmp_path)
    from fatura_kontrol import depo
    k = depo.donem_klasoru("EXPO İNŞ", date(2026, 9, 1)); k.mkdir(parents=True)
    muavin_yaz(k / "muavin.xlsx")
    d = c.get("/api/muavin/donemler").json()["donemler"]
    assert [x["id"] for x in d] == ["EXPO İNŞ/2026/09"]
    m = c.get("/api/muavin", params={"id": "EXPO İNŞ/2026/09"}).json()
    assert len(m["satirlar"]) == 3 and m["satirlar"][0]["hesap_kodu"].startswith("191")
    assert {s["borc"] for s in m["satirlar"]} >= {200.0, 150.0}
    assert c.get("/api/muavin", params={"id": "YOK/2026/09"}).status_code == 404


def test_firma_verisi_sil(monkeypatch, tmp_path):
    import sys
    from datetime import date
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).parent))
    from test_luca_otomasyon import muavin_yaz
    c = _uygulama(monkeypatch, tmp_path)
    from fatura_kontrol import depo
    k = depo.donem_klasoru("EXPO İNŞ", date(2026, 9, 1)); k.mkdir(parents=True)
    muavin_yaz(k / "muavin.xlsx"); (k / "faturalar.zip").write_bytes(b"x")
    depo.firma_bilgisi_yaz("EXPO İNŞ", "1", "11")
    assert c.post("/api/firma/sil", json={"luca_id": "11", "muavin": True}).json()["silinen"] == 1
    assert not (k / "muavin.xlsx").exists() and (k / "faturalar.zip").exists()
    assert c.post("/api/firma/sil", json={"ad": "EXPO İNŞ", "belgeler": True}).json()["klasor"] == 1
    assert not k.parent.parent.exists()


def test_muavin_excel_yukle(monkeypatch, tmp_path):
    import base64, sys
    from datetime import date
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).parent))
    from test_luca_otomasyon import muavin_yaz
    c = _uygulama(monkeypatch, tmp_path)
    from fatura_kontrol import depo
    muavin_yaz(tmp_path / "m.xlsx")
    b64 = base64.b64encode((tmp_path / "m.xlsx").read_bytes()).decode()
    # Luca numarasıyla daha önce indirilmiş firma klasörü varsa oraya yazılır
    depo.firma_bilgisi_yaz("EXPO İNŞ", "1", "11")
    k = depo.donem_klasoru("EXPO İNŞ", date(2026, 8, 1)); k.mkdir(parents=True)
    (k / "muavin_2.xlsx").write_bytes(b"eski"); (k / "faturalar.zip").write_bytes(b"x")
    r = c.post("/api/muavin/yukle", json={"ad": "Expo başka ad", "luca_id": "11", "yil": 2026, "ay": 8,
                                           "program": "luca", "dosya_adi": "muavin.xlsx", "b64": b64}).json()
    assert r == {"tamam": True, "id": "EXPO İNŞ/2026/08", "satir": 3}
    assert sorted(p.name for p in k.iterdir()) == ["faturalar.zip", "muavin.xlsx", "muavin_program.json"]
    d = c.get("/api/muavin/donemler").json()["donemler"]
    assert d[0]["luca_id"] == "11" and d[0]["program"] == "luca"
    # yeni firma: adından klasör
    r = c.post("/api/muavin/yukle", json={"ad": "YENİ FİRMA", "yil": 2026, "ay": 9, "program": "luca",
                                           "dosya_adi": "a.xlsx", "b64": b64}).json()
    assert r["id"] == "YENİ FİRMA/2026/09"
    # hatalar: program seçilmemiş, yanlış uzantı, muavin olmayan dosya
    assert c.post("/api/muavin/yukle", json={"ad": "X", "yil": 2026, "ay": 9, "program": "", "dosya_adi": "a.xlsx", "b64": b64}).status_code == 400
    assert c.post("/api/muavin/yukle", json={"ad": "X", "yil": 2026, "ay": 9, "program": "luca", "dosya_adi": "a.pdf", "b64": b64}).status_code == 400
    import openpyxl
    wb = openpyxl.Workbook(); wb.active.append(["merhaba"]); wb.save(tmp_path / "bos.xlsx")
    r = c.post("/api/muavin/yukle", json={"ad": "X", "yil": 2026, "ay": 9, "program": "luca", "dosya_adi": "a.xlsx",
                                           "b64": base64.b64encode((tmp_path / "bos.xlsx").read_bytes()).decode()})
    assert r.status_code == 400 and "Muavin" in r.json()["detail"] or "muavin" in r.json()["detail"]


def test_kdv_orani_yazilmamis():
    """Elektrik faturası gibi Percent yazılmayan KDV: oran KDV / matrah'tan bulunur (standart orana oturtulur)."""
    from fatura_kontrol.fatura_okuyucu import xml_oku
    x = b'''<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
 xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
 xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
<cbc:ProfileID>TEMELFATURA</cbc:ProfileID><cbc:ID>CK12026001377825</cbc:ID><cbc:UUID>u1</cbc:UUID>
<cbc:IssueDate>2026-09-12</cbc:IssueDate><cbc:InvoiceTypeCode>SATIS</cbc:InvoiceTypeCode><cbc:DocumentCurrencyCode>TRY</cbc:DocumentCurrencyCode>
<cac:AccountingSupplierParty><cac:Party><cac:PartyIdentification><cbc:ID schemeID="VKN">1</cbc:ID></cac:PartyIdentification><cac:PartyName><cbc:Name>CK</cbc:Name></cac:PartyName></cac:Party></cac:AccountingSupplierParty>
<cac:AccountingCustomerParty><cac:Party><cac:PartyIdentification><cbc:ID schemeID="VKN">2</cbc:ID></cac:PartyIdentification></cac:Party></cac:AccountingCustomerParty>
<cac:TaxTotal><cbc:TaxAmount currencyID="TRY">0.45</cbc:TaxAmount><cac:TaxSubtotal><cbc:TaxableAmount currencyID="TRY">4.49</cbc:TaxableAmount>
<cbc:TaxAmount currencyID="TRY">0.45</cbc:TaxAmount><cac:TaxCategory><cac:TaxScheme><cbc:Name>KDV</cbc:Name><cbc:TaxTypeCode>0015</cbc:TaxTypeCode></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal></cac:TaxTotal>
<cac:LegalMonetaryTotal><cbc:LineExtensionAmount currencyID="TRY">4.49</cbc:LineExtensionAmount><cbc:TaxExclusiveAmount currencyID="TRY">4.49</cbc:TaxExclusiveAmount>
<cbc:TaxInclusiveAmount currencyID="TRY">4.94</cbc:TaxInclusiveAmount><cbc:PayableAmount currencyID="TRY">4.94</cbc:PayableAmount></cac:LegalMonetaryTotal>
</Invoice>'''
    f = xml_oku(x, "t.xml")
    from decimal import Decimal
    assert list(f.kdv_oranlari) == [Decimal("10")]


def test_kaydedilmeyecek(monkeypatch, tmp_path):
    import sys, zipfile
    from datetime import date
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).parent))
    from test_luca_otomasyon import muavin_yaz, ubl, FIRMA_VKN
    c = _uygulama(monkeypatch, tmp_path)
    from fatura_kontrol import depo, kontrol as K
    k = depo.donem_klasoru("EXPO İNŞ", date(2026, 9, 1)); k.mkdir(parents=True)
    muavin_yaz(k / "muavin.xlsx")
    with zipfile.ZipFile(k / "faturalar.zip", "w") as z:
        z.writestr("gib_efatura_alis/ZZZ2026000000010.xml", ubl("ZZZ2026000000010", "2026-09-25", "1", FIRMA_VKN, "50.00", "10.00", 20))
    depo.firma_bilgisi_yaz("EXPO İNŞ", FIRMA_VKN, "11")
    v = K.calistir(k, date(2026, 9, 1), date(2026, 9, 30), FIRMA_VKN, "EXPO İNŞ")
    eksik = {d["ad"]: d["adet"] for d in v["durumlar"]}
    assert eksik.get("Muavinde yok", 0) >= 1
    a = c.get("/api/kayit/adaylar", params={"id": v["id"]}).json()
    z = next(f for f in a["faturalar"] if f["belge_no"] == "ZZZ2026000000010")
    r = c.post("/api/kayit/haric", json={"id": v["id"], "ekle": [{"anahtar": z["anahtar"], "belge_no": z["belge_no"]}]}).json()
    d = {x["ad"]: x["adet"] for x in r["durumlar"]}
    assert d.get("Kaydedilmeyecek (kullanıcı kararı)") == 1 and d.get("Muavinde yok", 0) == eksik["Muavinde yok"] - 1
    a = c.get("/api/kayit/adaylar", params={"id": v["id"]}).json()
    assert next(f for f in a["faturalar"] if f["belge_no"] == "ZZZ2026000000010")["haric"]
    r = c.post("/api/kayit/haric", json={"id": v["id"], "cikar": [z["anahtar"]]}).json()
    assert {x["ad"]: x["adet"] for x in r["durumlar"]}.get("Muavinde yok") == eksik["Muavinde yok"]


def test_uygun_kullanici_karari(monkeypatch, tmp_path):
    """Sorunlu bir sonuç ve faturası bulunamayan bir kayıt, açıklama yazılarak 'uygun' kabul edilir; rapor ve çıktıda görünür."""
    import sys, zipfile
    from datetime import date
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).parent))
    from test_luca_otomasyon import muavin_yaz, ubl, FIRMA_VKN
    c = _uygulama(monkeypatch, tmp_path)
    from fatura_kontrol import depo, kontrol as K
    k = depo.donem_klasoru("UYGUN LTD", date(2026, 9, 1)); k.mkdir(parents=True)
    muavin_yaz(k / "muavin.xlsx")
    with zipfile.ZipFile(k / "faturalar.zip", "w") as z:
        z.writestr("gib_efatura_alis/UYG2026000000010.xml", ubl("UYG2026000000010", "2026-09-25", "1", FIRMA_VKN, "50.00", "10.00", 20))
    depo.firma_bilgisi_yaz("UYGUN LTD", FIRMA_VKN, "12")
    v = K.calistir(k, date(2026, 9, 1), date(2026, 9, 30), FIRMA_VKN, "UYGUN LTD")
    j = c.get("/api/rapor", params={"id": v["id"]}).json()
    s = next(x for x in j["sonuclar"] if x["belge_no"] == "UYG2026000000010")
    assert s["sorunlu"] and s["anahtar"]
    # kısa açıklama reddedilir
    r = c.post("/api/kayit/uygun", json={"id": v["id"], "ekle": [{"anahtar": s["anahtar"], "aciklama": "ok"}]})
    assert r.status_code == 400
    r = c.post("/api/kayit/uygun", json={"id": v["id"], "ekle": [{"anahtar": s["anahtar"], "aciklama": "Temmuz faturası, Ağustos'ta 55 no.lu fişle kaydedildi", "belge_no": s["belge_no"]}]}).json()
    d = {x["ad"]: x["adet"] for x in r["durumlar"]}
    assert d.get("Uygun (kullanıcı kararı)") == 1
    j = c.get("/api/rapor", params={"id": v["id"]}).json()
    s2 = next(x for x in j["sonuclar"] if x["belge_no"] == "UYG2026000000010")
    assert s2["durum"] == "Uygun (kullanıcı kararı)" and not s2["sorunlu"] and "55 no.lu" in s2["aciklama"] and "Muavinde yok" in s2["aciklama"]
    # faturası bulunamayan kayıt da uygun kabul edilir ve sayımdan düşer
    fy = j["faturasi_olmayanlar"]
    if fy:
        once = {x["ad"]: x["adet"] for x in j["durumlar"]}["Faturası bulunamadı"]
        r = c.post("/api/kayit/uygun", json={"id": v["id"], "ekle": [{"anahtar": fy[0]["anahtar"], "aciklama": "Kağıt fatura, e-belge değil"}]}).json()
        assert {x["ad"]: x["adet"] for x in r["durumlar"]}["Faturası bulunamadı"] == once - 1
        j = c.get("/api/rapor", params={"id": v["id"]}).json()
        assert next(x for x in j["faturasi_olmayanlar"] if x["anahtar"] == fy[0]["anahtar"])["uygun"] == "Kağıt fatura, e-belge değil"
    html = c.get("/api/rapor/cikti", params={"id": v["id"]}).text
    assert "Kullanıcı kararıyla uygun kabul edilen" in html and "55 no.lu" in html
    # geri alma
    r = c.post("/api/kayit/uygun", json={"id": v["id"], "cikar": [s["anahtar"]]}).json()
    assert {x["ad"]: x["adet"] for x in r["durumlar"]}.get("Uygun (kullanıcı kararı)", 0) == 0


def test_beyanname_api(monkeypatch, tmp_path):
    """Kontrol edilen dönemden KDV 1 / KDV 2 beyanname kutuları; Excel çıktısı; dönem listesi."""
    import sys, zipfile
    from datetime import date
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).parent))
    from test_luca_otomasyon import muavin_yaz, ubl, FIRMA_VKN
    c = _uygulama(monkeypatch, tmp_path)
    from fatura_kontrol import depo, kontrol as K
    k = depo.donem_klasoru("BEYAN AŞ", date(2026, 9, 1)); k.mkdir(parents=True)
    muavin_yaz(k / "muavin.xlsx")
    with zipfile.ZipFile(k / "faturalar.zip", "w") as z:
        z.writestr("gib_efatura_alis/BYN2026000000010.xml", ubl("BYN2026000000010", "2026-09-25", "1", FIRMA_VKN, "50.00", "10.00", 20))
    depo.firma_bilgisi_yaz("BEYAN AŞ", FIRMA_VKN, "13")
    v = K.calistir(k, date(2026, 9, 1), date(2026, 9, 30), FIRMA_VKN, "BEYAN AŞ")
    d = c.get("/api/beyanname/donemler").json()
    assert any(x["id"] == v["id"] and x["muavin"] for x in d)
    b = c.get("/api/beyanname", params={"id": v["id"]}).json()
    assert b["mukellef"]["vkn"] == FIRMA_VKN and b["kdv1"]["donem"]["ay_adi"] == "Eylül"
    k1 = b["kdv1"]
    assert set(k1["matrah"]) == {"toplam_matrah", "hesaplanan_kdv", "ilave_kdv", "toplam_kdv"}
    assert set(k1["sonuc"]) == {"tecil", "odenecek", "iade_edilecek", "sonraki_doneme_devreden"}
    assert abs(k1["matrah"]["toplam_kdv"] - k1["indirimler"]["toplam"] - k1["sonuc"]["odenecek"] + k1["sonuc"]["sonraki_doneme_devreden"] + k1["sonuc"]["iade_edilecek"]) < 0.02
    assert "vergi_bildirimi" in b["kdv2"] and "kesintiler" in b["kdv2"]
    assert (k / "beyanname.json").exists()
    x = c.get("/api/beyanname/excel", params={"id": v["id"], "tur": "kdv1"})
    assert x.status_code == 200 and x.content[:2] == b"PK"
    x2 = c.get("/api/beyanname/excel", params={"id": v["id"], "tur": "kdv2"})
    assert x2.status_code == 200
    assert c.get("/beyanname").status_code == 200


def test_beyanname_toplu_ve_karsilastir(monkeypatch, tmp_path):
    """Toplu dönem listesi (tüm firmalar) + Excel; GİB PDF metni ile kutu kutu karşılaştırma; Kaydedilmeyecek kararı API'si."""
    import sys, zipfile
    from datetime import date
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).parent))
    from test_luca_otomasyon import muavin_yaz, ubl, FIRMA_VKN
    c = _uygulama(monkeypatch, tmp_path)
    from fatura_kontrol import depo, kontrol as K
    from fatura_kontrol.beyanname import gib_metin_coz
    k = depo.donem_klasoru("TOPLU AŞ", date(2026, 9, 1)); k.mkdir(parents=True)
    muavin_yaz(k / "muavin.xlsx")
    with zipfile.ZipFile(k / "faturalar.zip", "w") as z:
        z.writestr("gib_efatura_alis/TPL2026000000010.xml", ubl("TPL2026000000010", "2026-09-25", "1", FIRMA_VKN, "50.00", "10.00", 20))
    depo.firma_bilgisi_yaz("TOPLU AŞ", FIRMA_VKN, "14")
    v = K.calistir(k, date(2026, 9, 1), date(2026, 9, 30), FIRMA_VKN, "TOPLU AŞ")
    t = c.get("/api/beyanname/toplu", params={"yil": 2026, "ay": 9}).json()
    s = next(x for x in t["satirlar"] if x["id"] == v["id"])
    assert "hata" not in s and s["firma"] and "odenecek" in s and "kdv2_tevkif" in s
    assert t["ay_adi"] == "Eylül" and "odenecek" in t["toplam"]
    x = c.get("/api/beyanname/toplu/excel", params={"yil": 2026, "ay": 9})
    assert x.status_code == 200 and x.content[:2] == b"PK"
    assert c.get("/api/beyanname/toplu", params={"yil": 2026, "ay": 13}).status_code == 400
    # karşılaştırma: MuhaWin kutularından sahte bir GİB metni üret → tümü uyumlu; bir kutu bozulunca farklı
    b = c.get("/api/beyanname", params={"id": v["id"]}).json()["kdv1"]
    tl = lambda n: f"{n:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    metin = (f"Vergi Kimlik No: {FIRMA_VKN} Yıl: 2026 Ay: EYLÜL\nToplam Matrah {tl(b['matrah']['toplam_matrah'])}\nHesaplanan Katma Değer Vergisi {tl(b['matrah']['hesaplanan_kdv'])}\n"
             f"İndirimler Toplamı {tl(b['indirimler']['toplam'])}\nÖnceki Dönemden Devreden KDV {tl(b['indirimler']['onceki_donemden_devreden'])}\n"
             f"Ödenmesi Gereken Katma Değer Vergisi {tl(b['sonuc']['odenecek'])}\nSonraki Döneme Devreden KDV {tl(b['sonuc']['sonraki_doneme_devreden'])}")
    assert gib_metin_coz(metin, "kdv1")["_vkn"] == FIRMA_VKN
    r = c.post("/api/beyanname/karsilastir", json={"id": v["id"], "tur": "kdv1", "metin": metin}).json()
    assert r["sonuc"] == "uyumlu" and r["farkli"] == 0 and r["bulunan"] >= 5
    assert not r["uyarilar"]
    r2 = c.post("/api/beyanname/karsilastir", json={"id": v["id"], "tur": "kdv1", "metin": metin.replace(f"Toplam Matrah {tl(b['matrah']['toplam_matrah'])}", "Toplam Matrah 1,00")}).json()
    assert r2["sonuc"] == "farklı" and any(x["anahtar"] == "toplam_matrah" and x["durum"] == "farklı" for x in r2["satirlar"])
    r3 = c.post("/api/beyanname/karsilastir", json={"id": v["id"], "tur": "kdv1", "metin": metin.replace(FIRMA_VKN, "9999999999")}).json()
    assert any("VKN" in u for u in r3["uyarilar"])
    assert c.post("/api/beyanname/karsilastir", json={"id": v["id"], "metin": "x"}).status_code == 400
    # Kaydedilmeyecek (haric) kararı: muavinde olmayan faturayı işaretle → durum değişir → geri al
    rap = c.get("/api/rapor", params={"id": v["id"]}).json()
    yok = [s for s in rap["sonuclar"] if s["durum"] == "Muavinde yok"]
    if yok:
        a = yok[0]["anahtar"]
        h = c.post("/api/kayit/haric", json={"id": v["id"], "ekle": [{"anahtar": a, "belge_no": yok[0]["belge_no"], "tarih": yok[0]["tarih"], "yon": yok[0]["yon"]}]}).json()
        assert h["tamam"] and h["adet"] == 1
        rap2 = c.get("/api/rapor", params={"id": v["id"]}).json()
        assert any(s["anahtar"] == a and s["durum"].startswith("Kaydedilmeyecek") for s in rap2["sonuclar"])
        assert c.post("/api/kayit/haric", json={"id": v["id"], "cikar": [a]}).json()["adet"] == 0
        # toplu karar: birden çok fatura tek açıklamayla kaydedilmeyecek → açıklama raporda görünür
        ek = [{"anahtar": x["anahtar"], "belge_no": x["belge_no"], "aciklama": "Şube faturaları, merkezde kaydedilir"} for x in yok[:3]]
        assert c.post("/api/kayit/haric", json={"id": v["id"], "ekle": ek}).json()["adet"] == len(ek)
        rap3 = c.get("/api/rapor", params={"id": v["id"]}).json()
        isa = [s for s in rap3["sonuclar"] if s["anahtar"] in {x["anahtar"] for x in ek}]
        assert len(isa) == len(ek) and all(s["durum"].startswith("Kaydedilmeyecek") and "Şube faturaları" in s["aciklama"] for s in isa)
        assert c.post("/api/kayit/haric", json={"id": v["id"], "cikar": [x["anahtar"] for x in ek]}).json()["adet"] == 0
