# Rapor 22 – Yeni cari önerisi: IBAN / salt sayı ve " - " ekli ünvanlar

**Durum:** Yapıldı. İşçi oturumu: **Menü Düzenleme**. Dal: `claude/affectionate-darwin-effcgp` (ortam tek dala push izni veriyor). Taban: `main` (be9af35 sonrası).

## İstekler
| # | İstek | Durum |
|---|---|---|
| a | IBAN'a ve salt sayı / kod dizilerine cari önerilmesin | **Yapıldı.** Ayrıntılar aşağıda. |
| b | Ünvanda " - " sonrası ek olan hareket (ör. "ABC TURİZM A.Ş. - XYZ OTEL") mevcut cariyle eşleşsin, yeni cari açılmasın | **Yapıldı.** Ayrıntılar aşağıda. |

### a) IBAN ve salt sayı
- `HESAP.cariOner` başında yeni bir denetim var: `cariAdOlur`.
- Şu durumlarda cari önerilmez (`null` döner):
  - metin IBAN (TR + 24 hane, boşluklu ya da boşluksuz)
  - harfli bir sözcüğü yok
  - yarıdan fazlası rakam
- "TR", "IBAN", "EFT" gibi genel sözcükler harfli sayılmaz.
- Denetim iki yolu da kapsar: banka ekstresi (`reassign` → `unvanCikar` → `cariOner`) ve Muhasebe › fatura kaydındaki karşı ünvan (`FKAYIT` → `cariOner`).
- `unvanCikar` IBAN'ı zaten atıyordu; ona dokunulmadı.

### b) " - " ekli ünvan
1. Önce ünvanın tamamı hesap planında aranır.
2. Bulunamazsa " - " öncesindeki taban ünvanla (`unvanTaban`) yeniden aranır. Karşılaştırma bugünkü normalize edilmiş sözcük eşleşmesiyle yapılır; şirket türü ve sektör sözcükleri (LTD, ŞTİ, A.Ş., TURİZM …) dikkate alınmaz.
3. Planda yine yoksa taslak cari **taban ünvanla** açılır. Böylece aynı firmanın şubeleri ("DEF YAPI LTD ŞTİ - ANTALYA ŞANTİYESİ", "… - İZMİR ŞANTİYESİ") tek cariye düşer.

Ek bilgiler:
- Planda eşleşen cari, aynı ünvan için daha önce açılmış taslaktan önce gelir. Taslak yalnız planda olmayan kod için kullanıldığından sonuç eskisiyle aynı.
- Banka açıklamasında `unvanCikar` şirket ekinde durduğu için "FAST GELEN ABC TURİZM A.Ş. - XYZ OTEL" zaten "ABC TURİZM A.Ş." olarak çıkıyor.

## Değişen dosyalar
- `renderer/index.html`: `HESAP.cariOner`, yeni `cariAdOlur` ve `unvanTaban`; test için `_cariAdOlur` ve `_unvanTaban` dışarı açıldı.
- `test/e2e.js`: 3 yeni denetim (5. senaryo, taslak cari bölümü).
- `yonetim/raporlar/rapor-22.md`

## Testler (Linux, xvfb; derleme yok)
- `xvfb-run -a node test/e2e.js`: **278 ✓, 0 başarısız.**
- Yeni denetimler:
  - IBAN (boşluklu ve boşluksuz), salt sayı, kod dizisi ve "TR 4543 1234" için öneri yok
  - "ABC TURİZM A.Ş. - XYZ OTEL" → 120.01.003 ve "KAYA GIDA LTD. ŞTİ. - LARA ŞUBESİ" → 120.01.004; ikisi de mevcut cari
  - planda olmayan iki şube → tek taslak (120.01.005 "DEF YAPI LTD ŞTİ")
- `node test/mobil.js`: **45/45.**

## Riskler
- Taban ünvanda anlamlı tek bir sözcük kalıyorsa (ör. "ABC"), aynı sözcükle başlayan başka bir cariyle eşleşebilir. Eşik, bugünkü eşleşmeyle aynı (%60).
- " - " yalnız iki yanında boşluk varsa ayraç sayılır. "ABC-XYZ" gibi bitişik yazımlar bölünmez.

## Devir notu
G22 tamam. G21 (çoklu şart ve "Hiç kaydetme" kuralı) bu birleştikten sonra aynı dalda ikinci PR olarak gelecek.
