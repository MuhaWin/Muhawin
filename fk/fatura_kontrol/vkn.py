"""VKN (10 hane) / TCKN (11 hane) biçim ve sağlama denetimi, fatura numarası ön eki (Görev 35).

Sağlaması tutmayan numara cari eşleştirmede kullanılmaz. Luca'nın e-Belge listesinde VKN sayı olarak gelir;
baştaki 0 düşmüş 9 haneli VKN 10 haneye tamamlanır."""
from __future__ import annotations

import re

# Birden çok firmanın kullandığı genel ön ekler (entegratör / GİB portalı): tek başına cari göstermez
GENEL_ONEKLER = frozenset({"GIB", "EAR", "EFT"})


def vkn_norm(x) -> str:
    v = re.sub(r"\D", "", str(x if x is not None else ""))
    return v.zfill(10) if len(v) == 9 else v


def vkn_sagla(v: str) -> bool:
    if not re.fullmatch(r"\d{10}", v):
        return False
    t = 0
    for i in range(9):
        k = (int(v[i]) + 9 - i) % 10
        t += 9 if k == 9 else (k * 2 ** (9 - i)) % 9
    return (10 - t % 10) % 10 == int(v[9])


def tckn_sagla(v: str) -> bool:
    if not re.fullmatch(r"[1-9]\d{10}", v):
        return False
    d = [int(c) for c in v]
    return (sum(d[0:9:2]) * 7 - sum(d[1:8:2])) % 10 == d[9] and sum(d[:10]) % 10 == d[10]


def gecerli(x) -> bool:
    v = vkn_norm(x)
    return vkn_sagla(v) if len(v) == 10 else tckn_sagla(v) if len(v) == 11 else False


def onek(belge_no) -> str:
    """GİB fatura numarası 16 karakter: 3 karakter seri ön eki + yıl + sıra. Başka biçimde ön ek yok."""
    b = re.sub(r"\s", "", str(belge_no or "")).upper()
    return b[:3] if re.fullmatch(r"[A-Z0-9ÇĞİÖŞÜ]{3}\d{13}", b) else ""
