"""Eşleştirme motorunun hata senaryolarını yapay verilerle sınar."""
from datetime import date
from decimal import Decimal as D

from fatura_kontrol import eslestirme as E
from fatura_kontrol.fatura_okuyucu import Fatura, xml_oku
from fatura_kontrol.muavin_okuyucu import MuavinSatiri, aciklama_ayristir


def fatura(no="ABC2026000000001", kdv=None, tarih=date(2026, 9, 2), unvan="ÖRNEK GIDA LTD ŞTİ"):
    kdv = kdv or {D(20): D("200.00")}
    f = Fatura("t.xml", None, no, tarih, "TEMELFATURA", "SATIS", "TRY", "1111111111", unvan,
               "3810463613", "EXPO", sum(v * 5 for v in kdv.values()), sum(kdv.values()), D(0),
               kdv_oranlari=kdv)
    f.yon = "ALIS"
    return f


def satir(no="ABC2026000000001", tutar="200.00", hesap="191.10.20", adi="%20 İndirilecek KDV",
          fis=date(2026, 9, 30), belge_t=date(2026, 9, 2), unvan="ÖRNEK GIDA LTD ŞTİ", fis_no="1"):
    acik = f"{belge_t:%d/%m/%Y}-{no}-{unvan}"
    bt, bn, u = aciklama_ayristir(acik)
    return MuavinSatiri("m.xlsx", 1, hesap, adi, fis, "Mahsup", fis_no, acik, D(tutar), D(0), bt, bn, u)


def durum(faturalar, muavin):
    return [s.durum for s in E.esle(faturalar, muavin).sonuclar]


def test_uyumlu():
    assert durum([fatura()], [satir()]) == [E.UYUMLU]


def test_tutar_farki():
    assert durum([fatura()], [satir(tutar="180.00")]) == [E.TUTAR_FARKI]


def test_kurus_toleransi():
    assert durum([fatura()], [satir(tutar="200.03")]) == [E.UYUMLU]


def test_muavinde_yok():
    assert durum([fatura()], [satir(no="XYZ2026000000999", unvan="BAŞKA FİRMA", tutar="50")]) == [E.MUAVINDE_YOK]


def test_yanlis_oran_hesabi():
    r = durum([fatura()], [satir(hesap="191.10.10", adi="%10 İndirilecek KDV")])
    assert r == [E.ORAN_HATASI]


def test_mukerrer():
    assert durum([fatura()], [satir(fis_no="1"), satir(fis_no="2")]) == [E.MUKERRER]


def test_sonraki_donemde_kayit():
    assert durum([fatura()], [satir(fis=date(2026, 10, 31))]) == [E.DONEM_FARKI]


def test_belge_no_yazim_hatasi():
    r = E.esle([fatura()], [satir(no="ABC2026000000010")])
    assert [s.durum for s in r.sonuclar] == [E.BELGE_NO_SUPHELI]
    assert r.faturasi_olmayanlar == []          # aday kayıt ikinci kez listelenmez


def test_cok_oranli_fatura():
    f = fatura(kdv={D(1): D("10"), D(10): D("50"), D(20): D("100")})
    m = [satir(tutar="10", hesap="191.10.01", adi="%1 İndirilecek KDV"),
         satir(tutar="50", hesap="191.10.10", adi="%10 İndirilecek KDV"),
         satir(tutar="100")]
    assert durum([f], m) == [E.UYUMLU]


def test_faturasi_olmayan_kayit():
    r = E.esle([fatura()], [satir(), satir(no="QQQ2026000000005", unvan="DİĞER", tutar="77")])
    assert [s.belge_no for s in r.faturasi_olmayanlar] == ["QQQ2026000000005"]


def test_aciklama_ayristirma():
    assert aciklama_ayristir("02/09/2026-SM52026000046334-Sütaş Süt Ürünleri A.Ş.") == \
        (date(2026, 9, 2), "SM52026000046334", "Sütaş Süt Ürünleri A.Ş.")
    assert aciklama_ayristir("Ağustos Ayı KDV Tahakkuk")[1] is None


def test_xml_olmayan_dosya():
    assert xml_oku(b"<ApplicationResponse/>", "x") is None
    assert xml_oku(b"bozuk", "x") is None


