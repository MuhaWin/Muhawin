"""Fiş çıktısı ortak yardımcıları (Görev 53): ana hesap özeti ve imza alanları.

Programdaki fiş yazdırma sayfaları ve başka raporlar (ör. KDV2) kullanabilir. Masaüstü tarafındaki eşi
`renderer/fis-cikti.js`; ikisi aynı kuralı uygular:
- Özet, satırlar ana hesaba (ilk 3 hane) göre toplanarak verilir; YALNIZ aynı ana hesap birden çok satırda geçiyorsa gösterilir.
- Özetin altında toplam borç = toplam alacak denkliği (dengesizse fark).
- İmza alanları (Hazırlayan / Kontrol Eden / Onaylayan) her durumda en altta.
"""
from __future__ import annotations

import html as H
from decimal import Decimal
from typing import Callable, Iterable

# Tek Düzen Hesap Planı ana hesap adları (hesap planında ad yoksa)
TDHP = {"100": "Kasa", "101": "Alınan Çekler", "102": "Bankalar", "103": "Verilen Çekler ve Ödeme Emirleri (-)", "108": "Diğer Hazır Değerler",
        "120": "Alıcılar", "121": "Alacak Senetleri", "126": "Verilen Depozito ve Teminatlar", "127": "Diğer Ticari Alacaklar",
        "131": "Ortaklardan Alacaklar", "136": "Diğer Çeşitli Alacaklar", "150": "İlk Madde ve Malzeme", "153": "Ticari Mallar",
        "157": "Diğer Stoklar", "159": "Verilen Sipariş Avansları", "180": "Gelecek Aylara Ait Giderler", "190": "Devreden KDV",
        "191": "İndirilecek KDV", "193": "Peşin Ödenen Vergiler ve Fonlar", "195": "İş Avansları", "196": "Personel Avansları",
        "253": "Tesis, Makine ve Cihazlar", "254": "Taşıtlar", "255": "Demirbaşlar", "257": "Birikmiş Amortismanlar (-)",
        "260": "Haklar", "300": "Banka Kredileri", "309": "Diğer Mali Borçlar", "320": "Satıcılar", "321": "Borç Senetleri",
        "326": "Alınan Depozito ve Teminatlar", "329": "Diğer Ticari Borçlar", "331": "Ortaklara Borçlar", "335": "Personele Borçlar",
        "336": "Diğer Çeşitli Borçlar", "340": "Alınan Sipariş Avansları", "360": "Ödenecek Vergi ve Fonlar",
        "361": "Ödenecek Sosyal Güvenlik Kesintileri", "391": "Hesaplanan KDV", "392": "Diğer KDV", "500": "Sermaye",
        "600": "Yurtiçi Satışlar", "601": "Yurtdışı Satışlar", "602": "Diğer Gelirler", "610": "Satıştan İadeler (-)",
        "611": "Satış İskontoları (-)", "612": "Diğer İndirimler (-)", "620": "Satılan Mamuller Maliyeti (-)",
        "621": "Satılan Ticari Mallar Maliyeti (-)", "622": "Satılan Hizmet Maliyeti (-)", "632": "Genel Yönetim Giderleri (-)",
        "642": "Faiz Gelirleri", "646": "Kambiyo Karları", "649": "Diğer Olağan Gelir ve Karlar", "653": "Komisyon Giderleri (-)",
        "656": "Kambiyo Zararları (-)", "659": "Diğer Olağan Gider ve Zararlar (-)", "679": "Diğer Olağandışı Gelir ve Karlar",
        "689": "Diğer Olağandışı Gider ve Zararlar (-)", "760": "Pazarlama Satış ve Dağıtım Giderleri", "770": "Genel Yönetim Giderleri",
        "780": "Finansman Giderleri", "790": "Gider Çeşitleri"}

IMZA_ALANLARI = ("Hazırlayan", "Kontrol Eden", "Onaylayan")

