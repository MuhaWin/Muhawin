"""Fatura görüntüleme güvenliği (Görev 05, rapor-02 K1): faturaya gömülü XSLT dosya yazamaz/okuyamaz,
şablondaki script yanıttaki CSP ile çalışmaz; zararsız GİB şablonu yine görüntülenir."""
import base64
import zipfile

import pytest

from test_luca_otomasyon import FIRMA_VKN, ubl

XSL_NS = 'xmlns:xsl="http://www.w3.org/1999/XSL/Transform"'


def fatura(xsl: str, no="AAA2026000000001") -> bytes:
    """Gömülü XSLT şablonlu UBL-TR fatura (GİB'in görsel şablon yeri: AdditionalDocumentReference)."""
    ek = ("<cac:AdditionalDocumentReference><cbc:ID>1</cbc:ID><cac:Attachment>"
          f'<cbc:EmbeddedDocumentBinaryObject mimeCode="application/xml" filename="{no}.xslt">'
          f"{base64.b64encode(xsl.encode()).decode()}</cbc:EmbeddedDocumentBinaryObject>"
          "</cac:Attachment></cac:AdditionalDocumentReference>")
    x = ubl(no, "2026-09-05", "1234567890", FIRMA_VKN, "100", "20", "20").decode()
    return x.replace("<cac:AccountingSupplierParty>", ek + "<cac:AccountingSupplierParty>", 1).encode()


def sablon(govde: str, ek_ns: str = "", ek: str = "") -> str:
    return (f'<xsl:stylesheet version="1.0" {XSL_NS} {ek_ns} {ek}>'
            f'<xsl:template match="/"><html><head><title>GİB</title></head><body>{govde}</body></html>'
            "</xsl:template></xsl:stylesheet>")


ZARARSIZ = sablon('<h1>e-Fatura</h1><p>No: <xsl:value-of select="//*[local-name()=\'ID\'][1]"/></p>'
                  '<xsl:variable name="v"><i>1</i></xsl:variable>'
                  '<p>ns:<xsl:value-of select="count(exsl:node-set($v)/i)"/></p>',
                  ek_ns='xmlns:exsl="http://exslt.org/common"')


def test_zararsiz_gib_sablonu_goruntulenir():
    from fatura_kontrol.goruntu import goruntu_html
    h = goruntu_html(fatura(ZARARSIZ), "Fatura AAA2026000000001")
    assert "<h1>e-Fatura</h1>" in h and "No: AAA2026000000001" in h
    assert "ns:1" in h                                  # exsl:node-set (GİB şablonlarında yaygın) çalışır
    assert "sade görünüm" not in h and "window.print()" in h


@pytest.mark.parametrize("ek_ns,ek,eleman", [
    ('xmlns:exsl="http://exslt.org/common"', 'extension-element-prefixes="exsl"', "exsl:document"),
    ("", "", "xsl:document"),                           # XSLT 1.1 elemanı (libxslt destekler)
])
def test_sablon_dosya_yazamaz(tmp_path, ek_ns, ek, eleman):
    from fatura_kontrol.goruntu import goruntu_html
    hedef = tmp_path / "yazildi.txt"
    xsl = sablon(f'<p>fatura</p><{eleman} href="{hedef.as_posix()}" method="text">SALDIRI</{eleman}>', ek_ns, ek)
    if eleman == "xsl:document":
        xsl = xsl.replace('version="1.0"', 'version="1.1"', 1)
    h = goruntu_html(fatura(xsl), "Fatura X")
    assert not hedef.exists()
    assert "sade görünüm" in h and "AAA2026000000001" in h  # şablon reddedildi → sade görünüm


def test_sablon_yerel_dosya_okuyamaz(tmp_path):
    from fatura_kontrol.goruntu import goruntu_html
    gizli = tmp_path / "gizli.txt"
    gizli.write_text("GIZLI-ICERIK-123", encoding="utf-8")
    xsl = sablon(f"<pre><xsl:value-of select=\"document('{gizli.as_uri()}')\"/></pre>")
    h = goruntu_html(fatura(xsl), "Fatura X")
    assert "GIZLI-ICERIK-123" not in h


def test_sablon_dis_varlik_okuyamaz(tmp_path):
    from fatura_kontrol.goruntu import goruntu_html
    gizli = tmp_path / "gizli.txt"
    gizli.write_text("GIZLI-XXE-456", encoding="utf-8")
    xsl = (f'<!DOCTYPE x [<!ENTITY g SYSTEM "{gizli.as_uri()}">]>'
           + sablon("<pre>&g;</pre>"))
    assert "GIZLI-XXE-456" not in goruntu_html(fatura(xsl), "Fatura X")


def test_goruntu_ucu_csp_basligi(tmp_path, monkeypatch):
    monkeypatch.setenv("FK_VERI", str(tmp_path / "veri"))
    monkeypatch.delenv("FK_ANAHTAR", raising=False)
    from fastapi.testclient import TestClient
    from fatura_kontrol import depo
    from fatura_kontrol.web import app as A
    k = tmp_path / "rapor"; k.mkdir()
    no = "AAA2026000000001"
    xsl = sablon('<p>fatura</p><script>document.title="SALDIRI"</script>'
                 '<a href="javascript:alert(1)" onclick="alert(2)">x</a>')
    with zipfile.ZipFile(k / "faturalar.zip", "w") as z:
        z.writestr(f"gib_efatura_alis/{no}.xml", fatura(xsl, no))
    monkeypatch.setattr(depo, "rapor_klasoru", lambda rid: k)
    r = TestClient(A.app).get("/api/fatura/goruntu", params={"id": "F/2026/09", "belge": no})
    assert r.status_code == 200
    assert "<p>fatura</p>" in r.text                     # şablon görüntülendi
    csp = r.headers.get("content-security-policy", "")
    assert "script-src 'unsafe-hashes' 'sha256-" in csp and "'unsafe-inline'" not in csp
    assert "object-src 'none'" in csp and "base-uri 'none'" in csp
    # izin verilen tek satır içi kod yazdır düğmesinin ifadesi
    import hashlib
    ozet = base64.b64encode(hashlib.sha256(b"window.print()").digest()).decode()
    assert f"'sha256-{ozet}'" in csp
    # bulunamayan fatura 404 (main.js fk-fatura-pdf bu koda bakar)
    assert TestClient(A.app).get("/api/fatura/goruntu", params={"id": "F/2026/09", "belge": "YOK"}).status_code == 404
