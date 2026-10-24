// Görev 55: mizanda detay hesap (DH) — renderer/hesap_dh.js
//   node test/hesap_dh.js
const { detayHesaplar, norm } = require('../renderer/hesap_dh');
let ok = true; const t = (ad, kosul) => { console.log((kosul ? '  ✓ ' : '  ✗ ') + ad); if (!kosul) ok = false; };
const m = L => Object.fromEntries(detayHesaplar(L));
t('102 / 102.01 / 102.01.07 / 102.01.07.01: yalnız sonuncusu E',
  JSON.stringify(m(['102', '102.01', '102.01.07', '102.01.07.01'])) === JSON.stringify({ '102': 'H', '102.01': 'H', '102.01.07': 'H', '102.01.07.01': 'E' }));
t('sıra önemsiz, kardeş detaylar E', JSON.stringify(m(['102.01.07.02', '102', '102.01.07.01', '102.01.07'])) === JSON.stringify({ '102.01.07.02': 'E', '102': 'H', '102.01.07.01': 'E', '102.01.07': 'H' }));
t('aynı önekli ama alt olmayan kod alt sayılmaz (102.1 ↔ 102.10)', m(['102.1', '102.10'])['102.1'] === 'E');
t('boşluklu / tireli yazım (102 01 07, 102-01)', JSON.stringify(m(['102', '102 01', '102 01 07'])) === JSON.stringify({ '102': 'H', '102 01': 'H', '102 01 07': 'E' }) &&
  m(['102', '102-01'])['102'] === 'H' && norm(' 102 - 01 ') === '102.01');
t('noktasız yazım (102, 10201, 1020107)', JSON.stringify(m(['102', '10201', '1020107'])) === JSON.stringify({ '102': 'H', '10201': 'H', '1020107': 'E' }));
t('karışık: noktasız üst, noktalı alt (10201 ↔ 102.01.07)', m(['10201', '102.01.07'])['10201'] === 'H');
t('alt hesabı olmayan ana hesap E (100)', m(['100', '102', '102.01'])['100'] === 'E');
t('sayı olarak gelen kod', m([102, '102.01'])[102] === 'H');
console.log(ok ? 'TAMAM' : 'HATA'); process.exit(ok ? 0 : 1);
