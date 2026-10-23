# Görev 02 – Güvenlik Denetimi

**Durum:** Açık · **Taban:** `main` (2.9.12) · **Dal:** `gorev-02-guvenlik-denetimi` · **Mesaj sınırı:** 20 · **Tür:** Yalnız okuma. Kod düzeltmesi yapılmaz.

## Başlarken
1. `yonetim/YONETICI.md` dosyasındaki "İşçi oturum kuralları" bölümünü uygula.
2. Bu kartı, `yonetim/belgeler/ana-depo-ozet.md` (mimari) ve `yonetim/belgeler/durum-ve-birlestirme-plani.md` dosyalarını oku.
3. Kurulu güvenlik skill'lerini kontrol et (`claude-security`, `security-guidance`). Varsa kullan. Yoksa aşağıdaki listeyi elle uygula.

## Kapsam (öncelik sırasıyla)
1. **Electron:**
   - `nodeIntegration`, `contextIsolation`, `sandbox`, `webSecurity`
   - preload/IPC kanalları ve kanallara gelen girdinin doğrulanması
   - `shell.openExternal`, webview/iframe, CSP
   - gizli Luca giriş penceresi, çerez aktarımı
2. **Python yan süreci (`fk/`):**
   - Bağlanılan adres (`127.0.0.1` mi `0.0.0.0` mı), yetkilendirme
   - Başka bir yerel program ya da web sayfasının API'ye erişmesi (CSRF, DNS rebinding)
   - Path traversal
   - `subprocess` / `shell=True` kullanımı
3. **Belge ayrıştırma:**
   - UBL XML'de XXE ve billion laughs (`defusedxml` kullanılıyor mu?)
   - zip slip
   - boyut bombası (PDF, Excel)
4. **Gizli bilgiler:**
   - Luca şifresi ve çerezlerin saklanması (DPAPI ya da düz metin)
   - Supabase: `service_role` anahtarı exe'de **olmamalı**; `anon` anahtarı varsa RLS yeterli mi?
   - Token ya da anahtar depoda mı?
5. **Güncelleme zinciri:**
   - İmzasız exe
   - `latest.yml` sha512 doğrulaması
   - Güncelleme adresinin değiştirilebilir olması
6. **Bağımlılıklar:**
   - `npm audit --omit=dev`
   - `pip-audit -r fk/requirements.txt`
   - Electron sürümü
7. **Mobil yönetim paneli (GitHub Pages):**
   - İstemcide gizli bilgi
   - Yetki denetiminin yalnız arayüzde yapılması
8. **KVKK ve loglar:**
   - Loglarda ya da geçici dosyalarda VKN, TCKN, fatura içeriği veya şifre
   - Geçici dosyaların silinmesi

## Kurallar
- **Kod değiştirme, derleme yapma.** Tek commit, rapor dosyasıdır.
- Gerçek Luca, GİB, Supabase ya da GitHub'a deneme isteği **gönderme**. Yalnız kaynak kodu ve yerel testlerle çalış.
- Bulunan gizli bilgiyi rapora **maskeli** yaz (ilk 4 karakter ve `…`).
- Her bulgunun kanıt düzeyini belirt:
  - **Doğrulandı:** kod satırı ve yerel denemeyle gösterildi.
  - **Olası:** koddan çıkarıldı, denenmedi.

## Teslim
`yonetim/raporlar/rapor-02.md` dosyasını yaz, push et ve `Görev 02: Güvenlik denetimi` başlıklı PR'ı aç. Rapor şunları içermeli:
- **Özet:** Kritik / Yüksek / Orta / Düşük bulgu sayıları
- **Tablo:** No · Önem · Kanıt · Dosya:satır · Sorun · Etki · Önerilen düzeltme · İş (S / M / L)
- **Önerilen düzeltme görevleri:** Birbirinden bağımsız kartlar halinde; her kartta dokunulacak dosyalar yazılır.
- **Denetlenmeyenler** ve nedenleri
- Kullanılan skill'ler ve komutlar
