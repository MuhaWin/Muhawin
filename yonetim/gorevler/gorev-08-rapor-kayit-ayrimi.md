# Görev 08 – Rapor Kaydını Web Sunucusundan Ayırma (W1 ön koşulu)

**Durum:** Açık (Görev 06 ve 07'den sonra) · **Uygulayan oturum:** Yazılımcı · **Taban:** `main` · **Büyüklük:** S

## Neden
Kullanıcı kararı (23.10.2026): Mikro Denetim web sitesinde **tarayıcıda** (Pyodide) çalışacak; belgeler bilgisayardan çıkmaz. Web Asistanı denemesinde kod değiştirilmeden çalıştı, tek engel: `fk/fatura_kontrol/kontrol.py` raporu kaydetmek için `fk/fatura_kontrol/web/app.py`'yi (FastAPI, sqlite3, Playwright zinciri) içe aktarıyor. Ayrıntı: `yonetim/belgeler/web-modul-analizi.md` §3 W1.

## Yapılacaklar
1. `rapor_kaydet` ve `_json` (ve gerektirdiği yardımcılar) yeni `fk/fatura_kontrol/rapor_kayit.py` modülüne taşınır. `web/app.py` bu modülü kullanır.
2. `kontrol.py` artık `web.app`'i içe aktarmaz; geçmiş kaydı (sqlite) isteğe bağlı olur (modül yoksa ya da tarayıcıdaysa sessizce atlanır).
3. Masaüstü davranışı değişmez.
4. Test: `fatura_kontrol` paketi `fastapi`, `playwright` ve `sqlite3` olmadan içe aktarılabilmeli (bunu sınayan bir pytest; ör. `sys.modules` ile engelleyerek). Mevcut pytest sonucu tabandan kötü olmamalı.

## Dokunulacak dosyalar
`fk/fatura_kontrol/kontrol.py`, `fk/fatura_kontrol/web/app.py`, yeni `fk/fatura_kontrol/rapor_kayit.py`, yeni test. `renderer/`, `main.js`, `web/` dokunulmaz.

## Teslim
Rapor `yonetim/raporlar/rapor-08.md`, PR `Görev 08: Rapor kaydı ayrımı`, yöneticiye bildir. Derleme yok.
