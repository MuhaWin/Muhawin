"""Görev 51: ortak veri klasörü – kim sorguladı, firma-dönem kilidi, güvenli yenileme, iki kullanıcının toplu özeti.
Tarayıcı gerekmez: Luca oturumu ve indirme taklit edilir."""
import json
import os
import time
import zipfile
from contextlib import contextmanager
from datetime import date
from pathlib import Path

import pytest

from test_luca_otomasyon import FIRMA_VKN, ubl


@pytest.fixture()
def veri(tmp_path, monkeypatch):
    monkeypatch.setenv("FK_VERI", str(tmp_path / "veri"))
    monkeypatch.setenv("FK_KULLANICI", "ayse@ornek-musavirlik.com")
    monkeypatch.setenv("FK_GUNLUK", str(tmp_path / "gunluk.jsonl"))
    return tmp_path / "veri"


def test_kilit(veri):
    from fatura_kontrol import ortak
    k = veri / "firmalar" / "DEMO" / "2026" / "09"
    with ortak.kilit(k, "deneme"):
        assert ortak.kilit_bilgisi(k)["sahibi"] == "ayse@ornek-musavirlik.com"
        with pytest.raises(ortak.KilitHatasi, match="ayse@ornek-musavirlik.com.*sorgulanıyor"):
            with ortak.kilit(k):
                pass
    assert ortak.kilit_bilgisi(k) is None and not (k.parent / "09.kilit").exists()      # bırakıldı
    # bayat kilit (sahibi kapanmış): devralınır
    y = k.parent / "09.kilit"
    y.write_text(json.dumps({"sahibi": "eski@ornek.com", "bilgisayar": "X", "pid": 1, "zaman": "2026-01-01T00:00:00"}), encoding="utf-8")
    eski = time.time() - ortak.BAYAT_SN - 5
    os.utime(y, (eski, eski))
    with ortak.kilit(k) as ben:
        assert ben["sahibi"] == "ayse@ornek-musavirlik.com"
    # başkasının kilidini bırakmaz
    y.write_text(json.dumps({"sahibi": "veli@ornek.com", "bilgisayar": "B", "pid": os.getpid(), "zaman": "x"}), encoding="utf-8")
    with pytest.raises(ortak.KilitHatasi, match="veli@ornek.com"):
        with ortak.kilit(k):
            pass
    assert y.exists()


def test_yenileme(veri):
    from fatura_kontrol import ortak
    k = veri / "firmalar" / "DEMO" / "2026" / "09"
    k.mkdir(parents=True)
    (k / "muavin.xlsx").write_text("eski")
    y = ortak.Yenileme(k)
    (y.gecici / "muavin.xlsx").write_text("yarim")
    y.iptal()                                             # yarıda kaldı
    assert (k / "muavin.xlsx").read_text() == "eski" and not list(k.parent.glob(".09.*"))
    y = ortak.Yenileme(k)
    (y.gecici / "muavin.xlsx").write_text("yeni")
    assert (k / "muavin.xlsx").read_text() == "eski"     # bitene kadar eski görünür (başkası okurken bozulmaz)
    y.bitir()
    assert (k / "muavin.xlsx").read_text() == "yeni" and not list(k.parent.glob(".09.*"))


def test_arsiv_yonlendirme(veri, tmp_path):
    """Yenilemede o ayın faturaları geçici klasörün arşivine; başka aylarınki kendi (kalıcı) klasörüne; tek kopya."""
    from fatura_kontrol import arsiv, depo, ortak
    k = depo.donem_klasoru("DEMO", date(2026, 9, 1))
    zp = tmp_path / "gib_efatura_alis_1.zip"
    with zipfile.ZipFile(zp, "w") as z:
        z.writestr("a.xml", ubl("AAA2026000000001", "2026-09-05", "1", FIRMA_VKN, "100.00", "20.00", 20))
        z.writestr("b.xml", ubl("AAA2026000000002", "2026-08-30", "1", FIRMA_VKN, "100.00", "20.00", 20))
    y = ortak.Yenileme(k)
    arsiv.arsive_al("DEMO", [zp], sil=False, yonlendir={k: y.gecici})
    assert arsiv.mevcut_adlar(y.gecici / arsiv.ARSIV) == {"gib_efatura_alis/AAA2026000000001.xml"}
    agustos = depo.donem_klasoru("DEMO", date(2026, 8, 1)) / arsiv.ARSIV
    assert arsiv.mevcut_adlar(agustos) == {"gib_efatura_alis/AAA2026000000002.xml"} and not (k / arsiv.ARSIV).exists()
    arsiv.arsive_al("DEMO", [zp], sil=False, yonlendir={k: y.gecici})          # ikinci sorgulama: kopya artmaz
    assert len(arsiv.mevcut_adlar(agustos)) == 1 and len(arsiv.mevcut_adlar(y.gecici / arsiv.ARSIV)) == 1
    y.bitir()
    assert arsiv.mevcut_adlar(k / arsiv.ARSIV) == {"gib_efatura_alis/AAA2026000000001.xml"}


