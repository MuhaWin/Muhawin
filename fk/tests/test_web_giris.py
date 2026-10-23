"""Web sürümü (FK_WEB=1): giriş zorunlu, Luca bölümleri kapalı, Mikro Denetim açık."""
import importlib

import pytest
from fastapi.testclient import TestClient

IZINLI = "bilgi@ornek.com"


@pytest.fixture
def web(monkeypatch, tmp_path):
    monkeypatch.setenv("FK_WEB", "1")
    monkeypatch.setenv("FK_WEB_IZINLI", f"{IZINLI}, ikinci@ornek.com")
    monkeypatch.setenv("FK_WEB_ANAHTAR", "x" * 40)
    monkeypatch.setenv("FK_WEB_GUVENLI_CEREZ", "0")      # TestClient http üzerinden çalışır
    monkeypatch.setenv("FK_VERI", str(tmp_path))
    from fatura_kontrol.web import giris
    giris._hatalar.clear()
    monkeypatch.setattr(giris, "supabase_dogrula", lambda e, p: p == "dogru-parola")
    from fatura_kontrol.web import app as A
    A = importlib.reload(A)
    yield TestClient(A.app)
    monkeypatch.delenv("FK_WEB")
    importlib.reload(A)


def _gir(c, eposta=IZINLI, parola="dogru-parola"):
    return c.post("/api/giris", json={"eposta": eposta, "parola": parola})


def test_oturumsuz_giris_sayfasina_gider(web):
    r = web.get("/denetim", follow_redirects=False)
    assert r.status_code == 303 and r.headers["location"] == "/giris"
    assert web.get("/api/denetim/liste").status_code == 401
    assert web.get("/giris").status_code == 200
    assert web.get("/api/saglik").json()["web"] is True


def test_giris_ve_cikis(web):
    assert _gir(web).status_code == 200
    assert web.get("/denetim").status_code == 200
    assert web.get("/api/denetim/liste").json() == {"liste": []}
    assert web.get("/api/oturum").json()["eposta"] == IZINLI
    web.post("/api/cikis")
    assert web.get("/api/denetim/liste").status_code == 401


def test_izinsiz_ve_yanlis_parola(web):
    assert _gir(web, eposta="yabanci@ornek.com").status_code == 403
    assert _gir(web, parola="yanlis").status_code == 401
    assert web.get("/api/denetim/liste").status_code == 401


def test_hatali_denemede_kilit(web):
    for _ in range(5):
        assert _gir(web, parola="yanlis").status_code == 401
    assert _gir(web).status_code == 429


def test_luca_bolumleri_kapali(web):
    _gir(web)
    for yol in ("/toplu", "/api/toplu/durum", "/api/kontrol/luca-faturalari?firma_id=1&bas=2026-01-01",
                "/isletme-fis", "/api/ayarlar"):
        assert web.get(yol).status_code == 404, yol
    r = web.get("/", follow_redirects=False)
    assert r.status_code == 303 and r.headers["location"] == "/denetim"


def test_sahte_cerez_reddedilir(web):
    from fatura_kontrol.web import giris
    gecerli = giris.oturum_yaz(IZINLI)
    assert giris.oturum_oku(gecerli) == IZINLI
    veri, imza = gecerli.rsplit(".", 1)
    assert giris.oturum_oku(veri + "." + imza[:-2] + "AA") is None
    assert giris.oturum_oku(giris.oturum_yaz(IZINLI, simdi=0)) is None          # süresi dolmuş
    assert giris.oturum_oku(giris.oturum_yaz("yabanci@ornek.com")) is None     # izinli değil


def test_masaustunde_degisiklik_yok(monkeypatch):
    monkeypatch.delenv("FK_WEB", raising=False)
    from fatura_kontrol.web import app as A
    A = importlib.reload(A)
    c = TestClient(A.app)
    assert c.get("/", follow_redirects=False).status_code == 200
    assert "web" not in c.get("/api/saglik").json()
