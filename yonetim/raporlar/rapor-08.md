# Rapor 08 – Rapor Kaydı Ayrımı ve Programdan Bağımsız Denetim

**Oturum:** Yazılımcı (`session_01HKMyx49yrftMV598oVTfLH`) · **Taban:** `main` `b763b7e` · **Dal:** `claude/awesome-ritchie-ftviuk` (oturum ortamı bu dalı zorunlu kılıyor)

## İstek durumu
| # | İstek | Durum |
|---|---|---|
| 1 | `rapor_kaydet`, `_json` ve yardımcıları yeni `rapor_kayit.py`'ye; `web/app.py` onu kullanır | Yapıldı. Taşınanlar: `rapor_kaydet`, `_json`, `rapor_oku`, `rapor_yenile`, `defter_turu`, `KURAL_SURUMU`, `_db`, `_t`, `_sayi`, `_tarih`. `rapor_oku`/`rapor_yenile` da taşındı, çünkü KDV beyannamesi (`beyanname.hazirla`) onları kullanıyor ve analiz belgesine göre beyanname W1'e dahil |
| 2 | `kontrol.py` `web.app`'i içe aktarmaz; geçmiş (sqlite) isteğe bağlı | Yapıldı. `kontrol`, `denetim`, `beyanname` ve `web/toplu_api` artık `rapor_kayit`'i kullanıyor. `sqlite3` yoksa ya da `sys.platform == "emscripten"` (Pyodide) ise `_db()` `None` döner ve geçmiş kaydı atlanır. `defter_turu` Luca kayıtlarını (`luca.toplu`) yükleyemezse sessizce boş döner |
| 3 | Masaüstü davranışı değişmez | Değişmedi. `web/app.py` eski adları (`_db`, `defter_turu`, `rapor_oku` …) yeniden dışa açıyor; `/api/denetim` raporu yine geçmişe yazıyor (testle sınandı) |
| 4 | Denetim program bağımsız: `denetim.html` sabit `program=mikro` göndermez; etiketler seçili programa bağlı; `red_iptal.py` program bazlı | Yapıldı (ayrıntı aşağıda) |
| 5 | Paket `fastapi`, `playwright`, `sqlite3` olmadan içe aktarılabilir (pytest) | Yapıldı. Ayrı Python sürecinde `fastapi`, `starlette`, `pydantic`, `uvicorn`, `playwright`, `sqlite3` engellenip denetim, rapor kaydı, rapor okuma ve KDV beyannamesi uçtan uca çalıştırılıyor |
| Ek 1 | Sayfa başlığı "Muhasebe Denetimi" (yönetici, 23.10.2026) | Yapıldı (`<title>` ve üst başlık). Masaüstü modül kartına (`renderer/index.html`) dokunulmadı |
| Ek 2 | `web/app.py`'deki `toplu_api` (Playwright zinciri) tembel olsun (yönetici, 23.10.2026) | Yapıldı. Yönlendirici kayıtlı kalıyor; `toplu_api` içindeki `luca.toplu` bağı vekil nesneyle ilk kullanımda yükleniyor. `web.app` artık Playwright olmadan içe aktarılabiliyor (testle sınandı). Toplu uçları masaüstünde aynı çalışıyor |

### Program seçimi (madde 4)
- **`muavin_programlari.PROGRAMLAR`:** Kayıtlara iki alan eklendi:
  - `"denetim": True`: program Denetim ekranında seçilebilir. Bugün yalnız `mikro`.
  - `"red_iptal": "<düzen>"`: red/iptal Excel sütun düzeni.
  - Yeni yardımcılar: `liste(denetim=True)`, `denetimde_mi()`, `red_iptal_duzeni()`.
- **`red_iptal.py`:** Sütun adları `DUZENLER` kaydında (bugün tek düzen: `mikro`, varsayılan). `oku(yollar, duzen)` düzeni alır. Çağıranlar düzeni dönem klasörünün muavin programından (`muavin_program.json`) seçer. Kaydı olmayan program (ör. Luca tek firma kontrol) varsayılan düzeni kullanır, yani davranış değişmedi.
- **`/api/muavin/programlar?denetim=1`:** Yalnız Denetim programlarını döner. Parametresiz liste (Tek firma kontrol) değişmedi.
- **`/api/denetim`:** Denetim'e açık olmayan programı (ör. `luca`) 400 ile reddediyor.
- **`denetim.html`:**
  - "Muhasebe programı" seçimi eklendi. Liste uçtan geliyor; tek seçenek varken kutu kapalı.
  - Üst açıklama, red/iptal ve muavin etiketleri, boş ekran metni ve hata iletisi seçili programın adını kullanıyor.
  - Muavin ipucu ve dosya uzantıları kayıttan geliyor.
  - Fatura etiketi programdan bağımsız: "muhasebe programından ya da GİB portalından alınan XML'ler".
  - Liste alınamazsa sayfa Mikro ile çalışmaya devam ediyor.