FIS_EK_CSS = (".fisozet{margin-top:16px}.fisozet h2{font-size:13px;margin:0 0 6px}.fisozet .dengesiz{color:#b00020;font-weight:700}"
              "table.fisimza{width:100%;margin-top:34px;border-collapse:collapse;page-break-inside:avoid}"
              "table.fisimza td{border:0!important;width:33%;padding:0 18px 0 0;vertical-align:top}"
              "table.fisimza .ad{font-weight:700}table.fisimza .alan{margin-top:6px;color:#555;font-size:10px;line-height:2.2}"
              "table.fisimza .cizgi{display:inline-block;width:70%;border-bottom:1px solid #333}")


def tl(x) -> str:
    """1.234,56 biçimi."""
    return f"{Decimal(str(x or 0)):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def ana_hesap_ozeti(satirlar: Iterable[tuple[str, object, object]], ad_bul: Callable[[str], str] | None = None) -> dict:
    """(hesap kodu, borç, alacak) satırlarını ana hesaba göre toplar.

    Dönüş: goster (aynı ana hesap birden çok satırda mı), ana [{hesap, ad, borc, alacak, n}] (koda göre sıralı),
    borc, alacak (Decimal), dengeli."""
    ana: dict[str, dict] = {}
    for kod, b, a in satirlar:
        k = str(kod or "").strip()[:3]
        if not (len(k) == 3 and k.isdigit()):
            continue
        x = ana.setdefault(k, {"hesap": k, "ad": "", "borc": Decimal(0), "alacak": Decimal(0), "n": 0})
        x["borc"] += Decimal(str(b or 0)); x["alacak"] += Decimal(str(a or 0)); x["n"] += 1
    for x in ana.values():
        x["ad"] = (ad_bul(x["hesap"]) if ad_bul else "") or TDHP.get(x["hesap"], "")
    L = sorted(ana.values(), key=lambda x: x["hesap"])
    tb, ta = sum((x["borc"] for x in L), Decimal(0)), sum((x["alacak"] for x in L), Decimal(0))
    return {"goster": any(x["n"] > 1 for x in L), "ana": L, "borc": tb, "alacak": ta, "dengeli": abs(tb - ta) <= Decimal("0.01")}


def fis_ek_html(oz: dict) -> str:
    """Fiş tablosunun altına: özet (oz["goster"] ise) ve imza alanları. Stil: FIS_EK_CSS."""
    ozet = ""
    if oz.get("goster"):
        n = lambda v: tl(v) if v else ""
        sat = "".join(f"<tr><td class=m>{H.escape(x['hesap'])}</td><td>{H.escape(x['ad'])}</td><td class=n>{n(x['borc'])}</td>"
                      f"<td class=n>{n(x['alacak'])}</td></tr>" for x in oz["ana"])
        denk = ("Toplam borç = toplam alacak" if oz["dengeli"]
                else f"<span class=dengesiz>Fiş dengesiz (fark {tl(abs(Decimal(str(oz['borc'])) - Decimal(str(oz['alacak']))))})</span>")
        ozet = (f"<div class=fisozet><h2>Ana hesap özeti</h2><table><thead><tr><th>Ana hesap</th><th>Hesap adı</th><th class=n>Borç</th>"
                f"<th class=n>Alacak</th></tr></thead><tbody>{sat}</tbody><tfoot><tr><td colspan=2>Toplam · {denk}</td>"
                f"<td class=n>{tl(oz['borc'])}</td><td class=n>{tl(oz['alacak'])}</td></tr></tfoot></table></div>")
    imza = "".join(f"<td><div class=ad>{a}</div><div class=alan>Ad Soyad: <span class=cizgi></span><br>Tarih: <span class=cizgi></span><br>"
                   f"İmza: <span class=cizgi></span></div></td>" for a in IMZA_ALANLARI)
    return ozet + f"<table class=fisimza><tr>{imza}</tr></table>"