def test_fatura_tarihinden_once_kayit():
    f = fatura(tarih=date(2026, 10, 1))
    assert durum([f], [satir(belge_t=date(2026, 10, 1), fis=date(2026, 9, 30))]) == [E.ERKEN_KAYIT]


def test_donem_disi_kayitsiz_fatura():
    r = E.esle([fatura(tarih=date(2026, 10, 5))], [satir(no="QQQ2026000000002", unvan="DİĞER")],
               donem=(date(2026, 9, 1), date(2026, 9, 30)))
    assert [s.durum for s in r.sonuclar] == [E.DONEM_DISI]


def test_kdvsiz_fatura():
    assert durum([fatura(kdv={D(0): D(0)})], [satir(no="ZZZ2026000000001", unvan="X")]) == [E.KDVSIZ]


def test_kucuk_fark():
    assert durum([fatura()], [satir(tutar="200.40")]) == [E.KURUS_FARKI]


HEPSI = ("KDV", "Matrah", "Fiş toplamı")     # kapalı kontroller de çalışır durumda kalsın


def test_varsayilan_yalniz_kdv():
    f = fatura()
    f.matrah_oranlari = {D(20): D("1000.00")}
    f.vergiler_dahil = D("1200.00")
    m = [_fis_satiri("191.10.20", "%20 İndirilecek KDV", borc="200"),
         _fis_satiri("790.20", "Atlas-Gib Alış Matrahı %20", borc="900"),     # matrah farklı
         _fis_satiri("320.01", "Satıcılar", alacak="1100")]                   # fiş toplamı farklı
    r = E.esle([f], m)
    assert {(s.kontrol, s.durum) for s in r.sonuclar} == {("KDV", E.UYUMLU)}
    assert r.calisan_kontroller and all("KDV" in k and "Matrah" not in k for k in r.calisan_kontroller)


def _fis_satiri(hesap, adi, borc="0", alacak="0", no="ABC2026000000001"):
    s = satir(no=no, hesap=hesap, adi=adi, tutar="0")
    s.borc, s.alacak = D(borc), D(alacak)
    return s


def test_fis_bazli_kontrol_hesap_planindan_bagimsiz():
    f = fatura()                              # matrah 1000, KDV 200
    f.matrah_oranlari = {D(20): D("1000.00")}
    f.vergiler_dahil = D("1200.00")
    m = [_fis_satiri("191.10.20", "%20 İndirilecek KDV", borc="200"),
         _fis_satiri("790.20", "Atlas-Gib Alış Matrahı %20", borc="1000"),
         _fis_satiri("309.02", "Vakıfbank Kredi Kartı", alacak="1200")]
    r = E.esle([f], m, kontroller=HEPSI)
    assert {(s.kontrol, s.durum) for s in r.sonuclar} == {
        ("KDV", E.UYUMLU), ("Matrah", E.UYUMLU), ("Fiş toplamı", E.UYUMLU)}
    m[2].alacak = D("1100")
    r = E.esle([f], m, kontroller=HEPSI)
    assert ("Fiş toplamı", E.TUTAR_FARKI) in {(s.kontrol, s.durum) for s in r.sonuclar}


def test_iade_faturasinda_matrah_kontrolu_yapilmaz():
    f = fatura(no="EX12026000000005")
    f.yon, f.tip = "SATIS", "IADE"
    f.vergiler_dahil = D("1200.00")
    m = [_fis_satiri("150.10.09", "Yiyecek Malzeme Alışları", alacak="1000", no="EX12026000000005"),
         _fis_satiri("391.03.21", "Alınan Malların İadesi", alacak="200", no="EX12026000000005"),
         _fis_satiri("309.02", "Vakıfbank Kredi Kartı", borc="1200", no="EX12026000000005"),
         _fis_satiri("600.10.10.01", "Yiyecek Gelirleri", alacak="5", no="ZZZ2026000000009")]
    r = E.esle([f], m, kontroller=HEPSI)
    assert {(s.kontrol, s.durum) for s in r.sonuclar} == {("KDV", E.UYUMLU), ("Fiş toplamı", E.UYUMLU)}


