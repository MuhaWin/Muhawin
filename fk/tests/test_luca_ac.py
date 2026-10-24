"""Görev 37: rapordaki "Luca'da aç" düğmesi (yalnız MuhaWin içinde; fişe dokunmaz, Luca'da fiş listesini süzer)."""
import io
import json
import os
import sys
import zipfile
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent))
from test_fis_ve_tumu import _sunucu, tarayici  # noqa: E402,F401  (Chromium fikstürü)
from test_luca_otomasyon import FIRMA_VKN, muavin_yaz, ubl  # noqa: E402


@pytest.fixture
def c(tmp_path, monkeypatch):
    monkeypatch.setenv("FK_VERI", str(tmp_path / "veri"))
    from fastapi.testclient import TestClient
    from fatura_kontrol.web import app as A
    return TestClient(A.app)


def _rapor(c, tmp_path, luca_id="55"):
    zb = io.BytesIO()
    with zipfile.ZipFile(zb, "w") as z:
        z.writestr("a.xml", ubl("AAA2026000000001", "2026-09-05", "1", FIRMA_VKN, "1000.00", "200.00", 20))
        z.writestr("c.xml", ubl("ZZZ2026000000005", "2026-09-11", "7", FIRMA_VKN, "100.00", "20.00", 20))   # muavinde yok → fiş yok
    m = tmp_path / "muavin.xlsx"; muavin_yaz(m)
    r = c.post("/api/kontrol", data={"bas": "2026-09-01", "bit": "2026-09-30", "program": "luca"},
               files=[("faturalar", ("f.zip", zb.getvalue(), "application/zip")), ("muavinler", ("m.xlsx", m.read_bytes(), "application/octet-stream"))])
    assert r.status_code == 200, r.text
    v = r.json()
    if luca_id:
        from fatura_kontrol import depo
        f = depo.rapor_klasoru(v["id"]).parent.parent / "firma.json"
        d = json.loads(f.read_text(encoding="utf-8")) if f.exists() else {}
        d["luca_id"] = luca_id; f.write_text(json.dumps(d), encoding="utf-8")
    return v


def test_rapor_luca_kimligi(c, tmp_path):
    v = _rapor(c, tmp_path)
    assert c.get("/api/rapor", params={"id": v["id"]}).json()["luca_id"] == "55"


def test_rapor_luca_kimligi_yoksa_bos(c, tmp_path):
    v = _rapor(c, tmp_path, luca_id=None)
    assert c.get("/api/rapor", params={"id": v["id"]}).json()["luca_id"] == ""


def _ac(tarayici, adres, rid, muhawin=True):
    ctx = tarayici.new_context(user_agent=("Mozilla/5.0 Electron/31.7.7" if muhawin else "Mozilla/5.0 Chrome/130"))
    pg = ctx.new_page()
    pg.goto(f"{adres}/api/saglik")                                   # aynı köken: iframe'i barındıran sayfa
    pg.evaluate("""a => { window.__m = []; addEventListener('message', e => window.__m.push(e.data));
      document.body.innerHTML = '<iframe id=f style="width:1400px;height:900px" src="' + a + '"></iframe>'; }""", f"{adres}/?rapor={rid}")
    fr = None
    for _ in range(100):
        fr = next((f for f in pg.frames if "rapor=" in f.url), None)
        if fr:
            try:
                fr.wait_for_selector("#tablo .fisbtn", timeout=200); break
            except Exception:
                pass
        pg.wait_for_timeout(100)
    return ctx, pg, fr


# her sekmede başlık, süzgeç ve satır hücre sayıları aynı (sütun kalkınca tablo kaymasın)
_SUTUN = """() => { const t = document.querySelector('#tablo'); if (!t || !t.tHead) return null;
  const bas = t.querySelectorAll('thead tr:first-child th').length;
  const suz = t.querySelector('thead tr.tg-filtre') ? t.querySelectorAll('thead tr.tg-filtre > *').length : bas;
  const sat = [...t.querySelectorAll('tbody tr')].filter(r => r.children.length > 1).map(r => r.children.length);
  return {bas, suz, sat}; }"""


def test_tarayicida_luca_da_ac(c, tmp_path, tarayici):
    """Rapor listesinde satır sonu "Luca'da aç" sütunu yok (kullanıcı isteği); fiş penceresindeki "Luca'da aç" kalır."""
    v = _rapor(c, tmp_path)
    srv, adres = _sunucu(tmp_path / "veri")
    try:
        ctx, pg, fr = _ac(tarayici, adres, v["id"])
        assert fr.eval_on_selector_all(".lucabtn, #tablo [data-lucafis]", "b => b.length") == 0
        assert "Luca'da aç" not in fr.inner_text("#tablo")
        denetlenen = []
        for sekme in fr.eval_on_selector_all("#sekmeler [data-k]", "b => b.filter(x => !x.hidden && !x.disabled).map(x => x.dataset.k)"):
            fr.click(f"#sekmeler [data-k='{sekme}']")
            fr.wait_for_timeout(150)
            k = fr.evaluate(_SUTUN)
            if k and k["sat"]:
                assert k["bas"] == k["suz"] and all(n == k["bas"] for n in k["sat"]), (sekme, k)
                denetlenen.append((sekme, k["bas"]))
        assert len(denetlenen) >= 2, denetlenen
        fr.click("#sekmeler [data-k=kontrol]")
        # fiş numarasına tıklayınca açılan fiş penceresinde "Luca'da aç" → Luca'da Fiş Listesi o fişle
        fr.click("#tablo .fisbtn >> nth=0"); fr.wait_for_selector("#fisPen[open] tbody tr")
        assert fr.is_visible("#fisLuca")
        fr.click("#fisLuca")
        pg.wait_for_function("window.__m.some(m => m.tip === 'lucaFisAc')")
        m = next(x for x in pg.evaluate("window.__m") if x.get("tip") == "lucaFisAc")
        assert m["fk"] is True and m["lucaId"] == "55" and m["yil"] == "2026" and m["fisNo"] in ("1", "0001"), m
        ctx.close()
        # MuhaWin dışında (düz tarayıcı) fiş penceresinde "Luca'da aç" görünmez
        ctx, pg, fr = _ac(tarayici, adres, v["id"], muhawin=False)
        fr.click("#tablo .fisbtn >> nth=0"); fr.wait_for_selector("#fisPen[open] tbody tr")
        assert not fr.is_visible("#fisLuca")
        ctx.close()
    finally:
        srv.should_exit = True
