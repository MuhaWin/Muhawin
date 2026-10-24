"""Toplu (çok firmalı) Luca çalıştırması.

  python -m fatura_kontrol.luca.toplu --liste          # Luca'daki firma listesini veri/firmalar.xlsx'e çeker
  python -m fatura_kontrol.luca.toplu --ay 2026-09     # Dahil=E olan firmaların hepsini işler

firmalar.xlsx sütunları: Sıra | Luca Kısa Adı | SIRKET_ID | Dahil (E/H) | Not
Liste yenilendiğinde önceki Dahil/Not seçimleri SIRKET_ID üzerinden korunur; yeni firmalar 'E' gelir.
"""
from __future__ import annotations

import argparse
from contextlib import contextmanager
import json
import os
import re
import shutil
import sys
import time
import traceback
from calendar import monthrange
from datetime import date, datetime
from pathlib import Path

from openpyxl import Workbook, load_workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

from . import otomasyon as O
from .. import arsiv, depo, ortak

def veri_klasoru() -> Path:
    return depo.veri()


def liste_yolu() -> Path:
    return veri_klasoru() / "firma_listesi.xlsx"


DEFTERLER = ("bilanco", "isletme", "serbest")


def defter_oku() -> dict:
    """Firma (SIRKET_ID) → defter türü: bilanco | isletme | serbest (MuhaWin Ayarlar › Firmalar'dan gelir)."""
    try:
        return json.loads((veri_klasoru() / "defter_turleri.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def defter_yaz(yeni: dict) -> None:
    d = defter_oku()
    for k, v in yeni.items():
        if v in DEFTERLER:
            d[str(k)] = v
        else:
            d.pop(str(k), None)
    (veri_klasoru() / "defter_turleri.json").write_text(json.dumps(d, ensure_ascii=False, indent=1), encoding="utf-8")
BASLIKLAR = ["Sıra", "Luca Kısa Adı", "SIRKET_ID", "Dahil (E/H)", "Not"]


# ---------------------------------------------------------------- firma listesi dosyası
def liste_oku(yol: Path | None = None) -> list[dict]:
    yol = yol or liste_yolu()
    if not yol.exists():
        return []
    ws = load_workbook(yol).active
    firmalar = []
    for r in ws.iter_rows(min_row=2, values_only=True):
        if not r or not r[2]:
            continue
        dahil = str(r[3] or "E").strip().upper()[:1]
        firmalar.append({"ad": str(r[1] or "").strip(), "id": str(r[2]).strip(),
                         "dahil": dahil not in ("H", "N", "0"), "not": r[4] or ""})
    return firmalar


def liste_yaz(luca_firmalari: list[dict], yol: Path | None = None) -> Path:
    yol = yol or liste_yolu()
    eski = {f["id"]: f for f in liste_oku(yol)}
    yol.parent.mkdir(parents=True, exist_ok=True)
    wb = Workbook(); ws = wb.active; ws.title = "Firmalar"
    ws.append(BASLIKLAR)
    for c in ws[1]:
        c.font = Font(bold=True, color="FFFFFF"); c.fill = PatternFill("solid", fgColor="1F3864")
    for i, f in enumerate(luca_firmalari, 1):
        e = eski.get(f["id"])
        ws.append([i, f["ad"], f["id"], ("E" if e["dahil"] else "H") if e else "E", (e or {}).get("not", "")])
    for col, w in zip("ABCDE", (6, 30, 14, 12, 40)):
        ws.column_dimensions[col].width = w
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = ws.dimensions
    wb.save(yol)
    return yol


# ---------------------------------------------------------------- toplu çalıştırma
SORUN_SUTUNLARI = ["Muavinde yok", "Faturası bulunamadı", "Tutar farkı", "Yanlış KDV oranı hesabı",
                   "Mükerrer kayıt", "Fatura tarihinden önce kaydedilmiş", "Belge no farklı yazılmış olabilir",
                   "Binek araç (%70 KDV) – fark"]


class Ilerleme:
    """Programın canlı ilerleme ekranı için cikti/durum.json dosyasını günceller."""

    def __init__(self, cikti: Path, bas: date, bit: date, firmalar: list[dict]):
        self.yol = cikti / "durum.json"
        self.d = {"bas": bas.isoformat(), "bit": bit.isoformat(), "toplam": len(firmalar), "sira": 0,
                  "firma": "", "asama": "basliyor", "mesaj": "Tarayıcı açılıyor…", "adimlar": [],
                  "basladi": datetime.now().isoformat(timespec="seconds"), "bitti": None,
                  "guncelleme": datetime.now().isoformat(timespec="seconds")}
        self.yaz()

    def yaz(self, **k):
        self.d.update(k)
        self.d["guncelleme"] = datetime.now().isoformat(timespec="seconds")
        gecici = self.yol.with_suffix(".tmp")
        gecici.write_text(json.dumps(self.d, ensure_ascii=False), encoding="utf-8")
        os.replace(gecici, self.yol)

    def olay(self, olay: str, ayrinti: str = ""):
        if olay in ("giris", "captcha"):
            self.yaz(asama="giris", mesaj=ayrinti, captcha=olay == "captcha")
        elif olay == "giris_tamam":
            self.yaz(asama="calisiyor", mesaj=ayrinti, captcha=False)
        else:
            self.d["adimlar"] = (self.d["adimlar"] + [ayrinti])[-40:]
            self.yaz(mesaj=ayrinti)


def _tarayici_kapandi(e: Exception) -> bool:
    return bool(re.search(r"has been closed|Tarayıcı kapatıldı|Browser closed|Target closed", str(e), re.I))


def onceki_sonuclar(cikti: Path) -> list[dict]:
    y = cikti / "ozet.json"
    if y.exists():
        try:
            return json.loads(y.read_text(encoding="utf-8")).get("sonuclar", [])
        except (ValueError, OSError):
            pass
    return []


# ---------------------------------------------------------------- adım özeti (✓ / ✗ / tekrar sorgula)
ADIM_KODLARI = list(O.TURLER) + ["muavin"]
ADIM_DURUM = {"tamam": "Tamamlandı", "belge_yok": "Belge yok", "hata": "Hata", "yarim": "Yarım kaldı",
              "yapilmadi": "Yapılmadı"}


def adim_adi(kod: str) -> str:
    return "Muavin" if kod == "muavin" else O.TURLER.get(kod, kod)


def adim_kodu(a: dict) -> str | None:
    ad = a.get("adim", "")
    if ad.startswith("Muavin"):
        return "muavin"
    for k, v in O.TURLER.items():
        if ad == v or ad.startswith(v + ":"):
            return k
    return None


def adimlari_oku(klasor: Path) -> list[dict]:
    try:
        return json.loads((klasor / "adimlar.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return []


def adim_ozeti(adimlar: list[dict]) -> list[dict]:
    """Her e-belge türü ve muavin için tek satır: tamam / belge_yok / hata / yarim / yapilmadi."""
    ozet = []
    for kod in ADIM_KODLARI:
        grup = [a for a in adimlar if adim_kodu(a) == kod]
        hatali = [a for a in grup if a["durum"] == "hata"]
        if hatali:
            d, ayrinti = "hata", hatali[-1].get("ayrinti", "")
        elif kod == "muavin":
            d, ayrinti = ("tamam", grup[-1].get("ayrinti", "")) if grup else ("yapilmadi", "")
        elif any(a["durum"] == "atlandı" for a in grup):
            d, ayrinti = "belge_yok", "listede belge yok"
        elif any("indirildi" in a["adim"] for a in grup):
            d, ayrinti = "tamam", ""
        elif grup:
            d, ayrinti = "yarim", "sorgulandı ama indirme tamamlanmadı"
        else:
            d, ayrinti = "yapilmadi", ""
        belge = 0
        for a in grup:
            m = re.match(r"(\d+) belge", a.get("ayrinti") or "")
            if m and "indirildi" in a["adim"]:
                belge += int(m.group(1))
        if d == "tamam" and belge and kod != "muavin":
            ayrinti = f"{belge} belge"
        ozet.append({"kod": kod, "ad": adim_adi(kod), "durum": d, "ayrinti": ayrinti})
    return ozet


def firma_klasoru(bas: date, f: dict) -> Path:
    """Firmanın o döneme ait klasörü: veri/firmalar/<FİRMA>/<YIL>/<AA>"""
    return depo.donem_klasoru(f["ad"] or f["id"], bas)


def toplu_calistir(bas: date, bit: date, turler: list[str], cikti: Path, firmalar: list[dict],
                   profil=O.PROFIL, ctx_hazirla=None, adim: str | None = None,
                   yalniz_fatura: bool = False) -> tuple[list[dict], Path]:
    """Firmaları sırayla işler. Aynı klasörde önceden çalıştırılmış firmaların sonuçları korunur
    (yalnız yeniden çalıştırılanlar güncellenir) – 'tek firmayı yeniden çalıştır' bunu kullanır.
    adim verilirse (ör. 'gib_ebelge_alis' ya da 'muavin') yalnız o adım yeniden denenir; diğer adımların
    indirdiği dosyalar korunur ve kontrol tüm dosyalarla tekrar yapılır.
    yalniz_fatura: yalnız e-belgeler yeniden indirilir, dönem klasöründeki muavin korunur (Tek firma › "Luca'dan al")."""
    if adim and adim not in ADIM_KODLARI:
        raise ValueError(f"Bilinmeyen adım: {adim}")
    cikti.mkdir(parents=True, exist_ok=True)
    idler = {f["id"] for f in firmalar}
    onceki = {r.get("id"): r for r in onceki_sonuclar(cikti)}
    sonuclar: list[dict] = [r for r in onceki.values() if r.get("id") not in idler]
    ilerleme = Ilerleme(cikti, bas, bit, firmalar)
    O.DINLEYICI = ilerleme.olay

    def kaydet():
        try:                      # her firmadan sonra özeti güncelle (tarayıcı kapansa da özet kalır)
            ozet_yaz(sonuclar, bas, bit, cikti)
        except Exception as e:    # Excel'de açıkken kaydedilemeyebilir
            print(f"   (özet yazılamadı: {e})", flush=True)

    try:
        with O.oturum(profil, ctx_hazirla) as (ctx, L):
            kapandi = False
            for i, f in enumerate(firmalar, 1):
                print(f"\n[{i}/{len(firmalar)}] {f['ad']}" + (f" – yalnız {adim_adi(adim)}" if adim else ""), flush=True)
                ilerleme.yaz(sira=i, firma=f["ad"] + (f" · {adim_adi(adim)} tekrar" if adim else ""),
                             asama="calisiyor", adimlar=[], mesaj="Firma seçiliyor…")
                satir = {"ad": f["ad"], "id": f["id"], "vkn": "", "durum": "", "fatura": 0, "sorunlar": {},
                         "indirme_hatasi": [], "rapor": None, "rapor_id": None, "sure": 0,
                         "zaman": datetime.now().isoformat(timespec="seconds"), "sorgulayan": ortak.sorgulayan()}
                t0 = time.time()
                klasor = firma_klasoru(bas, f)
                eski_adimlar = adimlari_oku(klasor)
                if kapandi:
                    satir["durum"] = "Hata"
                    satir["indirme_hatasi"].append("Tarayıcı kapandığı için çalıştırılmadı – yeniden çalıştırın")
                    sonuclar.append(satir)
                    continue
                yen = None
                kilit_cm = ortak.kilit(klasor, "toplu kontrol")
                try:
                    kilit_cm.__enter__()            # aynı firma-dönemi başka biri sorguluyorsa KilitHatasi (Görev 51)
                    L = O.oturum_canli(ctx, L)
                    if adim == "muavin":
                        (klasor / "muavin.xlsx").unlink(missing_ok=True)
                        (klasor / "muavin_isletme.json").unlink(missing_ok=True)
                        t, mv = [], True
                    elif adim:
                        arsiv.tur_sil(klasor, adim)           # o türün faturaları yeniden indirilecek
                        t, mv = [adim], False
                    elif yalniz_fatura:
                        for tur0 in turler:
                            arsiv.tur_sil(klasor, tur0)
                        for z in klasor.glob("gib_*.zip"):
                            z.unlink(missing_ok=True)
                        t, mv = turler, False
                    else:
                        # güvenli yenileme (Görev 51): yeni belgeler geçici klasöre iner; tam ve hatasız biterse eskisinin
                        # yerine geçer, yarıda kalırsa eski veri olduğu gibi kalır
                        yen = ortak.Yenileme(klasor)
                        t, mv = turler, True
                    hedef = yen.gecici if yen else klasor
                    try:
                        s = O.firma_isle(L, f"id:{f['id']}", bas, bit, t, hedef, muavin=mv,
                                         defter=defter_oku().get(str(f["id"])))
                        L = getattr(s, "L", L)               # oturum yenilendiyse güncel Luca sayfası
                    finally:
                        if adim or yalniz_fatura:        # yalnız tekrarlanan adımların kayıtlarını değiştir
                            kodlar = {adim} if adim else set(turler)
                            yeni = adimlari_oku(klasor)
                            birlesik = [a for a in eski_adimlar if adim_kodu(a) not in kodlar] + \
                                       [a for a in yeni if adim_kodu(a) in kodlar]
                            (klasor / "adimlar.json").write_text(json.dumps(birlesik, ensure_ascii=False, indent=1),
                                                                 encoding="utf-8")
                    s.adimlar = adimlari_oku(hedef)
                    # her fatura bir kez, kendi ayının arşivine; Luca'nın ham ZIP'leri silinir (yenilemede bu ay geçici klasöre)
                    arsiv.arsive_al(f["ad"] or f["id"], sorted(hedef.glob("gib_*.zip")), yonlendir={klasor: hedef} if yen else None)
                    if yen:
                        if any(o["durum"] in ("hata", "yarim") for o in adim_ozeti(s.adimlar)):
                            yen.iptal()             # eksik indirme: eski belgeler ve rapor yerinde kalır
                            satir["eski_veri_korundu"] = True
                        else:
                            yen.bitir()
                    s.muavin = None
                    depo.firma_bilgisi_yaz(f["ad"] or f["id"], getattr(s, "vkn", None) or None, f["id"])   # Luca SIRKET_ID ↔ klasör
                    s.zipler = arsiv.donem_faturalari(klasor)
                    from ..kontrol import muavin_dosyalari
                    if muavin_dosyalari(klasor):        # muavin.xlsx ya da işletme defteri listesi (muavin_isletme.json)
                        s.muavin = muavin_dosyalari(klasor)[0]
                    satir["vkn"] = s.vkn or ""
                    satir["adimlar"] = adim_ozeti(s.adimlar)
                    satir["indirme_hatasi"] = [o["ad"] for o in satir["adimlar"] if o["durum"] in ("hata", "yarim")]
                    ilerleme.olay("adim", "Kontrol raporu hazırlanıyor…")
                    veri = O.kontrol_et(s, bas, bit)
                    if veri:
                        satir["vkn"] = veri.get("vkn") or satir["vkn"]
                        depo.firma_bilgisi_yaz(f["ad"] or f["id"], satir["vkn"], f["id"])
                        alis_tev = [t for t in veri.get("tevkifatlar", []) if t["yon"] == "Alış"
                                    and bas.isoformat() <= (t.get("tarih") or "") <= bit.isoformat()]
                        satir["kdv2"] = round(sum(t["tutar"] for t in alis_tev), 2)
                        satir["kdv2_adet"] = len({t["belge_no"] for t in alis_tev})
                        satir["sorunlar"] = {d["ad"]: d["adet"] for d in veri["durumlar"]}
                        satir["rapor_id"] = veri["id"]
                        satir["kural"] = veri.get("kural")
                    if veri and veri["fatura_sayisi"]:
                        satir["fatura"] = veri["fatura_sayisi"]
                        excel = klasor / depo.RAPOR_EXCEL
                        if excel.exists():          # özet Excel'inden firmanın raporuna göreli bağlantı
                            satir["rapor"] = os.path.relpath(excel, cikti).replace(os.sep, "/")
                        sorunlu = sum(satir["sorunlar"].get(k, 0) for k in SORUN_SUTUNLARI)
                        satir["durum"] = "Sorun var" if sorunlu else "Temiz"
                    else:
                        satir["durum"] = "Belge/muavin yok"
                    if satir["indirme_hatasi"] and satir["durum"] in ("Temiz", "Belge/muavin yok"):
                        satir["durum"] = "Eksik indirme"
                except ortak.KilitHatasi as e:     # başka kullanıcı bu firma-dönemi sorguluyor: dokunulmaz
                    satir["durum"] = "Hata"
                    satir["indirme_hatasi"].append(str(e)[:300])
                    satir["kilitli"] = True
                except O.OtomasyonHatasi as e:
                    satir["durum"] = "Hata"
                    satir["indirme_hatasi"].append(str(e)[:200])
                    if "GÜVENLİK" in str(e):
                        raise
                    kapandi = _tarayici_kapandi(e) and not ctx.pages
                except Exception as e:      # bir firmanın hatası diğerlerini durdurmaz
                    satir["durum"] = "Hata"
                    satir["indirme_hatasi"].append(f"{type(e).__name__}: {str(e).splitlines()[0][:200]}")
                    klasor.mkdir(parents=True, exist_ok=True)
                    (klasor / "hata.txt").write_text(traceback.format_exc(), encoding="utf-8")
                    try:
                        kapandi = _tarayici_kapandi(e) and not ctx.pages
                    except Exception:
                        kapandi = True
                satir["sure"] = round(time.time() - t0)
                ortak.gunluk("sorgu", f["ad"] or f["id"], f"Toplu kontrol {bas:%Y-%m}" + (f" ({adim_adi(adim)} tekrar)" if adim else "")
                             + f": {satir['durum']}" + (f", {satir['fatura']} fatura" if satir.get("fatura") else ""),
                             donem=f"{bas:%Y-%m}", durum=satir["durum"])
                if "adimlar" not in satir:
                    satir["adimlar"] = adim_ozeti(adimlari_oku(klasor))
                if yen:
                    yen.iptal()                     # hata / yarıda kalma: geçici klasör silinir (bitirildiyse bir şey yapmaz)
                try:
                    kilit_cm.__exit__(None, None, None)
                except Exception:
                    pass
                if adim and satir["durum"] == "Hata" and f["id"] in onceki:
                    # adım tekrarı başarısız: önceki sonucu koru, yalnız hatayı ve adım durumunu güncelle
                    eski = dict(onceki[f["id"]])
                    eski["adimlar"] = satir["adimlar"]
                    eski["indirme_hatasi"] = sorted(set(eski.get("indirme_hatasi", [])) | set(satir["indirme_hatasi"]))
                    satir = eski
                sonuclar.append(satir)
                kaydet()
                print(f"   → {satir['durum']}" + (f" ({', '.join(satir['indirme_hatasi'])})" if satir["indirme_hatasi"] else ""),
                      flush=True)
    finally:
        O.DINLEYICI = None
        kaydet()
        ilerleme.yaz(asama="bitti", bitti=datetime.now().isoformat(timespec="seconds"),
                     mesaj="Tamamlandı")
    return sonuclar, cikti / "toplu_ozet.xlsx"


def kdv2_raporu(sonuclar: list[dict], bas: str | None = None, bit: str | None = None) -> list[dict]:
    """Tevkifatlı ALIŞ faturası olan firmalar: [{ad, vkn, rapor_id, satirlar, toplam, adet}] (firma adına göre).
    bas/bit (YYYY-AA-GG) verilirse yalnız bu dönemdeki faturalar alınır (sonraki aya ait olanlar hariç)."""
    cikti = []
    for r in sorted(sonuclar, key=lambda r: r.get("ad", "")):
        if not r.get("rapor_id"):
            continue
        try:
            k = depo.rapor_klasoru(r["rapor_id"])
            v = json.loads((k / depo.RAPOR_JSON).read_text(encoding="utf-8"))
        except (OSError, ValueError, TypeError):
            continue
        satirlar = [t for t in v.get("tevkifatlar", []) if t["yon"] == "Alış"
                    and (not bas or (t.get("tarih") or "") >= bas) and (not bit or (t.get("tarih") or "") <= bit)]
        if satirlar:
            cikti.append({"ad": r["ad"], "vkn": r.get("vkn", ""), "rapor_id": r["rapor_id"], "satirlar": satirlar,
                          "toplam": round(sum(t["tutar"] for t in satirlar), 2),
                          "adet": len({t["belge_no"] for t in satirlar})})
    return cikti


def kdv2_sayfasi(wb, sonuclar: list[dict], baslik: str | None = None, bas: str | None = None, bit: str | None = None):
    """Excel'e 'KDV2 Raporu' sayfası: firma firma tevkifatlı alış faturaları ve ara toplamlar."""
    rapor = kdv2_raporu(sonuclar, bas, bit)
    ws = wb.create_sheet("KDV2 Raporu")
    ws["A1"] = baslik or "KDV2 Raporu – tevkifatlı alış faturaları"
    ws["A1"].font = Font(bold=True, size=13)
    ws["A2"] = f"{len(rapor)} firma · genel toplam KDV2: {sum(f['toplam'] for f in rapor):,.2f} TL" if rapor \
        else "Tevkifatlı alış faturası bulunan firma yok."
    basliklar = ["Tarih", "Belge No", "Satıcı", "Satıcı VKN", "Matrah", "KDV", "Kod", "Tevkifat Türü", "Oran",
                 "KDV2 (tevkif edilen)"]
    for f in rapor:
        ws.append([])
        ws.append([f"{f['ad']}  (VKN {f['vkn']})"])
        ws.cell(ws.max_row, 1).font = Font(bold=True, size=12, color="1F3864")
        ws.append(basliklar)
        for c in ws[ws.max_row]:
            c.font = Font(bold=True, color="FFFFFF"); c.fill = PatternFill("solid", fgColor="1F3864")
        for t in f["satirlar"]:
            ws.append([datetime.strptime(t["tarih"], "%Y-%m-%d") if t.get("tarih") else None, t["belge_no"],
                       t["karsi_taraf"], t["vkn"], t["matrah"], t["kdv"], t["kod"], t["tur"], t["oran"], t["tutar"]])
            ws.cell(ws.max_row, 1).number_format = "DD.MM.YYYY"
            for j in (5, 6, 10):
                ws.cell(ws.max_row, j).number_format = "#,##0.00"
        ws.append([f"{f['ad']} toplamı", None, f"{f['adet']} fatura", None, None, None, None, None, None, f["toplam"]])
        for j in (1, 3, 10):
            ws.cell(ws.max_row, j).font = Font(bold=True)
        ws.cell(ws.max_row, 10).number_format = "#,##0.00"
    for i, w in enumerate([12, 19, 42, 13, 14, 13, 7, 40, 7, 16], 1):
        ws.column_dimensions[get_column_letter(i)].width = w
    return ws


DURUM_SIRASI = {"Hata": 0, "Eksik indirme": 1, "Sorun var": 2, "Belge/muavin yok": 3, "Temiz": 4}


def ozet_satiri_guncelle(veri: dict) -> bool:
    """Bir firmanın raporu Luca'ya bağlanmadan yenilendiğinde (ör. "kaydedilmeyecek" işareti) toplu özetteki satırı."""
    rid = veri.get("id")
    for oz in sorted(depo.toplu_kok().glob("*/ozet.json")):
        try:
            d = json.loads(oz.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        degisti = False
        for satir in d.get("sonuclar", []):
            if satir.get("rapor_id") == rid:
                satir["sorunlar"] = {x["ad"]: x["adet"] for x in veri["durumlar"]}
                if satir.get("durum") in ("Temiz", "Sorun var"):
                    sorunlu = sum(satir["sorunlar"].get(k, 0) for k in SORUN_SUTUNLARI)
                    satir["durum"] = "Sorun var" if sorunlu else "Temiz"
                degisti = True
        if degisti:
            ozet_yaz(d["sonuclar"], date.fromisoformat(d["bas"]), date.fromisoformat(d["bit"]), oz.parent)
            return True
    return False


def ozet_birlestir(sonuclar: list[dict], cikti: Path) -> list[dict]:
    """Ortak veri klasöründe aynı ayın özetini başka kullanıcılar da yazabilir (Görev 51): diskteki son hâlle firma bazında
    birleştirilir, her firmanın en son sorgulaması kalır. Sıra korunur (yeni firmalar sona)."""
    disk = onceki_sonuclar(cikti)
    if not disk:
        return sonuclar
    benim = {r.get("id"): r for r in sonuclar}
    out, gorulen = [], set()
    for r in disk:
        b = benim.get(r.get("id"))
        out.append(b if b is not None and str(b.get("zaman") or "") >= str(r.get("zaman") or "") else r)
        gorulen.add(r.get("id"))
    out += [r for r in sonuclar if r.get("id") not in gorulen]
    return out


@contextmanager
def _ozet_kilidi(cikti: Path):
    """Özet dosyasını yazarken kısa kilit (aynı anda iki kullanıcının yazması birbirini ezmesin)."""
    y = cikti / "ozet.kilit"; t0 = time.time(); fd = None
    while fd is None:
        try:
            fd = os.open(y, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
        except FileExistsError:
            try:
                if time.time() - y.stat().st_mtime > 60:
                    y.unlink(); continue
            except OSError:
                continue
            if time.time() - t0 > 15:
                break                       # kilit alınamadı: yine de yaz (özet bir sonraki firmada yeniden yazılır)
            time.sleep(0.2)
    try:
        yield
    finally:
        if fd is not None:
            os.close(fd)
            try:
                y.unlink()
            except OSError:
                pass


def ozet_yaz(sonuclar: list[dict], bas: date, bit: date, cikti: Path, birlestir: bool = True) -> Path:
    """birlestir=False: liste olduğu gibi yazılır (ör. sonuçtan firma silme)."""
    with _ozet_kilidi(cikti):
        return _ozet_yaz(ozet_birlestir(sonuclar, cikti) if birlestir else sonuclar, bas, bit, cikti)


def _ozet_yaz(sonuclar: list[dict], bas: date, bit: date, cikti: Path) -> Path:
    wb = Workbook(); ws = wb.active; ws.title = "Toplu Özet"
    ws["A1"] = f"Toplu Fatura–Muavin Kontrolü  {bas:%d.%m.%Y} – {bit:%d.%m.%Y}"
    ws["A1"].font = Font(bold=True, size=14)
    ws["A2"] = f"Oluşturma: {datetime.now():%d.%m.%Y %H:%M} · {len(sonuclar)} firma"
    basliklar = ["Firma", "VKN", "Durum", "Fatura"] + SORUN_SUTUNLARI + ["Dönem dışı", "KDV2 (alış tevkifatı)", "İndirme hataları", "Rapor", "Süre (sn)"]
    ws.append([]); ws.append(basliklar)
    bas_satir = ws.max_row
    for c in ws[bas_satir]:
        c.font = Font(bold=True, color="FFFFFF"); c.fill = PatternFill("solid", fgColor="1F3864")
        c.alignment = Alignment(wrap_text=True, vertical="center")
    renk = {"Temiz": "E2EFDA", "Sorun var": "F8CBAD", "Hata": "FFC7CE", "Eksik indirme": "FFEB9C",
            "Belge/muavin yok": "EDEDED"}
    for r in sorted(sonuclar, key=lambda r: (DURUM_SIRASI.get(r["durum"], 9), r["ad"])):
        ws.append([r["ad"], r["vkn"], r["durum"], r["fatura"]] +
                  [r["sorunlar"].get(k, 0) for k in SORUN_SUTUNLARI] +
                  [r["sorunlar"].get("Dönem dışı fatura (henüz kayıtsız)", 0), r.get("kdv2") or 0,
                   "; ".join(r["indirme_hatasi"]),
                   r["rapor"] or "", r["sure"]])
        satir = ws.max_row
        ws.cell(satir, 3).fill = PatternFill("solid", fgColor=renk.get(r["durum"], "FFFFFF"))
        for j in range(5, 5 + len(SORUN_SUTUNLARI)):
            if ws.cell(satir, j).value:
                ws.cell(satir, j).fill = PatternFill("solid", fgColor="F8CBAD")
        ws.cell(satir, 6 + len(SORUN_SUTUNLARI)).number_format = "#,##0.00"
        if r["rapor"]:
            c = ws.cell(satir, len(basliklar) - 1)
            c.hyperlink = r["rapor"]; c.font = Font(color="0563C1", underline="single")
    for i, w in enumerate([28, 13, 14, 8] + [11] * len(SORUN_SUTUNLARI) + [10, 14, 40, 30, 9], 1):
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.row_dimensions[bas_satir].height = 45
    ws.freeze_panes = ws.cell(bas_satir + 1, 2)
    kdv2_sayfasi(wb, sonuclar, bas=bas.isoformat(), bit=bit.isoformat())
    yol = cikti / "toplu_ozet.xlsx"
    (cikti / "ozet.json").write_text(json.dumps({"bas": bas.isoformat(), "bit": bit.isoformat(),
                                                 "sonuclar": sonuclar}, ensure_ascii=False), encoding="utf-8")
    wb.save(yol)
    return yol


def _ac(yol: Path):
    if sys.platform == "win32":
        os.startfile(yol)   # noqa


def main(argv=None):
    ap = argparse.ArgumentParser(description="Luca toplu fatura–muavin kontrolü")
    ap.add_argument("--liste", action="store_true", help="Luca'daki firma listesini firmalar.xlsx'e çek")
    ap.add_argument("--ay", help="YYYY-AA")
    ap.add_argument("--turler", default=",".join(O.TURLER))
    ap.add_argument("--sadece", help="yalnız adında bu ifadeler geçen firmalar (virgülle, ör. NAIL,TURAC)")
    ap.add_argument("--idler", help="yalnız bu SIRKET_ID'ler (virgülle) – program kullanır")
    ap.add_argument("--cikti", help="çıktı klasörü (varsa önceki sonuçlar korunur)")
    ap.add_argument("--adim", choices=ADIM_KODLARI, help="yalnız bu adımı yeniden dene (program kullanır)")
    ap.add_argument("--yalniz-fatura", action="store_true", help="yalnız e-belgeleri indir, muavini koru (program kullanır)")
    ap.add_argument("--sessiz", action="store_true", help="soru sorma, dosya açma (program kullanır)")
    a = ap.parse_args(argv)
    O.muhawin_cerezleri()          # MuhaWin'in Luca oturumu (geçici dosya) hemen okunur ve silinir
    if getattr(a, 'cikti', None):
        O.CIKTI = Path(a.cikti)    # doğrulama kodu resmi / yanıtı (programda gösterilir)

    if a.liste:
        print("Firma listesi çekilecek. Açılan tarayıcıda Luca'ya giriş yapın.")
        durum = Path(a.cikti) / "durum.json" if a.cikti else None
        if durum:
            durum.parent.mkdir(parents=True, exist_ok=True)
            il = Ilerleme(durum.parent, date.today(), date.today(), [])
            O.DINLEYICI = il.olay
        with O.oturum() as (ctx, L):
            firmalar = O.firma_listesi(L)
        yol = liste_yaz(firmalar)
        print(f"\n{len(firmalar)} firma yazıldı: {yol}")
        if durum:
            il.yaz(asama="bitti", bitti=datetime.now().isoformat(timespec="seconds"),
                   mesaj=f"{len(firmalar)} firma alındı")
        if not a.sessiz:
            print("Kontrol edilmesini İSTEMEDİĞİNİZ firmaların 'Dahil' sütununa H yazıp kaydedin.")
            _ac(yol)
        return

    firmalar = liste_oku()
    if a.idler:
        idler = set(a.idler.split(","))
        firmalar = [f for f in firmalar if f["id"] in idler]
    else:
        firmalar = [f for f in firmalar if f["dahil"]]
    sadece = a.sadece
    if sadece is None and not a.ay and not a.sessiz:
        sadece = input("Yalnız belirli firmalar mı? (ör. NAIL,TURAC – boş = hepsi): ").strip()
    if sadece:
        aranan = [O.sade(x) for x in sadece.split(",") if x.strip()]
        firmalar = [f for f in firmalar if any(x in O.sade(f["ad"]) for x in aranan)]
    if not firmalar:
        raise SystemExit(f"{liste_yolu()} yok ya da seçili firma yok. Önce firma listesini çekin.")
    ay = a.ay or input("Ay (YYYY-AA, ör. 2026-09): ").strip()
    y, m = map(int, ay.split("-"))
    bas, bit = date(y, m, 1), date(y, m, monthrange(y, m)[1])
    turler = [t for t in a.turler.split(",") if t]
    cikti = Path(a.cikti) if a.cikti else depo.toplu_klasoru(bas)
    print(f"\nToplu kontrol: {len(firmalar)} firma, {bas:%d.%m.%Y}–{bit:%d.%m.%Y}")
    print("Program Belge Sil / Muhasebeleştir / Muhasebe İptal düğmelerine asla basmaz.")
    sonuclar, ozet = toplu_calistir(bas, bit, turler, cikti, firmalar, adim=a.adim, yalniz_fatura=a.yalniz_fatura)
    say = lambda d: sum(r["durum"] == d for r in sonuclar)
    print(f"\nBitti: {say('Temiz')} temiz, {say('Sorun var')} sorunlu, {say('Hata')} hatalı, "
          f"{say('Belge/muavin yok')} belgesiz.\nÖzet: {ozet}")
    if not a.sessiz:
        _ac(ozet)


if __name__ == "__main__":
    try:
        main()
    except O.OtomasyonHatasi as e:
        print(f"\nDURDURULDU: {e}")
    except KeyboardInterrupt:
        print("\nİptal edildi.")