def test_esmm_okuma():
    from fatura_kontrol.fatura_okuyucu import xml_oku
    x = """<?xml version="1.0" encoding="UTF-8"?><eArsivVeri xmlns="http://earsiv.efatura.gov.tr">
<baslik><mukellef><tckn>12345678901</tckn></mukellef></baslik>
<serbestMeslekMakbuz><makbuzNo>SMM2026000000705</makbuzNo><ETTN>e1</ETTN><belgeTarihi>2026-09-30</belgeTarihi>
<odenecekTutar>1000.00</odenecekTutar><paraBirimi>TRY</paraBirimi>
<vergiBilgisi><vergi><matrah>1000.00</matrah><vergiKodu>0015</vergiKodu><vergiTutari>200.00</vergiTutari></vergi>
<vergi><matrah>1000.00</matrah><vergiKodu>0003</vergiKodu><vergiTutari>200.00</vergiTutari></vergi></vergiBilgisi>
<aliciBilgileri><tuzelKisi><vkn>3810463613</vkn><unvan>EXPO</unvan></tuzelKisi></aliciBilgileri>
<malHizmetBilgisi><malHizmet><burutUcret>1000.00</burutUcret></malHizmet></malHizmetBilgisi></serbestMeslekMakbuz></eArsivVeri>""".encode()
    f = xml_oku(x, "smm.xml")
    assert f.belge_no == "SMM2026000000705" and f.alici_vkn == "3810463613" and f.satici_vkn == "12345678901"
    assert f.kdv_oranlari == {D(20): D("200.00")} and f.vergiler_dahil == D("1200.00")
    assert f.diger_vergiler == {"Gelir Vergisi Stopajı": D("200.00")} and f.tevkifat == 0


def test_matrah_hesabi_yoksa_matrah_kontrolu_atlanir():
    f = fatura()
    f.matrah_oranlari = {D(20): D("1000.00")}
    f.vergiler_dahil = D("1200.00")
    m = [_fis_satiri("191.10.20", "%20 İndirilecek KDV", borc="200"),
         _fis_satiri("770.02.20", "Muhasebe Giderleri", borc="1000"),
         _fis_satiri("320.01", "Satıcılar", alacak="1200"),
         _fis_satiri("790.20", "Atlas-Gib Alış Matrahı %20", borc="5", no="ZZZ2026000000009")]
    r = E.esle([f], m, kontroller=HEPSI)
    assert {(s.kontrol, s.durum) for s in r.sonuclar} == {("KDV", E.UYUMLU), ("Fiş toplamı", E.UYUMLU)}


def test_binek_arac_yuzde_70():
    """Fişte adında 'Binek' geçen hesap varsa KDV'nin %70'i beklenir ve ayrı kategoride gösterilir."""
    f = fatura()                                       # KDV 200 (%20)
    m = [_fis_satiri("191.10.20", "%20 İndirilecek KDV", borc="140"),
         _fis_satiri("770.05", "Binek Araç Giderleri", borc="1060"),
         _fis_satiri("320.01", "Satıcılar", alacak="1200")]
    r = E.esle([f], m)
    assert [(s.kontrol, s.durum) for s in r.sonuclar] == [("KDV", E.BINEK_UYUMLU)]
    assert r.sonuclar[0].fatura_tutari == D("140.00") and "%70" in r.sonuclar[0].aciklama
    m[0].borc = D("200")                               # tamamı indirilmiş → fark
    r = E.esle([f], m)
    assert r.sonuclar[0].durum == E.BINEK_FARK
    # binek hesabı yoksa normal kontrol
    m2 = [_fis_satiri("191.10.20", "%20 İndirilecek KDV", borc="200"), _fis_satiri("770.05", "Kırtasiye", borc="1000")]
    assert [s.durum for s in E.esle([f], m2).sonuclar] == [E.UYUMLU]


