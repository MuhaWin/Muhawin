"""MuhaWin kurulumuna gömülecek Windows Python'unu hazırlar: dist-python/python

- Python: python-build-standalone (CPython, x86_64-pc-windows-msvc, install_only_stripped)
- Paketler: fk/requirements.txt, Windows (win_amd64) wheel'leri olarak Lib/site-packages'a kurulur.
Bu betik Linux'ta da çalışır (çapraz hazırlık); kurulum dosyası müşteride Python gerektirmez.

Kullanım:  python3 tools/python_win.py
"""
from __future__ import annotations

import io
import shutil
import subprocess
import sys
import tarfile
import urllib.request
from pathlib import Path

PY_SURUM = "3.12.11"
PBS_ETIKET = "20250612"
URL = ("https://github.com/astral-sh/python-build-standalone/releases/download/"
       f"{PBS_ETIKET}/cpython-{PY_SURUM}%2B{PBS_ETIKET}-x86_64-pc-windows-msvc-install_only_stripped.tar.gz")

KOK = Path(__file__).resolve().parent.parent
HEDEF = KOK / "dist-python" / "python"
ONBELLEK = KOK / "dist-python" / f"cpython-{PY_SURUM}-win.tar.gz"
GEREKSINIM = KOK / "fk" / "requirements.txt"


def indir():
    if ONBELLEK.exists() and ONBELLEK.stat().st_size > 10_000_000:
        return ONBELLEK.read_bytes()
    print("Windows Python indiriliyor:", URL)
    with urllib.request.urlopen(URL, timeout=300) as r:
        veri = r.read()
    ONBELLEK.parent.mkdir(parents=True, exist_ok=True)
    ONBELLEK.write_bytes(veri)
    return veri


def main():
    if HEDEF.exists():
        shutil.rmtree(HEDEF)
    HEDEF.parent.mkdir(parents=True, exist_ok=True)
    with tarfile.open(fileobj=io.BytesIO(indir()), mode="r:gz") as t:
        t.extractall(HEDEF.parent, filter="data")          # arşivin kökü "python/"
    assert (HEDEF / "python.exe").exists(), "python.exe bulunamadı"
    site = HEDEF / "Lib" / "site-packages"
    print("Paketler kuruluyor (win_amd64)...")
    subprocess.run([sys.executable, "-m", "pip", "install", "--quiet", "--disable-pip-version-check",
                    "--platform", "win_amd64", "--python-version", PY_SURUM.rsplit(".", 1)[0].replace(".", ""),
                    "--implementation", "cp", "--only-binary=:all:", "--target", str(site), "--upgrade",
                    "-r", str(GEREKSINIM)], check=True)
    # kurulum boyutunu küçült: testler, önbellekler, Tcl/Tk ve IDLE gereksiz
    for kalip in ("**/__pycache__", "Lib/test", "Lib/idlelib", "Lib/tkinter", "tcl", "Lib/ensurepip",
                  "Lib/site-packages/*/tests"):
        for y in HEDEF.glob(kalip):
            shutil.rmtree(y, ignore_errors=True)
    for y in ("DLLs/_tkinter.pyd", "DLLs/tcl86t.dll", "DLLs/tk86t.dll"):
        (HEDEF / y).unlink(missing_ok=True)
    boyut = sum(f.stat().st_size for f in HEDEF.rglob("*") if f.is_file())
    print(f"Hazır: {HEDEF}  ({boyut / 1e6:.0f} MB)")


if __name__ == "__main__":
    main()
