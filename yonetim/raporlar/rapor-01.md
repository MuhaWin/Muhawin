# Rapor 01 – Menü Düzeni (ara rapor, 23.10.2026; Cowork işçisi)

**Seçim:** B. Üstte modül sekmeleri olacak (kullanıcı kararı). Görsel taslak `menu-secenekleri.html` dosyasında; dosya Cowork sohbetinde kaldı, depoda yok.
**Durum:** Kod değişikliği YAPILMADI. Sebep: 2.9.12 kaynağı o oturumda yoktu. Artık kaynak depoda.

## İstek listesi
| # | İstek | Durum |
|---|---|---|
| 1 | Menü düzeni B: üstte kalıcı modül sekme çubuğu (Banka · Muhasebe · Belgeden Fiş · Denetim · Ofisinize Özel · Geçici Vergi (yakında) · Personel (yakında)) | Bekliyor |
| 2 | Üst şeritte firma seçimi kalacak. "Yeni firma" düğmesi üst şeritten kaldırılıp Ayarlar → Firmalar bölümüne taşınacak | Bekliyor. "Luca'dan firma ekle" de oraya mı taşınacak? Kullanıcıya soruldu |
| 3 | Luca giriş düğmesi YALNIZ üst şeritte olacak: bağlı değilken "Luca'ya giriş", bağlıyken "● Luca bağlı" yazacak. Diğer tüm "Luca'ya bağlan" düğmeleri kaldırılacak: Banka toolbar `data-luca="connect"`, okcPanel, cekPanel, fkKayit, Fiş Girişi (`data-lucabag`), modül seçim ekranı bandı (`#modLucaBag`) | Bekliyor |
| 4 | Luca sayfa yönetimi: "Luca'da Çalış" ayrı bir Luca penceresinde açılacak. Diğer Luca işleri tek ortak sayfada yürüyecek. Aynı anda ek bir iş gelirse (ör. toplu kontrol sürerken muavin indirme), firma/dönem çubuğunun altındaki beyaz düğmeyle yeni bir Luca sayfası açılıp kullanılacak | **KAPSAM DIŞI**: Luca otomasyonu, `luca.js` / Playwright. Yönetici bunu ayrı görev yaptı |
| 5 | "Mizan / Muavin" düğmesinin adı "Mizan / Muavin / Hesap Planı" olacak. Panel sekmeleri Mizan · Muavin · Hesap Planı sırasıyla gelecek (bugünkü sıra Hesap Planı · Muavin · Mizan). Varsayılan sekme Mizan olacak | Bekliyor |

## Commit / değişen dosyalar / testler
Henüz yok.

## Açık riskler
- Madde 3: Düğmeler kaldırılınca, Luca gerektiren işlemler bağlantı yokken kullanıcıyı üst şeritteki düğmeye yönlendirmeli.
- e2e testleri şu seçicilere bağlı: `[data-lucabag]`, `#modGate`, `[data-mod]`, `#fkNav`.

## Devir notu
Depoda `main` → `gorev-01-menu-duzeni` dalı açılacak. Sıra: madde 1, 2, 3, 5.