def test_ihrac_kayitli_ve_istisna():
    """İhraç kayıtlı: faturadaki KDV tahsil edilmez; muavinde KDV yoksa uyumlu.
    İstisna: KDV'siz fatura, gerekçesiyle 'İstisna – uyumlu'. Fatura tipi raporda yazılır."""
    f = fatura(no="ABC2026000000001")                        # KDV 200 hesaplanmış
    f.tip, f.istisna = "IHRACKAYITLI", "701 - 3065 s. KDV K. 11/1-c md. kapsamındaki teslimler"
    baska = _fis_satiri("191.10.20", "%20 İndirilecek KDV", borc="50", no="ZZZ2026000000009")   # muavinde 191 var
    m = [_fis_satiri("153.01", "Ticari Mallar", borc="1000"), _fis_satiri("320.01", "Satıcılar", alacak="1000"), baska]
    r = E.esle([f], m)
    assert [s.durum for s in r.sonuclar if s.fatura is f] == [E.IHRACKAYITLI_UYUMLU]
    assert "tahsil edilmemiş" in r.sonuclar[0].aciklama and E.fatura_tipi(f).startswith("İhraç kayıtlı · 701")
    # muavinde KDV de yazılmışsa normal kontrol
    m2 = m + [_fis_satiri("191.10.20", "%20 İndirilecek KDV", borc="200")]
    assert [s.durum for s in E.esle([f], m2).sonuclar] == [E.UYUMLU]
    # istisna (KDV 0)
    g = fatura(no="ABC2026000000002", kdv={D(0): D(0)})
    g.matrah = D(1000)
    g.tip, g.istisna = "ISTISNA", "301 - 11/1-a Mal ihracatı"
    m3 = [_fis_satiri("153.01", "Ticari Mallar", borc="1000", no="ABC2026000000002"),
          _fis_satiri("320.01", "Satıcılar", alacak="1000", no="ABC2026000000002"), baska]
    r = E.esle([g], m3)
    assert [s.durum for s in r.sonuclar] == [E.ISTISNA_UYUMLU] and "301" in r.sonuclar[0].aciklama


def test_muavinde_kaydi_olmayan_ihracat_uyumlu():
    """KDV'siz ihracat / istisna satış faturası muavinde hiç yoksa: KDV açısından uyumlu, ayrı kategoride."""
    g = fatura(no="UKI2026000000044", kdv={D(0): D(0)})
    g.yon, g.tip, g.profil, g.istisna = "SATIS", "ISTISNA", "IHRACAT", "301 - 11/1 - a Mal ihracatı"
    normal = fatura(no="UKI2026000000045")
    normal.yon = "SATIS"
    m = [_fis_satiri("601.01", "Blok Mermer Satışları", alacak="1000", no="UKI2026000000043"),
         _fis_satiri("120.01", "Alıcılar", borc="1000", no="UKI2026000000043"),
         _fis_satiri("391.01.20", "%20 Hesaplanan KDV", alacak="200", no="UKI2026000000045")]
    r = E.esle([g, normal], m, donem=(date(2026, 9, 1), date(2026, 9, 30)))
    d = {s.fatura.belge_no: s for s in r.sonuclar}
    assert d["UKI2026000000044"].durum == E.ISTISNA_KAYITSIZ
    assert E.ISTISNA_KAYITSIZ in E.BILGI_DURUMLARI and "GÇB" in d["UKI2026000000044"].aciklama
    # KDV'li normal satış muavinde yoksa hâlâ sorun
    k = fatura(no="UKI2026000000099")
    k.yon = "SATIS"
    assert E.esle([k], m, donem=(date(2026, 9, 1), date(2026, 9, 30))).sonuclar[0].durum == E.MUAVINDE_YOK


