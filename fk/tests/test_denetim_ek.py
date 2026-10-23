"""Mikro Denetim ekleri: konaklama vergisi, satış faturasıyla iade (610), ÖİV ↔ 689, yakın belge no (LIL ↔ LII)."""
from datetime import date
from decimal import Decimal as D

from fatura_kontrol import eslestirme as E
from fatura_kontrol.denetim import oiv_kontrol, OIV_UYUMLU, OIV_FARK, OIV_YOK
from tests.test_eslestirme import fatura, satir


def fs(hesap, adi, borc="0", alacak="0", no="ABC2026000000001", unvan="ÖRNEK GIDA LTD ŞTİ", fis_no="1"):
    s = satir(no=no, hesap=hesap, adi=adi, tutar="0", unvan=unvan, fis_no=fis_no)
    s.borc, s.alacak = D(borc), D(alacak)
    return s


def esle(f, m):
    return E.esle([f], m, kontrol_listesi=E.DENETIM_KONTROLLER)


def d(r, k):
    return {s.durum for s in r.sonuclar if s.kontrol == k}


def test_konaklama_vergisi_matraha_eklenir():
    f = fatura()                                   # matrah 1000, KDV 200
    f.matrah_oranlari = {D(20): D("1000.00")}
    f.diger_vergiler = {"Konaklama Vergisi": D("20.00")}
    f.vergiler_dahil = f.odenecek = D("1220.00")
    m = [fs("191.01", "İndirilecek KDV", borc="200"), fs("770.01", "Konaklama Gideri", borc="1020"),
         fs("320.01", "Otel", alacak="1220")]
    r = esle(f, m)
    assert d(r, "Matrah") == {E.KONAKLAMA_UYUMLU}
    m[1].borc = D("1000")
    assert d(esle(f, m), "Matrah") == {E.KONAKLAMA_FARK}


def test_satis_faturasiyla_iade_610():
    f = fatura(no="SAT2026000000010")
    f.yon, f.tip = "SATIS", "SATIS"
    f.notlar = ["Mal İADE faturasıdır"]
    f.matrah_oranlari = {D(20): D("1000.00")}
    f.vergiler_dahil = f.odenecek = D("1200.00")
    no = "SAT2026000000010"
    m = [fs("610.01", "Satıştan İadeler", borc="1000", no=no), fs("191.01", "İndirilecek KDV", borc="200", no=no),
         fs("120.01", "Müşteri", alacak="1200", no=no),
         fs("600.01", "Yurtiçi Satışlar", alacak="50", no="ZZZ2026000000009")]
    r = esle(f, m)
    assert d(r, "Matrah") == {E.IADE_610_UYUMLU}
    assert E.iade_notlu(f)


def test_oiv_689_karsilastirmasi():
    f = fatura()
    f.matrah_oranlari = {D(20): D("1000.00")}
    f.diger_vergiler = {"Özel İletişim Vergisi": D("100.00")}
    f.vergiler_dahil = f.odenecek = D("1300.00")
    m = [fs("191.01", "İndirilecek KDV", borc="200"), fs("760.01", "Telefon Gideri", borc="1000"),
         fs("689.01", "ÖİV Gideri", borc="100"), fs("320.01", "Telekom", alacak="1300")]
    r = esle(f, m)
    assert [x["durum"] for x in oiv_kontrol(r, [f], m)] == [OIV_UYUMLU]
    m[2].borc = D("90"); m[3].alacak = D("1290")
    x = oiv_kontrol(esle(f, m), [f], m)[0]
    assert x["durum"] == OIV_FARK and x["sorunlu"] and abs(x["fark"]) == 10
    m2 = [m[0], fs("760.01", "Telefon Gideri", borc="1100"), fs("320.01", "Telekom", alacak="1300")]
    assert oiv_kontrol(esle(f, m2), [f], m2)[0]["durum"] == OIV_YOK


