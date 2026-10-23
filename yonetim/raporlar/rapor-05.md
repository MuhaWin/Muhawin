# Rapor 05 – Fatura Görüntüleme Güvenliği (G-A, rapor-02 K1)

**Oturum:** Yazılımcı (`session_01HKMyx49yrftMV598oVTfLH`) · **Taban:** `main` `e116994` · **Dal:** `claude/awesome-ritchie-ftviuk` (kartın istediği dal yerine; oturum ortamı bu dalı zorunlu kılıyor)

## İstek durumu
| # | İstek | Durum |
|---|---|---|
| 1 | XSLT erişim kısıtı; engellenirse sade görünüm | Yapıldı. `etree.XSLT(..., access_control=XSLTAccessControl.DENY_ALL)` ile `exsl:document` / `xsl:document` yazma, `document()` okuma ve ağ erişimi kapalı. Ek katman: `extension-element-prefixes` bildiren şablon hiç çalıştırılmaz. Ayrıştırıcı `resolve_entities=False, no_network=True`. Hata ya da ret olursa `_sade()` |
| 2 | `/api/fatura/goruntu` yanıtına CSP | Yapıldı (aşağıdaki sapmaya bakın) |
| 3 | `fk-fatura-pdf` penceresinde `javascript:false`; PDF'e yazdırma bozulmamalı | Yapıldı. `executeJavaScript` JS kapalıyken çalışmadığı için "bulunamadı" denetimi HTTP koduna (`did-navigate`) taşındı: 404 → eski mesaj, 200 dışı başka kod → "Fatura görüntülenemedi (HTTP n)" |
| 4 | Yeni test `fk/tests/test_goruntu_guvenlik.py` | Yapıldı (6 test) |

### Karttan sapma: CSP
Kart `script-src 'none'` diyor. Ancak fatura görüntüsü FK arayüzünden (`static/index.html:791`, `denetim.html:196`) yeni pencerede de açılıyor ve oradaki "🖨 Yazdır / PDF olarak kaydet" düğmesi `onclick="window.print()"` kullanıyor. `'none'` bu düğmeyi bozardı. Bu yüzden yalnız o tek ifadenin özetine izin verildi:

```
script-src 'unsafe-hashes' 'sha256-MguIPR6qNR8D3B+eAlK+bIRTZe8t3wkOY4B/56Me9FU='; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'; connect-src 'none'
```

Şablon aynı `onclick="window.print()"` ifadesini kullanırsa en fazla yazdır penceresi açılır. Başka hiçbir `<script>`, olay özniteliği ya da `javascript:` adresi çalışmaz; `'unsafe-inline'` yok. `connect-src 'none'` ayrıca sayfadan yerel API'ye `fetch` isteğini de keser.

### Neden "uzantı ad alanı" ya da `<script>` içeren şablon reddedilmedi
GİB şablonlarında `exsl:node-set()` (exslt ad alanı) yaygın; bazı şablonlarda `<script>` de var. Bunları reddetmek meşru faturaları sade görünüme düşürürdü. `DENY_ALL`, `node-set`'e dokunmadan yazma ve okumayı engelliyor (yerel denemeyle doğrulandı). Script'i ise CSP ve JS kapalı pencere durduruyor.

## Commit'ler
- `19ed24a` Görev 05: faturaya gömülü XSLT'yi erişimsiz çalıştır
- `20a593f` Görev 05: fatura görüntü ucuna CSP başlığı
- `5cd0306` Görev 05: fk-fatura-pdf penceresinde JavaScript kapalı
- `1ca65b0` Görev 05: fatura görüntüleme güvenlik testleri
- Bu raporun commit'i

## Değişen dosyalar
- `fk/fatura_kontrol/goruntu.py`: `_xslt_uygula()`, `goruntu_csp()`, `YAZDIR_JS`
- `fk/fatura_kontrol/web/app.py`: yalnız `fatura_goruntu` ucu (CSP başlığı)
- `main.js`: yalnız `fk-fatura-pdf` penceresi
- Yeni: `fk/tests/test_goruntu_guvenlik.py`
- Dokunulmadı: `renderer/index.html`

## Testler
| Test | Sonuç |
|---|---|
| `fk/tests/test_goruntu_guvenlik.py` | **6/6**. Eski kodla 3'ü kırılıyor (iki yazma testi ve CSP); okuma ve XXE testleri eski lxml varsayılanlarıyla da geçiyordu, artık ayrıca kilitli |
| `cd fk && pytest -q` | **106 geçti, 2 başarısız, 1 atlandı.** Taban 100/2/1 + 6 yeni. Başarısızlar aynı: eksik `fk/tests/veri_isletme_*.xlsx` |
| `node test/mobil.js` | **42/42** |
| `xvfb-run -a node test/e2e.js` | **203 geçti, 1 hata.** Tabanla aynı; ÖKC OCR zaman aşımı, sebep eksik `test/ornek/` |
| Elle Electron denemesi (yerel FK sunucusu + Electron 31) | `javascript:false` penceresinde zararsız ve script'li şablon → HTTP 200, PDF üretildi (12.340 / 6.342 bayt). Olmayan fatura → 404 yakalandı. JS açık pencerede bile CSP script'i durdurdu (sayfa metni değişmedi). Aynı süreçte ardışık üç pencere doğru çalıştı |

e2e `fk-fatura-pdf` yolunu sınamıyor; bu yüzden elle deneme yapıldı.

## Riskler ve kalanlar
- **Dış görseller:** CSP `img-src`'yi kısıtlamıyor. Şablon dış bir adresten görsel yükleyebilir (izleme pikseli: faturanın açıldığı bilgisi sızar). GİB şablonları logoyu çoğunlukla `data:` ile gömdüğü için `img-src 'self' data:` eklenebilir. Ancak dış adresli logolar bozulur; bilinçli olarak eklenmedi, karar yöneticinin.
- **Meta yenileme:** `<meta http-equiv="refresh">` CSP ile engellenemez. Şablon FK penceresini dış bir sayfaya yönlendirebilir. O pencerede preload olmadığı ve yerel API anahtarı yalnız `127.0.0.1` isteklerine eklendiği için etkisi düşük. Kalıcı çözüm rapor-02 O1 (gezinme engeli, G-D).
- **Eski libxslt sürümleri:** Windows paketindeki lxml sürümü farklıysa `DENY_ALL` yine geçerli (lxml 2.x'ten beri var). `requirements.txt` sabitleme işi G-G'de.

## Devir notu
- Görev 01 `main.js`'ye dokunursa çakışma yalnız `fk-fatura-pdf` bloğunda olabilir (6 satır).
- `goruntu_csp()` başka HTML uçlarında (rapor çıktısı vb.) da kullanılabilir. Onlar şu an güvenilir, program içi veri üretiyor; kapsam dışı bırakıldı.
