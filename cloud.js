'use strict';
// Supabase bağlantısı: üyelik / giriş / e-posta kodu / lisans ve deneme durumu / yönetici işlemleri.
// Banka ekstreleri, mizanlar, kurallar ve Luca bilgileri sunucuya GÖNDERİLMEZ.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');

const URL_ = 'https://rupwlypoblungdfajrya.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1cHdseXBvYmx1bmdkZmFqcnlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyNjk2MDEsImV4cCI6MjEwNzg0NTYwMX0.riJdzAxjZZyZSgf7FKIfekJ7xVsY2iNTT2xS9EKhDgA';
// Yönetim modülü yalnız program sahibine açılır (sunucu da settings.admin_email ile ayrıca denetler)
const OWNER_EMAIL = 'bilgi@smmmantalya.com';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Modül durumları: sunucu "modules" alanı gönderir. Eski sunucuda (güncelleme SQL'i çalıştırılmamışsa)
// tüm etkin modüller tek (Ekstre) lisansa bağlı sayılır.
const MODULES = [
  { id: 'fatura', name: 'Muhasebe İşlemleri', active: true },
  { id: 'ekstre', name: 'Banka İşlemleri', active: true },
  { id: 'okc', name: 'Belgeden Fiş', active: true },
  { id: 'denetim', name: 'Denetim ve Analiz', active: false },     // şimdilik pasif (kullanıcı kararı); içerik hazır: ters bakiye, banka mutabakatı, günün özeti
  { id: 'ozel', name: 'Ofisinize Özel Çözümler', active: true },
  { id: 'gecici', name: 'Geçici Vergi İşlemleri', active: false },
  { id: 'personel', name: 'Personel', active: false }
];
function offlineFix(m, offline) {
  if (!offline || !m) return m;
  const end = m.type === 'pool' ? m.license_end : m.trial_end;
  const left = end ? Math.ceil((new Date(end) - Date.now()) / 86400e3) : -1;
  if (m.valid && left >= 0) return { ...m, daysLeft: left, offline: true };
  if (m.valid) return { ...m, valid: false, reason: 'Süre doldu; devam etmek için internete bağlanıp lisans kodu girin.', offline: true };
  return { ...m, offline: true };
}
function moduleList(st) {
  const list = (st && Array.isArray(st.module_list) && st.module_list.length) ? st.module_list : MODULES;
  return list.map(x => ({ ...x, ...moduleOf(st, x.id) }));
}
// TEK LİSANS (2.9.0): MuhaWin lisansı tüm modülleri açar. Hangi modülün koduyla / denemesiyle alınmış olursa olsun
// en iyi durum (geçerli lisans > geçerli deneme > kapalı hesap > süresi dolmuş) her modüle uygulanır.
function birlesik(st) {
  const L = Object.values((st && st.modules) || {}).filter(m => m && m.active !== false && m.type !== 'soon');
  if (!L.length) return null;
  const bitis = m => new Date((m.type === 'pool' ? m.license_end : m.trial_end) || m.expires || 0).getTime() || 0;
  const en = a => a.sort((x, y) => (y.daysLeft || 0) - (x.daysLeft || 0) || bitis(y) - bitis(x))[0];
  return en(L.filter(m => m.valid && m.type === 'pool')) || en(L.filter(m => m.valid)) || L.find(m => m.type === 'disabled')
    || en(L.filter(m => m.type === 'pool' && m.expired)) || en(L.filter(m => m.trialExpired)) || L.find(m => m.trialAvailable) || L[0];
}
// "Ofisinize Özel Çözümler" yalnız yönetimde kendisine özel çözüm tanımlanmış ofisin üyelerine görünür
const ozelListesi = st => (st && st.office && Array.isArray(st.office.ozel)) ? st.office.ozel.filter(Boolean) : [];
function moduleOf(st, id) {
  const def = MODULES.find(x => x.id === id) || { id, name: id, active: false };
  if (def.free) return { module: id, name: def.name, active: true, valid: true, type: 'free', reason: '' };
  if (id === 'ozel' && !ozelListesi(st).length)
    return { module: id, name: def.name, active: false, valid: false, type: 'gizli', reason: 'Bu bölüm yalnız kendisine özel çözüm tanımlanmış ofislere açıktır.' };
  if (!st) return { module: id, name: def.name, active: def.active, valid: false, reason: 'Lisans durumu alınamadı.' };
  if (!def.active) return { module: id, name: def.name, active: false, valid: false, type: 'soon', reason: 'Yakında.' };
  if (st.devicesBlocked) return { module: id, name: def.name, active: true, valid: false, type: 'devices', reason: st.reason };
  let m = birlesik(st);
  if (!m) m = { valid: !!st.valid, type: st.type, expires: st.expires, daysLeft: st.daysLeft, reason: st.reason,
    license_end: st.license_end, trial_end: st.trial_end, legacy: true };
  return offlineFix({ ...m, module: id, name: def.name, active: true, ozel: id === 'ozel' ? ozelListesi(st) : undefined }, !!st._offline);
}

// Lisans kodu: büyük harf, yalnız harf/rakam, I L O U → 1 1 0 V (sunucudaki activate_code ile aynı), 50 karakter
const KOD_ALFABE = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function kodNorm(k) { return String(k || '').toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/[IL]/g, '1').replace(/O/g, '0').replace(/U/g, 'V'); }
function kodOzet(k) { const v = kodNorm(k); if (v.length !== 50) throw new Error('Lisans kodu 50 haneli olmalı.'); return crypto.createHash('sha256').update(v).digest('hex'); }
function kodUret(adet) {
  const L = new Set();
  while (L.size < adet) { const b = crypto.randomBytes(50); let s = ''; for (let i = 0; i < 50; i++) s += KOD_ALFABE[b[i] & 31]; L.add(s); }
  return [...L];
}
const kodGrupla = k => k.match(/.{5}/g).join('-');

