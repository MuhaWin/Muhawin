"""Muhasebe Denetimi › Raporlama: KDV ve matrah kontrolü + detay denetim sonuçları (yazdırılabilir HTML)."""
from __future__ import annotations

import html as H
from datetime import datetime

from .detay import DURUM_AD


def _tl(x) -> str:
    return f"{float(x or 0):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def _t(d) -> str:
    return ".".join(reversed(str(d or "")[:10].split("-"))) if d else ""


def _e(x) -> str:
    return H.escape(str(x if x is not None else ""))


def _kontrol_bolumu(v: dict, ad: str, baslik: str) -> str:
    o = (v.get("ozet") or {}).get(ad) or {}
    L = [s for s in v.get("sonuclar", []) if (s["kontrol"] == ad or (ad == "KDV" and s["kontrol"] == "Kayıt")) and s["sorunlu"]]
    durum = "".join(f"<tr><td>{_e(d['ad'])}</td><td class=n>{d['adet']}</td><td>{'sorunlu' if d['sorunlu'] else 'uygun'}</td></tr>"
                    for d in o.get("durumlar", []))
    satir = "".join(f"<tr><td>{_e(s['durum'])}</td><td class=m>{_e(s['belge_no'])}</td><td>{_t(s['tarih'])}</td><td>{_e(s['karsi_taraf'])}</td>"
                    f"<td class=n>{_tl(s['fatura_tutari'])}</td><td class=n>{_tl(s['muavin_tutari'])}</td><td class=n>{_tl(s['fark'])}</td>"
                    f"<td class=m>{_e(s.get('fisler'))}</td><td>{_e(s.get('aciklama'))}</td></tr>" for s in L)
    return f"""<h2>{_e(baslik)} — {o.get('adet', 0)} kontrol, <span class={'kotu' if o.get('sorunlu') else 'iyi'}>{o.get('sorunlu', 0)} sorunlu</span></h2>
<table class=kucuk><thead><tr><th>Durum</th><th class=n>Adet</th><th>Sonuç</th></tr></thead><tbody>{durum}</tbody></table>
{f'<table><thead><tr><th>Durum</th><th>Belge no</th><th>Tarih</th><th>Karşı taraf</th><th class=n>Fatura</th><th class=n>Muavin</th><th class=n>Fark</th><th>Fiş</th><th>Açıklama</th></tr></thead><tbody>{satir}</tbody></table>' if L else '<p class=not>Sorunlu kayıt yok.</p>'}"""


def _detay_bolumu(d: dict, tur: str, baslik: str) -> str:
    L = d.get(tur, [])
    oz = (d.get("ozet") or {}).get(tur, {})
    kutu = "".join(f"<div class='kutu d-{k}'><b>{oz.get(k, 0)}</b><span>{_e(a)}</span></div>" for k, a in DURUM_AD.items())
    def tablo(S, notlu=True):
        return "".join(f"<tr><td>{_e(x['durum_ad'])}</td><td class=m>{_e(x['belge_no'])}</td><td>{_t(x['tarih'])}</td><td>{_e(x['karsi_taraf'])}</td>"
                       f"<td class=n>{_tl(x['matrah'])}</td><td class=m>{_e(', '.join(h['kod'] for h in x.get('hesaplar', [])))}</td>"
                       f"<td class=n>{_tl(x.get('hesap_toplam'))}</td><td class=m>{_e(', '.join(f['no'] for f in x.get('fisler', [])))}</td>"
                       f"<td>{_e(x.get('neden')) if notlu else ''}</td></tr>" for x in S)
    bas = "<thead><tr><th>Sonuç</th><th>Belge no</th><th>Tarih</th><th>Karşı taraf</th><th class=n>Matrah</th><th>Hesap</th><th class=n>Kayıt</th><th>Fiş</th><th>Not / gerekçe</th></tr></thead>"
    sorun = [x for x in L if x["durum"] in ("uygun_degil", "bekliyor")]
    tamam = [x for x in L if x["durum"] not in ("uygun_degil", "bekliyor")]
    return f"""<h2>{_e(baslik)} — {len(L)} fatura</h2><div class=kutular>{kutu}</div>
{f'<h3>Uygun değil ve kontrol bekleyen</h3><table>{bas}<tbody>{tablo(sorun)}</tbody></table>' if sorun else '<p class=not>Uygun olmayan ya da bekleyen fatura yok.</p>'}
{f'<details><summary>Uygun bulunanlar ({len(tamam)})</summary><table>{bas}<tbody>{tablo(tamam)}</tbody></table></details>' if tamam else ''}"""


