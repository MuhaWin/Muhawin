"""Görev 35: VKN / TCKN sağlaması, fatura numarası ön eki ve kayıt adaylarında geçmişin eşleşme kaynağı. Veriler sahtedir."""
import io
import sys
import zipfile
from datetime import datetime
from pathlib import Path

import openpyxl
import pytest

from fatura_kontrol.vkn import gecerli, onek, vkn_norm

sys.path.insert(0, str(Path(__file__).parent))
from test_program import istemci  # noqa: E402,F401  (fixture)

FIRMA = "3810463613"
V1, V_GECERSIZ, TC = "1234567890", "1234567891", "10000000146"


def test_vkn_tckn_saglama():
    assert gecerli(V1) and gecerli(FIRMA) and gecerli(TC)
    assert not gecerli(V_GECERSIZ) and not gecerli("10000000147") and not gecerli("01000000146") and not gecerli("1001") and not gecerli("")
    assert vkn_norm(381046361) == "0381046361" and vkn_norm(" 381 046 3613 ") == FIRMA


def test_onek():
    assert onek("abc2026000000001") == "ABC" and onek("GIB2026000000005") == "GIB"
    assert onek("ABC-1") == "" and onek("ABC20260000001") == "" and onek(None) == ""


def _ubl(no, tarih, satici, unvan, matrah="1000.00", kdv="200.00"):
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
<cbc:ProfileID>TEMELFATURA</cbc:ProfileID><cbc:ID>{no}</cbc:ID><cbc:UUID>{no}-uuid</cbc:UUID><cbc:IssueDate>{tarih}</cbc:IssueDate>
<cbc:InvoiceTypeCode>SATIS</cbc:InvoiceTypeCode><cbc:DocumentCurrencyCode>TRY</cbc:DocumentCurrencyCode>
<cac:AccountingSupplierParty><cac:Party><cac:PartyIdentification><cbc:ID schemeID="{'TCKN' if len(satici) == 11 else 'VKN'}">{satici}</cbc:ID></cac:PartyIdentification><cac:PartyName><cbc:Name>{unvan}</cbc:Name></cac:PartyName></cac:Party></cac:AccountingSupplierParty>
<cac:AccountingCustomerParty><cac:Party><cac:PartyIdentification><cbc:ID schemeID="VKN">{FIRMA}</cbc:ID></cac:PartyIdentification><cac:PartyName><cbc:Name>EXPO</cbc:Name></cac:PartyName></cac:Party></cac:AccountingCustomerParty>
<cac:TaxTotal><cbc:TaxAmount currencyID="TRY">{kdv}</cbc:TaxAmount><cac:TaxSubtotal><cbc:TaxableAmount currencyID="TRY">{matrah}</cbc:TaxableAmount><cbc:TaxAmount currencyID="TRY">{kdv}</cbc:TaxAmount><cbc:Percent>20</cbc:Percent>
<cac:TaxCategory><cac:TaxScheme><cbc:TaxTypeCode>0015</cbc:TaxTypeCode></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal></cac:TaxTotal>
<cac:LegalMonetaryTotal><cbc:TaxExclusiveAmount currencyID="TRY">{matrah}</cbc:TaxExclusiveAmount><cbc:TaxInclusiveAmount currencyID="TRY">{float(matrah) + float(kdv):.2f}</cbc:TaxInclusiveAmount>
<cbc:PayableAmount currencyID="TRY">{float(matrah) + float(kdv):.2f}</cbc:PayableAmount></cac:LegalMonetaryTotal></Invoice>""".encode()


def _muavin(yol):
    """Kayıtlı iki fatura: ABC…1 (V1, 320.01.001) ve GIB…4 (geçersiz VKN, 320.01.002)."""
    bas = ("TARİH", "TİP", "FİŞ NO", "AÇIKLAMA", "BORÇ", "ALACAK", "BAKİYE", "B/A")
    wb = openpyxl.Workbook(); ws = wb.active
    for r in [("MUAVİN DEFTER",), ("EXPO",), ("Tarih Aralığı :", "01/01/2026-31/12/2026"),
              ("320.01.001 SATICI A",), bas, (datetime(2026, 9, 5), "Mahsup", "1", "05/09/2026-ABC2026000000001-SATICI A", None, 1200),
              ("320.01.002 SATICI B",), bas, (datetime(2026, 9, 6), "Mahsup", "2", "06/09/2026-GIB2026000000004-SATICI B", None, 1200),
              ("770.01 GENEL GİDER",), bas, (datetime(2026, 9, 5), "Mahsup", "1", "05/09/2026-ABC2026000000001-SATICI A", 1000, None),
              (datetime(2026, 9, 6), "Mahsup", "2", "06/09/2026-GIB2026000000004-SATICI B", 1000, None),
              ("191.10.20 %20 İndirilecek KDV",), bas, (datetime(2026, 9, 5), "Mahsup", "1", "05/09/2026-ABC2026000000001-SATICI A", 200, None),
              (datetime(2026, 9, 6), "Mahsup", "2", "06/09/2026-GIB2026000000004-SATICI B", 200, None)]:
        ws.append(r)
    wb.save(yol)


def test_adaylar_vkn_onek(istemci, tmp_path):  # noqa: F811
    c, _ = istemci
    m = tmp_path / "muavin.xlsx"; _muavin(m)
    zb = io.BytesIO()
    with zipfile.ZipFile(zb, "w") as z:
        z.writestr("1.xml", _ubl("ABC2026000000001", "2026-09-05", V1, "SATICI A"))
        z.writestr("2.xml", _ubl("ABC2026000000002", "2026-09-15", V1, "SATICI A TİCARET"))        # aynı VKN, ünvan farklı yazılmış
        z.writestr("4.xml", _ubl("GIB2026000000004", "2026-09-06", V_GECERSIZ, "SATICI B"))
        z.writestr("5.xml", _ubl("GIB2026000000005", "2026-09-16", V_GECERSIZ, "SATICI B"))
        z.writestr("6.xml", _ubl("XYZ2026000000006", "2026-09-17", TC, "AHMET YILMAZ"))
        z.writestr("7.xml", _ubl("XYZ2026000000007", "2026-09-18", V1, "SATICI A"))
    r = c.post("/api/kontrol", data={"bas": "2026-09-01", "bit": "2026-09-30"},
               files=[("faturalar", ("p.zip", zb.getvalue(), "application/zip")), ("muavinler", ("muavin.xlsx", m.read_bytes(), "application/octet-stream"))])
    assert r.status_code == 200, r.text
    a = c.get("/api/kayit/adaylar", params={"id": r.json()["id"]}).json()
    f = {x["belge_no"]: x for x in a["faturalar"]}
    # VKN geçerli, geçmiş VKN ile bulundu (ünvan farklı yazılsa da)
    x = f["ABC2026000000002"]
    assert x["vkn_gecerli"] and x["gecmis"]["eslesme"] == "vkn" and x["gecmis"]["cari"] == "320.01.001"
    # ön ek ABC: yalnız V1 kullanmış, muavinde tek cariye kaydedilmiş → güçlü
    assert x["onek"] == {"ek": "ABC", "firma": 1, "genel": False, "cari": "320.01.001"}
    # geçersiz VKN: işaretlenir; GIB genel ön ek → cari göstermez
    y = f["GIB2026000000005"]
    assert not y["vkn_gecerli"] and y["onek"]["genel"] and y["onek"]["cari"] is None
    # XYZ ön ekini iki karşı taraf kullanmış → güçlü değil; TCKN geçerli
    z = f["XYZ2026000000006"]
    assert z["vkn_gecerli"] and z["onek"]["firma"] == 2 and z["onek"]["cari"] is None
