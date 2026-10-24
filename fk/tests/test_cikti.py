"""Çıktı raporu: muavinden KDV beyannamesi taslağı (UKİ Ağustos 2026 beyannamesindeki tutarlarla)."""
from datetime import date
from decimal import Decimal as D

from fatura_kontrol.cikti import cikti_html, kdv_beyani, muavin_dokumu
from fatura_kontrol.muavin_okuyucu import MuavinSatiri


def s(hesap, adi, borc=0, alacak=0, fis="1", t=date(2026, 8, 31), belge=None, acik=""):
    return MuavinSatiri("m.xlsx", 1, hesap, adi, t, "Mahsup", fis, acik or (belge or adi), D(str(borc)), D(str(alacak)),
                        None, belge, "")


def muavin():
    return [
        s("190.01", "Devreden KDV", 1501614.63, 0, "00942", date(2026, 7, 31)),
        s("391.01.20", "%20 lik Hesaplanan KDV", 0, 542575.24, "01088", belge="UKI2026000000032"),
        s("601.01", "Blok Mermer Satışları", 0, 11287298.60, "01088"),
        s("191.01.20", "%20 Lik İndirilecek KDV", 602379.73, 0, "00983"),
        s("191.01.10", "%10 Luk İndirilecek Kdv", 7665.19, 0, "00983"),
        s("191.01.01", "%1 Lik İndirilecek KDV", 70.60, 0, "00983"),
        s("191.02.20", "Sorumlu Sıfatıyla Beyan Edilip Ödenen Kdv", 22461.73, 0, "00983"),
        s("360.06.02", "2/10 Tevkifatlı KDV", 0, 22461.73, "00983"),
        # ay sonu tahakkuk fişi (hesaplamaya katılmaz, karşılaştırılır)
        s("391.01.20", "%20 lik Hesaplanan KDV", 542575.24, 0, "01089"),
        s("191.01.20", "%20 Lik İndirilecek KDV", 0, 602379.73, "01089"),
        s("191.01.10", "%10 Luk İndirilecek Kdv", 0, 7665.19, "01089"),
        s("191.01.01", "%1 Lik İndirilecek KDV", 0, 70.60, "01089"),
        s("191.02.20", "Sorumlu Sıfatıyla Beyan Edilip Ödenen Kdv", 0, 22461.73, "01089"),
        s("136.07", "Vergi Dairesinden Alacaklar", 388962.53, 0, "01089"),
        s("190.01", "Devreden KDV", 1202654.11, 0, "01089"),
        s("190.01", "Devreden KDV", 0, 1501614.63, "01089"),
    ]


def test_beyanname_taslagi_gercek_beyanla_ayni():
    b = kdv_beyani(muavin(), date(2026, 8, 1), date(2026, 8, 31))
    assert b.hesaplanan == D("542575.24") and b.toplam_hesaplanan == D("542575.24")
    assert abs(b.toplam_matrah - D("2712876.21")) <= D("0.01")
    assert b.devreden == D("1501614.63")
    assert b.indirimler_toplami == D("2134191.88")
    tur = {}
    for x in b.indirimler:
        tur[x.ad[:3]] = tur.get(x.ad[:3], 0) + x.vergi
    assert tur == {"108": D("610115.52"), "109": D("22461.73")}
    assert b.istisna_bedeli == D("11287298.60")
    assert b.iade_edilebilir == D("388962.53") and b.iade_edilmesi_gereken == D("388962.53")
    assert b.odenecek == 0 and b.sonraki_doneme == D("1202654.11")
    assert abs(b.aylik_bedel - D("14000174.81")) <= D("0.01")
    assert b.tahakkuk and b.tahakkuk["hesaplanan"] == D("542575.24")


def test_cikti_sayfasi():
    rapor = {"firma": "UKİ MADEN", "vkn": "8870571658", "donem": {"Alış": ["2026-08-01", "2026-08-31"]},
             "durumlar": [{"ad": "Uyumlu", "adet": 1, "sorunlu": False}], "alis": 1, "satis": 1, "fatura_sayisi": 2,
             "sonuclar": [{"belge_no": "UKI2026000000032", "durum": "Uyumlu", "sorunlu": False}], "uyarilar": []}
    h = cikti_html(rapor, muavin(), {"buro_unvan": "Örnek SMMM"})
    for metin in ("KDV KONTROL RAPORU", "Açıklamalı muavin dökümü", "KDV beyannamesi örneği", "1.202.654,11",
                  "2.134.191,88", "301 - Mal İhracatı", "Örnek SMMM", "TASLAK", "KDV tahakkuk / mahsup fişi"):
        assert metin in h, metin
    _, satirlar = muavin_dokumu(muavin(), date(2026, 8, 1), date(2026, 8, 31), rapor)
    assert any(k == "Uyumlu" for x, k in satirlar if x.belge_no == "UKI2026000000032")
    assert "muavin dosyası bulunamadı" in cikti_html(rapor, None, {})


