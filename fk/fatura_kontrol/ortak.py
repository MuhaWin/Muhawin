"""Görev 51: veri klasörü birden çok kişi tarafından kullanılabilir (büronun ortak klasörü).

* sorgulayan(): sorgulamayı yapan kullanıcı (MuhaWin'den FK_KULLANICI = e-posta); rapora ve toplu özete yazılır.
* kilit(): aynı firma ve dönemi iki kişi aynı anda sorgulamasın. Kilit dosyası <dönem>.kilit (sahibi, zamanı); sahibi
  çalıştıkça dosyanın zamanı yenilenir, 10 dakika yenilenmeyen kilit bayat sayılır ve devralınır.
* Yenileme: yeni sorgulamanın belgeleri geçici klasöre (.<AA>.yeni-…) iner; sorgulama tam ve hatasız biterse geçici
  klasör eskisinin yerine geçer, eski ancak o zaman silinir. Yarıda kalırsa eski veri olduğu gibi kalır.
* gunluk(): yapılan sorgulama MuhaWin'in işlem günlüğüne (Supabase, ofis bazında) gider: FK_GUNLUK dosyasına bir satır
  yazılır, MuhaWin okuyup gönderir. MuhaWin dışında (komut satırı) yazılmaz.
"""
from __future__ import annotations

import getpass
import json
import os
import shutil
import socket
import threading
import time
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path

BAYAT_SN = 600            # 10 dakika yenilenmeyen kilit bayat
YENILE_SN = 30


def sorgulayan() -> str:
    try:
        return os.environ.get("FK_KULLANICI") or getpass.getuser()
    except Exception:
        return ""


def simdi() -> str:
    return datetime.now().isoformat(timespec="seconds")


class KilitHatasi(RuntimeError):
    pass


def _kilit_yolu(klasor: Path) -> Path:
    return klasor.parent / f"{klasor.name}.kilit"


def kilit_bilgisi(klasor: Path) -> dict | None:
    """Kilit varsa ve bayat değilse sahibini döndürür."""
    y = _kilit_yolu(klasor)
    try:
        if time.time() - y.stat().st_mtime > BAYAT_SN:
            return None
        return json.loads(y.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


@contextmanager
def kilit(klasor: Path, is_adi: str = "sorgulama"):
    """Firma-dönem kilidi. Başkası tutuyorsa KilitHatasi (kim, ne zamandan beri)."""
    y = _kilit_yolu(klasor)
    y.parent.mkdir(parents=True, exist_ok=True)
    ben = {"sahibi": sorgulayan(), "bilgisayar": socket.gethostname(), "pid": os.getpid(), "is": is_adi, "zaman": simdi()}
    for _ in range(2):
        try:
            fd = os.open(y, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                json.dump(ben, f, ensure_ascii=False)
            break
        except FileExistsError:
            try:
                bayat = time.time() - y.stat().st_mtime > BAYAT_SN
            except OSError:
                bayat = True
            if bayat:                                     # sahibi çökmüş / kapanmış: devral
                try:
                    y.unlink()
                except OSError:
                    pass
                continue
            try:
                o = json.loads(y.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                o = {}
            raise KilitHatasi(f"{klasor.parent.parent.name} {klasor.parent.name}-{klasor.name} şu anda "
                              f"{o.get('sahibi') or 'başka bir kullanıcı'} ({o.get('bilgisayar') or '?'}) tarafından sorgulanıyor"
                              f" (başladı: {str(o.get('zaman') or '')[:16].replace('T', ' ')}). Bitince yeniden deneyin.")
    else:
        raise KilitHatasi("Kilit alınamadı; yeniden deneyin.")
    dur = threading.Event()

    def canli():                                          # kilidi taze tut
        while not dur.wait(YENILE_SN):
            try:
                os.utime(y, None)
            except OSError:
                pass
    t = threading.Thread(target=canli, daemon=True)
    t.start()
    try:
        yield ben
    finally:
        dur.set()
        try:
            o = json.loads(y.read_text(encoding="utf-8"))
            if o.get("pid") == ben["pid"] and o.get("bilgisayar") == ben["bilgisayar"] and o.get("zaman") == ben["zaman"]:
                y.unlink()
        except (OSError, ValueError):
            pass


class Yenileme:
    """Dönem klasörünün güvenli yenilenmesi: belgeler önce geçici klasöre iner, bitir() ile eskisinin yerine geçer."""

    def __init__(self, klasor: Path):
        self.klasor = klasor
        self.gecici = klasor.parent / f".{klasor.name}.yeni-{os.getpid()}-{int(time.time() * 1000)}"
        self.gecici.mkdir(parents=True, exist_ok=True)
        self.bitti = False

    def bitir(self) -> Path:
        """Geçici klasör eskisinin yerine geçer; eski ancak şimdi silinir. Kalıcı klasörü döndürür."""
        eski = None
        if self.klasor.exists():
            eski = self.klasor.parent / f".{self.klasor.name}.eski-{os.getpid()}-{int(time.time() * 1000)}"
            os.replace(self.klasor, eski)           # eski klasörde açık dosya varsa (Windows) hata: hiçbir şey değişmez
        try:
            os.replace(self.gecici, self.klasor)
        except OSError:
            if eski:
                os.replace(eski, self.klasor)       # eski veri yerine döner
            raise
        if eski:
            shutil.rmtree(eski, ignore_errors=True)
        self.bitti = True
        return self.klasor

    def iptal(self):
        """Yarıda kalan sorgulama: geçici klasör silinir, eski veri olduğu gibi kalır."""
        if not self.bitti:
            shutil.rmtree(self.gecici, ignore_errors=True)


def artiklari_temizle(firma_klasor: Path, yas_sn: int = 86400):
    """Çöken sorgulamalardan kalan eski geçici klasörleri (1 günden eski) siler."""
    for y in firma_klasor.glob("*/.*.yeni-*"):
        try:
            if time.time() - y.stat().st_mtime > yas_sn:
                shutil.rmtree(y, ignore_errors=True)
        except OSError:
            pass
    for y in firma_klasor.glob("*/.*.eski-*"):
        shutil.rmtree(y, ignore_errors=True)


def gunluk(tur: str, firma: str = "", ozet: str = "", **ayrinti):
    """MuhaWin işlem günlüğüne kayıt (FK_GUNLUK dosyasına bir JSON satırı; MuhaWin okuyup ofis günlüğüne gönderir)."""
    y = os.environ.get("FK_GUNLUK")
    if not y:
        return
    try:
        with open(y, "a", encoding="utf-8") as f:
            f.write(json.dumps({"tur": tur, "firma": firma, "ozet": ozet, "ayrinti": ayrinti or None, "zaman": simdi()},
                               ensure_ascii=False) + "\n")
    except OSError:
        pass
