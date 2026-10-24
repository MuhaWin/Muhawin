'use strict';
/* Görev 55: detay hesap (DH). Mizandaki bir hesabın altında başka hesap varsa "H" (üst / ana hesap), yoksa "E" (detay hesap,
   en alt kırılım). Karar yalnız mizandaki hesap kodlarından verilir: "kod." ile başlayan başka bir kod varsa H.
   Noktasız biçimler de sayılır: "102 01 07" / "102-01-07" noktalıya çevrilir; yalnız rakamdan oluşan "1020107" gibi
   kodlarda, kendisiyle başlayan daha uzun bir kod (ya da noktalı bir kodun birleşik yazımı: 102.01 → 10201) varsa H. */
(function (kok) {
  const norm = k => String(k == null ? '' : k).trim().split(/[.\-\s]+/).filter(Boolean).join('.');
  // mizandaki kodların hepsinin üst kodları (noktalı ve birleşik yazımla)
  function ustKodlar(kodlar) {
    const u = new Set();
    for (const k0 of kodlar) {
      const k = norm(k0); if (!k) continue;
      if (k.includes('.')) {
        const p = k.split('.');
        for (let i = 1; i < p.length; i++) { u.add(p.slice(0, i).join('.')); u.add(p.slice(0, i).join('')); }
      } else if (/^\d{4,}$/.test(k)) {
        for (let i = 3; i < k.length; i++) u.add(k.slice(0, i));
      }
    }
    return u;
  }
  // kodlar → Map(kod → 'E' | 'H'); her kod kendi yazımıyla anahtar
  function detayHesaplar(kodlar) {
    const L = [...kodlar], u = ustKodlar(L), out = new Map();
    for (const k of L) out.set(k, u.has(norm(k)) ? 'H' : 'E');
    return out;
  }
  const api = { norm, ustKodlar, detayHesaplar };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else kok.HesapDH = api;
})(typeof window !== 'undefined' ? window : globalThis);
