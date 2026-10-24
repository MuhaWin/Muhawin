'use strict';
// Veri deposu: bu bilgisayarda (varsayılan) ya da büronun ortak klasöründe.
// Yapı:  <kök>/veri.json  {firms, rules, output, rev, savedAt, savedBy}
//        <kök>/mizan/<firmaId>.json  [[kod, ad], ...]
// Her değişiklik tek bir işlem olarak uygulanır: kilit al → diskten en güncel veriyi oku → işlemi uygula → yaz.
// Böylece aynı klasörü kullanan bilgisayarlar birbirinin değişikliğini ezmez.
const fs = require('fs');
const path = require('path');
const os = require('os');

const SHARED_SUB = 'EkstreLuca-Veri';

function makeDataStore(userDir) {
  const cfgFile = path.join(userDir, 'ayarlar.json');
  const readCfg = () => { try { return JSON.parse(fs.readFileSync(cfgFile, 'utf8')); } catch (e) { return {}; } };
  const writeCfg = c => { fs.mkdirSync(userDir, { recursive: true }); fs.writeFileSync(cfgFile, JSON.stringify(c, null, 1)); };

  const root = () => { const c = readCfg(); return c.sharedDir ? path.join(c.sharedDir, SHARED_SUB) : userDir; };
  const veriFile = (r = root()) => path.join(r, 'veri.json');
  const mizanDir = (r = root()) => path.join(r, 'mizan');
  const safeId = id => String(id).replace(/[^\w.-]/g, '_');

  function readRaw(r = root()) {
    try { return JSON.parse(fs.readFileSync(veriFile(r), 'utf8')); } catch (e) { return null; }
  }
  function writeAtomic(file, text) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = file + '.' + process.pid + '.tmp';
    fs.writeFileSync(tmp, text);
    try { fs.renameSync(tmp, file); } catch (e) { fs.copyFileSync(tmp, file); fs.unlinkSync(tmp); }
  }
  function normalize(d) {
    d = d || {};
    d.firms = d.firms || {}; d.rules = d.rules || {};
    if (d.output === undefined) d.output = null;
    return d;
  }
  // Eski biçim: mizanlar veri.json içindeydi → ayrı dosyalara taşı
  function migrate(r = root()) {
    const d = readRaw(r);
    if (!d || !d.mizan || !Object.keys(d.mizan).length) return;
    for (const [fid, acc] of Object.entries(d.mizan)) writeAtomic(path.join(mizanDir(r), safeId(fid) + '.json'), JSON.stringify(acc));
    delete d.mizan; writeAtomic(veriFile(r), JSON.stringify(d));
  }

  // --- kilit (ağ klasörlerinde de çalışan basit kilit dosyası) ---
  function sleep(ms) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }
  function withLock(r, fn) {
    fs.mkdirSync(r, { recursive: true });
    const lock = path.join(r, 'veri.lock');
    const t0 = Date.now(); let fd = null;
    while (fd === null) {
      try { fd = fs.openSync(lock, 'wx'); fs.writeSync(fd, os.hostname() + ' ' + new Date().toISOString()); }
      catch (e) {
        if (e.code !== 'EEXIST') throw e;
        try { if (Date.now() - fs.statSync(lock).mtimeMs > 20000) { fs.unlinkSync(lock); continue; } } catch (_) {}
        if (Date.now() - t0 > 8000) throw new Error('Veri dosyası başka bir bilgisayar tarafından kullanılıyor. Birkaç saniye sonra tekrar deneyin.');
        sleep(150);
      }
    }
    try { return fn(); } finally { try { fs.closeSync(fd); } catch (_) {} try { fs.unlinkSync(lock); } catch (_) {} }
  }

  // silinen firmanın saklanan kuralları/mizanı için anahtar: Luca firma no ya da ad
  const arsivAnahtari = f => f ? (f.lucaId ? 'luca:' + f.lucaId : 'ad:' + String(f.name || '').trim().toLocaleUpperCase('tr-TR')) : null;
  // --- Görev 51: ofis deposu satırları (tur, firma, anahtar, veri, silindi) ---
  // firma: mizanInfo bu bilgisayara aittir (mizan dosyası yerelde), uzaktan gelen firmaya yereldeki eklenir.
  function uzakSatir(d, r, x) {
    const sil = !!x.silindi || x.veri == null, v = x.veri;
    const kume = (alan, fid) => { d[alan] = d[alan] || {}; return (d[alan][fid] = d[alan][fid] || {}); };
    switch (x.tur) {
      case 'firma': {
        const eski = d.firms[x.anahtar];
        if (sil) { delete d.firms[x.anahtar]; break; }
        d.firms[x.anahtar] = { ...v, id: x.anahtar, ...(eski && eski.mizanInfo ? { mizanInfo: eski.mizanInfo } : {}) };
        if (!d.firms[x.anahtar].mizanInfo) delete d.firms[x.anahtar].mizanInfo;
        break; }
      case 'kural': if (sil) { if (d.rules[x.firma]) delete d.rules[x.firma][x.anahtar]; } else kume('rules', x.firma)[x.anahtar] = v; break;
      case 'fkural': if (sil) { if (d.fkurallar && d.fkurallar[x.firma]) delete d.fkurallar[x.firma][x.anahtar]; } else kume('fkurallar', x.firma)[x.anahtar] = v; break;
      case 'okckural': if (sil) { if (d.okckural && d.okckural[x.firma]) delete d.okckural[x.firma][x.anahtar]; } else kume('okckural', x.firma)[x.anahtar] = v; break;
      case 'cikti': d.output = sil ? null : v; break;
      case 'buro': if (!sil) d.registration = v; break;
      default: break;                                           // bilinmeyen tür (yeni sürüm): yok sayılır
    }
  }
  function firmaKimlik(d, r, eski, yeni) {
    if (!eski || !yeni || eski === yeni || !d.firms[eski]) return;
    const tasi = alan => { if (d[alan] && d[alan][eski]) { d[alan][yeni] = { ...(d[alan][eski] || {}), ...(d[alan][yeni] || {}) }; delete d[alan][eski]; } };
    d.firms[yeni] = { ...d.firms[eski], ...(d.firms[yeni] || {}), id: yeni }; delete d.firms[eski];
    for (const alan of ['rules', 'fkurallar', 'okckural', 'okc']) tasi(alan);
    for (const alan of ['aktarim', 'fkayit']) if (d[alan] && d[alan][eski]) {
      const a = d[alan][eski], b = (d[alan][yeni] = d[alan][yeni] || { keys: {}, batches: [] });
      Object.assign(b.keys, a.keys || {}); b.batches = [...(a.batches || []), ...(b.batches || [])].slice(0, 300); delete d[alan][eski];
    }
    for (const g of d.gunluk || []) if (g.fid === eski) g.fid = yeni;
    try { const src = path.join(mizanDir(r), safeId(eski) + '.json'), hedef = path.join(mizanDir(r), safeId(yeni) + '.json');
      if (fs.existsSync(src) && !fs.existsSync(hedef)) fs.renameSync(src, hedef); } catch (_) {}
  }
  let lastOwnRev = null;
  function apply(op, a) {
    const r = root();
    return withLock(r, () => {
      const d = normalize(readRaw(r));
      switch (op) {
        case 'saveFirm': {
          const yeni = !d.firms[a.firm.id];
          d.firms[a.firm.id] = a.firm;
          // daha önce silinip kuralları saklanan firma yeniden eklendiyse kuralları geri gelir
          const ar = d.kuralArsivi || {}; const k = arsivAnahtari(a.firm);
          if (yeni && k && ar[k]) {
            if (!d.rules[a.firm.id] || !Object.keys(d.rules[a.firm.id]).length) d.rules[a.firm.id] = ar[k].rules || {};
            d.fkurallar = d.fkurallar || {};
            if (!d.fkurallar[a.firm.id] || !Object.keys(d.fkurallar[a.firm.id]).length) d.fkurallar[a.firm.id] = ar[k].fkurallar || {};
            delete ar[k];
          }
          const ma = d.mizanArsivi || {};
          if (yeni && k && ma[k] && !a.firm.mizanInfo) {
            try { const src = path.join(mizanDir(r), 'arsiv_' + safeId(k) + '.json'); if (fs.existsSync(src)) { fs.renameSync(src, path.join(mizanDir(r), safeId(a.firm.id) + '.json')); d.firms[a.firm.id] = { ...a.firm, mizanInfo: ma[k] }; } } catch (_) {}
            delete ma[k];
          }
          break; }
        case 'deleteFirm': {
          // a.kurallar / a.mizan: false verilirse saklanır (varsayılan: silinir)
          const f = d.firms[a.id]; const kural = a.kurallar !== false, mizan = a.mizan !== false;
          if (!kural && f) {
            const k = arsivAnahtari(f);
            if (k) { d.kuralArsivi = d.kuralArsivi || {}; d.kuralArsivi[k] = { ad: f.name, at: new Date().toISOString(), rules: d.rules[a.id] || {}, fkurallar: (d.fkurallar || {})[a.id] || {} }; }
          }
          delete d.firms[a.id]; delete d.rules[a.id]; if (d.fkurallar) delete d.fkurallar[a.id];
          if (mizan) { try { fs.unlinkSync(path.join(mizanDir(r), safeId(a.id) + '.json')); } catch (_) {} }
          else { try { const src = path.join(mizanDir(r), safeId(a.id) + '.json'), k = arsivAnahtari(f); if (f && k && fs.existsSync(src)) { fs.renameSync(src, path.join(mizanDir(r), 'arsiv_' + safeId(k) + '.json')); d.mizanArsivi = d.mizanArsivi || {}; d.mizanArsivi[k] = f.mizanInfo || { count: 0 }; } } catch (_) {} }
          break; }
        case 'addRule': (d.rules[a.fid] = d.rules[a.fid] || {})[a.rule.id] = a.rule; break;
        case 'delRule': if (d.rules[a.fid]) delete d.rules[a.fid][a.rid]; break;
        case 'saveMizan': writeAtomic(path.join(mizanDir(r), safeId(a.fid) + '.json'), JSON.stringify(a.acc || [])); break;
        case 'saveOutput': d.output = a.o; break;
        case 'saveReg': d.registration = a.reg; break;
        case 'logAktarim': { // Luca'ya aktarılan hareketler (mükerrer koruması) + aktarım raporu
          const A = (d.aktarim = d.aktarim || {}); const x = (A[a.fid] = A[a.fid] || { keys: {}, batches: [] });
          Object.assign(x.keys, a.keys || {});
          if (a.batch) { const i = x.batches.findIndex(b => b.id === a.batch.id); if (i >= 0) x.batches[i] = a.batch; else x.batches.unshift(a.batch); x.batches = x.batches.slice(0, 300); }
          break; }
        // Fatura → Luca kayıt: fatura kuralları ve kaydedilen faturalar (mükerrer koruması)
        case 'addFKural': (d.fkurallar = d.fkurallar || {}); (d.fkurallar[a.fid] = d.fkurallar[a.fid] || {})[a.kural.id] = a.kural; break;
        case 'delFKural': if (d.fkurallar && d.fkurallar[a.fid]) delete d.fkurallar[a.fid][a.id]; break;
        case 'logFKayit': { const K = (d.fkayit = d.fkayit || {}); const x = (K[a.fid] = K[a.fid] || { keys: {}, batches: [] });
          Object.assign(x.keys, a.keys || {});
          if (a.batch) { const i = x.batches.findIndex(b => b.id === a.batch.id); if (i >= 0) x.batches[i] = a.batch; else x.batches.unshift(a.batch); x.batches = x.batches.slice(0, 300); }
          break; }
        case 'unlogFKayit': { const x = d.fkayit && d.fkayit[a.fid]; if (x) for (const k of a.keys || []) delete x.keys[k]; break; }
        // ÖKC fiş girişi: okunan belgeler (görüntüler hesap klasöründe okc/<firma>/) ve işyeri kuralları
        case 'okcSet': { const O = (d.okc = d.okc || {}); const x = (O[a.fid] = O[a.fid] || {}); for (const b of a.belgeler || []) if (b && b.id) x[b.id] = b; break; }
        case 'okcDel': { const x = d.okc && d.okc[a.fid]; if (x) for (const id of a.ids || []) delete x[id]; break; }
        case 'okcKural': (d.okckural = d.okckural || {}); (d.okckural[a.fid] = d.okckural[a.fid] || {})[a.kural.id] = a.kural; break;
        case 'okcKuralSil': if (d.okckural && d.okckural[a.fid]) delete d.okckural[a.fid][a.id]; break;
        // Günlük iş özeti: Luca'ya kaydedilen fişler, indirilen muavinler vb. (en çok 5000 kayıt, eski olanlar düşer)
        case 'logGunluk': { const G = (d.gunluk = d.gunluk || []); if (a.kayit) G.unshift({ ...a.kayit, at: a.kayit.at || new Date().toISOString() }); if (G.length > 5000) G.length = 5000; break; }
        case 'unlogAktarim': { const x = d.aktarim && d.aktarim[a.fid]; if (x) for (const k of a.keys || []) delete x.keys[k]; break; }
        // Görev 51: ofis deposundan (Supabase) gelen satırlar yerel önbelleğe işlenir (ofisveri.js); bu bilgisayara ait alanlar korunur
        case 'uzakUygula': for (const x of a.satirlar || []) uzakSatir(d, r, x); break;
        // Görev 51: aynı firma ofis deposunda başka kimlikle varsa yereldeki kimlik onunkine çevrilir (kurallar, mizan, kayıtlar taşınır)
        case 'firmaKimlik': firmaKimlik(d, r, a.eski, a.yeni); break;
        default: throw new Error('Bilinmeyen işlem: ' + op);
      }
      d.rev = (d.rev || 0) + 1; d.savedAt = new Date().toISOString(); d.savedBy = os.hostname();
      writeAtomic(veriFile(r), JSON.stringify(d));
      lastOwnRev = d.rev + '|' + d.savedAt;
      return d;
    });
  }

  function load() { migrate(); return normalize(readRaw()); }
  function getMizan(fid) { try { return JSON.parse(fs.readFileSync(path.join(mizanDir(), safeId(fid) + '.json'), 'utf8')); } catch (e) { return []; } }

  function info() {
    const c = readCfg(); const d = readRaw();
    return { shared: !!c.sharedDir, dir: root(), sharedDir: c.sharedDir || null, local: userDir,
      firms: d ? Object.keys(d.firms || {}).length : 0, savedAt: d && d.savedAt, savedBy: d && d.savedBy, host: os.hostname() };
  }

  // --- tam paket (yedek / taşıma) ---
  function bundle(r = root()) {
    migrate(r);
    const d = normalize(readRaw(r));
    const mizan = {};
    try { for (const n of fs.readdirSync(mizanDir(r))) if (n.endsWith('.json') && !n.startsWith('arsiv_')) { try { mizan[n.slice(0, -5)] = JSON.parse(fs.readFileSync(path.join(mizanDir(r), n), 'utf8')); } catch (_) {} } } catch (_) {}
    return { format: 'ekstre-luca-veri', version: 1, exportedAt: new Date().toISOString(), host: os.hostname(), firms: d.firms, rules: d.rules, output: d.output, mizan, aktarim: d.aktarim || {}, registration: d.registration, fkurallar: d.fkurallar || {}, fkayit: d.fkayit || {}, okc: d.okc || {}, okckural: d.okckural || {} };
  }
  function validateBundle(b) {
    if (!b || typeof b !== 'object' || !b.firms || typeof b.firms !== 'object') throw new Error('Bu dosya Ekstre Luca veri dosyası değil.');
    b.rules = b.rules || {}; b.mizan = b.mizan || {};
    return { firms: Object.keys(b.firms).length, rules: Object.values(b.rules).reduce((n, x) => n + Object.keys(x || {}).length, 0), mizan: Object.keys(b.mizan).length, exportedAt: b.exportedAt || null, host: b.host || null };
  }
  // Birleştirme: aynı firma (aynı kimlik ya da aynı Luca firması) tek firmada toplanır; kurallar birleşir; mizanın yenisi kalır.
  function mergeInto(cur, inc) {
    const out = { firms: { ...cur.firms }, rules: JSON.parse(JSON.stringify(cur.rules || {})), output: cur.output || inc.output || null, mizan: { ...(cur.mizan || {}) }, aktarim: JSON.parse(JSON.stringify(cur.aktarim || {})), registration: cur.registration || inc.registration };
    out.fkurallar = JSON.parse(JSON.stringify(cur.fkurallar || {}));
    for (const [fid, x] of Object.entries(inc.fkurallar || {})) out.fkurallar[fid] = { ...(x || {}), ...(out.fkurallar[fid] || {}) };
    out.fkayit = JSON.parse(JSON.stringify(cur.fkayit || {}));
    out.okc = JSON.parse(JSON.stringify(cur.okc || {})); for (const [fid, x] of Object.entries(inc.okc || {})) out.okc[fid] = { ...(x || {}), ...(out.okc[fid] || {}) };
    out.okckural = JSON.parse(JSON.stringify(cur.okckural || {})); for (const [fid, x] of Object.entries(inc.okckural || {})) out.okckural[fid] = { ...(x || {}), ...(out.okckural[fid] || {}) };
    for (const [fid, x] of Object.entries(inc.fkayit || {})) { const o = (out.fkayit[fid] = out.fkayit[fid] || { keys: {}, batches: [] }); Object.assign(o.keys, (x || {}).keys || {}); }
    for (const [fid, x] of Object.entries(inc.aktarim || {})) { const o = (out.aktarim[fid] = out.aktarim[fid] || { keys: {}, batches: [] }); Object.assign(o.keys, x.keys || {}); const ids = new Set(o.batches.map(b => b.id)); for (const b of x.batches || []) if (!ids.has(b.id)) o.batches.push(b); o.batches.sort((p, q) => String(q.at).localeCompare(String(p.at))); }
    const byLuca = new Map(Object.values(out.firms).filter(f => f.lucaId).map(f => [String(f.lucaId), f.id]));
    const at = f => (f && f.mizanInfo && f.mizanInfo.at) || '';
    for (const f of Object.values(inc.firms || {})) {
      const target = out.firms[f.id] ? f.id : (f.lucaId && byLuca.get(String(f.lucaId))) || f.id;
      const ex = out.firms[target];
      if (!ex) { out.firms[target] = { ...f, id: target }; if (inc.mizan[f.id]) out.mizan[target] = inc.mizan[f.id]; }
      else {
        const newer = String(f.updatedAt || '') > String(ex.updatedAt || '');
        const merged = newer ? { ...ex, ...f, id: target } : { ...f, ...ex, id: target };
        if (!(merged.banks || []).length) merged.banks = (ex.banks || []).length ? ex.banks : f.banks;
        if (at(f) > at(ex) && inc.mizan[f.id]) { out.mizan[target] = inc.mizan[f.id]; merged.mizanInfo = f.mizanInfo; } else merged.mizanInfo = ex.mizanInfo || f.mizanInfo;
        out.firms[target] = merged;
      }
      const rs = inc.rules[f.id] || {};
      out.rules[target] = { ...(out.rules[target] || {}), ...rs };
    }
    return out;
  }
  function writeBundle(r, b) {
    return withLock(r, () => {
      fs.mkdirSync(mizanDir(r), { recursive: true });
      for (const [fid, acc] of Object.entries(b.mizan || {})) writeAtomic(path.join(mizanDir(r), safeId(fid) + '.json'), JSON.stringify(acc));
      const prev = readRaw(r) || {};
      const d = { firms: b.firms, rules: b.rules, output: b.output || null, aktarim: b.aktarim || prev.aktarim || {}, registration: b.registration || prev.registration,
        fkurallar: b.fkurallar || prev.fkurallar || {}, fkayit: b.fkayit || prev.fkayit || {}, okc: b.okc || prev.okc || {}, okckural: b.okckural || prev.okckural || {}, rev: (prev.rev || 0) + 1, savedAt: new Date().toISOString(), savedBy: os.hostname() };
      writeAtomic(veriFile(r), JSON.stringify(d)); lastOwnRev = d.rev + '|' + d.savedAt;
      return d;
    });
  }
  function importBundle(b, mode) {
    validateBundle(b);
    const r = root();
    const next = mode === 'replace' ? { firms: b.firms, rules: b.rules, output: b.output, mizan: b.mizan, aktarim: b.aktarim || {}, registration: b.registration, fkurallar: b.fkurallar || {}, fkayit: b.fkayit || {}, okc: b.okc || {}, okckural: b.okckural || {} } : mergeInto(bundle(r), b);
    if (mode === 'replace') { try { for (const n of fs.readdirSync(mizanDir(r))) fs.unlinkSync(path.join(mizanDir(r), n)); } catch (_) {} }
    writeBundle(r, next);
    return info();
  }

  // --- konum değiştirme ---
  function inspectShared(dir) {
    const r = path.join(dir, SHARED_SUB);
    const d = readRaw(r);
    return { exists: !!d, firms: d ? Object.keys(d.firms || {}).length : 0, savedAt: d && d.savedAt, savedBy: d && d.savedBy, path: r };
  }
  // mode: 'merge' (bu bilgisayardakiyle birleştir) | 'useShared' (ortaktakini olduğu gibi kullan) | 'copy' (ortak klasör boş, buradakini taşı)
  function useShared(dir, mode) {
    const r = path.join(dir, SHARED_SUB);
    fs.mkdirSync(r, { recursive: true });
    // yazma izni denemesi
    const probe = path.join(r, '.yazma-denemesi'); fs.writeFileSync(probe, 'ok'); fs.unlinkSync(probe);
    const here = bundle(root());
    const there = readRaw(r) ? bundle(r) : null;
    if (!there || mode === 'copy') writeBundle(r, here);
    else if (mode === 'merge') writeBundle(r, mergeInto(there, here));
    const c = readCfg(); c.sharedDir = dir; writeCfg(c);
    return info();
  }
  function useLocal() {
    const c = readCfg(); if (!c.sharedDir) return info();
    // ortak klasördeki son durumu bu bilgisayara kopyala ki hiçbir şey kaybolmasın
    try { const b = bundle(path.join(c.sharedDir, SHARED_SUB)); writeBundle(userDir, b); } catch (e) { /* ortak klasöre ulaşılamıyorsa yereldeki son veriyle devam */ }
    delete c.sharedDir; writeCfg(c);
    return info();
  }

  // --- değişiklik izleme (diğer bilgisayarların kayıtları) ---
  let watched = null, onChange = null;
  function watch(cb) {
    onChange = cb || onChange;
    if (watched) fs.unwatchFile(watched);
    watched = veriFile();
    fs.watchFile(watched, { interval: 3000 }, (cur, prev) => {
      if (cur.mtimeMs === prev.mtimeMs) return;
      const d = readRaw(); if (!d) return;
      if ((d.rev + '|' + d.savedAt) === lastOwnRev) return;
      lastOwnRev = d.rev + '|' + d.savedAt;
      if (onChange) onChange();
    });
  }

  function unwatch() { if (watched) fs.unwatchFile(watched); watched = null; onChange = null; }
  return { load, apply, getMizan, info, bundle, validateBundle, importBundle, inspectShared, useShared, useLocal, watch, unwatch, root };
}

module.exports = { makeDataStore };
