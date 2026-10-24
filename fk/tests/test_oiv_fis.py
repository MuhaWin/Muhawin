"""Görev 38: ÖİV'li (TaxTypeCode 4080) fatura okunur; fiş satırları ekranda (e2e) bu çıktıdan kurulur. Örnekler sahtedir."""
from decimal import Decimal as D

from fatura_kontrol.fatura_okuyucu import xml_oku


def oiv_ubl(no="TEL2026000000001", odenecek="1290.00", oiv_adi=""):
    """Telefon faturası: hizmet 1000, ÖİV %7,5 = 75, KDV %20 (1075 üzerinden) = 215, ödenecek 1290 (ya da verilen)."""
    ad = f"<cbc:Name>{oiv_adi}</cbc:Name>" if oiv_adi else ""
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
 xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
 xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
<cbc:ProfileID>TICARIFATURA</cbc:ProfileID><cbc:ID>{no}</cbc:ID><cbc:UUID>{no}-uuid</cbc:UUID>
<cbc:IssueDate>2026-09-15</cbc:IssueDate><cbc:InvoiceTypeCode>SATIS</cbc:InvoiceTypeCode><cbc:DocumentCurrencyCode>TRY</cbc:DocumentCurrencyCode>
<cac:AccountingSupplierParty><cac:Party><cac:PartyIdentification><cbc:ID schemeID="VKN">1234567890</cbc:ID></cac:PartyIdentification>
<cac:PartyName><cbc:Name>ÖRNEK TELEKOM A.Ş.</cbc:Name></cac:PartyName></cac:Party></cac:AccountingSupplierParty>
<cac:AccountingCustomerParty><cac:Party><cac:PartyIdentification><cbc:ID schemeID="VKN">3810463613</cbc:ID></cac:PartyIdentification>
<cac:PartyName><cbc:Name>EXPO</cbc:Name></cac:PartyName></cac:Party></cac:AccountingCustomerParty>
<cac:TaxTotal><cbc:TaxAmount currencyID="TRY">290.00</cbc:TaxAmount>
<cac:TaxSubtotal><cbc:TaxableAmount currencyID="TRY">1000.00</cbc:TaxableAmount><cbc:TaxAmount currencyID="TRY">75.00</cbc:TaxAmount><cbc:Percent>7.5</cbc:Percent>
<cac:TaxCategory><cac:TaxScheme>{ad}<cbc:TaxTypeCode>4080</cbc:TaxTypeCode></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal>
<cac:TaxSubtotal><cbc:TaxableAmount currencyID="TRY">1075.00</cbc:TaxableAmount><cbc:TaxAmount currencyID="TRY">215.00</cbc:TaxAmount><cbc:Percent>20</cbc:Percent>
<cac:TaxCategory><cac:TaxScheme><cbc:Name>KDV</cbc:Name><cbc:TaxTypeCode>0015</cbc:TaxTypeCode></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal></cac:TaxTotal>
<cac:LegalMonetaryTotal><cbc:LineExtensionAmount currencyID="TRY">1000.00</cbc:LineExtensionAmount><cbc:TaxExclusiveAmount currencyID="TRY">1000.00</cbc:TaxExclusiveAmount>
<cbc:TaxInclusiveAmount currencyID="TRY">1290.00</cbc:TaxInclusiveAmount><cbc:PayableAmount currencyID="TRY">{odenecek}</cbc:PayableAmount></cac:LegalMonetaryTotal>
</Invoice>""".encode()


def test_oiv_4080_okunur():
    f = xml_oku(oiv_ubl(), "tel.xml")
    assert f.matrah == D("1000.00") and f.kdv_toplam == D("215.00") and f.odenecek == D("1290.00")
    assert f.diger_vergiler == {"Özel İletişim Vergisi": D("75.00")}
    assert f.kdv_oranlari == {D("20"): D("215.00")}


def test_oiv_adi_kucuk_harf_korunur_ve_taninir():
    """Faturada vergi adı yazılıysa o ad kalır (ekran adı harf / Türkçe karakter duyarsız tanır)."""
    f = xml_oku(oiv_ubl(oiv_adi="özel iletişim vergisi"), "tel.xml")
    assert list(f.diger_vergiler) == ["özel iletişim vergisi"]


def test_yuvarlama_farkli_odenecek():
    f = xml_oku(oiv_ubl(odenecek="1290.03"), "tel.xml")
    assert f.odenecek == D("1290.03") and f.matrah + f.kdv_toplam + sum(f.diger_vergiler.values()) == D("1290.00")