KOMISYONCU_XML = """<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
 xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
 xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
<cbc:ProfileID>HKS</cbc:ProfileID><cbc:ID>MUS2026000000137</cbc:ID><cbc:UUID>A32CECE8-0673-42A7-B951-B4E4D8DEE550</cbc:UUID>
<cbc:IssueDate>2026-09-01</cbc:IssueDate><cbc:InvoiceTypeCode>KOMISYONCU</cbc:InvoiceTypeCode><cbc:DocumentCurrencyCode>TRY</cbc:DocumentCurrencyCode>
<cac:AccountingSupplierParty><cac:Party><cac:PartyIdentification><cbc:ID schemeID="VKN">5411183332</cbc:ID></cac:PartyIdentification>
<cac:PartyName><cbc:Name>KAZIM AKBULUT YAŞ SEBZE MEYVE KOM. LTD.ŞTİ.</cbc:Name></cac:PartyName></cac:Party></cac:AccountingSupplierParty>
<cac:AccountingCustomerParty><cac:Party><cac:PartyIdentification><cbc:ID schemeID="VKN">4740375420</cbc:ID></cac:PartyIdentification>
<cac:PartyName><cbc:Name>İMÖZ TARIM GIDA İNŞAAT TUR.SAN.TİC.LTD.ŞTİ</cbc:Name></cac:PartyName></cac:Party></cac:AccountingCustomerParty>
<cac:AllowanceCharge><cbc:ChargeIndicator>false</cbc:ChargeIndicator><cbc:AllowanceChargeReason>Komisyon</cbc:AllowanceChargeReason><cbc:MultiplierFactorNumeric>0.08</cbc:MultiplierFactorNumeric><cbc:Amount currencyID="TRY">1408.00</cbc:Amount></cac:AllowanceCharge>
<cac:AllowanceCharge><cbc:ChargeIndicator>false</cbc:ChargeIndicator><cbc:AllowanceChargeReason>Komisyon KDV</cbc:AllowanceChargeReason><cbc:MultiplierFactorNumeric>0.20</cbc:MultiplierFactorNumeric><cbc:Amount currencyID="TRY">281.60</cbc:Amount></cac:AllowanceCharge>
<cac:AllowanceCharge><cbc:ChargeIndicator>false</cbc:ChargeIndicator><cbc:AllowanceChargeReason>Navlun</cbc:AllowanceChargeReason><cbc:Amount currencyID="TRY">1600.00</cbc:Amount></cac:AllowanceCharge>
<cac:AllowanceCharge><cbc:ChargeIndicator>false</cbc:ChargeIndicator><cbc:AllowanceChargeReason>Diğer Masraflar</cbc:AllowanceChargeReason><cbc:Amount currencyID="TRY">176.00</cbc:Amount></cac:AllowanceCharge>
<cac:AllowanceCharge><cbc:ChargeIndicator>false</cbc:ChargeIndicator><cbc:AllowanceChargeReason>Diğer KDV</cbc:AllowanceChargeReason><cbc:MultiplierFactorNumeric>0.20</cbc:MultiplierFactorNumeric><cbc:Amount currencyID="TRY">35.20</cbc:Amount></cac:AllowanceCharge>
<cac:TaxTotal><cbc:TaxAmount currencyID="TRY">176.00</cbc:TaxAmount><cac:TaxSubtotal>
<cbc:TaxableAmount currencyID="TRY">17600.00</cbc:TaxableAmount><cbc:TaxAmount currencyID="TRY">176.00</cbc:TaxAmount><cbc:Percent>1</cbc:Percent>
<cac:TaxCategory><cac:TaxScheme><cbc:TaxTypeCode>0015</cbc:TaxTypeCode></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal></cac:TaxTotal>
<cac:LegalMonetaryTotal><cbc:LineExtensionAmount currencyID="TRY">17600.00</cbc:LineExtensionAmount><cbc:TaxExclusiveAmount currencyID="TRY">17600.00</cbc:TaxExclusiveAmount>
<cbc:TaxInclusiveAmount currencyID="TRY">17776.00</cbc:TaxInclusiveAmount><cbc:AllowanceTotalAmount currencyID="TRY">3500.80</cbc:AllowanceTotalAmount>
<cbc:PayableAmount currencyID="TRY">14275.20</cbc:PayableAmount></cac:LegalMonetaryTotal>
<cac:InvoiceLine><cbc:ID>1</cbc:ID><cbc:InvoicedQuantity unitCode="KGM">800</cbc:InvoicedQuantity><cbc:LineExtensionAmount currencyID="TRY">17600.00</cbc:LineExtensionAmount><cac:Item><cbc:Name>DOMATES</cbc:Name></cac:Item></cac:InvoiceLine>
</Invoice>""".encode()