def test_ozet_iki_kullanici(veri, tmp_path):
    from fatura_kontrol.luca import toplu as T
    cikti = tmp_path / "toplu"; cikti.mkdir()
    bas, bit = date(2026, 9, 1), date(2026, 9, 30)
    r = lambda id_, ad, zaman, kim, durum="Temiz": {"id": id_, "ad": ad, "vkn": "", "durum": durum, "fatura": 1, "sorunlar": {}, "indirme_hatasi": [],
                                                     "rapor": None, "rapor_id": None, "sure": 1, "zaman": zaman, "sorgulayan": kim}
    T.ozet_yaz([r("1", "A", "2026-10-01T10:00", "ayse")], bas, bit, cikti)                  # Ayşe A'yı sorguladı
    T.ozet_yaz([r("2", "B", "2026-10-01T10:05", "veli")], bas, bit, cikti)                  # Veli (eski listesinde A yok) B'yi
    d = {x["id"]: x for x in T.onceki_sonuclar(cikti)}
    assert set(d) == {"1", "2"} and d["1"]["sorgulayan"] == "ayse" and d["2"]["sorgulayan"] == "veli"
    # Ayşe'nin bayat listesi Veli'nin daha yeni A sorgulamasını ezmez
    T.ozet_yaz([r("1", "A", "2026-10-01T11:00", "veli", "Sorun var")], bas, bit, cikti)
    T.ozet_yaz([r("1", "A", "2026-10-01T10:00", "ayse"), r("2", "B", "2026-10-01T10:05", "veli")], bas, bit, cikti)
    d = {x["id"]: x for x in T.onceki_sonuclar(cikti)}
    assert d["1"]["sorgulayan"] == "veli" and d["1"]["durum"] == "Sorun var"
    T.ozet_yaz([r("2", "B", "2026-10-01T10:05", "veli")], bas, bit, cikti, birlestir=False)   # sonuçtan firma silme
    assert [x["id"] for x in T.onceki_sonuclar(cikti)] == ["2"]


def _taklit(monkeypatch, davranis):
    """Luca oturumu ve indirme taklidi. davranis(klasor) → indirme sonucu ('tamam' | 'hata' | istisna)."""
    from fatura_kontrol.luca import otomasyon as O

    class Ctx:
        pages = []

    @contextmanager
    def oturum(profil=None, hazirla=None):
        yield Ctx(), None

    def firma_isle(L, firma, bas, bit, turler, cikti, muavin=True, defter=None):
        s = O.Sonuc(cikti); s.vkn = FIRMA_VKN; s.firma = "DEMO"
        (cikti / "muavin.xlsx").write_text("yeni muavin")
        with zipfile.ZipFile(cikti / "gib_efatura_alis_1.zip", "w") as z:
            z.writestr("a.xml", ubl("AAA2026000000009", "2026-09-05", "1", FIRMA_VKN, "100.00", "20.00", 20))
        sonuc = davranis(cikti)
        s.not_al("Muavin", "tamam")
        s.not_al(O.TURLER["gib_efatura_alis"] + (": indirildi" if sonuc == "tamam" else ""), sonuc, "1 belge" if sonuc == "tamam" else "sunucu hatası")
        (cikti / "adimlar.json").write_text(json.dumps(s.adimlar, ensure_ascii=False), encoding="utf-8")
        return s

    def kontrol_et(s, bas, bit):
        return {"vkn": FIRMA_VKN, "durumlar": [], "id": "DEMO/2026/09", "fatura_sayisi": 1, "tevkifatlar": [], "kural": 1}

    monkeypatch.setattr(O, "oturum", oturum)
    monkeypatch.setattr(O, "oturum_canli", lambda ctx, L: L)
    monkeypatch.setattr(O, "firma_isle", firma_isle)
    monkeypatch.setattr(O, "kontrol_et", kontrol_et)


