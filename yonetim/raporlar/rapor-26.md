# Rapor 26 – Belge girdisi sınırları (rapor-02 G-F)

**Oturum:** Yazılımcı (`session_01HKMyx49yrftMV598oVTfLH`) · **Taban:** `main` `35fa787` · **Dal:** `claude/awesome-ritchie-ftviuk` (oturum ortamı bu dalı zorunlu kılıyor)
Derleme yapılmadı.

## Önceki durum
- **ZIP açma:** Fatura arşivleri sınırsız açılıyordu: iç içe ZIP sonsuz derinlikte, girdiler bildirilen boyutlarına bakılmadan belleğe okunuyordu.
- **Bozuk paket kurtarma** (`_kurtar`): `zlib` ile sınırsız açıyordu.
- **Yükleme:** `/api/kontrol` ve benzeri uçlarda üst sınır yoktu.
- **Risk:** Küçük bir "açma bombası" (ör. birkaç KB'lık ZIP → GB'larca veri) yardımcı süreci bellek tükenmesiyle düşürebilirdi.

## Yapılan
**`fk/fatura_kontrol/fatura_okuyucu.py`**

| Sınır | Değer | Gerekçe |
|---|---|---|
| İç içe ZIP derinliği | 4 düzey (dış dosya dahil) | GİB / Luca paketleri en çok 2 düzey (dönem paketi → fatura paketi); 2 düzey pay |
| Tek girdinin açılmış boyutu | 256 MB | Tek fatura XML'i, ekli PDF'le bile birkaç MB |
| Bir dosyadan açılan toplam | 4 GB | 200 MB'lık XML arşivi ≈ 2–3 GB açılır; reddedilmez |
| Sıkıştırma oranı | 10 MB üstü girdide en çok 500:1 | XML en çok ~50–100 kat sıkışır; açma bombaları 1000:1 ve üstü |
| Girdi sayısı | 500.000 | Yıllık büyük arşivler on binler düzeyinde |

- **Önce bildirim, sonra okuma:** `ZipInfo.file_size` okumadan önce denetleniyor. Okuma en çok sınır + 1 bayt; `zipfile` zaten bildirilen boyutta durup CRC'yi doğruluyor.
- **Kurtarma yolu da sınırlı:** Yarım inmiş paketlerde `_kurtar` açmayı `max_length` ile sınırlıyor; sayaç ortak.
- **Hata sınıfı:** Sınır aşılınca `GirdiSiniri` (Türkçe, anlaşılır mesaj). Bozuk iç paket eskisi gibi uyarıyla geçiliyor; sınır aşımı uyarıya dönüşmüyor, hata olarak çıkıyor.

**`fk/fatura_kontrol/web/app.py`**
- **Yükleme sınırı:** İstek başına en çok **2 GB** (`FK_YUKLEME_SINIR_MB` ile değiştirilebilir).
  - `Content-Length` büyükse istek 413 ile hemen reddediliyor.
  - `Content-Length` yoksa ya da yanlışsa, dosyalar diske yazılırken sayılıyor (`_kopyala`).
  - Mesaj: "Yüklenen dosyalar çok büyük (en çok 2048 MB). Dosyaları dönemlere bölüp ayrı ayrı yükleyin."
- **Ortak hata işleyici:** `GirdiSiniri` hangi uçtan gelirse gelsin 400 ve Türkçe mesaj dönüyor, 500 dönmüyor.

## Testler
| Test | Sonuç |
|---|---|
| `fk/tests/test_girdi_siniri.py` (yeni, 10 test) | **10/10**: 300 faturalı 2 düzeyli arşiv okunur; derinlik 4 geçer, 5 reddedilir; açma bombası (oran); tek girdi ve toplam boyut; girdi sayısı; yarım paket kurtarmada da sınır; bozuk iç paket uyarı, sınır hata; yükleme 413 (başlıkla ve sayaçla); varsayılan sınır ≥ 1 GB; `GirdiSiniri` → 400 |
| Tüm `pytest` | **151 geçti**, 1 atlandı (önceden de atlanıyordu) |

## Riskler
- Bir istekte 2 GB'tan büyük yükleme artık reddediliyor; kullanıcıya bölmesi söyleniyor. Gerekirse `FK_YUKLEME_SINIR_MB` ile yükseltilir.
- Arşivlerin içeriği hâlâ belleğe alınıyor (mevcut tasarım); 4 GB toplam sınırı bellek kullanımının da üst sınırı.
