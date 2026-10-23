// WhatsApp webhook imza / abonelik doğrulaması (Görev 06) birim testi: node test/whatsapp-imza.mjs
// Edge Function'ın kullandığı saf modül (sunucu/edge/whatsapp-webhook/imza.ts) doğrudan yüklenir; ağa çıkılmaz.
// Node 22.18+ .ts dosyalarını tür bilgisini atarak yükler.
import crypto from 'node:crypto';
import { abonelikGecerli, esitMi, hmacHex, imzaGecerli } from '../sunucu/edge/whatsapp-webhook/imza.ts';

const ok = [], bad = [];
const check = (c, m) => { (c ? ok : bad).push(m); console.log((c ? '  ✓ ' : '  ✗ ') + m); };
const SECRET = 'test-app-secret-123';
const meta = govde => 'sha256=' + crypto.createHmac('sha256', SECRET).update(govde).digest('hex');   // Meta'nın ürettiği başlık

(async () => {
  const govde = JSON.stringify({ object: 'whatsapp_business_account', entry: [{ changes: [{ value: { contacts: [{ profile: { name: 'Ayşe Çağlar' } }] } }] }] });
  const bayt = new TextEncoder().encode(govde);

  console.log('POST imzası (X-Hub-Signature-256)');
  check(await hmacHex(SECRET, govde) === crypto.createHmac('sha256', SECRET).update(govde).digest('hex'), 'HMAC-SHA256 Node crypto ile aynı');
  check(await imzaGecerli(SECRET, bayt, meta(govde)), 'Meta imzası geçerli (ham bayt, Türkçe karakterli gövde)');
  check(await imzaGecerli(SECRET, govde, meta(govde).toUpperCase().replace('SHA256=', 'sha256=')), 'büyük harfli hex de kabul');
  check(!(await imzaGecerli(SECRET, bayt, meta(govde + ' '))), 'gövde değişince imza geçersiz');
  check(!(await imzaGecerli('baska-secret', bayt, meta(govde))), 'yanlış secret ile geçersiz');
  check(!(await imzaGecerli('', bayt, meta(govde))), 'secret tanımsızsa her istek reddedilir');
  check(!(await imzaGecerli(SECRET, bayt, null)), 'başlık yoksa reddedilir');
  check(!(await imzaGecerli(SECRET, bayt, meta(govde).replace('sha256=', 'sha1='))), 'sha256= öneki zorunlu');
  check(!(await imzaGecerli(SECRET, bayt, meta(govde).slice(0, -2))), 'kısa / bozuk imza reddedilir');
  // metne çevirip yeniden kodlamak imzayı bozmamalı: gövde UTF-8 olarak imzalanır, bayt bayt aynı
  const latin = Buffer.from('{"ad":"Çağlar"}', 'utf8');
  check(await imzaGecerli(SECRET, new Uint8Array(latin), 'sha256=' + crypto.createHmac('sha256', SECRET).update(latin).digest('hex')), 'ham UTF-8 baytları üzerinden doğrulama');

  console.log('Sabit zamanlı karşılaştırma');
  check(esitMi('abc', 'abc') && !esitMi('abc', 'abd') && !esitMi('abc', 'abcd'), 'esitMi doğru sonuç verir');

  console.log('GET abonelik (hub.verify_token)');
  check(abonelikGecerli('dogrula', 'subscribe', 'dogrula'), 'doğru belirteç kabul');
  check(!abonelikGecerli('dogrula', 'subscribe', 'yanlis'), 'yanlış belirteç reddedilir');
  check(!abonelikGecerli('', 'subscribe', ''), 'WA_VERIFY_TOKEN boşsa boş belirteç reddedilir (D4)');
  check(!abonelikGecerli('', 'subscribe', null), 'WA_VERIFY_TOKEN boşsa belirteçsiz istek reddedilir');
  check(!abonelikGecerli('dogrula', 'unsubscribe', 'dogrula'), 'hub.mode subscribe değilse reddedilir');

  console.log(`\n${ok.length} geçti, ${bad.length} başarısız`);
  process.exit(bad.length ? 1 : 0);
})().catch(e => { console.error('✗ HATA', e); process.exit(1); });
