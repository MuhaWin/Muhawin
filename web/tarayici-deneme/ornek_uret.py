"""Denemenin sahte girdileri: fk/tests'teki üreticilerle (gerçek firma verisi yok)."""
import sys, zipfile
from pathlib import Path
BURA = Path(__file__).parent
sys.path.insert(0, str(BURA.parent.parent / "fk" / "tests"))
sys.path.insert(0, str(BURA.parent.parent / "fk"))
from test_luca_otomasyon import ubl, FIRMA_VKN
from test_denetim import _mikro
(BURA / "ornek").mkdir(exist_ok=True)
with zipfile.ZipFile(BURA / "ornek" / "faturalar.zip", "w") as z:
    z.writestr("a.xml", ubl("AAA2026000000001", "2026-09-05", "1", FIRMA_VKN, "1000.00", "200.00", 20))
    z.writestr("b.xml", ubl("EX02026000000001", "2026-09-10", FIRMA_VKN, "9", "2000.00", "400.00", 20))
_mikro(BURA / "ornek" / "muavin.xlsx", satis_matrah=1900, cari_alis=1150)
print("ornek/faturalar.zip ve ornek/muavin.xlsx yazıldı")
