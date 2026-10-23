# Rapor 27 – Yerel veri ve oturum hijyeni (rapor-02 G-I; `renderer/index.html` hariç)

**Oturum:** Yazılımcı (`session_01HKMyx49yrftMV598oVTfLH`) · **Dal:** `claude/awesome-ritchie-ftviuk` (oturum ortamı bu dalı zorunlu kılıyor)
Derleme yapılmadı. `renderer/index.html`'e dokunulmadı.

## Yapılanlar
| # | Bulgu | Çözüm | Yer |
|---|---|---|---|
| D10 | Toplu kontrolde hata ekran görüntüleri (`hata_*.jpg`) ve sayfa kopyaları (`hata_*_frm3.html`) firma klasöründe kalıyordu (VKN, unvan, fatura) | Firma işi bitince (hatayla bitse de) siliniyor; eski sürümlerden kalanlar da aynı anda siliniyor. Destek için **tanılama modu** var: `FK_TANILAMA=1` iken dosyalar kalır | `fk/fatura_kontrol/luca/otomasyon.py` › `firma_isle`, `hata_goruntulerini_sil` |
| D11 | Windows dışında Luca parolası `ayarlar.json`'a yalnız base64 ile yazılıyordu | Windows dışında parola **diske yazılmıyor**, yalnız süreç açıkken bellekte tutuluyor (program yeniden açılınca yeniden girilir). Eski sürümün `b64:` kaydı okunuyor ve ilk kayıtta diskten siliniyor. Windows'ta DPAPI aynı. "Parola kayıtlı" bilgisi artık parolanın bu süreçte çözülebildiğini gösteriyor | `fk/fatura_kontrol/ayarlar.py` |
| D15 | `FK_ANAHTAR` yoksa (MuhaWin dışında `python -m fatura_kontrol.web`) yerel sunucu kimlik denetimsizdi | Bağımsız çalıştırmada rastgele anahtar üretiliyor; tarayıcı `http://127.0.0.1:PORT/?anahtar=…` ile açılıyor. Sunucu anahtarı bir kez **çereze** alıyor (`HttpOnly`, `SameSite=Strict`) ve adresten siliyor; sonraki istekler çerezle geliyor. Başka programlar ve web sayfaları 403 alıyor. MuhaWin yolu (`X-MuhaWin` başlığı) aynı; karşılaştırma `hmac.compare_digest` ile | `fk/fatura_kontrol/web/__main__.py`, `web/app.py` › `_muhawin_kapisi` |
| D16 | Luca istek kaydı fatura ve muavin yanıtlarını düz metin yazıyordu; süre sınırı ve uyarı yoktu | Kayıt en çok **30 dakika** açık kalıyor, sonra kendiliğinden duruyor; toplananlar "Kaydı Durdur"a kadar saklanıyor. Kayıt dosyasının başında uyarı var ("düz metin… destek için gönderdikten sonra silin"). `Belgeler/MuhaWin Luca Kayıtları` içindeki **7 günden eski** kayıtlar program açılışında ve her yeni kayıtta siliniyor | `luca.js` › `kayitBaslat`/`kayitKapat`/`kayitDurumu`, `main.js` |

**Not:** Arayüzde kaydın 30 dakika sınırını gösteren bir yazı yok (`renderer/index.html` bu görevin dışında). `kayitBaslat` uyarıyı (`uyari`, `sureDk`) dönüyor, `kayitDurumu` `sureDoldu` bildiriyor. Menü Düzenleme isterse "Kayıt Al" ekranında gösterebilir.

## Öneriler (uygulanmadı)
### D6 – "Beni hatırla" düz parolayı saklıyor (`main.js` › `hatirlaYaz`)
- **Şimdi:** E-posta ve parola `safeStorage` (Windows'ta DPAPI) ile `beni-hatirla.bin`'de duruyor. Aynı Windows kullanıcısıyla çalışan herhangi bir program dosyayı çözebilir.
- **Öneri:** Parola yerine Supabase **yenileme belirtecini** (`refresh_token`) saklamak.
  - Açılışta `cloud.js` `grant_type=refresh_token` ile oturumu yeniler (kod zaten var: `cloud.js:159`); belirteç geçersizse giriş ekranı açılır.
  - Belirteç çalınsa da parola açığa çıkmaz. Supabase'de "oturumları kapat" ile iptal edilebilir ve döner (rotation).
  - **İş:** `main.js` (hatırla oku/yaz), `cloud.js` (belirteçle açılış), giriş ekranı metni. **Boyut:** M. Mevcut `beni-hatirla.bin` ilk açılışta belirtece çevrilip silinir.

### D7 – Varsayılan yönetim PIN'i `55555` (`sunucu/supabase-yonetim.sql:524-537`)
- **Şimdi:** `settings.admin_pin` boşken PIN `55555`. PIN yalnız arayüz kapısı; asıl yetki sunucuda `_chk()` ile (doğru).
- **Öneri 1 (S):** `admin_pin` boşken `admin_pin_check` her PIN'i reddetsin ve "İlk kez PIN belirleyin" dönsün. Yönetici ilk girişte PIN belirlesin. Sunucu yaması + yönetim ekranında "PIN belirle" adımı.
- **Öneri 2 (M):** PIN yerine Supabase **MFA (TOTP)**. Yönetim RPC'leri `auth.jwt()->>'aal' = 'aal2'` istesin. PIN kalkar; kimlik doğrulayıcı uygulama gerekir.

## Testler
| Test | Sonuç |
|---|---|
| `fk/tests/test_yerel_hijyen.py` (yeni) | **6/6** |
| `node test/luca/kayit-sure.js` (yeni; CI'daki `test/luca/*` döngüsünde) | **5/5** |
| Tüm `pytest`, `test/luca/*`, `test/mobil.js`, `xvfb-run -a node test/e2e.js` | SONUC_27 |

Yeni testlerin kapsamı:
- **D10:** Tanılama modunda dosyalar kalıyor; normal modda siliniyor. Hata veren bir firma işinden sonra da siliniyor.
- **D11:** Diskte ne düz ne base64 parola var; aynı süreçte kullanılıyor; yeniden açılışta isteniyor. Eski `b64:` kaydı temizleniyor.
- **D15:** Rastgele anahtar ve açılış adresi; anahtarsız ya da yanlış anahtarla 403; anahtar çereze alınıp adresten siliniyor (`HttpOnly`, `SameSite=Strict`); MuhaWin başlığı çalışıyor.
- **D16:** 30 dakikada kendiliğinden durma; olaylar korunuyor; elle durdurulan kaydın süresi işlemiyor.

## Kullanıcıya etkisi
- **Windows (MuhaWin):** Görünür değişiklik yok. Hata görüntüleri artık birikmiyor; Luca kayıtları 7 günde siliniyor.
- **Mac / Linux (geliştirme):** Fatura Kontrol'deki Luca parolası her açılışta yeniden istenir.
