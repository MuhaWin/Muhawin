"""Yönetici raporu HTML'i: satış çubuk grafiği, gider küçük grafikleri, o ayın vergileri, rasyolar (yazdırılabilir).
Grafikler satır içi SVG'dir (dış kütüphane yok); her çubuğun üzerine gelince değeri görünür (SVG <title>)."""
from __future__ import annotations

import html as H
from datetime import datetime

MARKA, ACIK, UYARI, IZGARA, MUREKKEP, SOLUK = "#1f4aa8", "#a9bde6", "#b54708", "#e3e7ee", "#172033", "#5b6578"


def _e(x) -> str:
    return H.escape(str(x if x is not None else ""))


def _tl(x, kurus=True) -> str:
    if x is None:
        return "—"
    s = f"{float(x):,.{2 if kurus else 0}f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return s


def _kisa(x: float) -> str:
    a = abs(x)
    if a >= 1_000_000:
        return f"{x / 1_000_000:.1f}".replace(".", ",") + " mn"
    if a >= 10_000:
        return f"{x / 1_000:.0f} bin"
    if a >= 1_000:
        return f"{x / 1_000:.1f}".replace(".", ",").replace(",0", "") + " bin"
    return f"{x:.0f}"


def _tavan(m: float) -> tuple[float, int]:
    """Yuvarlak eksen tavanı ve bölme sayısı (adımlar 1 / 2 / 5 × 10ⁿ)."""
    if m <= 0:
        return 1, 4
    import math
    us = 10 ** math.floor(math.log10(m))
    for k, bolme in ((1, 5), (2, 4), (2.5, 5), (5, 5), (10, 5)):
        if m <= k * us:
            return k * us, bolme
    return 10 * us, 5


def cubuk(aylar, degerler, secili: int, yuksek=None, gen=640, yuk=210, etiket_alt=None, baslik="") -> str:
    """Tek seri çubuk grafik: seçili ay koyu, diğerleri açık (aynı renk tonu); vurgulananlar uyarı rengi + ▲."""
    yuksek = yuksek or set()
    sol, alt, ust = 52, 34, 22
    w, h = gen - sol - 8, yuk - alt - ust
    tavan, bolme = _tavan(max([v or 0 for v in degerler] + [0]))
    n = len(degerler) or 1
    bw = min(46, w / n - 6)
    parcalar = [f'<svg viewBox="0 0 {gen} {yuk}" width="100%" role="img" aria-label="{_e(baslik)}" style="max-width:{gen}px;font:11px Arial,sans-serif">']
    for i in range(bolme + 1):                               # yatay ızgara + eksen etiketleri
        y = ust + h - h * i / bolme
        parcalar.append(f'<line x1="{sol}" x2="{gen - 8}" y1="{y:.1f}" y2="{y:.1f}" stroke="{IZGARA}"/>'
                        f'<text x="{sol - 6}" y="{y + 4:.1f}" text-anchor="end" fill="{SOLUK}">{_kisa(tavan * i / bolme)}</text>')
    for i, (ay, v) in enumerate(zip(aylar, degerler)):
        x = sol + (i + 0.5) * w / n - bw / 2
        v = v or 0
        bh = max(h * max(v, 0) / tavan, 0)
        y = ust + h - bh
        renk = UYARI if i in yuksek else (MARKA if i == secili else ACIK)
        r = min(4, bw / 2, bh)
        yol = (f"M{x:.1f},{ust + h:.1f} V{y + r:.1f} Q{x:.1f},{y:.1f} {x + r:.1f},{y:.1f} H{x + bw - r:.1f} "
               f"Q{x + bw:.1f},{y:.1f} {x + bw:.1f},{y + r:.1f} V{ust + h:.1f} Z") if bh > 0 else ""
        if yol:
            parcalar.append(f'<path d="{yol}" fill="{renk}"><title>{_e(ay)}: {_tl(v)} TL</title></path>')
        kalin = ' font-weight="700"' if i == secili else ""
        parcalar.append(f'<text x="{x + bw / 2:.1f}" y="{ust + h + 14}" text-anchor="middle" fill="{MUREKKEP if i == secili else SOLUK}"'
                        f'{kalin}>{_e(ay[:3])}</text>')
        if etiket_alt and etiket_alt[i]:
            parcalar.append(f'<text x="{x + bw / 2:.1f}" y="{ust + h + 27}" text-anchor="middle" fill="{SOLUK}" font-size="10">{_e(etiket_alt[i])}</text>')
        if i == secili or i in yuksek:                      # seçici doğrudan etiket: yalnız seçili ay ve vurgulananlar
            parcalar.append(f'<text x="{x + bw / 2:.1f}" y="{y - 5:.1f}" text-anchor="middle" fill="{MUREKKEP}" font-weight="700">'
                            f'{"▲ " if i in yuksek else ""}{_kisa(v)}</text>')
    parcalar.append(f'<line x1="{sol}" x2="{gen - 8}" y1="{ust + h}" y2="{ust + h}" stroke="{SOLUK}"/></svg>')
    return "".join(parcalar)