def test_iade_talebi_sorusu():
    m = muavin()
    hayir = kdv_beyani(m, date(2026, 8, 1), date(2026, 8, 31), iade={"cevap": "hayir"})
    assert hayir.iade_edilmesi_gereken == 0 and hayir.sonraki_doneme == D("1591616.64")
    evet = kdv_beyani(m, date(2026, 8, 1), date(2026, 8, 31), iade={"cevap": "evet", "tutar": "100.000,00"})
    assert evet.iade_edilmesi_gereken == D("100000.00") and evet.sonraki_doneme == D("1491616.64")
    # tahakkuk fişi olmayan dönemde soru sorulur; cevapsızken iade 0
    eylul = [x for x in m if x.fis_no != "01089"]
    b = kdv_beyani(eylul, date(2026, 8, 1), date(2026, 8, 31))
    assert b.iade_cevap is None and b.iade_edilmesi_gereken == 0
    rapor = {"firma": "X", "donem": {"Alış": ["2026-08-01", "2026-08-31"]}}
    h = cikti_html(rapor, eylul, {})
    assert "iade talebiniz olacak mı" in h and "(190 bakiyesi)" in h


def test_kdv2_beyani():
    """UKİ Ağustos 2026 KDV2 beyannamesi: 6 belge, matrah 561.543,19, tevkif edilen 22.461,73 (224 - Yük taşımacılığı)."""
    from fatura_kontrol.cikti import kdv2_beyani
    veriler = [("EGE2026000000004", "HASAN EGELİ", "22231407090", 310000.00, 12400.00),
               ("KRL2026000000466", "Karakayalar Lojistik", "5151126789", 28135.65, 1125.43),
               ("KRL2026000000465", "Karakayalar Lojistik", "5151126789", 31383.78, 1255.35),
               ("ESG2026000000001", "ESTAŞ GÜVENLİK", "3800536287", 53215.02, 2128.60),
               ("KRL2026000000436", "Karakayalar Lojistik", "5151126789", 91611.17, 3664.45),
               ("EST2026000000020", "ESTAŞ GÜVENLİK", "3800536287", 47197.57, 1887.90)]
    m = [s("360.06.02", "2/10 Tevkifatlı KDV", 0, t, "00983", date(2026, 8, 20), belge=no) for no, _, _, _, t in veriler]
    m.append(s("360.06.02", "2/10 Tevkifatlı KDV", 10085.52, 0, "01297", date(2026, 8, 25), acik="TEMMUZ KDV2 ÖDEME"))
    tev = [{"yon": "Alış", "belge_no": no, "tarih": "2026-08-10", "karsi_taraf": u, "vkn": v, "matrah": mat,
            "kdv": round(mat * 0.2, 2), "kod": "624", "tur": "624 - %20 YÜK TAŞIMACILIĞI HİZMETİ", "oran": "2/10",
            "tutar": t} for no, u, v, mat, t in veriler[1:]]       # biri faturasız: hesap adından hesaplanır
    tev.append({"yon": "Alış", "belge_no": "XYZ2026000000001", "tarih": "2026-08-15", "karsi_taraf": "KAYITSIZ",
                "matrah": 1000, "kdv": 200, "kod": "624", "tur": "", "oran": "2/10", "tutar": 40})
    k = kdv2_beyani(m, date(2026, 8, 1), date(2026, 8, 31), tev)
    assert k.tevkif == D("22461.73") and abs(k.matrah - D("561543.19")) < D("0.01")
    assert {x.islem for x in k.satirlar if x.kaynak == "e-fatura"} == {"224 - Yük Taşımacılığı Hizmeti"}
    assert [x.kaynak for x in k.satirlar if x.belge_no == "EGE2026000000004"] == ["muavin (hesaplandı)"]
    assert k.odemeler == D("10085.52") and [x["belge_no"] for x in k.muavinde_yok] == ["XYZ2026000000001"]
    rapor = {"firma": "UKİ", "donem": {"Alış": ["2026-08-01", "2026-08-31"]}, "tevkifatlar": tev}
    h = cikti_html(rapor, m, {})
    assert "KDV2 beyannamesi örneği" in h and "22.461,73" in h and "XYZ2026000000001" in h


