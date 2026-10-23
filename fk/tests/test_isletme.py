import json
from decimal import Decimal

from fatura_kontrol.isletme_okuyucu import isletme_oku, oran
from fatura_kontrol import muavin_programlari as MP


def test_isletme_listesi_muavine_donusur(tmp_path):
    v = {"firma": "FURKAN T.", "gelir": [{"fid": "1", "tarih": "14/09/2026", "evrak_no": "GIB2026000000045", "belge_turu": "Satış",
                                          "aciklama": "RG GAYRİMENKUL", "cari": "", "tutar": "41.666,67", "kdv": "5.833,33", "toplam": "47.500,00"}],
         "gider": [{"fid": "2", "tarih": "11/09/2026", "evrak_no": "MAR2026006604274", "belge_turu": "Diğer Alışlar",
                    "aciklama": "MARTI", "cari": "", "tutar": "4.166,66", "kdv": "833,33", "toplam": "4.999,99"}]}
    y = tmp_path / "muavin_isletme.json"
    y.write_text(json.dumps(v), encoding="utf-8")
    (tmp_path / "muavin_program.json").write_text(json.dumps({"program": "luca_isletme"}))
    s, bilgi = MP.oku(y)
    assert bilgi["firma"] == "FURKAN T."
    kdv = {x.ana_hesap: x for x in s if x.ana_hesap in ("191", "391")}
    assert kdv["391"].alacak == Decimal("5833.33") and kdv["391"].kdv_orani is None   # listede oran yok: oran kontrolü yapılmaz
    assert kdv["191"].borc == Decimal("833.33")
    assert kdv["191"].belge_no == "MAR2026006604274" and kdv["191"].e_belge_mi
    assert oran(Decimal("41666.67"), Decimal("5833.33")) == 10 or oran(Decimal("41666.67"), Decimal("5833.33")) == 18
    assert "luca_isletme" not in [p["kod"] for p in MP.liste()]


def test_gelir_gider_raporu_excel():
    from pathlib import Path
    s, _ = MP.oku(Path(__file__).parent / "veri_isletme_gelir_gider.xlsx", "luca_isletme_excel")
    kdv = {x.belge_no: x for x in s if x.ana_hesap in ("191", "391")}
    assert len(kdv) == 11
    assert kdv["GIB2026000000045"].ana_hesap == "391" and kdv["GIB2026000000045"].alacak == Decimal("5833.33")
    assert kdv["SMM2026000000707"].ana_hesap == "191" and kdv["SMM2026000000707"].borc == Decimal("400")
    gelir = [x for x in s if x.ana_hesap == "600" and x.belge_no == "GIB2026000000047"]
    assert gelir and gelir[0].alacak == Decimal("30000")
    assert "luca_isletme_excel" in [p["kod"] for p in MP.liste()]


def test_mikro_muavin():
    from pathlib import Path
    s, _ = MP.oku(Path(__file__).parent / "veri_mikro_muavin.xlsx", "mikro")
    assert len(s) == 4476          # 4475 hareket + 190 Devreden KDV'nin dönem başı satırı
    assert sum(1 for x in s if x.fis_no == "DEVREDEN" and x.ana_hesap == "190") == 1
    k = next(x for x in s if x.belge_no == "KS12026001130211" and x.ana_hesap == "191")
    assert k.kdv_orani == Decimal("1") and k.borc == Decimal("2.18") and k.unvan == "ÖRNEK MARKETLER A.Ş."
    satis = [x for x in s if x.ana_hesap == "391" and x.belge_no == "AAS2026000004604"]
    assert satis and satis[0].kdv_orani == Decimal("20")
    assert "mikro" in [p["kod"] for p in MP.liste()]
