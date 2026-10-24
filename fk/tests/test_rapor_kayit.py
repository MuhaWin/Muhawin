"""Görev 08: rapor kaydı web sunucusundan ayrı (tarayıcıda / Pyodide'de çalışma ön koşulu) ve Denetim'in program seçimi."""
import io
import json
import subprocess
import sys
import textwrap
import zipfile
from pathlib import Path

import pytest

from test_denetim import _mikro, c  # noqa: F401 (c: TestClient fikstürü)
from test_luca_otomasyon import FIRMA_VKN, ubl

FK = Path(__file__).resolve().parent.parent


def _belgeler(tmp_path) -> tuple[Path, Path]:
    z = tmp_path / "faturalar.zip"
    with zipfile.ZipFile(z, "w") as zf:
        zf.writestr("a.xml", ubl("AAA2026000000001", "2026-09-05", "1", FIRMA_VKN, "1000.00", "200.00", 20))
        zf.writestr("b.xml", ubl("EX02026000000001", "2026-09-10", FIRMA_VKN, "9", "2000.00", "400.00", 20))
    m = tmp_path / "muavin.xlsx"
    _mikro(m, satis_matrah=1900, cari_alis=1150)
    return z, m


def test_paket_web_sunucusu_ve_sqlite_olmadan_calisir(tmp_path):
    """fastapi / starlette / pydantic / uvicorn / playwright / sqlite3 yokken (tarayıcıdaki gibi) denetim, rapor kaydı ve beyanname."""
    z, m = _belgeler(tmp_path)
    veri = tmp_path / "veri"
    betik = textwrap.dedent(f"""
        import json, os, sys
        ENGEL = ("fastapi", "starlette", "pydantic", "uvicorn", "playwright", "sqlite3", "_sqlite3")
        for ad in ENGEL:
            sys.modules[ad] = None                      # içe aktarılırsa ImportError
        os.environ["FK_VERI"] = {str(veri)!r}
        sys.path.insert(0, {str(FK)!r})
        from datetime import date
        from pathlib import Path
        from fatura_kontrol import kontrol, denetim, rapor_kayit, beyanname
        k, bas, bit, vkn, ad = kontrol.yuklenenleri_yerlestir([Path({str(z)!r})], [Path({str(m)!r})], date(2026, 9, 1),
                                                              date(2026, 9, 30), None, program="mikro", firma_ad="DENETİM A.Ş.")
        v = kontrol.calistir(k, bas, bit, vkn, ad)
        d = denetim.denetle(k, bas, bit, vkn, ad, v["id"])
        bey = beyanname.hazirla(v["id"])                # KDV 1 / KDV 2 (W1'e dahil)
        yuklu = sorted(a for a in ENGEL if sys.modules.get(a) is not None)
        print(json.dumps({{"id": v["id"], "durumlar": len(v["durumlar"]), "ozet": d["ozet"],
                          "rapor_json": (k / "rapor.json").exists(), "yuklu": yuklu,
                          "web_app": "fatura_kontrol.web.app" in sys.modules, "db": rapor_kayit._db() is None,
                          "okunan": (rapor_kayit.rapor_oku(v["id"]) or {{}}).get("id"), "kdv1": "kdv1" in bey}}))
    """)
    r = subprocess.run([sys.executable, "-c", betik], capture_output=True, text=True, timeout=120)
    assert r.returncode == 0, r.stderr[-3000:]
    s = json.loads(r.stdout.strip().splitlines()[-1])
    assert s["yuklu"] == [] and not s["web_app"]          # engellenen modüllerin hiçbiri ve web sunucusu yüklenmedi
    assert s["rapor_json"] and s["durumlar"] > 0 and s["okunan"] == s["id"] and s["kdv1"]
    assert s["db"]                                          # sqlite3 yok → geçmiş kaydı atlandı
    assert not (veri / "gecmis.sqlite").exists()
    assert s["ozet"]["Matrah"]["sorunlu"] == 1 and s["ozet"]["Cari"]["sorunlu"] == 1 and s["ozet"]["KDV"]["sorunlu"] == 0