def _yuzde(x) -> str:
    if x is None:
        return ""
    return ("+" if x > 0 else "") + f"{x:.1f}".replace(".", ",") + "%"


def rapor_html(v: dict, y: dict) -> str:
    o = y["ay_ozet"]
    secili = len(y["aylar"]) - 1
    satis = y["satis"]
    kutu = lambda ad, deger, alt="", sinif="": f'<div class="kutu {sinif}"><span>{_e(ad)}</span><b>{deger}</b><small>{alt}</small></div>'
    degisim = o.get("satis_degisim")
    kutular = "".join([
        kutu(f"Satışlar · {o['ay_adi']}", _tl(o["satis"]) + " TL", f"önceki aya göre {_yuzde(degisim)}" if degisim is not None else "önceki ay yok",
             "kotu" if degisim is not None and degisim < -20 else ""),
        kutu("Hesaplanan KDV (391)", _tl(o["hesaplanan_kdv"]) + " TL"),
        kutu("İndirilecek KDV (191)", _tl(o["indirilecek_kdv"]) + " TL", f"önceki dönemden devreden {_tl(o['onceki_devreden_kdv'])}"),
        kutu("Ödenecek KDV" if o["odenecek_kdv"] else "Sonraki aya devreden KDV",
             _tl(o["odenecek_kdv"] or o["devreden_kdv"]) + " TL", f"190 bakiyesi ay sonu {_tl(o['kdv_190_bakiye'])}"),
        kutu("360 · tahakkuk eden vergiler", _tl(o["tahakkuk_360"]) + " TL", f"ödenen {_tl(o['odenen_360'])} · bakiye {_tl(o['bakiye_360'])}"),
        kutu("361 · SGK tahakkuku", _tl(o["tahakkuk_361"]) + " TL", f"ödenen {_tl(o['odenen_361'])}"),
    ])
    vergiler = "".join(f"<tr><td class=m>{_e(x['kod'])}</td><td>{_e(x['ad'])}</td><td class=n>{_tl(x['tutar'])}</td></tr>" for x in o["vergiler_360"])
    satis_svg = cubuk(y["aylar"], [x["brut"] for x in satis], secili, gen=1000, yuk=240,
                      etiket_alt=[_yuzde(x["degisim"]) for x in satis], baslik="Aylık satışlar (600–602)")
    gider_kart = []
    for g in y["giderler"]:
        yuk = {i for i, s in enumerate(g["seri"]) if s["yuksek"]}
        son = g["seri"][-1]
        not_ = (f'<div class="uyari-et">▲ {_e(y["aylar"][max(yuk)])}: önceki ayların ortalamasının {_yuzde(g["seri"][max(yuk)]["artis"])} üstünde</div>'
                if yuk else '<div class="not">Belirgin artış yok</div>')
        gider_kart.append(f'<div class="gk"><div class="gb"><b>{_e(g["kod"])} {_e(g["ad"])}</b><span>{_e(y["aylar"][-1][:3])}: {_tl(son["tutar"])} · yıl {_tl(g["toplam"])}</span></div>'
                          f'{cubuk(y["aylar"], [s["tutar"] for s in g["seri"]], secili, yuk, gen=420, yuk=150, baslik=g["kod"])}{not_}</div>')
    tanim = {t["kod"]: t for t in y["rasyo_tanim"]}
    bas = "".join(f"<th class=n>{_e(a[:3])}</th>" for a in y["aylar"])
    rs = []
    for t in y["rasyo_tanim"]:
        kalin = ' style="font-weight:700"'
        hucre = "".join(f"<td class=n{kalin if i == secili else ''}>"
                        f"{'—' if r[t['kod']] is None else (_tl(r[t['kod']]) + (' %' if t['birim'] == '%' else ''))}</td>" for i, r in enumerate(y["rasyolar"]))
        rs.append(f"<tr><td><b>{_e(t['ad'])}</b><br><small class=not>{_e(t['formul'])}</small></td>{hucre}</tr>")
    uyari = "".join(f'<p class="uyari">{_e(u)}</p>' for u in y["uyarilar"])
    return f"""<!doctype html><html lang=tr><head><meta charset=utf-8><title>Yönetici raporu – {_e(v.get('firma'))} {_e(o['ay_adi'])} {o['yil']}</title>
<style>body{{font:12.5px/1.45 Arial,sans-serif;margin:28px;color:{MUREKKEP};background:#fff}}h1{{font-size:20px;margin:0}}h2{{font-size:15px;margin:26px 0 8px;padding-bottom:4px;border-bottom:2px solid #16325C}}
.ust{{display:flex;justify-content:space-between;align-items:flex-end;gap:16px}}.not{{color:{SOLUK}}}small{{font-size:11px}}
.kutular{{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:14px}}.kutu{{border:1px solid #d8dee8;border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:2px}}
.kutu span{{color:{SOLUK};font-size:11.5px}}.kutu b{{font-size:19px}}.kutu small{{color:{SOLUK}}}.kutu.kotu b{{color:#a3262c}}
.gider{{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}}.gk{{border:1px solid #d8dee8;border-radius:10px;padding:10px;break-inside:avoid}}
.gb{{display:flex;justify-content:space-between;gap:8px;margin-bottom:4px}}.gb span{{color:{SOLUK}}}.uyari-et{{color:{UYARI};font-weight:700;font-size:11.5px}}
table{{width:100%;border-collapse:collapse}}th,td{{border-bottom:1px solid #e3e7ee;padding:5px 6px;text-align:left;vertical-align:top}}th{{color:{SOLUK};font-size:11.5px}}
td.n,th.n{{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}}td.m{{font-family:Consolas,monospace}}
.uyari{{background:#fff6e5;border:1px solid #f0d49a;color:#7a4d00;border-radius:8px;padding:8px 10px}}.lejant{{display:flex;gap:14px;color:{SOLUK};font-size:11.5px;margin:4px 0}}
.lejant i{{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:4px;vertical-align:-1px}}
@media print{{.yok{{display:none}}body{{margin:10mm}}h2{{break-after:avoid}}}}</style></head><body>
<div class=yok style="margin-bottom:12px"><button onclick="print()">Yazdır / PDF olarak kaydet</button></div>
<div class=ust><div><h1>{_e(v.get('firma'))}</h1><div class=not>Yönetici raporu · VKN {_e(v.get('vkn'))}</div></div>
<div style="text-align:right"><b style="font-size:16px">{_e(o['ay_adi'])} {o['yil']}</b><br><span class=not>Ocak – {_e(o['ay_adi'])} muavininden · {datetime.now():%d.%m.%Y}</span></div></div>
{uyari}
<div class=kutular>{kutular}</div>
<h2>Satışlar (600–602) · ay ay</h2>
<div class=lejant><span><i style="background:{MARKA}"></i>{_e(o['ay_adi'])}</span><span><i style="background:{ACIK}"></i>önceki aylar</span><span>çubuk altındaki yüzde: önceki aya göre değişim</span></div>
{satis_svg}
<h2>Giderler (7xx) · ay ay</h2>
<div class=lejant><span><i style="background:{MARKA}"></i>{_e(o['ay_adi'])}</span><span><i style="background:{ACIK}"></i>önceki aylar</span><span><i style="background:{UYARI}"></i>▲ önceki ayların ortalamasının 1,5 katından fazla (en az 1.000 TL)</span></div>
<div class=gider>{''.join(gider_kart) or '<p class=not>Muavinde 7xx gider hareketi yok.</p>'}</div>
{f'<h2>{_e(o["ay_adi"])} · 360 tahakkuk eden vergiler</h2><table><thead><tr><th>Hesap</th><th>Hesap adı</th><th class=n>Tahakkuk</th></tr></thead><tbody>{vergiler}</tbody></table>' if vergiler else ''}
<h2>Rasyolar · ay sonları</h2>
<table><thead><tr><th>Oran ve formülü</th>{bas}</tr></thead><tbody>{''.join(rs)}</tbody></table>
<p class=not>Rasyolar muavinden kurulan mizandan hesaplanır (ay sonu bakiyeleri; dönem kârı kapanış yapılmadan 6xx ve 7xx'ten). Payda sıfır ya da eksi ise “—”.
Bu rapor kayıt yapmaz.</p></body></html>"""