def rapor_html(v: dict, d: dict) -> str:
    return f"""<!doctype html><html lang=tr><head><meta charset=utf-8><title>Denetim raporu – {_e(v.get('firma'))} {_t(v.get('bas'))} – {_t(v.get('bit'))}</title>
<style>body{{font:12px/1.4 Arial,sans-serif;margin:24px;color:#111}}h1{{font-size:18px;margin:0}}h2{{font-size:14px;margin:22px 0 6px;border-bottom:1px solid #999;padding-bottom:3px}}h3{{font-size:12.5px;margin:10px 0 4px}}
.ust{{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #16325C;padding-bottom:6px}}
table{{width:100%;border-collapse:collapse;margin:4px 0}}th,td{{border:1px solid #bbb;padding:3px 5px;text-align:left;vertical-align:top}}th{{background:#eef2f8}}
table.kucuk{{width:auto;min-width:340px}}td.n,th.n{{text-align:right;white-space:nowrap}}td.m{{font-family:Consolas,monospace;white-space:nowrap}}
.kotu{{color:#a3262c}}.iyi{{color:#13694a}}.not{{color:#555}}.kutular{{display:flex;gap:8px;flex-wrap:wrap;margin:6px 0}}
.kutu{{border:1px solid #ccc;border-radius:6px;padding:6px 10px;min-width:110px}}.kutu b{{display:block;font-size:16px}}.kutu span{{color:#555;font-size:11px}}
.d-uygun_degil b{{color:#a3262c}}.d-bekliyor b{{color:#9a6200}}.d-kural b,.d-gecmis b,.d-uygun b{{color:#13694a}}
table.imza{{margin-top:36px;page-break-inside:avoid}}table.imza td{{border:none;width:50%;padding:0 24px 0 0}}table.imza .cizgi{{height:56px;border-bottom:1px solid #333;margin:4px 0}}
@media print{{.yok{{display:none}}body{{margin:10mm}}details{{display:block}}details>summary{{list-style:none}}}}</style></head><body>
<div class=yok style="margin-bottom:12px"><button onclick="print()">Yazdır / PDF olarak kaydet</button></div>
<div class=ust><div><h1>{_e(v.get('firma'))}</h1><div class=not>Muhasebe Denetimi raporu · VKN {_e(v.get('vkn'))}</div></div>
<div style="text-align:right"><b>Dönem:</b> {_t(v.get('bas'))} – {_t(v.get('bit'))}<br><span class=not>{v.get('alis', 0)} alış, {v.get('satis', 0)} satış faturası · {datetime.now():%d.%m.%Y %H:%M}</span></div></div>
{_kontrol_bolumu(v, "KDV", "KDV kontrolü")}
{_kontrol_bolumu(v, "Matrah", "Matrah kontrolü")}
{_detay_bolumu(d, "gider", "Detay denetim · Gider kontrolü (alış)")}
{_detay_bolumu(d, "gelir", "Detay denetim · Gelir kontrolü (satış)")}
<p class=not>Kurala uygun ve geçmişle uyumlu faturalar otomatik değerlendirilmiştir (geçmiş: önceki en az iki ayda aynı cari aynı hesaba, tutar önceki aralıkta).
Bu rapor kayıt yapmaz; muhasebe kayıtları değiştirilmemiştir.</p>
<table class=imza><tr><td><b>Hazırlayan</b><div class=cizgi></div><span class=not>Ad Soyad · İmza · Tarih</span></td>
<td><b>Onaylayan</b><div class=cizgi></div><span class=not>Ad Soyad · İmza · Tarih</span></td></tr></table></body></html>"""