def test_masaustunde_gecmis_yine_yazilir(c, tmp_path):
    """Masaüstü davranışı değişmez: /api/denetim raporu geçmişe (sqlite) ekler, /api/gecmis listeler."""
    z, m = _belgeler(tmp_path)
    r = c.post("/api/denetim", data={"bas": "2026-09-01", "bit": "2026-09-30", "firma_ad": "DENETİM A.Ş.", "program": "mikro"},
               files=[("faturalar", ("p.zip", z.read_bytes(), "application/zip")),
                      ("muavinler", ("m.xlsx", m.read_bytes(), "application/octet-stream"))])
    assert r.status_code == 200, r.text
    rid = r.json()["rapor_id"]
    assert rid in [g["id"] for g in c.get("/api/gecmis").json()]


def test_denetim_program_listesi(c):
    from fatura_kontrol import muavin_programlari as MP
    d = c.get("/api/muavin/programlar", params={"denetim": 1}).json()["programlar"]
    assert [p["kod"] for p in d] == MP.DENETIM_SIRA == ["mikro", "elektra", "luca"]     # Görev 43: Mikro · Elektra · Luca
    assert all(p["ad"] and p["ipucu"] for p in d)
    tum = c.get("/api/muavin/programlar").json()["programlar"]
    assert [p["kod"] for p in tum] == ["luca", "mikro", "luca_isletme_excel"]   # tek firma kontroldeki liste değişmedi


def test_denetimde_olmayan_program_reddedilir(c, tmp_path):
    z, m = _belgeler(tmp_path)
    r = c.post("/api/denetim", data={"bas": "2026-09-01", "bit": "2026-09-30", "program": "luca_isletme_excel"},
               files=[("faturalar", ("p.zip", z.read_bytes(), "application/zip")),
                      ("muavinler", ("m.xlsx", m.read_bytes(), "application/octet-stream"))])
    assert r.status_code == 400 and "Denetim ekranında desteklenmiyor" in r.json()["detail"]


def test_red_iptal_duzeni_programa_gore(tmp_path):
    from fatura_kontrol import muavin_programlari as MP, red_iptal
    assert MP.red_iptal_duzeni("mikro") == "mikro"
    assert MP.red_iptal_duzeni("luca") == red_iptal.VARSAYILAN_DUZEN      # kaydı olmayan program → varsayılan
    assert MP.red_iptal_duzeni(None) == red_iptal.VARSAYILAN_DUZEN
    # bilinmeyen düzen adı varsayılana düşer; Mikro listesi iki yolla da aynı okunur
    import openpyxl
    y = tmp_path / "red_iptal_satis.xlsx"
    wb = openpyxl.Workbook(); ws = wb.active
    ws.append(["EFatura ID", "Belge tarihi", "Vergi kimlik no", "Cari ünvanı", "Vergi matrahı", "Hesaplanan KDV", "Yekün", "Fatura durum açıklaması"])
    ws.append(["EX02026000000009", "10.09.2026", "1234567890", "ALICI", 100, 20, 120, "İptal edildi"])
    wb.save(y)
    a, _ = red_iptal.oku([y], "mikro")
    b, _ = red_iptal.oku([y], "yok-boyle-duzen")
    assert list(a) == ["EX02026000000009"] and a == b and a["EX02026000000009"]["red"]


def test_denetim_sayfasi_program_secimi():
    """denetim.html sabit program=mikro göndermez; program seçimi ve etiketler kayıttan gelir."""
    s = (FK / "fatura_kontrol" / "web" / "static" / "denetim.html").read_text(encoding="utf-8")
    assert 'fd.append("program", "mikro")' not in s and 'fd.append("program", $("#program").value)' in s
    assert 'id="program"' in s and "/api/muavin/programlar?denetim=1" in s
    assert "Firmanın Mikro muavinini seçin" not in s and "Mikro muavinini yükleyip" not in s


def test_web_app_playwright_olmadan_iceri_aktarilir():
    """toplu_api'nin Luca/Playwright zinciri tembel: web.app Playwright olmadan yüklenir, toplu uçları yine kayıtlı."""
    betik = textwrap.dedent(f"""
        import json, sys
        sys.modules["playwright"] = None
        sys.path.insert(0, {str(FK)!r})
        import fatura_kontrol.web.app as A
        print(json.dumps({{"otomasyon": "fatura_kontrol.luca.otomasyon" in sys.modules,
                          "toplu": "/api/toplu/durum" in A.app.openapi()["paths"]}}))
    """)
    r = subprocess.run([sys.executable, "-c", betik], capture_output=True, text=True, timeout=120)
    assert r.returncode == 0, r.stderr[-3000:]
    s = json.loads(r.stdout.strip().splitlines()[-1])
    assert not s["otomasyon"] and s["toplu"]
