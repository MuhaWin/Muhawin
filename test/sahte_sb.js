// Sahte Supabase: MuhaWin'in giriş / modül lisansı için çağırdığı uçlar (testler için)
//   fatura: 'yeni' (hiç açılmamış → açılınca deneme) | 'bitti' (süresi dolmuş; kod girilince açılır)
const http = require('http');
function start({ port = 0, fatura = 'yeni', admin = false, ekstre = 'lisansli' } = {}) {
  const st = { fatura, ekstre, ekstreKod: false, faturaKod: false, office: null, invites: [], members: [], admin, adm: admin ? yonetimVerisi() : null };
  const gun = n => new Date(Date.now() + n * 864e5).toISOString();
  function modules() {
    const f = st.faturaKod ? { valid: true, type: 'pool', expires: gun(365).slice(0, 10), daysLeft: 365, license_end: gun(365) }
      : st.fatura === 'deneme' ? { valid: true, type: 'trial', expires: gun(7).slice(0, 10), daysLeft: 7, trial_days: 7, trial_end: gun(7) }
      : st.fatura === 'bitti' ? { valid: false, type: 'trial', trialExpired: true, reason: '7 günlük deneme süresi doldu. Devam etmek için lisans kodu girin.' }
      : { valid: false, type: 'trial', trialAvailable: true, trial_days: 7, reason: 'Modülü açınca 7 günlük deneme süresi başlar.' };
    return {
      ekstre: st.ekstre === 'bitti' && !st.ekstreKod ? { module: 'ekstre', name: 'Banka İşlemleri', active: true, valid: false, type: 'pool', expired: true, license_end: gun(-3), reason: 'Lisans süresi doldu. Yeni lisans kodu girin.' }
        : { module: 'ekstre', name: 'Banka İşlemleri', active: true, valid: true, type: 'pool', expires: '2027-12-31', daysLeft: 400, license_end: '2027-12-31T00:00:00Z' },
      fatura: { module: 'fatura', name: 'Muhasebe İşlemleri', active: true, ...f },
      okc: st.ekstre === 'bitti' && !st.ekstreKod ? { module: 'okc', active: true, valid: false, type: 'trial', trialExpired: true, reason: 'Deneme süresi doldu.' } : { module: 'okc', name: 'ÖKC Fiş Girişi', active: true, valid: true, type: 'trial', expires: gun(7).slice(0, 10), daysLeft: 7, trial_days: 7 },
      denetim: { module: 'denetim', name: 'Denetim ve Analiz', active: false, valid: false, type: 'soon', reason: 'Yakında.' },
      ozel: st.ekstre === 'bitti' && !st.ekstreKod ? { module: 'ozel', active: true, valid: false, type: 'trial', trialExpired: true, reason: 'Deneme süresi doldu.' } : { module: 'ozel', name: 'Özel İşlemler', active: true, valid: true, type: 'trial', expires: gun(7).slice(0, 10), daysLeft: 7, trial_days: 7 },
      gecici: { module: 'gecici', name: 'Geçici Vergi İşlemleri', active: false, valid: false, type: 'soon', reason: 'Yakında.' }
    };
  }
  const status = () => ({ valid: true, type: 'pool', expires: '2027-12-31', license_end: '2027-12-31T00:00:00Z', daysLeft: 400, is_admin: !!st.admin,
    reg: { buro: 'Test SMMM', yetkili: 'Mehmet Test', telefon: '05000000000', eposta: 'test@ornek.com' },
    modules: modules(),
    office: st.office ? { ...st.office, role: 'yonetici', is_owner: true, owner_email: 'test@ornek.com' } : null,
    module_list: [['fatura', 'Muhasebe İşlemleri', true], ['ekstre', 'Banka İşlemleri', true], ['okc', 'ÖKC Fiş Girişi', true], ['denetim', 'Denetim ve Analiz', false], ['ozel', 'Özel İşlemler', true], ['gecici', 'Geçici Vergi İşlemleri', false]]
      .map(([id, name, active]) => ({ id, name, active })) });
  const s = http.createServer((q, r) => {
    let b = ''; q.on('data', d => b += d); q.on('end', () => {
      r.setHeader('Content-Type', 'application/json');
      let j = {}; try { j = JSON.parse(b || '{}'); } catch (e) {}
      if (q.url.startsWith('/auth/v1/token')) return r.end(JSON.stringify({ access_token: 'a', refresh_token: 'r', expires_in: 3600, user: { email: 'test@ornek.com' } }));
      if (q.url.startsWith('/rest/v1/rpc/app_status')) {
        if (j.p_module === 'fatura' && st.fatura === 'yeni') st.fatura = 'deneme';
        return r.end(JSON.stringify(status()));
      }
      if (q.url.startsWith('/rest/v1/rpc/activate_code')) {
        const k = String(j.p_code || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
        if (k.startsWith('FATURA')) { st.faturaKod = true; return r.end(JSON.stringify({ ...status(), activated_module: 'fatura', note: 'Muhasebe İşlemleri – Kontrol modülü lisansı 365 gün uzatıldı.' })); }
        if (k.startsWith('EKSTRE')) st.ekstreKod = true;
        if (k.startsWith('EKSTRE')) return r.end(JSON.stringify({ ...status(), activated_module: 'ekstre', note: 'Banka İşlemleri modülü lisansı 365 gün uzatıldı.' }));
        return r.end(JSON.stringify({ valid: false, reason: 'Lisans kodu geçersiz.' }));
      }
      const fn = (q.url.match(/rpc\/(\w+)/) || [])[1];
      const info = () => st.office ? { ...st.office, role: 'yonetici', is_owner: true, owner_email: 'test@ornek.com',
        members: [{ user_id: 'u1', email: 'test@ornek.com', role: 'yonetici', is_owner: true, joined_at: new Date().toISOString() }, ...st.members],
        invites: st.invites.map((v, i) => ({ id: i + 1, email: v.email, role: v.role, expires_at: gun(14) })) } : null;
      if (fn === 'app_duyuru') return r.end(JSON.stringify(st.adm && st.adm.ayar.duyuru || null));
      if (fn && fn.startsWith('admin_')) {
        if (!st.admin) { r.statusCode = 400; return r.end(JSON.stringify({ message: 'Yetkisiz' })); }
        st.cagri = st.cagri || []; st.cagri.push([fn, j]);
        return r.end(JSON.stringify(yonetim(st.adm, fn, j)));
      }
      if (fn === 'office_info') return r.end(JSON.stringify(info()));
      if (fn === 'office_create') { st.office = { id: 'o1', name: j.p_name, luca_uye_no: String(j.p_luca_uye_no).replace(/\D/g, '') }; return r.end(JSON.stringify(status())); }
      if (fn === 'office_invite') { st.invites.push({ email: j.p_email.toLowerCase(), role: j.p_role }); return r.end(JSON.stringify({ ok: true, code: 'MW-ABCD-EFGH-JKMN', email: j.p_email.toLowerCase(), expires_at: gun(14), office: st.office.name, luca_uye_no: st.office.luca_uye_no })); }
      if (fn === 'office_join') return r.end(JSON.stringify({ ok: false, reason: 'Davet kodu geçersiz.' }));
      if (q.url.startsWith('/rest/v1/rpc/')) return r.end('{}');
      r.end('{}');
    });
  });
  return new Promise(res => s.listen(port, '127.0.0.1', () => res({ server: s, url: 'http://127.0.0.1:' + s.address().port, state: st })));
}

// ---- yönetim (program sahibi) sahte verisi ----
function yonetimVerisi() {
  const gun = n => new Date(Date.now() + n * 864e5).toISOString();
  const mod = (t, d) => t === 'pool' ? { valid: d > 0, type: 'pool', daysLeft: d, license_end: gun(d), expires: gun(d).slice(0, 10), expired: d <= 0 } : t === 'trial' ? { valid: true, type: 'trial', daysLeft: d, trial_end: gun(d), expires: gun(d).slice(0, 10) } : { valid: false, type: 'trial', trialAvailable: true };
  const u = (id, email, buro, mods, ek) => ({ id, email, reg: { buro, yetkili: 'Yetkili ' + id, telefon: '0555', vkn: '111' + id.slice(-1), vd: 'Muratpaşa' }, created_at: gun(-10), last_seen: gun(-1), app_version: '2.8.0',
    disabled: false, confirmed: true, devices: 1, paid: 0, due: 0, fatura: {}, admin_note: null, modules: { fatura: mod(...mods[0]), ekstre: mod(...mods[1]), okc: mod('x'), ozel: mod('x') }, ...ek });
  return {
    users: [u('u1', 'ali@buro.com', 'Ali SMMM', [['pool', 20], ['pool', 200]]), u('u2', 'veli@buro.com', 'Veli Muhasebe', [['trial', 5], ['x']]), u('u3', 'ayse@buro.com', 'Ayşe Mali Müşavirlik', [['pool', 0], ['x']], { disabled: true })],
    ofisler: [{ id: 'of1', name: 'Ali SMMM Ofisi', luca_uye_no: '1111', owner: 'u1', owner_email: 'ali@buro.com', uye: 2, ozel: [], created_at: gun(-9) }],
    pays: [], log: [], batches: [{ batch: 'ilk-1000', module: 'ekstre', days: 365, total: 1000, used: 3 }],
    ayar: { max_devices: 2, offline_days: 3, admin_email: 'bilgi@smmmantalya.com', duyuru: null, fiyatlar: { fatura: 5000 },
      modules: [['fatura', true], ['ekstre', true], ['okc', true], ['denetim', false], ['ozel', true], ['gecici', false]].map(([id, active]) => ({ id, name: id, active, trial_days: 7 })) }
  };
}
function yonetim(A, fn, j) {
  const U = id => A.users.find(x => x.id === id);
  const log = (action, target, detail) => A.log.unshift({ at: new Date().toISOString(), action, target, email: (U(target) || {}).email, detail });
  if (fn === 'admin_pin_check') { A.pinHata = A.pinHata || 0; if (A.pinHata >= 5) return { ok: false, kilit: true, reason: 'Çok fazla hatalı deneme.' };
    if (j.p_pin === (A.pin || '55555')) { A.pinHata = 0; return { ok: true, varsayilan: !A.pin }; } A.pinHata++; return { ok: false, reason: 'Şifre hatalı.' }; }
  if (fn === 'admin_pin_set') { if (j.p_old !== (A.pin || '55555')) return { ok: false, reason: 'Şifre hatalı.' }; A.pin = j.p_new; log('pin_degisti', null, null); return { ok: true }; }
  if (fn === 'admin_offices') return A.ofisler;
  if (fn === 'admin_office_set_ozel') { const o = A.ofisler.find(x => x.id === j.p_office); o.ozel = j.p_ozel; log('ozel', o.owner, { ofis: o.name, ozel: o.ozel }); return o; }
  if (fn === 'admin_users') return A.users;
  if (fn === 'admin_settings') return A.ayar;
  if (fn === 'admin_dashboard') return { uye: A.users.length, yeni_ay: 3, aktif_7: 2, aktif_30: 3, kapali: 1, dogrulanmamis: 0, ofis: 0, tahsil_ay: 0, tahsil_yil: A.pays.filter(p => p.durum === 'odendi').reduce((s, p) => s + p.tutar * 1.2, 0), bekleyen: 0, bekleyen_adet: 0,
    aylik: [{ ay: '2026-10', uye: 3, tahsil: 6000 }], surumler: { '2.8.0': 3 }, bitecek: [{ user_id: 'u1', email: 'ali@buro.com', buro: 'Ali SMMM', module: 'fatura', ends_at: new Date(Date.now() + 20 * 864e5).toISOString() }],
    son_uyeler: A.users.map(u => ({ id: u.id, email: u.email, buro: u.reg.buro, created_at: u.created_at })), kodlar: { ekstre: { total: 1000, used: 3 } } };
  if (fn === 'admin_user_detail') { const u = U(j.p_user); return { ...u, licenses: [], device_list: [{ device_id: 'd1', name: 'OFIS-PC', first_seen: u.created_at, last_seen: u.last_seen }], payments: A.pays.filter(p => p.user_id === u.id), log: A.log.filter(g => g.target === u.id) }; }
  if (fn === 'admin_user_update') { const u = U(j.p_user); if (j.p_fatura) u.fatura = j.p_fatura; if (j.p_admin_note != null) u.admin_note = j.p_admin_note || null; log('bilgi', u.id, {}); return u; }
  if (fn === 'admin_grant') { const u = U(j.p_user); const m = u.modules[j.p_module]; const d = (m.valid && m.type === 'pool' ? m.daysLeft : 0) + j.p_days; u.modules[j.p_module] = { valid: true, type: 'pool', daysLeft: d, license_end: new Date(Date.now() + d * 864e5).toISOString() }; log('lisans', u.id, { modul: j.p_module, gun: j.p_days }); return u; }
  if (fn === 'admin_set_disabled') { const u = U(j.p_user); u.disabled = j.p_disabled; log(j.p_disabled ? 'kapat' : 'ac', u.id, {}); return u; }
  if (fn === 'admin_payment_save') { const p = j.p; let row;
    if (p.id) { row = A.pays.find(x => x.id === p.id); Object.assign(row, p, { tutar: +p.tutar, kdv_orani: +p.kdv_orani }); }
    else { row = { ...p, id: A.pays.length + 1, tutar: +p.tutar, kdv_orani: +p.kdv_orani, email: U(p.user_id).email, created_at: new Date().toISOString(), license_id: p.lisans_ver ? 99 : null };
      A.pays.unshift(row); if (p.lisans_ver) yonetim(A, 'admin_grant', { p_user: p.user_id, p_days: +p.days, p_module: p.module }); log('satis', p.user_id, { tutar: row.tutar }); }
    const u = U(row.user_id); const top = x => x.tutar * (1 + x.kdv_orani / 100);
    u.paid = A.pays.filter(x => x.user_id === u.id && x.durum === 'odendi').reduce((s, x) => s + top(x), 0); u.due = A.pays.filter(x => x.user_id === u.id && x.durum === 'bekliyor').reduce((s, x) => s + top(x), 0);
    return row; }
  if (fn === 'admin_payments') return A.pays.map(p => ({ ...p, buro: U(p.user_id).reg.buro, cur_email: U(p.user_id).email }));
  if (fn === 'admin_payment_delete') { A.pays = A.pays.filter(x => x.id !== j.p_id); return { ok: true }; }
  if (fn === 'admin_code_batches') return A.batches;
  if (fn === 'admin_codes_add') { A.kodOzetleri = j.p_hashes; A.batches.push({ batch: j.p_batch, module: j.p_module, days: j.p_days, total: j.p_hashes.length, used: 0 }); return { ok: true, added: j.p_hashes.length }; }
  if (fn === 'admin_code_lookup') return (A.kodOzetleri || []).includes(j.p_hash) ? { found: true, module: 'okc', days: 365, batch: 'test', used_by: null } : { found: false };
  if (fn === 'admin_settings_set') { const p = j.p; if (p.max_devices) A.ayar.max_devices = p.max_devices; if ('duyuru' in p) A.ayar.duyuru = p.duyuru ? { id: Date.now(), ...p.duyuru, tarih: new Date().toISOString() } : null; if (p.fiyatlar) A.ayar.fiyatlar = p.fiyatlar; return A.ayar; }
  if (fn === 'admin_log_list') return A.log;
  return { ok: true };
}
module.exports = { start };