def test_komisyoncu_faturasi():
    """HKS komisyoncu faturası: mal sahibine alış olarak gelir; mal KDV'si 391'de, masraf KDV'leri 191'de aranır."""
    from datetime import date
    from decimal import Decimal as D
    from fatura_kontrol.fatura_okuyucu import xml_oku
    from fatura_kontrol.muavin_okuyucu import MuavinSatiri
    from fatura_kontrol.eslestirme import esle, UYUMLU
    f = xml_oku(KOMISYONCU_XML, "kom.xml"); f.yon = "ALIS"
    assert f.komisyoncu and f.odenecek == D("14275.20") and f.kdv_toplam == D("176.00")
    m = {x["ad"]: x for x in f.masraflar}
    assert set(m) == {"Komisyon", "Navlun", "Diğer Masraflar"}
    assert m["Komisyon"]["tutar"] == D("1408.00") and m["Komisyon"]["oran"] == D("8") and m["Komisyon"]["kdv"] == D("281.60")
    assert m["Navlun"]["kdv"] == 0 and m["Diğer Masraflar"]["kdv"] == D("35.20")
    assert f.masraf_kdv == D("316.80") and f.masraf_kdv_oranlari == {D("20"): D("316.80")}
    assert f.vergiler_dahil - sum(x["tutar"] + x["kdv"] for x in f.masraflar) == f.odenecek

    def s(kod, ad, b, a):
        return MuavinSatiri("m", 1, kod, ad, date(2026, 9, 1), "Mahsup", "755", "01/09/2026-MUS2026000000137-KAZIM AKBULUT",
                            D(b), D(a), date(2026, 9, 1), "MUS2026000000137", "KAZIM AKBULUT")
    muavin = [s("600.01", "% 1 Lik Hasılat", 0, "17600"), s("391.01.01", "%1 lik Hesaplanan KDV", 0, "176"),
              s("120.K.002", "Kazım Akbulut", "14275.20", 0), s("760.05", "Kom.Giderleri", "1408", 0),
              s("191.01.20", "%20 Lik İndirilecek KDV", "281.60", 0), s("760.08", "Navlun Giderleri", "1600", 0),
              s("760.05", "Kom.Giderleri", "176", 0), s("191.01.20", "%20 Lik İndirilecek KDV", "35.20", 0)]
    r = esle([f], muavin, donem=(date(2026, 9, 1), date(2026, 9, 30)))
    kdv = [x for x in r.sonuclar if x.kontrol == "KDV"]
    assert len(kdv) == 2 and all(x.durum == UYUMLU for x in kdv), [(x.durum, x.fatura_tutari, x.muavin_tutari, x.aciklama) for x in r.sonuclar]
    assert sorted(x.fatura_tutari for x in kdv) == [D("176.00"), D("316.80")]
    # 191'e mal KDV'si (176) yazılmışsa hata yakalanır
    yanlis = [x for x in muavin if not x.hesap_kodu.startswith("391")] + [s("191.01.01", "%1 İndirilecek KDV", "176", 0)]
    r2 = esle([f], yanlis, donem=(date(2026, 9, 1), date(2026, 9, 30)))
    assert any(x.durum != UYUMLU for x in r2.sonuclar if x.kontrol == "KDV")


# ---- fatura no + ay; yıl geneli yalnız aynı cari (2.8.1) ----
def test_ayni_no_baska_ayda_baska_firma_eslesmez():
    # Eylül faturası: Eylül muavininde yok; aynı no Ağustos'ta BAŞKA bir firmaya ait → muavinde yok sayılır
    m = [satir(fis=date(2026, 8, 31), belge_t=date(2026, 8, 5), unvan="BAŞKA YAPI MALZEMELERİ A.Ş.", tutar="999")]
    r = E.esle([fatura()], m, donem=(date(2026, 9, 1), date(2026, 9, 30)))
    assert [s.durum for s in r.sonuclar] == [E.MUAVINDE_YOK]
    assert "bu firmaya ait kayıt bulunamadı" in r.sonuclar[0].aciklama


def test_ayni_no_iki_ayda_faturanin_ayi_secilir():
    # aynı numara Ağustos'ta başka firmada (farklı tutar), Eylül'de doğru firmada → Eylül kaydıyla uyumlu
    m = [satir(fis=date(2026, 8, 31), belge_t=date(2026, 8, 5), unvan="BAŞKA YAPI MALZEMELERİ A.Ş.", tutar="999", fis_no="7"),
         satir(fis_no="12")]
    r = E.esle([fatura()], m)
    assert [s.durum for s in r.sonuclar] == [E.UYUMLU]
    assert [s.fis_no for s in r.sonuclar[0].satirlar] == ["12"]


def test_ayni_ayda_iki_firma_cari_ile_ayrilir():
    m = [satir(unvan="BAŞKA YAPI MALZEMELERİ A.Ş.", tutar="999", fis_no="7"), satir(fis_no="12")]
    assert durum([fatura()], m) == [E.UYUMLU]


def test_yil_icinde_ayni_cari_sonraki_ayda():
    m = [satir(fis=date(2026, 10, 15), belge_t=date(2026, 10, 15))]
    assert durum([fatura()], m) == [E.DONEM_FARKI]