def test_yakin_belge_no_smm():
    f = fatura(no="LIL2026000000085", unvan="AV. AHMET YILMAZ")
    f.matrah_oranlari = {D(20): D("1000.00")}
    f.vergiler_dahil = f.odenecek = D("1200.00")
    no = "LII2026000000085"
    m = [fs("191.01", "İndirilecek KDV", borc="200", no=no, unvan="BAŞKA CARİ"),
         fs("770.01", "Danışmanlık", borc="1000", no=no, unvan="BAŞKA CARİ"),
         fs("320.01", "Cari", alacak="1200", no=no, unvan="BAŞKA CARİ")]
    r = esle(f, m)
    assert d(r, "KDV") == {E.BELGE_NO_YAKIN}
    assert not r.faturasi_olmayanlar
    m[0].borc = D("150")                          # KDV tutmuyorsa yakın no kabul edilmez
    r = esle(f, m)
    assert E.BELGE_NO_YAKIN not in d(r, "KDV")


def test_ubl_konaklama_oiv_ve_not():
    from fatura_kontrol.fatura_okuyucu import xml_oku
    x = """<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
<cbc:ProfileID>TEMELFATURA</cbc:ProfileID><cbc:ID>ABC2026000000001</cbc:ID><cbc:IssueDate>2026-09-02</cbc:IssueDate>
<cbc:InvoiceTypeCode>SATIS</cbc:InvoiceTypeCode><cbc:Note>İade faturasıdır</cbc:Note><cbc:DocumentCurrencyCode>TRY</cbc:DocumentCurrencyCode>
<cac:AccountingSupplierParty><cac:Party><cac:PartyIdentification><cbc:ID schemeID="VKN">1111111111</cbc:ID></cac:PartyIdentification><cac:PartyName><cbc:Name>OTEL</cbc:Name></cac:PartyName></cac:Party></cac:AccountingSupplierParty>
<cac:AccountingCustomerParty><cac:Party><cac:PartyIdentification><cbc:ID schemeID="VKN">3810463613</cbc:ID></cac:PartyIdentification><cac:PartyName><cbc:Name>EXPO</cbc:Name></cac:PartyName></cac:Party></cac:AccountingCustomerParty>
<cac:TaxTotal><cbc:TaxAmount currencyID="TRY">320.00</cbc:TaxAmount>
<cac:TaxSubtotal><cbc:TaxableAmount currencyID="TRY">1000.00</cbc:TaxableAmount><cbc:TaxAmount currencyID="TRY">200.00</cbc:TaxAmount><cbc:Percent>20</cbc:Percent><cac:TaxCategory><cac:TaxScheme><cbc:Name>KDV</cbc:Name><cbc:TaxTypeCode>0015</cbc:TaxTypeCode></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal>
<cac:TaxSubtotal><cbc:TaxableAmount currencyID="TRY">1000.00</cbc:TaxableAmount><cbc:TaxAmount currencyID="TRY">20.00</cbc:TaxAmount><cbc:Percent>2</cbc:Percent><cac:TaxCategory><cac:TaxScheme><cbc:TaxTypeCode>0059</cbc:TaxTypeCode></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal>
<cac:TaxSubtotal><cbc:TaxableAmount currencyID="TRY">1000.00</cbc:TaxableAmount><cbc:TaxAmount currencyID="TRY">100.00</cbc:TaxAmount><cbc:Percent>10</cbc:Percent><cac:TaxCategory><cac:TaxScheme><cbc:Name>ÖİV</cbc:Name><cbc:TaxTypeCode>4080</cbc:TaxTypeCode></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal>
</cac:TaxTotal>
<cac:LegalMonetaryTotal><cbc:LineExtensionAmount currencyID="TRY">1000.00</cbc:LineExtensionAmount><cbc:TaxExclusiveAmount currencyID="TRY">1000.00</cbc:TaxExclusiveAmount><cbc:TaxInclusiveAmount currencyID="TRY">1320.00</cbc:TaxInclusiveAmount><cbc:PayableAmount currencyID="TRY">1320.00</cbc:PayableAmount></cac:LegalMonetaryTotal>
</Invoice>""".encode()
    f = xml_oku(x, "k.xml")
    assert E.konaklama_vergisi(f) == D("20.00")
    assert E.oiv_tutari(f) == D("100.00")
    assert any("İade" in n for n in f.notlar)


