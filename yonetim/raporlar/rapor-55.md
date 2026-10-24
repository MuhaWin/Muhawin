# Rapor 55 – Mizan: detay hesap (DH) sütunu; muavinde yürüyen bakiye ve hesaplar arası gezinme

**Oturum:** Web Asistanı (`session_01GmVYe6iE3V7psTH1xXFUiq`) · **Taban:** `main` `555ce25` · **Dal:** `claude/beautiful-bohr-c7x9ij`

Derleme yapılmadı.

## Yapılanlar
- **`renderer/hesap_dh.js` (yeni):** Detay hesap kararını veren tek yer. Node testinde de kullanılıyor.
  - Bir kodun altında mizanda başka bir kod varsa **H**, yoksa **E**. "Altında" demek, "kod." ile başlayan başka bir kod olması.
  - Boşluklu ya da tireli kodlar (`102 01 07`, `102-01`) noktalıya çevrilerek karşılaştırılıyor.
  - Yalnız rakamdan oluşan kodlarda (`1020107`), kendisiyle başlayan daha uzun bir kod varsa H. Noktalı bir kodun birleşik yazımı da sayılıyor (`102.01.07` için `10201` H olur).
  - `102.1` ile `102.10` birbirinin alt hesabı sayılmıyor.
- **Mizan sekmesi (Mizan / Muavin / Hesap Planı penceresi):**
  - Hesap adından sonra **DH** sütunu eklendi (E / H). Başlığın ipucunda anlamı yazıyor.
  - Hem Luca / Excel mizanında hem "Muavinden oluştur" mizanında çalışıyor.
  - **H satırları kalın ve koyu renkli** (`tr.ust`), E satırları normal yazıyla. Mizanda düzeye göre kalınlık (`lv1` / `lv2`) yerine artık bu kural geçerli. Hesap Planı sekmesi değişmedi.
  - Ters bakiyeli satırlar yine kırmızı.
  - "Yalnız muavin (en alt)" düzey seçimi aynı kararı kullanıyor.
- **Süzgeç ve sıralama:** DH sütununda süzgeç var ("E/H" yazılır) ve başlığa tıklayınca sıralanıyor. Sütun dar (44 px) ve ortalı.
- **Yatay kaydırma:** Aynı stil dosyasıyla 1366 px'te kaydırma oluşmuyor. 980 px'teki 17 px'lik kaydırma DH olmadan da vardı; Görev 41 ölçümü yatay kaydırmayı 1280 px ve üstünde denetliyor.
- **Excel'e aktarma:** DH sütunu çıktıda da var.
- **Fatura Kontrol / denetim:** Mizan görüntüleme tablosu yok (yönetici raporu mizanı yalnız hesaplamada kullanıyor), bu yüzden orada değişiklik gerekmedi.

## Ek 1 – Muavinde yürüyen bakiye (mizandan / hesap planından girilen tek hesap)
**Eski durum:** "Bakiye" ilk açılışta tarih sırasıyla bir kez hesaplanıyordu. Sıralama ya da süzgeç değişince eski değerler yerinde kalıyordu.

**Şimdi:**
- **Hesaplanma:** Bakiye `filtered()` içinde, ekranda görünen sıraya göre baştan hesaplanıyor. Sıralama, sütun süzgeci ve aramanın hepsi dikkate alınıyor. Excel'e aktarımda da aynı değerler çıkıyor.
- **Açılış bakiyesi:** Dönem ya da tarih aralığı seçiliyse, aralıktan önceki hareketlerin toplamı açılış bakiyesi oluyor ve bakiye ondan başlıyor (`st.acilis`). Devir satırı listedeyse kendi satırı olarak toplama giriyor.
- **Gösterim:** Bakiye borç − alacak olarak hesaplanıyor; B / A gösterimi bugünkü gibi.
- **Alt toplam:** "Toplam" satırındaki bakiye de açılışı içeriyor. Böylece son satırdaki bakiye toplam bakiyeye eşit.
- **Birden fazla hesap:** Alt hesaplarıyla birlikte listelenen bir üst hesapta (ör. 102 → 102.01.x) bakiye bugünkü gibi tek toplam olarak yürüyor; hesap bazında ayrı hesaplanmıyor. Hesap bazında toplam için "Hesap bazında topla" kullanılabilir.
- **Etkilenmeyen:** Firmanın tüm muavini (hesap seçili değilken) değişmedi; orada bakiye sütunu yok.

