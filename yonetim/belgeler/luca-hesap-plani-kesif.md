# Luca hesap planı — keşif

## 2.9.1 · Raporlar → Excel Hesap Planı (21.10.2026, kullanıcının istek kaydı) — ARTIK ANA YÖNTEM
Ekran: `raporMuhasebeHesapKarti.do?c_musteri_id=<üye no>` (YMFrameAction modul=10). Akış (asenkron rapor):
1. `POST jasper.jq?rapor_tur=hesap_plani_listesi` JSON gövde: `{donem: "<JSON metni>", form: "<JSON metni>", donem_id: "<id>"}`
   - donem: `{donem_bas:"01/01/2026", donem_bit:"31/12/2026", kurulus_tarihi:"04/02/2019", cari_donem_bas, beyan_sekli:2, sistem_doviz_kod:0, sm:0, kesinlesme_tarihi:"", hesap_plani_yontem:0, doviz_kullan:1, e_defter:1, sirket_id:<sayı>, donem_id:<sayı>, uzun_ad, sinif:1, donem:"2026", kisa_ad}`
     (MuhaWin: `__SESSION` (YMFrameAction.do) + `genel/donem.jq` kaydı + firma adı ile kurar)
   - form: `{ilk_tarih:"", hesap_bas:"", hesap_boyu_bas:"", hesap_tipi:null, dil:"tr", bakiye_goster:"1", hesap_adi_kes:"1"(MuhaWin "0" gönderir), son_tarih:"", hesap_bit:"", hesap_boyu_bit:"", doviz:["tl"], sistem_doviz_sembol:"TL", tarih_yazdir:"H", sayfa_numarasi_yazdir:"H", report_type:"XLSX", font:"Arial", alt_bilgi_yazdir:"H", donem_id, sirket_id, tur:"hesap_plani_listesi", email_hesap:null}`
   - yanıt `{"success":"Rapor talebi başarıyla alındı."}`
2. `POST genel/rapor_takip.jq` `{donem_id, params:{raporTur:"hesap_plani_listesi"}}` → `{durum:100, durumAciklama:"… hesabının verileri oluşturuluyor."}` … `{durum:150, "Rapor başarılı bir şekilde oluşturuldu."}`
3. `POST genel/rapor_indir.jq` form `donem_id=…&raporTur=hesap_plani_listesi&filename=hesap_plani_listesi_<KISA AD>` → `application/xlsx`.
MuhaWin: luca.js `hesapPlaniRapor` (+ `hesapPlaniExcelOku`: "Hesap Kodu"/"Hesap Adı" başlığı, yoksa kod biçimli hücre + yanındaki metin). `hesapPlani()` önce rapor, olmazsa liste (`kaynak:'rapor'|'liste'`, `raporHata`). Aynı asenkron rapor düzeni (jasper.jq + rapor_takip + rapor_indir) muhtemelen diğer Luca raporlarında da kullanılıyor (mizan, muavin, döviz raporları için aday).
**Excel sütunları gerçek dosyayla teyit edilmedi** (kullanıcı Excel'i göndermedi).

## 2.7.x · Hesap Planı Listesi ekranı (yedek yöntem)
- Ekran: Muhasebe → Hesap Planı İşlemleri → Hesap Planı Listesi (`listHesapPlaniFrame.do?c_musteri_id=…`).
- Liste: `POST hesapPlaniSearchAction.do` (HTML, windows-1254), gövde `sayfaNo=N&sayfaBasinaKayitSayisi=150&kebirDeger=1&hesapKodu=&hesapAdi=&tcNo=&vergiNo=&vergiDairesi=&vergiDairesiAd=&hesapKodu1=&hesapKodu2=&ay=&tarih1=&tarih2=&calismayanHesap=0`. Satırlarda `td#td<kod>` hesap adı.
- Yeni hesap: `POST addHesapPlaniAction.do` (form) `json=1&N=B&UST_HESAP_KODU=&islem=yeni&HESAP_KODU=…&HESAP_ADI=…&BIRIM=&BAKIYE_SEKLI=&AKTIF=1` (N=K kebir). Yanıt `{success}` / `{error}`. Güncelleme `editHesapPlaniAction.do`.
- Önce firma/dönem `TopFrameAction.do?SIRKET_ID=&DONEM_ID=` (luca.js `prepareFis`).
