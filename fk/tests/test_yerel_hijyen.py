"""Yerel veri ve oturum hijyeni (rapor-02 G-I, Görev 27): D10 hata görüntüleri, D11 Windows dışı parola, D15 bağımsız mod anahtarı."""
import importlib
import json
import sys

import pytest


def test_d10_hata_goruntuleri_is_sonunda_silinir(tmp_path, monkeypatch):
    from fatura_kontrol.luca import otomasyon as O
    for ad in ("hata_muavin.jpg", "hata_muavin_frm3.html", "hata_gib_efatura_alis.jpg"):
        (tmp_path / ad).write_text("x")
    (tmp_path / "muavin.xlsx").write_text("x")
    monkeypatch.setenv("FK_TANILAMA", "1")
    O.hata_goruntulerini_sil(tmp_path)
    assert len(list(tmp_path.glob("hata_*"))) == 3, "tanılama modunda kalır"
    monkeypatch.delenv("FK_TANILAMA")
    O.hata_goruntulerini_sil(tmp_path)
    assert not list(tmp_path.glob("hata_*")) and (tmp_path / "muavin.xlsx").exists()


def test_d10_firma_isle_sonunda_silinir(tmp_path, monkeypatch):
    """Adım hata verince görüntü alınır, firma işi bitince (hatayla da olsa) silinir."""
    from fatura_kontrol.luca import otomasyon as O

    class L:
        url = "https://x.luca.com.tr/Luca/luca.do"
        context = None

        def screenshot(self, path, **k):
            open(path, "w").write("resim")

        def frame(self, name):
            return None
    monkeypatch.setattr(O, "luca_hatasi", lambda L: False)
    monkeypatch.setattr(O, "zaman_asimi", lambda L: False)
    monkeypatch.setattr(O, "firma_sec", lambda *a: None)
    monkeypatch.setattr(O, "uye_no", lambda L: "1")
    goruldu = []
    gercek = O._goruntu
    monkeypatch.setattr(O, "_goruntu", lambda L_, s, ad: (gercek(L_, s, ad), goruldu.extend(p.name for p in s.klasor.glob("hata_*"))))

    def bozuk(*a, **k):
        raise O.OtomasyonHatasi("Muavin Defter ekranı açılamadı")
    monkeypatch.setattr(O, "muavin_indir", bozuk)
    monkeypatch.setattr(O, "isletme_mi", lambda L: False)
    from datetime import date
    s = O.firma_isle(L(), "id:1", date(2026, 9, 1), date(2026, 9, 30), [], tmp_path, muavin=True, defter="bilanco")
    assert goruldu == ["hata_muavin.jpg"]
    assert not list(tmp_path.glob("hata_*")) and any(a["durum"] == "hata" for a in s.adimlar)


@pytest.mark.skipif(sys.platform == "win32", reason="Windows'ta DPAPI kullanılır")
def test_d11_windows_disinda_parola_diske_yazilmaz(tmp_path, monkeypatch):
    monkeypatch.setenv("FK_VERI", str(tmp_path))
    from fatura_kontrol import ayarlar
    ayarlar.kaydet({"luca_uye_no": "1", "luca_kullanici": "a", "luca_parola": "GizliP4rola", "otomatik_giris": True})
    disk = (tmp_path / "ayarlar.json").read_text(encoding="utf-8")
    assert "GizliP4rola" not in disk and "R2l6bGlQNHJvbGE" not in disk          # düz de base64 de yok
    assert ayarlar.luca_girisi()["parola"] == "GizliP4rola"                      # aynı süreçte kullanılır
    assert ayarlar.oku()["luca_parola_kayitli"]
    importlib.reload(ayarlar)                                                    # program yeniden açıldı
    assert ayarlar.luca_girisi() is None and not ayarlar.oku()["luca_parola_kayitli"]


@pytest.mark.skipif(sys.platform == "win32", reason="Windows'ta DPAPI kullanılır")
def test_d11_eski_base64_kayit_ilk_yazista_temizlenir(tmp_path, monkeypatch):
    monkeypatch.setenv("FK_VERI", str(tmp_path))
    (tmp_path / "ayarlar.json").write_text(json.dumps({"luca_uye_no": "1", "luca_kullanici": "a", "otomatik_giris": True,
                                                       "luca_parola": "b64:R2l6bGlQNHJvbGE="}), encoding="utf-8")
    from fatura_kontrol import ayarlar
    importlib.reload(ayarlar)
    assert ayarlar.luca_girisi()["parola"] == "GizliP4rola"                      # eski kayıt okunur
    ayarlar.kaydet({"telefon": "0"})
    assert "R2l6bGlQNHJvbGE" not in (tmp_path / "ayarlar.json").read_text(encoding="utf-8")
    assert ayarlar.luca_girisi()["parola"] == "GizliP4rola"


def _istemci(monkeypatch, tmp_path, **env):
    monkeypatch.setenv("FK_VERI", str(tmp_path))
    for k, v in env.items():
        monkeypatch.setenv(k, v)
    import fatura_kontrol.web.app as A
    A = importlib.reload(A)
    from fastapi.testclient import TestClient
    return TestClient(A.app)


def test_d15_bagimsiz_mod_rastgele_anahtar(monkeypatch, tmp_path):
    monkeypatch.setenv("FK_ANAHTAR", "")            # testten sonra eski hâline döner (üretilen anahtar sızmaz)
    monkeypatch.delenv("FK_ANAHTAR")
    from fatura_kontrol.web.__main__ import acilis_adresi
    adres = acilis_adresi(8123)
    import os
    anahtar = os.environ["FK_ANAHTAR"]
    assert len(anahtar) >= 24 and adres == f"http://127.0.0.1:8123/?anahtar={anahtar}"
    monkeypatch.setenv("FK_ANAHTAR", "muhawin-verdi")
    assert acilis_adresi(8123) == "http://127.0.0.1:8123"                       # MuhaWin anahtarı adreste görünmez


def test_d15_anahtar_cereze_alinir(monkeypatch, tmp_path):
    c = _istemci(monkeypatch, tmp_path, FK_ANAHTAR="K3y-bagimsiz")
    assert c.get("/api/ayarlar").status_code == 403                               # başka program / sayfa
    assert c.get("/api/ayarlar?anahtar=yanlis").status_code == 403
    r = c.get("/?anahtar=K3y-bagimsiz", follow_redirects=False)
    assert r.status_code == 303 and r.headers["location"] == "/"
    cerez = r.headers["set-cookie"].lower()
    assert "fk_anahtar=k3y-bagimsiz" in cerez and "httponly" in cerez and "samesite=strict" in cerez
    assert c.get("/api/ayarlar").status_code == 200                               # tarayıcı çerezle devam eder
    assert c.post("/api/ayarlar?anahtar=K3y-bagimsiz", json={}, cookies={"fk_anahtar": ""}).status_code == 403
    assert _istemci(monkeypatch, tmp_path, FK_ANAHTAR="K3y-bagimsiz").get("/api/ayarlar", headers={"X-MuhaWin": "K3y-bagimsiz"}).status_code == 200