function makeCloud(dir, { version = '', safeStorage = null, _testUrl = null } = {}) {
  const BASE = _testUrl || URL_;
  let sess = null;            // {access_token, refresh_token, expires_at, email}
  let status = null;          // sunucudan son durum
  let offline = false;
  const cacheFile = path.join(dir, 'oturum.bin');
  const pinFile = path.join(dir, 'yonetim-sifre.json');
  let pinHata = [];
  function yerelPin(pin) {
    pinHata = pinHata.filter(t => Date.now() - t < 15 * 60e3);
    if (pinHata.length >= 5) return { ok: false, kilit: true, reason: 'Çok fazla hatalı deneme. 15 dakika sonra tekrar deneyin.' };
    let ok;
    try { const k = JSON.parse(fs.readFileSync(pinFile, 'utf8')); ok = pwHash(String(pin || ''), k.salt) === k.hash; }
    catch (e) { ok = String(pin || '') === '55555'; }
    if (!ok) { pinHata.push(Date.now()); return { ok: false, reason: 'Şifre hatalı.', kalan: 5 - pinHata.length }; }
    pinHata = []; return { ok: true, yerel: true };
  }
  const devFile = path.join(dir, 'cihaz.json');

  const enc = s => { try { return safeStorage && safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(s) : Buffer.from(s, 'utf8'); } catch (e) { return Buffer.from(s, 'utf8'); } };
  const dec = b => { try { return safeStorage && safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(b) : b.toString('utf8'); } catch (e) { return b.toString('utf8'); } };
  const readCache = () => { try { return JSON.parse(dec(fs.readFileSync(cacheFile))); } catch (e) { return null; } };
  const writeCache = c => { try { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(cacheFile, enc(JSON.stringify(c))); } catch (e) {} };
  // Bu bilgisayarın kimliği (Windows MachineGuid, Linux /etc/machine-id; yoksa bilgisayar adı). Yalnız özeti saklanır.
  // cihaz.json başka bilgisayara kopyalanırsa özet tutmaz ve yeni cihaz kimliği üretilir (cihaz sınırı aşılamasın).
  let makineOzet = null;
  function makine() {
    if (makineOzet) return makineOzet;
    let ham = '';
    try {
      if (process.platform === 'win32') {
        const o = require('child_process').execFileSync('reg', ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid'],
          { encoding: 'utf8', windowsHide: true, timeout: 5000 });
        const m = o.match(/MachineGuid\s+REG_\w+\s+(\S+)/i); if (m) ham = m[1];
      } else if (process.platform === 'linux') ham = fs.readFileSync('/etc/machine-id', 'utf8').trim();
    } catch (e) {}
    makineOzet = crypto.createHash('sha256').update('muhawin-cihaz:' + (ham || os.hostname())).digest('hex').slice(0, 32);
    return makineOzet;
  }
  function device() {
    const mk = makine();
    const yaz = d => { try { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(devFile, JSON.stringify(d)); } catch (e) {} return d; };
    try {
      const d = JSON.parse(fs.readFileSync(devFile, 'utf8'));
      if (d.id && !d.makine) return yaz({ ...d, makine: mk });          // eski sürümün dosyası: bu bilgisayarı benimser, kimlik değişmez
      if (d.id && d.makine === mk) return d;
    } catch (e) {}
    return yaz({ id: crypto.randomUUID(), makine: mk, created: new Date().toISOString() });
  }
  const pwHash = (pw, salt) => crypto.scryptSync(String(pw), Buffer.from(salt, 'hex'), 32).toString('hex');
  const normEmail = e => String(e || '').trim().toLowerCase();

  class NetErr extends Error {}
  async function call(p, { method = 'POST', body, token, timeout = 15000 } = {}) {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeout);
    let r;
    try {
      r = await fetch(BASE + p, { method, signal: ctl.signal, headers: { apikey: ANON, 'Content-Type': 'application/json', Authorization: 'Bearer ' + (token || ANON) }, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch (e) { throw new NetErr('Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.'); }
    finally { clearTimeout(t); }
    const txt = await r.text(); let j = null; try { j = txt ? JSON.parse(txt) : null; } catch (e) {}
    if (!r.ok) { const e = new Error(trErr(j, r.status)); e.status = r.status; e.code = j && (j.error_code || j.code); throw e; }
    return j;
  }
  function trErr(j, st) {
    const m = String((j && (j.msg || j.message || j.error_description || j.error)) || '');
    const c = j && (j.error_code || j.code);
    if (c === 'email_not_confirmed' || /not confirmed/i.test(m)) return 'E-posta adresiniz henüz doğrulanmadı.';
    if (c === 'invalid_credentials' || /invalid login/i.test(m)) return 'E-posta ya da şifre hatalı.';
    if (c === 'user_already_exists' || /already registered/i.test(m)) return 'Bu e-posta ile zaten üyelik var. Giriş yapın.';
    if (c === 'weak_password' || /password should/i.test(m)) return 'Şifre çok zayıf. En az 8 karakter, harf ve rakam kullanın.';
    if (c === 'otp_expired' || /expired|invalid.*(otp|token)/i.test(m)) return 'Kod hatalı ya da süresi dolmuş. Yeni kod isteyin.';
    if (c === 'over_email_send_rate_limit' || /rate limit|security purposes/i.test(m)) return 'Çok sık deneme yapıldı. Biraz bekleyip tekrar deneyin.';
    if (/Yetkisiz/.test(m)) return 'Bu işlem için yetkiniz yok.';
    if (st === 401) return 'Oturum süresi doldu. Yeniden giriş yapın.';
    return m || ('Sunucu hatası (' + st + ').');
  }
  function setSession(j, email) {
    sess = { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: Date.now() + (j.expires_in || 3600) * 1000, email: normEmail(email || (j.user && j.user.email)) };
  }
  async function token() {
    if (!sess) throw new Error('Önce programa giriş yapın.');
    if (offline) throw new NetErr('Çevrimdışı çalışıyorsunuz; bu işlem için internet gerekli.');
    if (Date.now() > sess.expires_at - 60000) {
      const j = await call('/auth/v1/token?grant_type=refresh_token', { body: { refresh_token: sess.refresh_token } });
      setSession(j, sess.email);
    }
    return sess.access_token;
  }
  const rpc = async (fn, args = {}) => call('/rest/v1/rpc/' + fn, { body: args, token: await token() });

  async function refreshStatus(pw, module) {
    const d = device();
    const args = { p_device: d.id, p_name: os.hostname(), p_version: version };
    if (module) args.p_module = module;
    try { status = await rpc('app_status', args); }
    catch (e) {
      // sunucu henüz modül güncellemesi almadıysa (p_module bilinmiyor) eski çağrıyla dene
      if (!module || !/p_module|function|404|Could not find/i.test(e.message + ' ' + (e.code || ''))) throw e;
      delete args.p_module; status = await rpc('app_status', args);
    }
    const salt = crypto.randomBytes(16).toString('hex');
    const prev = readCache() || {};
    writeCache({ email: sess.email, salt: pw ? salt : prev.salt, hash: pw ? pwHash(pw, salt) : prev.hash, status, checkedAt: Date.now(), lastSeen: Math.max(Date.now(), prev.lastSeen || 0) });
    return status;
  }

  return {
    isAuthed: () => !!sess,
    lastEmail: () => { const c = readCache(); return c ? c.email : null; },
    info: () => ({ authed: !!sess, email: sess && sess.email, offline }),
    async signup({ email, password }) {
      const e = normEmail(email);
      if (!EMAIL_RE.test(e)) throw new Error('Geçerli bir e-posta adresi girin.');
      if (String(password || '').length < 8 || !/\d/.test(password) || !/[A-Za-zÇĞİÖŞÜçğıöşü]/.test(password)) throw new Error('Şifre en az 8 karakter olmalı; harf ve rakam içermeli.');
      const j = await call('/auth/v1/signup', { body: { email: e, password } });
      if (j && j.access_token) { setSession(j, e); offline = false; await refreshStatus(password); return { ok: true, email: e, confirmed: true }; }
      if (j && j.user && Array.isArray(j.user.identities) && !j.user.identities.length) throw new Error('Bu e-posta ile zaten üyelik var. Giriş yapın.');
      return { ok: true, email: e, needCode: true };
    },
    async verify({ email, code, type = 'signup', password }) {
      const e = normEmail(email);
      const j = await call('/auth/v1/verify', { body: { type, email: e, token: String(code || '').replace(/\s/g, '') } });
      setSession(j, e); offline = false;
      if (type === 'recovery') return { ok: true, email: e, recovery: true };
      await refreshStatus(password);
      return { ok: true, email: e };
    },
    async resend({ email }) { await call('/auth/v1/resend', { body: { type: 'signup', email: normEmail(email) } }); return { ok: true }; },
    async recover({ email }) { await call('/auth/v1/recover', { body: { email: normEmail(email) } }); return { ok: true }; },
    async setNewPassword({ password }) {
      if (String(password || '').length < 8 || !/\d/.test(password)) throw new Error('Şifre en az 8 karakter olmalı; harf ve rakam içermeli.');
      await call('/auth/v1/user', { method: 'PUT', body: { password }, token: await token() });
      await refreshStatus(password); return { ok: true };
    },
    async login({ email, password }) {
      const e = normEmail(email);
      try {
        const j = await call('/auth/v1/token?grant_type=password', { body: { email: e, password } });
        setSession(j, e); offline = false;
        await refreshStatus(password);
        return { ok: true, email: e };
      } catch (err) {
        if (!(err instanceof NetErr)) { if (/doğrulanmadı/.test(err.message)) return { ok: false, needCode: true, email: e, error: err.message }; throw err; }
        // çevrimdışı giriş: son başarılı girişin şifreli kaydıyla, sınırlı süre
        const c = readCache();
        const days = (c && c.status && c.status.offline_days) || 3;
        if (!c || c.email !== e || !c.hash || pwHash(password, c.salt) !== c.hash) throw err;
        if (Date.now() < (c.lastSeen || 0) - 36 * 3600e3) throw new Error('Bilgisayarın tarihi geri alınmış görünüyor.');
        if (Date.now() - c.checkedAt > days * 86400e3) throw new Error('Son ' + days + ' gündür sunucuya bağlanılamadı. Devam etmek için internete bağlanın.');
        sess = { email: e, access_token: null, refresh_token: null, expires_at: 0 }; offline = true; status = c.status;
        writeCache({ ...c, lastSeen: Math.max(Date.now(), c.lastSeen || 0) });
        return { ok: true, email: e, offline: true };
      }
    },
    async changePassword({ current, next }) {
      if (!sess) throw new Error('Önce giriş yapın.');
      await call('/auth/v1/token?grant_type=password', { body: { email: sess.email, password: current } }).catch(e => { if (e instanceof NetErr) throw e; throw new Error('Mevcut şifre hatalı.'); });
      return this.setNewPassword({ password: next });
    },
    logout() {
      const t = sess && sess.access_token; sess = null; status = null; offline = false;
      if (t) call('/auth/v1/logout', { token: t }).catch(() => {});
      return true;
    },
    // --- lisans (program arayüzüne mevcut biçimde) ---
    licenseStatus() {
      if (!status) return { valid: false, reason: 'Lisans durumu alınamadı.' };
      if (!offline) return status;
      // çevrimdışı: son durumdan bitiş tarihine göre yeniden hesapla
      const end = status.type === 'pool' ? status.license_end : status.trial_end;
      const left = end ? Math.ceil((new Date(end) - Date.now()) / 86400e3) : -1;
      if (status.valid && left >= 0) return { ...status, daysLeft: left, offline: true };
      return { ...status, valid: false, reason: status.reason || 'Süre doldu; devam etmek için internete bağlanıp lisans kodu girin.', offline: true };
    },
    async licenseRefresh() { if (offline) return this.licenseStatus(); return refreshStatus(); },
    // --- modüller ---
    moduleStatus(id) { return moduleOf(status && { ...status, _offline: offline }, id); },
    modules() { return moduleList(status && { ...status, _offline: offline }); },
    async openModule(id) {
      if (!offline && sess) { try { await refreshStatus(null, id); } catch (e) { if (!(e instanceof NetErr)) throw e; } }
      return moduleOf(status && { ...status, _offline: offline }, id);
    },
    async activate(code) {
      const r = await rpc('activate_code', { p_code: code });
      // yeni sunucu: kodun modülü döner; modülün durumu geçerliyse kabul
      if (r && r.activated_module) { status = await refreshStatus(); const m = moduleOf(status, r.activated_module); return { ...status, valid: !!m.valid, activated_module: r.activated_module, module: m, note: r.note, reason: m.reason }; }
      if (r && r.valid) { status = await refreshStatus(); return { ...status, note: r.note, activated_module: 'ekstre' }; }
      return { valid: false, reason: (r && r.reason) || 'Kod kabul edilmedi.' };
    },
    async saveReg(reg) { return rpc('save_registration', { p_reg: reg || {} }); },
    // --- ofis (muhasebe bürosu) ve çalışan davetleri ---
    office: () => (status && status.office) || null,
    async officeCall(fn, args) {
      const ok = ['office_info', 'office_create', 'office_update', 'office_invite', 'office_join', 'office_revoke_invite', 'office_remove_member', 'office_set_role'];
      if (!ok.includes(fn)) throw new Error('Geçersiz işlem.');
      if (offline) throw new NetErr('Çevrimdışı çalışıyorsunuz; bu işlem için internet gerekli.');
      const r = await rpc(fn, args || {});
      if (['office_create', 'office_update', 'office_join', 'office_remove_member'].includes(fn)) { try { await refreshStatus(); } catch (e) {} }
      return r;
    },
    // --- WhatsApp fiş kutusu (Edge Function 'whatsapp-al': kullanıcı belirteciyle) ---
    async waBekleyenler() { if (offline) throw new NetErr('Çevrimdışı; WhatsApp kutusu için internet gerekli.'); return call('/functions/v1/whatsapp-al', { method: 'GET', token: await token(), timeout: 30000 }); },
    async waAlindi(ids) { return call('/functions/v1/whatsapp-al', { method: 'POST', body: { ids: ids || [] }, token: await token() }); },
    async waNumara() { try { return await rpc('wa_numaram', {}); } catch (e) { return []; } },
    async waNumaraBagla(id, display) { return rpc('wa_numara_bagla', { p_phone_number_id: String(id || '').trim(), p_display: String(display || '').trim() }); },
    isAdmin: () => !!(status && status.is_admin && sess && sess.email === OWNER_EMAIL && !offline),
    // Yönetim girişi şifresi: sunucuda (bcrypt); sunucu güncellenmemişse bu bilgisayarda (scrypt). İlk şifre 55555.
    async adminPin(pin) {
      if (!this.isAdmin()) throw new Error('Bu işlem için yetkiniz yok.');
      try { return await rpc('admin_pin_check', { p_pin: String(pin || '') }); }
      catch (e) { if (/schema cache|Could not find the function/i.test(e.message)) return yerelPin(pin); throw e; }
    },
    async adminPinSet(eski, yeni) {
      if (!this.isAdmin()) throw new Error('Bu işlem için yetkiniz yok.');
      if (!/^\S{4,32}$/.test(String(yeni || ''))) throw new Error('Yeni şifre 4–32 karakter olmalı, boşluk içermemeli.');
      try { return await rpc('admin_pin_set', { p_old: String(eski || ''), p_new: String(yeni) }); }
      catch (e) {
        if (!/schema cache|Could not find the function/i.test(e.message)) throw e;
        const r = yerelPin(eski); if (!r.ok) return r;
        const salt = crypto.randomBytes(16).toString('hex');
        fs.writeFileSync(pinFile, JSON.stringify({ salt, hash: pwHash(yeni, salt) })); return { ok: true, yerel: true };
      }
    },
    async duyuru() { if (offline || !sess) return null; try { return await rpc('app_duyuru', {}); } catch (e) { return null; } },
    admin: async (fn, args) => {
      const ok = ['admin_users', 'admin_set_trial', 'admin_grant', 'admin_end_license', 'admin_set_disabled', 'admin_reset_devices', 'admin_codes',
        'admin_user_detail', 'admin_user_update', 'admin_set_license_end', 'admin_remove_device', 'admin_user_delete', 'admin_payment_save',
        'admin_payment_delete', 'admin_payments', 'admin_dashboard', 'admin_codes_add', 'admin_code_lookup', 'admin_code_batches',
        'admin_settings', 'admin_settings_set', 'admin_log_list', 'admin_offices', 'admin_office_set_ozel'];
      if (!ok.includes(fn)) throw new Error('Geçersiz işlem.');
      if (offline) throw new NetErr('Çevrimdışı çalışıyorsunuz; yönetim için internet gerekli.');
      args = { ...(args || {}) };
      // lisans kodu sorgusu: kodun kendisi sunucuya gönderilmez, yalnız SHA-256 özeti
      if (fn === 'admin_code_lookup' && 'p_code' in args) { args = { p_hash: kodOzet(args.p_code) }; }
      try { return await rpc(fn, args); }
      catch (e) {
        if (/schema cache|Could not find the function/i.test(e.message) && !['admin_users', 'admin_set_trial', 'admin_grant', 'admin_end_license', 'admin_set_disabled', 'admin_reset_devices', 'admin_codes'].includes(fn)) {
          const x = new Error('Yönetim modülü için lisans sunucusunun güncellenmesi gerekiyor: Supabase → SQL Editor\'da sunucu/supabase-yonetim.sql dosyasını bir kez çalıştırın.'); x.code = 'SUNUCU_ESKI'; throw x;
        }
        // sunucuya modül güncellemesi (supabase-moduller.sql) henüz yüklenmemiş: eski imzayla dene (yalnız Ekstre)
        if (!/schema cache|Could not find the function/i.test(e.message) || !('p_module' in args)) throw e;
        if (args.p_module && args.p_module !== 'ekstre' && fn !== 'admin_end_license')
          throw new Error('Modül lisansı için lisans sunucusunun güncellenmesi gerekiyor: Supabase → SQL Editor\'da supabase-moduller.sql ve supabase-ofis.sql dosyalarını çalıştırın.');
        const { p_module, ...eski } = args; return rpc(fn, eski);
      }
    }
  };
}
module.exports = { makeCloud, SUPABASE_URL: URL_, MODULES, moduleOf, moduleList, birlesik, ozelListesi, OWNER_EMAIL, kodNorm, kodOzet, kodUret, kodGrupla };