def test_kaydedilmeyecek_kurali(tmp_path, monkeypatch):
    """Şahsi fatura (ev elektriği): abone no kuralı → bu ve sonraki aylarda 'Kaydedilmeyecek'; kayıt listesinde de hariç."""
    import io, sys, zipfile
    from pathlib import Path as P
    monkeypatch.setenv("FK_VERI", str(tmp_path / "veri"))
    sys.path.insert(0, str(P(__file__).parent))
    from fastapi.testclient import TestClient
    from fatura_kontrol.web import app as A
    from test_luca_otomasyon import ubl, FIRMA_VKN
    from test_denetim import _mikro
    c = TestClient(A.app)
    ev = ubl("ELK2026000000077", "2026-09-08", "5555555555", FIRMA_VKN, "500.00", "100.00", 20).decode()
    ev = ev.replace("</cbc:IssueDate>", "</cbc:IssueDate><cbc:Note>Tesisat No: 4001 2345 67 - Abone No: 9876543</cbc:Note>", 1)
    zb = io.BytesIO()
    with zipfile.ZipFile(zb, "w") as z:
        z.writestr("a.xml", ubl("AAA2026000000001", "2026-09-05", "1", FIRMA_VKN, "1000.00", "200.00", 20))
        z.writestr("b.xml", ubl("EX02026000000001", "2026-09-10", FIRMA_VKN, "9", "2000.00", "400.00", 20))
        z.writestr("e.xml", ev)
    y = tmp_path / "m.xlsx"; _mikro(y)
    v = c.post("/api/denetim", data={"bas": "2026-09-01", "bit": "2026-09-30", "firma_ad": "ŞAHIS"},
               files=[("faturalar", ("p.zip", zb.getvalue(), "application/zip")), ("muavinler", ("m.xlsx", y.read_bytes(), "application/octet-stream"))]).json()
    rid = v["rapor_id"]
    r = c.get("/api/rapor", params={"id": rid}).json()
    s = next(x for x in r["sonuclar"] if x["belge_no"] == "ELK2026000000077")
    assert s["durum"] == "Muavinde yok"
    ip = c.get("/api/kayit/fatura-ipucu", params={"id": rid, "anahtar": s["anahtar"]}).json()
    assert {o["deger"] for o in ip["oneriler"]} >= {"4001234567", "9876543"}
    assert c.post("/api/kayit/haric-kural", json={"id": rid, "ekle": {"alan": "icerik", "ifade": "12"}}).status_code == 400
    j = c.post("/api/kayit/haric-kural", json={"id": rid, "ekle": {"alan": "icerik", "ifade": "4001 234567", "yon": "ALIS", "aciklama": "Ev elektriği"}}).json()
    assert j["eslesen"] == 1 and len(j["kurallar"]) == 1
    r = c.get("/api/rapor", params={"id": rid}).json()
    s = [x for x in r["sonuclar"] if x["belge_no"] == "ELK2026000000077"]
    assert s and all(x["durum"] == "Kaydedilmeyecek (kullanıcı kararı)" and "Ev elektriği" in x["aciklama"] for x in s)
    # yanlış sayı (başka bir sayının parçası) eşleşmez
    from fatura_kontrol import eslestirme as E
    from tests.test_eslestirme import fatura
    f = fatura(); f.metin = "Abone No: 1400123456789"
    assert not E.kural_eslesir(f, {"alan": "icerik", "ifade": "4001234567", "yon": "*"})
    assert E.kural_eslesir(f, {"alan": "icerik", "ifade": "abone", "yon": "*"})
    # kaldırınca eski hâline döner
    kid = j["kurallar"][0]["id"]
    c.post("/api/kayit/haric-kural", json={"id": rid, "sil": [kid]})
    r = c.get("/api/rapor", params={"id": rid}).json()
    assert next(x for x in r["sonuclar"] if x["belge_no"] == "ELK2026000000077")["durum"] == "Muavinde yok"