def test_sorumlu_sifatiyla_kdv_odenmedi():
    """Sorumlu sıfatıyla indirilen KDV ödenmediyse indirimden çıkarılır; ödendiyse (ya da cevapsız) aynı kalır."""
    m = muavin()
    temel = kdv_beyani(m, date(2026, 8, 1), date(2026, 8, 31))
    assert temel.sorumlu_tutar == D("22461.73") and temel.sorumlu_cevap is None
    odendi = kdv_beyani(m, date(2026, 8, 1), date(2026, 8, 31), sorumlu={"cevap": "odendi"})
    assert odendi.indirimler_toplami == temel.indirimler_toplami == D("2134191.88")
    yok = kdv_beyani(m, date(2026, 8, 1), date(2026, 8, 31), sorumlu={"cevap": "odenmedi"})
    assert yok.sorumlu_indirilmeyen == D("22461.73") and yok.indirimler_toplami == D("2134191.88") - D("22461.73")
    assert yok.sonraki_doneme == temel.sonraki_doneme - D("22461.73") and any("ödenmediği için" in n for n in yok.notlar)
    rapor = {"firma": "X", "donem": {"Alış": ["2026-08-01", "2026-08-31"]}}
    h = cikti_html(rapor, m, {}, sorumlu={"cevap": "odenmedi"})
    assert "Sorumlu sıfatıyla indirilen KDV (22.461,73 TL) ödendi mi?" in h and "indirimden çıkarıldı" in h
    # sorumlu sıfatıyla KDV olmayan dönemde soru yok
    sade = [x for x in m if not x.hesap_kodu.startswith(("191.02", "360"))]
    assert "ödendi mi" not in cikti_html(rapor, sade, {})


def test_onceki_aylarda_kdv_tahakkuk_fisi():
    """Eylül beyannamesinde Ocak–Ağustos taranır: tahakkuk fişi adından ya da yapısından tanınır; Temmuz yoksa uyarılır."""
    from fatura_kontrol.cikti import tahakkuk_ay_kontrolu
    m = [s("100.01", "Kasa", 1, 0, "0", date(2026, 1, 2))]
    adlar = {1: "OCAK AYI KDV TAHAKKUKU", 2: "Şubat ayı KDV tahakkuku", 4: "04/2026 KDV TAHAKKUK FİŞİ",
             5: "mayıs ayı kdv tahakkuku", 6: "HAZİRAN 2026 KDV TAHAKKUK", 8: "AĞUSTOS AYI KDV TAHAKKUKU"}
    for ay, ad in adlar.items():          # adıyla tanınan fişler (hesap yapısı aranmaz)
        m.append(s("360.01", "Ödenecek KDV", 0, 10, f"T{ay}", date(2026, ay, 28), acik=ad))
    # Mart: adı yok, yapısından (391 borç + 191 alacak)
    m += [s("391.01.20", "%20 Hesaplanan KDV", 50, 0, "T3", date(2026, 3, 31)), s("191.01.20", "%20 İndirilecek KDV", 0, 50, "T3", date(2026, 3, 31))]
    # Temmuz: KDV hareketi var, tahakkuk fişi yok
    m.append(s("191.01.20", "%20 İndirilecek KDV", 20, 0, "77", date(2026, 7, 10), acik="ALIŞ FATURASI"))
    t = tahakkuk_ay_kontrolu(m, date(2026, 9, 1))
    assert [x["ay"] for x in t["bulunan"]] == [1, 2, 3, 4, 5, 6, 8]
    assert t["eksik"] == [{"ay": 7, "ad": "Temmuz", "hareket": True}] and t["kapsam_disi"] == []
    b = kdv_beyani(m, date(2026, 9, 1), date(2026, 9, 30))
    assert any(n.startswith("Temmuz ayına ait KDV tahakkuk fişi muavinde bulunamadı") for n in b.notlar)
    h = cikti_html({"firma": "X", "donem": {"Alış": ["2026-09-01", "2026-09-30"]}}, m, {})
    assert "KDV tahakkuk fişi bulunamadı: Temmuz." in h
    # muavin Mart'tan başlıyorsa Ocak / Şubat denetlenemez (eksik sayılmaz, ayrıca bildirilir)
    t2 = tahakkuk_ay_kontrolu(m, date(2026, 9, 1), date(2026, 3, 1))   # Mart 1 kapsamda
    assert t2["kapsam_disi"] == [1, 2] and [x["ay"] for x in t2["eksik"]] == [7]
    # Ocak beyannamesinde önceki ay (geçen yıl) aranmaz
    assert tahakkuk_ay_kontrolu(m, date(2026, 1, 1)) == {"bulunan": [], "eksik": [], "kapsam_disi": []}
    # adında ay geçen ama sonraki ay tarihli fiş (Ağustos tahakkuku 05.09'da kesilmiş) o aya sayılır
    gec = [x for x in m if x.fis_no != "T8"] + [s("360.01", "Ödenecek KDV", 0, 1, "T8b", date(2026, 9, 5), acik="AĞUSTOS AYI KDV TAHAKKUKU")]
    assert 8 in [x["ay"] for x in tahakkuk_ay_kontrolu(gec, date(2026, 10, 1))["bulunan"]]
