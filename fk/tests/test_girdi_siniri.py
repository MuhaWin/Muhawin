"""Belge girdisi sınırları (rapor-02 G-F, Görev 26): iç içe ZIP derinliği, açılmış boyut, sıkıştırma oranı, yükleme üst sınırı.
Sınırlar testte küçültülür; asıl eşikler fatura_okuyucu.py ve web/app.py'de."""
import importlib
import io
import zipfile

import pytest

import fatura_kontrol.fatura_okuyucu as FO
from test_luca_otomasyon import ubl

VKN = "1234567890"


def zipla(girdiler: dict[str, bytes], sikistir=zipfile.ZIP_DEFLATED) -> bytes:
    b = io.BytesIO()
    with zipfile.ZipFile(b, "w", sikistir) as z:
        for ad, veri in girdiler.items():
            z.writestr(ad, veri)
    return b.getvalue()


def fatura(i: int) -> bytes:
    return ubl(f"AAA2026{i:09d}", "2026-09-05", "9", VKN, "1000.00", "200.00", 20)


def ic_ice(derinlik: int) -> bytes:
    """derinlik = toplam ZIP düzeyi (dış dosya dahil); en içte bir fatura."""
    v = zipla({"f.xml": fatura(1)})
    for i in range(derinlik - 1):
        v = zipla({f"ic{i}.zip": v})
    return v


def oku(tmp_path, veri: bytes, ad="paket.zip"):
    y = tmp_path / ad
    y.write_bytes(veri)
    return FO.faturalari_oku([y], VKN)


def test_gercekci_arsiv_okunur(tmp_path):
    """Dönem paketi → fatura paketleri (2 düzey), 300 fatura: sınırlara takılmaz."""
    ic = {f"fatura_{i}.zip": zipla({f"{i}.xml": fatura(i)}) for i in range(300)}
    ft, _ = oku(tmp_path, zipla(ic))
    assert len(ft) == 300


def test_derinlik_siniri(tmp_path):
    assert len(oku(tmp_path, ic_ice(FO.ZIP_DERINLIK))[0]) == 1
    with pytest.raises(FO.GirdiSiniri, match="iç içe 4 düzeyden derin"):
        oku(tmp_path, ic_ice(FO.ZIP_DERINLIK + 1))


def test_acma_bombasi_orani(tmp_path, monkeypatch):
    monkeypatch.setattr(FO, "ZIP_GIRDI_EN_COK", 64 * FO.MB)
    bomba = b"<a>" + b"0" * (20 * FO.MB) + b"</a>"          # ~20 MB, birkaç on KB'a sıkışır (oran > 500)
    with pytest.raises(FO.GirdiSiniri, match="olağan dışı sıkıştırılmış"):
        oku(tmp_path, zipla({"x.xml": bomba}))


def test_girdi_boyutu_ve_toplam(tmp_path, monkeypatch):
    monkeypatch.setattr(FO, "ZIP_GIRDI_EN_COK", 1024)
    with pytest.raises(FO.GirdiSiniri, match="tek dosya en çok"):
        oku(tmp_path, zipla({"buyuk.xml": b"<a>" + bytes(range(256)) * 8 + b"</a>"}))
    monkeypatch.setattr(FO, "ZIP_GIRDI_EN_COK", 256 * FO.MB)
    monkeypatch.setattr(FO, "ZIP_TOPLAM_EN_COK", 5 * len(fatura(1)))
    with pytest.raises(FO.GirdiSiniri, match="dönemlere bölüp"):
        oku(tmp_path, zipla({f"{i}.xml": fatura(i) for i in range(10)}))


def test_girdi_sayisi(tmp_path, monkeypatch):
    monkeypatch.setattr(FO, "ZIP_GIRDI_SAYISI", 5)
    with pytest.raises(FO.GirdiSiniri, match="çok fazla dosya"):
        oku(tmp_path, zipla({f"{i}.xml": fatura(i) for i in range(6)}))


def test_bozuk_paket_kurtarmada_da_sinir(tmp_path, monkeypatch):
    """İçindekiler listesi olmayan (yarım inmiş) paket yerel başlıklardan açılırken de boyut sınırlı."""
    tam = zipla({"a.xml": fatura(1), "b.xml": b"<a>" + b"1" * 4096 + b"</a>"})
    yarim = tam[:tam.rfind(b"PK\x01\x02")]
    ft, _ = oku(tmp_path, yarim)
    assert len(ft) == 1
    monkeypatch.setattr(FO, "ZIP_GIRDI_EN_COK", 1024)
    with pytest.raises(FO.GirdiSiniri):
        oku(tmp_path, yarim)


def test_ic_zip_bozuksa_uyari_sinirsa_hata(tmp_path):
    """Bozuk iç paket eskisi gibi uyarıyla geçilir; sınır aşımı ise uyarıya dönüşmez, hata olarak çıkar."""
    FO.ZIP_UYARILARI.clear()
    ft, _ = oku(tmp_path, zipla({"iyi.xml": fatura(1), "bozuk.zip": b"PK\x03\x04bozuk"}))
    assert len(ft) == 1 and any("bozuk.zip" in u for u in FO.ZIP_UYARILARI)
    with pytest.raises(FO.GirdiSiniri):
        oku(tmp_path, zipla({"iyi.xml": fatura(1), "derin.zip": ic_ice(FO.ZIP_DERINLIK)}))


def _istemci(monkeypatch, tmp_path, **env):
    monkeypatch.setenv("FK_VERI", str(tmp_path))
    for k, v in env.items():
        monkeypatch.setenv(k, v)
    import fatura_kontrol.web.app as A
    A = importlib.reload(A)
    from fastapi.testclient import TestClient
    return A, TestClient(A.app)


def test_yukleme_ust_siniri(monkeypatch, tmp_path):
    A, c = _istemci(monkeypatch, tmp_path, FK_YUKLEME_SINIR_MB="1")
    assert A.YUKLEME_EN_COK == 1024 * 1024
    r = c.post("/api/kontrol", files={"faturalar": ("f.zip", b"0" * (1024 * 1024 + 10), "application/zip")})
    assert r.status_code == 413 and "en çok 1 MB" in r.json()["detail"]
    # Content-Length'e güvenilmese de kopyalarken sayılır
    from fastapi import HTTPException
    sayac = [0]
    with pytest.raises(HTTPException) as e:
        A._kopyala(io.BytesIO(b"0" * (1024 * 1024 + 1)), tmp_path / "x.bin", sayac)
    assert e.value.status_code == 413


def test_varsayilan_yukleme_siniri_buyuk_arsivi_reddetmez(monkeypatch, tmp_path):
    A, _ = _istemci(monkeypatch, tmp_path)
    assert A.YUKLEME_EN_COK >= 1024 * 1024 * 1024        # 200 MB'lık arşiv rahatça geçer


def test_sinir_hatasi_anlasilir_400(monkeypatch, tmp_path):
    A, c = _istemci(monkeypatch, tmp_path)

    @A.app.get("/api/_test_sinir")
    def _sinir():
        raise FO.GirdiSiniri("paket.zip: iç içe 4 düzeyden derin ZIP açılmaz.")
    r = c.get("/api/_test_sinir")
    assert r.status_code == 400 and r.json()["detail"].startswith("paket.zip: iç içe")
