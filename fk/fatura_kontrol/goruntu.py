"""Fatura görüntüsü: UBL-TR XML'in içindeki GİB görsel şablonu (XSLT) ile HTML üretir.

Şablon yoksa ya da işlenemezse faturanın temel bilgilerinden sade bir görünüm hazırlanır.
Üstte 'Yazdır / PDF olarak kaydet' düğmesi bulunur (tarayıcının yazdır penceresinde 'PDF olarak kaydet').
"""
from __future__ import annotations

import base64
import html
import re
import zipfile
from pathlib import Path

from .fatura_okuyucu import xml_oku

ARAC_CUBUGU = """<div class="fk-arac" style="position:sticky;top:0;z-index:9999;display:flex;gap:10px;align-items:center;
 padding:8px 14px;background:#1f3864;color:#fff;font:14px 'Segoe UI',sans-serif">
 <b style="flex:1">{baslik}</b>
 <button onclick="window.print()" style="padding:6px 14px;border:0;border-radius:6px;background:#fff;color:#1f3864;
  font-weight:600;cursor:pointer">🖨 Yazdır / PDF olarak kaydet</button></div>
<style>@media print{{.fk-arac{{display:none!important}}}}</style>"""


def arsivden_bul(arsiv: Path, belge_no: str) -> bytes | None:
    if not arsiv.exists():
        return None
    anahtar = re.sub(r"[^A-Za-z0-9_-]+", "_", belge_no)
    with zipfile.ZipFile(arsiv) as z:
        for ad in z.namelist():
            if ad.rsplit("/", 1)[-1] == f"{anahtar}.xml":
                return z.read(ad)
    return None


def _xslt(veri: bytes) -> bytes | None:
    m = re.search(rb"<(?:\w+:)?EmbeddedDocumentBinaryObject[^>]*filename=\"[^\"]*\.xslt\"[^>]*>([^<]+)<", veri, re.I) \
        or re.search(rb"<(?:\w+:)?EmbeddedDocumentBinaryObject[^>]*>([^<]+)</(?:\w+:)?EmbeddedDocumentBinaryObject>"
                     rb"(?=[\s\S]{0,400}XSLT)", veri)
    if not m:
        return None
    try:
        return base64.b64decode(m.group(1))
    except ValueError:
        return None


def _sade(veri: bytes) -> str:
    f = xml_oku(veri, "fatura")
    if f is None:
        return "<p>Fatura okunamadı.</p>"
    satir = lambda a, b: f"<tr><th style='text-align:left;padding:4px 10px'>{a}</th><td style='padding:4px 10px'>{html.escape(str(b))}</td></tr>"
    return ("<div style='font:14px Segoe UI,sans-serif;max-width:720px;margin:24px auto'>"
            f"<h2>{html.escape(f.belge_no)}</h2><table>"
            + satir("Tarih", f.tarih.strftime("%d.%m.%Y")) + satir("Satıcı", f"{f.satici_unvan} ({f.satici_vkn})")
            + satir("Alıcı", f"{f.alici_unvan} ({f.alici_vkn})") + satir("Matrah", f.matrah)
            + "".join(satir(f"KDV %{o}", v) for o, v in sorted(f.kdv_oranlari.items()))
            + satir("Vergiler dahil", f.vergiler_dahil) + satir("Ödenecek", f.odenecek)
            + "</table><p style='color:#667085'>Bu belgede görsel şablon bulunmadığı için sade görünüm gösteriliyor.</p></div>")


def goruntu_html(veri: bytes, baslik: str) -> str:
    govde = None
    sablon = _xslt(veri)
    if sablon:
        try:
            from lxml import etree
            donustur = etree.XSLT(etree.fromstring(sablon))
            govde = str(donustur(etree.fromstring(veri)))
        except Exception:
            govde = None
    if not govde:
        govde = _sade(veri)
    arac = ARAC_CUBUGU.format(baslik=html.escape(baslik))
    if re.search(r"<body[^>]*>", govde, re.I):
        return re.sub(r"(<body[^>]*>)", lambda m: m.group(1) + arac, govde, count=1, flags=re.I)
    return f"<!doctype html><meta charset='utf-8'><title>{html.escape(baslik)}</title>{arac}{govde}"
