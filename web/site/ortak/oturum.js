/* MuhaWin sitesi: giriş, oturum ve lisans (W2). Programdaki cloud.js'in tarayıcı karşılığı.
   - Erişim belirteci yalnız bellekte; yenileme belirteci sekmeye özgü sessionStorage'da (sekme kapanınca silinir).
   - Lisans: rpc/app_status (p_device boş: web girişi bilgisayar sayısına eklenmez). Kurallar cloud.js moduleOf ile aynı.
   - Belgeler hiçbir zaman sunucuya gönderilmez; bu dosya yalnız giriş ve lisans içindir. */
'use strict';
(function () {
  const A = window.MW_AYAR;
  const ANAHTAR = 'mw-oturum';
  let erisim = null, bitis = 0, eposta = '', durumOnbellek = null;

  const depoOku = () => { try { return JSON.parse(sessionStorage.getItem(ANAHTAR) || 'null'); } catch (e) { return null; } };
  const depoYaz = v => { try { v ? sessionStorage.setItem(ANAHTAR, JSON.stringify(v)) : sessionStorage.removeItem(ANAHTAR); } catch (e) {} };
  const normEposta = e => String(e || '').trim().toLowerCase();

  function hataMetni(j, st) {
    const m = String((j && (j.msg || j.message || j.error_description || j.error)) || '');
    const c = j && (j.error_code || j.code);
    if (c === 'email_not_confirmed' || /not confirmed/i.test(m)) return 'E-posta adresiniz henüz doğrulanmadı. MuhaWin programından üyeliğinizi doğrulayın.';
    if (c === 'invalid_credentials' || /invalid login/i.test(m)) return 'E-posta ya da şifre hatalı.';
    if (c === 'weak_password' || /password should/i.test(m)) return 'Şifre çok zayıf. En az 8 karakter, harf ve rakam kullanın.';
    if (c === 'otp_expired' || /expired|invalid.*(otp|token)/i.test(m)) return 'Kod hatalı ya da süresi dolmuş. Yeni kod isteyin.';
    if (c === 'over_email_send_rate_limit' || /rate limit|security purposes/i.test(m)) return 'Çok sık deneme yapıldı. Biraz bekleyip tekrar deneyin.';
    if (st === 401) return 'Oturum süresi doldu. Yeniden giriş yapın.';
    return m || ('Sunucu hatası (' + st + ').');
  }

  async function cagir(yol, { yontem = 'POST', govde, belirtec } = {}) {
    let r;
    try {
      r = await fetch(A.supabase + yol, {
        method: yontem,
        headers: { apikey: A.anon, 'Content-Type': 'application/json', Authorization: 'Bearer ' + (belirtec || A.anon) },
        body: govde === undefined ? undefined : JSON.stringify(govde),
      });
    } catch (e) { throw new Error('Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.'); }
    const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch (e) {}
    if (!r.ok) { const e = new Error(hataMetni(j, r.status)); e.status = r.status; throw e; }
    return j;
  }

  function oturumKur(j, e) {
    erisim = j.access_token; bitis = Date.now() + (j.expires_in || 3600) * 1000;
    eposta = normEposta(e || (j.user && j.user.email));
    depoYaz({ yenile: j.refresh_token, eposta });
  }

  async function belirtec() {
    if (erisim && Date.now() < bitis - 60000) return erisim;
    const d = depoOku();
    if (!d || !d.yenile) return null;
    try { oturumKur(await cagir('/auth/v1/token?grant_type=refresh_token', { govde: { refresh_token: d.yenile } }), d.eposta); }
    catch (e) { if (e.status) { depoYaz(null); erisim = null; return null; } throw e; }
    return erisim;
  }

  async function rpc(ad, arg = {}) {
    const b = await belirtec();
    if (!b) { const e = new Error('Oturum kapalı.'); e.status = 401; throw e; }
    return cagir('/rest/v1/rpc/' + ad, { govde: arg, belirtec: b });
  }

  // ---- lisans: cloud.js moduleOf / birlesik ile aynı kurallar (TEK LİSANS: en iyi durum her modüle uygulanır)
  const ozelListesi = st => (st && st.office && Array.isArray(st.office.ozel)) ? st.office.ozel.filter(Boolean) : [];
  function birlesik(st) {
    const L = Object.values((st && st.modules) || {}).filter(m => m && m.active !== false && m.type !== 'soon');
    if (!L.length) return null;
    const son = m => new Date((m.type === 'pool' ? m.license_end : m.trial_end) || m.expires || 0).getTime() || 0;
    const en = a => a.sort((x, y) => (y.daysLeft || 0) - (x.daysLeft || 0) || son(y) - son(x))[0];
    return en(L.filter(m => m.valid && m.type === 'pool')) || en(L.filter(m => m.valid)) || L.find(m => m.type === 'disabled')
      || en(L.filter(m => m.type === 'pool' && m.expired)) || en(L.filter(m => m.trialExpired)) || L.find(m => m.trialAvailable) || L[0];
  }
  /** Ofisinize Özel Çözümler içindeki bir işe (ör. 'mikro') izin: { izin, neden, gun } */
  function ozelIzni(st, is) {
    if (!st) return { izin: false, neden: 'Lisans durumu alınamadı.' };
    if (!ozelListesi(st).includes(is)) return { izin: false, neden: 'Bu bölüm ofisinize tanımlı değil. Açtırmak için muhawin@muhawin.com.tr adresine yazın.' };
    if (st.devicesBlocked) return { izin: false, neden: st.reason || 'Bilgisayar sınırı aşıldı.' };
    const m = birlesik(st) || { valid: !!st.valid, reason: st.reason, daysLeft: st.daysLeft };
    return m.valid ? { izin: true, gun: m.daysLeft, tur: m.type } : { izin: false, neden: m.reason || 'Lisansınızın süresi dolmuş.' };
  }

  const Oturum = {
    eposta: () => eposta || ((depoOku() || {}).eposta || ''),
    acikMi: async () => !!(await belirtec()),
    async giris(e, parola) {
      e = normEposta(e);
      if (!e || !parola) throw new Error('E-posta ve şifrenizi yazın.');
      oturumKur(await cagir('/auth/v1/token?grant_type=password', { govde: { email: e, password: parola } }), e);
      durumOnbellek = null;
    },
    async cikis() {
      const b = erisim;
      depoYaz(null); erisim = null; durumOnbellek = null;
      if (b) { try { await cagir('/auth/v1/logout', { belirtec: b }); } catch (x) {} }
    },
    sifreKoduIste: e => cagir('/auth/v1/recover', { govde: { email: normEposta(e) } }),
    async sifreYenile(e, kod, yeni) {
      if (String(yeni || '').length < 8 || !/\d/.test(yeni) || !/[A-Za-zÇĞİÖŞÜçğıöşü]/.test(yeni)) throw new Error('Şifre en az 8 karakter olmalı; harf ve rakam içermeli.');
      oturumKur(await cagir('/auth/v1/verify', { govde: { type: 'recovery', email: normEposta(e), token: String(kod || '').replace(/\s/g, '') } }), e);
      await cagir('/auth/v1/user', { yontem: 'PUT', govde: { password: yeni }, belirtec: erisim });
    },
    async durum(modul = 'ozel') {
      if (!durumOnbellek) durumOnbellek = await rpc('app_status', { p_device: null, p_name: null, p_version: 'web', p_module: modul });
      return durumOnbellek;
    },
    ozelIzni,
    /** Sayfayı korur: oturum yoksa giriş sayfasına, izin yoksa nedeniyle hata verir. */
    async gerekli({ ozel } = {}) {
      if (!(await belirtec())) {
        location.replace('/giris.html?geri=' + encodeURIComponent(location.pathname + location.search));
        return new Promise(() => {});
      }
      if (!ozel) return { izin: true };
      return ozelIzni(await this.durum('ozel'), ozel);
    },
  };
  window.Oturum = Oturum;
})();