def _calistir(tmp_path):
    from fatura_kontrol.luca import toplu as T
    return T.toplu_calistir(date(2026, 9, 1), date(2026, 9, 30), ["gib_efatura_alis"], tmp_path / "toplu",
                            [{"id": "901", "ad": "DEMO"}])[0][0]


def _eski_veri(veri):
    k = veri / "firmalar" / "DEMO" / "2026" / "09"
    k.mkdir(parents=True)
    (k / "muavin.xlsx").write_text("eski muavin")
    (k / "rapor.json").write_text('{"eski": true}')
    return k


def test_toplu_yarida_kalirsa_eski_veri_kalir(veri, tmp_path, monkeypatch):
    k = _eski_veri(veri)

    def kes(cikti):
        raise RuntimeError("Bağlantı koptu")              # indirme ortasında hata
    _taklit(monkeypatch, kes)
    satir = _calistir(tmp_path)
    assert satir["durum"] == "Hata" and "Bağlantı koptu" in " ".join(satir["indirme_hatasi"])
    assert (k / "muavin.xlsx").read_text() == "eski muavin" and (k / "rapor.json").exists()
    assert not list(k.parent.glob(".09.*")) and not (k.parent / "09.kilit").exists()      # geçici klasör ve kilit kalmadı


def test_toplu_eksik_indirmede_eski_veri_kalir(veri, tmp_path, monkeypatch):
    k = _eski_veri(veri)
    _taklit(monkeypatch, lambda c: "hata")              # indirme hatayla bitti (yarım)
    satir = _calistir(tmp_path)
    assert satir.get("eski_veri_korundu") and satir["durum"] == "Eksik indirme"
    assert (k / "muavin.xlsx").read_text() == "eski muavin" and not list(k.parent.glob(".09.*"))


def test_toplu_tamamsa_yenisi_gecer_ve_kim_sorguladi(veri, tmp_path, monkeypatch):
    k = _eski_veri(veri)
    _taklit(monkeypatch, lambda c: "tamam")
    satir = _calistir(tmp_path)
    assert satir["sorgulayan"] == "ayse@ornek-musavirlik.com" and satir["durum"] == "Temiz"
    assert (k / "muavin.xlsx").read_text() == "yeni muavin" and not (k / "rapor.json").exists()      # eski rapor gitti
    from fatura_kontrol import arsiv
    assert arsiv.mevcut_adlar(k / arsiv.ARSIV) == {"gib_efatura_alis/AAA2026000000009.xml"}
    assert not list(k.parent.glob(".09.*")) and not list(k.glob("gib_*.zip"))
    g = [json.loads(x) for x in (tmp_path / "gunluk.jsonl").read_text(encoding="utf-8").splitlines()]
    assert g and g[-1]["tur"] == "sorgu" and g[-1]["firma"] == "DEMO"            # MuhaWin işlem günlüğüne


def test_toplu_baskasi_sorguluyorsa_dokunmaz(veri, tmp_path, monkeypatch):
    from fatura_kontrol import ortak
    k = _eski_veri(veri)
    (k.parent / "09.kilit").write_text(json.dumps({"sahibi": "veli@ornek.com", "bilgisayar": "OFIS-2", "pid": 1, "zaman": ortak.simdi()}), encoding="utf-8")
    _taklit(monkeypatch, lambda c: "tamam")
    satir = _calistir(tmp_path)
    assert satir["durum"] == "Hata" and satir.get("kilitli") and "veli@ornek.com" in satir["indirme_hatasi"][0]
    assert (k / "muavin.xlsx").read_text() == "eski muavin" and (k.parent / "09.kilit").exists()