def test_binek_689_arac_yakit():
    """Fişte bu faturaya ait 689 satırında araç / yakıt geçiyorsa fatura binek araç gibi kontrol edilir."""
    f = fatura()                                       # KDV 200
    m = [_fis_satiri("191.10.20", "%20 İndirilecek KDV", borc="140"),
         _fis_satiri("760.01", "Pazarlama Giderleri", borc="1000"),
         _fis_satiri("689.01", "Diğer Olağandışı Gider ve Zararlar", borc="60"),
         _fis_satiri("320.01", "Satıcılar", alacak="1200")]
    m[2].aciklama = "02/09/2026-ABC2026000000001-ARAÇ YAKIT KKEG"
    r = E.esle([f], m)
    assert [(s.kontrol, s.durum) for s in r.sonuclar] == [("KDV", E.BINEK_UYUMLU)]
    assert "689" in r.sonuclar[0].aciklama
    # 689'da araç/yakıt geçmiyorsa binek sayılmaz → %70 kayıt tutar farkı olur
    m[2].aciklama = "02/09/2026-ABC2026000000001-CEZA"
    assert [s.durum for s in E.esle([f], m).sonuclar] == [E.TUTAR_FARKI]
    # başka faturaya ait fişteki 689 araç satırı bu faturayı binek yapmaz
    m3 = [_fis_satiri("191.10.20", "%20 İndirilecek KDV", borc="200"),
          _fis_satiri("191.10.20", "%20 İndirilecek KDV", borc="20", no="XYZ2026000000005"),
          _fis_satiri("689.01", "KKEG", borc="6")]
    m3[2].aciklama, m3[2].belge_no = "araç yakıt", None
    assert [s.durum for s in E.esle([f], m3).sonuclar][0] == E.UYUMLU


def test_evrak_no_kisa_yazilmis():
    """AAA2026000000889 muavinde 'AAA-889' / 'aaa889' yazılmışsa bulunur; tek hane hatası (aaa899) şüpheli olarak önerilir."""
    f = fatura(no="AAA2026000000889")
    for yazim in ("AAA-889", "aaa889", "AAA 2026/889", "AAA000889"):
        s = satir(no="X")
        s.aciklama = f"02/09/2026-{yazim}-ÖRNEK GIDA LTD ŞTİ"
        s.belge_tarihi, s.belge_no, s.unvan = E.aciklama_ayristir(s.aciklama) if hasattr(E, "aciklama_ayristir") else aciklama_ayristir(s.aciklama)
        r = E.esle([f], [s])
        assert [x.durum for x in r.sonuclar] == [E.UYUMLU], yazim
        assert "kısa/farklı yazılmış" in r.sonuclar[0].aciklama and not r.fatura_disi
    s = satir(no="X"); s.aciklama = "02/09/2026-AAA-899-ÖRNEK GIDA LTD ŞTİ"
    s.belge_tarihi, s.belge_no, s.unvan = aciklama_ayristir(s.aciklama)
    r = E.esle([f], [s])
    assert [x.durum for x in r.sonuclar] == [E.BELGE_NO_SUPHELI] and "yazım hatası" in r.sonuclar[0].aciklama
    s.borc = D("150")                                  # tutar da tutmuyorsa önerilmez
    assert [x.durum for x in E.esle([f], [s]).sonuclar] == [E.MUAVINDE_YOK]
    # başka seri / başka cari: eşleşmez
    s2 = satir(no="X"); s2.aciklama = "02/09/2026-BBB-889-ÖRNEK GIDA LTD ŞTİ"; s2.belge_tarihi, s2.belge_no, s2.unvan = aciklama_ayristir(s2.aciklama)
    r2 = E.esle([f], [s2])                             # kısa no ile bulunmaz; tarih + tutar + ünvan aynı → eski kural: şüpheli
    assert [x.durum for x in r2.sonuclar] == [E.BELGE_NO_SUPHELI] and "kısa/farklı" not in r2.sonuclar[0].aciklama
    s3 = satir(no="X"); s3.aciklama = "02/09/2026-AAA-889-BAŞKA FİRMA AŞ"; s3.belge_tarihi, s3.belge_no, s3.unvan = aciklama_ayristir(s3.aciklama)
    assert [x.durum for x in E.esle([f], [s3]).sonuclar] == [E.MUAVINDE_YOK]
    assert E.fatura_kisa("AAA2026000000889") == ("AAA", 2026, 889) and E._tek_hane_farki(889, 898) and not E._tek_hane_farki(889, 988)