- **Yeni program eklemek:** `PROGRAMLAR`'a okuyucuyla bir kayıt (`"denetim": True`). Red listesi farklıysa `red_iptal.DUZENLER`'e bir düzen. Okuyucular bu görevde yazılmadı.

## Commit'ler
`git log` için PR'a bakın (rebase sonrası kimlikler değişebilir):
1. Görev 08: rapor kaydı web sunucusundan ayrı modülde; Denetim programa bağlı
2. Görev 08: Denetim sayfasında muhasebe programı seçimi
3. Görev 08: web sunucusu ve sqlite olmadan çalışma testi, program seçimi testleri
4. Görev 08: Denetim sayfasının başlığı Muhasebe Denetimi
5. Görev 08: toplu_api'de Luca/Playwright zinciri tembel yüklenir
6. Görev 08: rapor-08

## Değişen dosyalar
- **Yeni:** `fk/fatura_kontrol/rapor_kayit.py`, `fk/tests/test_rapor_kayit.py`
- **Değişen:**
  - `fk/fatura_kontrol/web/app.py`: ~190 satır taşındı, içe aktarmalar sadeleşti.
  - `kontrol.py`, `denetim.py`, `beyanname.py`, `web/toplu_api.py`
  - `muavin_programlari.py`, `red_iptal.py`, `web/static/denetim.html`
- **Dokunulmadı:** `renderer/`, `main.js`, `web/` (site)

## Testler
| Test | Sonuç |
|---|---|
| `fk/tests/test_rapor_kayit.py` | **7/7.** Eski kodla 5'i kırılıyor; masaüstü geçmiş testi eski kodda da geçiyor (davranış aynı) |
| `cd fk && pytest -q` | **113 geçti, 2 başarısız, 1 atlandı** (taban 106/2/1 + 7 yeni). Başarısızlar aynı: eksik `fk/tests/veri_isletme_*.xlsx` |
| `xvfb-run -a node test/e2e.js` | **215 geçti, 1 hata.** Tek hata bilinen ÖKC OCR zaman aşımı (eksik `test/ornek/`). Sayının 203'ten 215'e çıkması `main`'e giren Görev 01 denetimlerinden |
| `node test/mobil.js` | **42/42** |
| `python3 web/denetim/site_e2e.py` (sitenin Pyodide sürümü, sahte veri) | **TAMAM**: tüm denetimler geçti, sayfa adı "Muhasebe Denetimi", CSP ihlali yok |
| Elle tarayıcı (Chromium, yerel FK sunucusu, `/denetim`) | Program kutusu tek seçenek (Mikro) ve kapalı. 3 etiket "Mikro", muavin ipucu kayıttan geliyor, konsol hatası yok. Ekran görüntüsünde etiketler doğru dizildi |

## Riskler ve notlar
- **Web köprüsü:** `web/denetim/kopru.py` hâlâ `playwright` ve `fastapi` taklidi kuruyor. Ek 2 ile `playwright` taklidine gerek kalmadı; `fastapi` taklidi `web.app`'in kendisi için gerekli olmaya devam ediyor. Taklidin kaldırılması Web Asistanı'nın işi (`web/` bu görevin kapsamı dışında). Site testi taklit dururken geçiyor.
- **`toplu_api.T` vekili:** Modül özniteliklerine okuma ile erişim tam aynı. Vekile atama (`T.x = …`) gerçek modüle geçmez; kodda ve testlerde böyle bir kullanım yok.
- **Başlık:** `denetim.html` başlığı "Muhasebe Denetimi". Masaüstündeki menü ve kart adları ("Mikro Denetim") `renderer/` kapsamında; e2e de o adı arıyor ve değişmedi.
- **Program kutusu:** Bugün tek program olduğundan kapalı. İkinci kayıt eklenince kendiliğinden açılır.

## Devir notu
- Yeni bir program okuyucusu (ör. Logo, Zirve) için:
  1. `<program>_muavin.py` okuyucusu yazılır.
  2. `PROGRAMLAR`'a `"denetim": True` ile kayıt eklenir.
  3. Red listesi farklıysa `red_iptal.DUZENLER`'e düzen eklenir.
  4. `test_rapor_kayit.py::test_denetim_program_listesi` listeyi kayıttan hesapladığı için güncelleme gerektirmez.
- `rapor_kayit.py` Pyodide paketine girer (`tools/site_uret.js` tüm `fatura_kontrol`'ü zip'liyor).
