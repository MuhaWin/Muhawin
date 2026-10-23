# Rapor – Güncelleme

## İş: Derleme ve yayın iş akışı (GitHub Actions) · 23.10.2026
**İstek:** Kullanıcı (23.10.2026): "GitHub Actions iş akışı hazırla; exe'yi kendisi derlesin ve release'e yüklesin."
**Taban:** `main` aa07fa7 · **Dal:** `claude/practical-ride-pa4cbl` (oturumun atanmış dalı)
**Kapsam notu:** Kart bu role yalnız `package.json` sürümü, OKUBENI ve rapor dosyasını değiştirme izni veriyor. `.github/workflows/surum.yml` kullanıcının açık isteğiyle eklendi; kaynak koda dokunulmadı.

### İş akışı: `.github/workflows/surum.yml`
| Tetik | Sonuç |
|---|---|
| `v<sürüm>` etiketi push | Test → Windows derleme → `muhawin/muhawin-surumler` deposuna **yayın** |
| `surum-*` dalında `package.json` değişikliği | Test → derleme → **deneme** (dosyalar Actions → Artifacts, 30 gün) |
| Actions → "MuhaWin sürüm" → Run workflow | Teslim seçilir: `deneme` / `yayin`; acil durumda "testleri atla" |

Adımlar:
1. **Sürüm bilgisi:** Etiket, `package.json` sürümü, OKUBENI başlığı ve "<sürüm> YENİLİKLER" bölümü tutarlı değilse durur.
2. **Testler** (ubuntu): `fk` pytest, `test/mobil.js`, `test/luca/*.js`, `xvfb-run node test/e2e.js` (e2e düşerse bir kez yeniden denenir; bilinen "Logo fişleri" oynaklığı). Biri düşerse derleme yapılmaz.
3. **Derleme** (windows-latest): `npm ci` → `python tools/python_win.py` → `electron-builder --win nsis --x64 --publish never`. Exe, blockmap ve `latest.yml` aynı derlemeden mi, `latest.yml` sürümü ve sha512 exe ile uyuşuyor mu, `app-update.yml` `muhawin/muhawin-surumler` mı, denetlenir. Boyut ve sha512 (ilk 12) çalıştırma özetine yazılır.
4. **Yayın:** Sürüm notu OKUBENI'deki "<sürüm> YENİLİKLER" bölümünden alınır. `v<sürüm>` "release" türünde (taslak/ön sürüm değil) açılır, 3 dosya yüklenir. Aynı etiket varsa üzerine yazmaz. Sonra `releases/latest` ve dosya sayısı (3) doğrulanır.

### Kullanıcının bir kez yapması gerekenler (Claude token yazamaz)
1. **Sürüm deposu taşıma** (YONETICI.md açık konu 4): `McLk007/muhawin-surumler` → `muhawin/muhawin-surumler`.
2. **`SURUM_TOKEN` sırrı:** github.com/settings/personal-access-tokens → Fine-grained token → Repository access: yalnız `muhawin/muhawin-surumler` → Permissions: Contents **Read and write**. Sonra `MuhaWin/Muhawin` → Settings → Secrets and variables → Actions → New repository secret → ad `SURUM_TOKEN`.
   Sır yoksa derleme yine yapılır; yalnız yayın adımı açık bir hata ile durur, dosyalar Artifacts'te kalır.

### Yerel test sonuçları (bu oturum, `main` aa07fa7)
| Test | Sonuç |
|---|---|
| `node test/mobil.js` | 42/42 |
| `test/luca/*.js` | 8/8 |
| `cd fk && pytest -q` | 100 geçti, 1 atlandı, **2 düştü** |
| `xvfb-run -a node test/e2e.js` | 203 geçti, **yarıda kaldı** (250 bekleniyor) |

### Engel (yöneticinin kararı gerekir)
Test verileri depoya hiç konmamış (muhtemelen YONETICI.md açık konu 2 – olası müşteri verisi):
- `fk/tests/veri_isletme_gelir_gider.xlsx`, `fk/tests/veri_mikro_muavin.xlsx` → `test_isletme.py::test_gelir_gider_raporu_excel`, `::test_mikro_muavin` düşüyor.
- `test/ornek/` (okc_fis*.jpg, mizan_*, logo_musteri, mikro_*) → `test/e2e.js:507` (OKC fiş) zaman aşımına giriyor, e2e burada duruyor.

Bu yüzden iş akışındaki test adımı bugün **kırmızı** döner ve derleme yapılmaz. Kart gereği testler gevşetilmedi. Çözüm: sahte verilerle bu dosyaları üreten bir görev açılmalı (kaynak/test değişikliği, bu rolün dışında). O zamana kadar derleme yalnız Run workflow → "testleri atla" ile yapılabilir (kullanıcı/yönetici kararıyla).

Ortam bağımlılıkları (kaynakta değil, iş akışında kuruldu): Playwright 1.63.0 (npm) + chromium, Pillow, reportlab, xvfb, DejaVu yazı tipi.

### Riskler
- Kod imzalama sertifikası yok; exe imzasız, SmartScreen uyarısı beklenir.
- Windows derlemesi CI'da henüz hiç çalışmadı; ilk çalıştırmada `python_win.py` / electron-builder adımı doğrulanacak.
- Deponun varsayılan dalı `claude/awesome-ritchie-ftviuk`; "Run workflow" düğmesi yalnız varsayılan dalda bulunan iş akışları için görünür. Varsayılan dal `main` yapılmalı (Settings → General → Default branch).
