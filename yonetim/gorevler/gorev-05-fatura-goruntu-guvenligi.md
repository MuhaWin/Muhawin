# Görev 05 – Fatura Görüntüleme Güvenliği (G-A, rapor-02 K1)

**Durum:** Açık · **Uygulayan oturum:** Yazılımcı · **Taban:** `main` · **Dal:** `gorev-05-fatura-goruntu-guvenligi` (ortam başka dal zorunlu kılıyorsa onu kullan, PR'da belirt) · **Öncelik:** 1 (kritik)

## Sorun (rapor-02 K1, doğrulandı)
`fk/fatura_kontrol/goruntu.py` → `goruntu_html()` faturaya gömülü XSLT'yi `etree.XSLT(...)` ile **erişim kısıtı olmadan** çalıştırıyor. Kötü niyetli bir e-fatura `exsl:document` ile diske dosya yazabiliyor; şablondaki `<script>` çıktıya geçiyor ve JavaScript'i açık `fk-fatura-pdf` penceresinde çalışıyor.

## Yapılacaklar
1. `etree.XSLT(..., access_control=etree.XSLTAccessControl.DENY_ALL)`. Uzantı elemanlarını (`exsl:document`, `xsl:result-document` vb.) ve dış belge erişimini (`document()`) engelle; engellenirse sade görünüme (`_sade`) düş.
2. XSLT çıktısından `<script>`, olay öznitelikleri ve `javascript:` adresleri işe yaramayacak şekilde: `/api/fatura/goruntu` yanıtına `Content-Security-Policy: script-src 'none'; object-src 'none'; base-uri 'none'` başlığı.
3. `main.js` → `fk-fatura-pdf` penceresi: `webPreferences.javascript = false` (yalnız bu pencere). Pencerenin PDF'e yazdırma işlevi bozulmamalı.
4. Yeni test `fk/tests/test_goruntu_guvenlik.py`: `exsl:document` dosya yazamaz; `document()` ile yerel dosya okunamaz; `<script>` içeren şablonda yanıt başlığı CSP içerir; normal (zararsız) GİB şablonu yine görüntülenir.

## Dokunulacak dosyalar
`fk/fatura_kontrol/goruntu.py`, `fk/fatura_kontrol/web/app.py` (yalnız görüntü ucu), `main.js` (yalnız `fk-fatura-pdf` penceresi), `fk/tests/test_goruntu_guvenlik.py` (yeni). `renderer/index.html`'e dokunma (Görev 01).

## Kabul
- Yeni testler geçer; `cd fk && python3 -m pytest -q` taban sonucundan kötü değil (taban: 100 geçti, 2 hata eksik örnek dosyadan).
- `node test/mobil.js` 42/42; e2e taban sonucundan kötü değil.
- Rapor `yonetim/raporlar/rapor-05.md`. PR başlığı `Görev 05: Fatura görüntüleme güvenliği`. Derleme yok. PR'ı yöneticiye send_message ile bildir.