## Ek 2 – Muavinde hesaplar arası gezinme
- **Klavye ve düğmeler:**
  - **→** sonraki, **←** önceki hesabın muavinini açar.
  - Başlıkta hesabın yanında **"< önceki · 3 / 120 · sonraki >"** düğmeleri var; fareyle de gezilebiliyor.
  - **↑ / ↓** muavin satırları arasında gezinir (seçili satır vurgulanır ve görünür kalır).
- **Sıra:** Mizana ya da hesap planına tıklandığı anda o listenin görünen sırası alınıyor (süzgeç, sıralama, düzey ve görünüm dahil).
- **Kutu odaktayken:** Yazı ya da süzgeç kutusu (arama, sütun süzgeci, tarih, açılır liste) odaktayken oklar metinde çalışıyor, hesap değişmiyor. Fiş penceresi ya da başka bir pencere açıkken de oklar hesap değiştirmiyor.
- **Liste sonu:** Listenin başında ya da sonunda durup "Listenin başındasınız / sonundasınız" uyarısı veriyor.
- **Hesap değişince:**
  - Sıralama ve süzgeç tercihi korunuyor ve bakiye yeni hesap için yeniden hesaplanıyor.
  - "← Mizana dön" son gezilen hesabı işaretleyerek açılıyor.

## Ek 3 – Muavin fiş penceresinde "Luca'da aç"
- **Yer:** Muavinde fiş no'ya tıklanınca açılan pencerede, "PDF Yazdır" ve "Excel'e Aktar"ın solunda.
- **Akış:** Yeni akış yazılmadı; Görev 37 ve 48'deki akış kullanılıyor (`FKUI.lucaFisAc` → `luca.fisGoster`).
  - Luca'da Fiş Listesi o fiş numarasıyla süzülmüş açılıyor; yıl fişin tarihinden alınıyor.
  - Fiş hazır olunca Luca penceresi `oneGetir` ile öne geliyor (`fisGoster` zaten yapıyor).
  - "Luca'da açılıyor…" bekleme göstergesi ve hata iletileri aynı.
- **Pasif durumlar:** Firmanın Luca karşılığı yoksa (ya da satırın fiş no'su yoksa) düğme pasif ve nedeni ipucunda yazıyor.

## Testler
- **`node test/hesap_dh.js` (yeni):** 8 kontrol, CI'ye (`surum.yml`) eklendi.
  - 102 / 102.01 / 102.01.07 / 102.01.07.01 örneğinde yalnız sonuncusu E.
  - Kardeş detaylar, `102.1` ↔ `102.10`, boşluklu / tireli / noktasız / karışık yazım, alt hesabı olmayan ana hesap, sayı olarak gelen kod.
- **`test/e2e.js` (Mizan sekmesine kontrol eklendi):**
  - DH sütunu var ve her satırdaki değer `HesapDH` ile aynı.
  - H satırlarının yazısı kalın (≥700), E satırları normal.
  - Mizan kutusunda yatay kaydırma yok.
  - 102 örneği doğru çıkıyor.
  - Muavinde → ile sonraki hesap, ← ile önceki açılıyor; listenin başında duruyor; arama kutusu odaktayken → hesabı değiştirmiyor; "sonraki >" düğmesi var.
  - Fiş penceresinde "Luca'da aç" PDF / Excel düğmelerinin solunda. Basınca `fisGoster`'a doğru fiş no ve yıl gidiyor (testte istek yakalanıyor, Luca'ya gidilmiyor). Luca karşılığı yoksa düğme pasif ve ipucunda neden yazıyor.
  - Alacağa göre azalan sıralayınca her satırın bakiyesi görünen sıranın yürüyen toplamı ve son satır "Toplam" bakiyesine eşit (örnek hesapta en az iki hareket varsa).
- **Görünüm:** Programın stil dosyasıyla örnek tablo tarayıcıda denendi; H satırları kalın, E normal.
