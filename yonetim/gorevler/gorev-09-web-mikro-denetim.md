# Görev 09 – Web: Mikro Denetim Tarayıcıda + Site Girişi (W1 + W2)

**Durum:** Açık · **Uygulayan oturum:** Web Asistanı · **Taban:** `main` · **Büyüklük:** M

## Kullanıcı kararları (23.10.2026)
- Belgeler **tarayıcıda** işlenir (T); sunucuya fatura/belge gitmez.
- Alan adı alınacak (Cloudflare Pages + DNS önerisi kabul; satın alma ve hesap açma kullanıcıda).

## Kapsam
Ayrıntılı tasarım: `yonetim/belgeler/web-modul-analizi.md` §3 **W1** ve **W2**.
1. **W2 – Giriş ve lisans** (hemen başlanabilir): `web/site/giris.html`, `web/site/ortak/oturum.js` (Supabase e-posta/parola, oturum yenileme, `rpc/app_status` ile modül lisansı, çıkış, parola sıfırlama). Oturum `localStorage` yerine bellekte + yenileme belirteci (rapor-02 D5). Yalnız `anon` anahtar; `service_role` asla.
2. **W1 – Mikro Denetim tarayıcıda:** `web/site/denetim/` (Web Worker + Pyodide, paket ve wheel'ler sitede barındırılır, CDN yok), `kopru.js` ile `/api/denetim*` çağrıları Worker'a; veri IndexedDB (isteğe bağlı File System Access). `tools/site_uret.js` `fk/fatura_kontrol` paketini paketler.
   - **Ön koşul:** Görev 08 (Yazılımcı, `rapor_kayit.py` ayrımı). O birleşene kadar W2'yi ve W1'in tarayıcı tarafını taslak modüllerle (`web/tarayici-deneme/taslak_moduller.py` gibi) geliştir; Görev 08 gelince taslakları kaldır.
3. **Yayın hazırlığı:** `.github/workflows/site.yml` (Cloudflare Pages; `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` sırları). İlk yayını kullanıcı onaylar. OKUBENI'deki "sunucuda git pull" satırını Pages yoluna göre düzelt.
4. Alan adı satın alma ve Cloudflare kurulumu için kullanıcıya adım adım rehberlik (sohbette; token sohbete yazdırılmaz).

## Kurallar
- `fk/`, `renderer/`, `main.js`, `package.json`'a dokunma (Görev 08 Yazılımcı'da).
- Lisans denetimi tarayıcıda atlatılabilir; belge sızıntısı olmadığı için kabul (analiz §2). Daha sıkısı ayrı karar.

## Kabul
- Pyodide denetim testi (`web/tarayici-deneme/deneme.mjs` benzeri) ve Playwright ile giriş → denetim → Excel raporu uçtan uca (sahte veri, sahte Supabase; gerçek Supabase'e istek yok).
- Rapor `yonetim/raporlar/rapor-09.md`, PR `Görev 09: Web Mikro Denetim ve giriş`, yöneticiye bildir.
