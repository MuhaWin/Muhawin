// Görev 43 Faz 4: yapay zekâ ile karşılaştırma — ana süreç modülü (yz.js). Sahte istemci; gerçek API'ye istek gitmez.
//   node test/yz.js
const fs = require('fs'); const os = require('os'); const path = require('path');
const { makeYz, maskele, MODELLER } = require('../yz');
let ok = true; const t = (ad, kosul) => { console.log((kosul ? '  ✓ ' : '  ✗ ') + ad); if (!kosul) ok = false; };
const atar = async (f, desen) => { try { await f(); return false; } catch (e) { return desen.test(e.message); } };
const sahteSafe = (var_ = true) => ({ isEncryptionAvailable: () => var_,
  encryptString: s => Buffer.from('SIFRELI:' + Buffer.from(s).toString('base64')),
  decryptString: b => Buffer.from(String(b).replace(/^SIFRELI:/, ''), 'base64').toString() });
const ANAHTAR = 'sk-ant-api03-' + 'x'.repeat(40);

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yz-'));
  let istek = null, yanit = null;
  const istemciYap = k => ({ beta: { messages: { create: async r => { istek = { ...r, _anahtar: k }; return yanit; } } } });
  const yz = makeYz({ dir: () => dir, safeStorage: sahteSafe(), istemciYap });

  console.log('Anahtar ve ayar');
  t('anahtar yokken kapalı ve açıklamalı', !yz.durum('o1').acik && !yz.durum('o1').anahtarVar &&
    await atar(() => yz.degerlendir('o1', { baglam: 'x', istek: '{}' }), /API anahtarı girilmemiş/));
  t('geçersiz anahtar reddedilir', await atar(() => yz.anahtarKaydet('abc'), /sk-ant-/));
  const yzSifresiz = makeYz({ dir: () => fs.mkdtempSync(path.join(os.tmpdir(), 'yz-')), safeStorage: sahteSafe(false), istemciYap });
  t('güvenli saklama yoksa anahtar kaydedilmez', await atar(() => yzSifresiz.anahtarKaydet(ANAHTAR), /güvenli saklama/) && !yzSifresiz.durum('o1').anahtarVar);
  yz.anahtarKaydet(ANAHTAR);
  const ham = fs.readFileSync(path.join(dir, 'yz-anahtar.bin'), 'utf8');
  t('anahtar şifreli dosyada (düz metin değil)', !ham.includes(ANAHTAR) && yz.durum('o1').anahtarVar);
  t('onaysız açılamaz', await atar(() => yz.ayarla('o1', { acik: true }), /onaylayın/));
  t('anahtar var ama ofiste kapalı → değerlendirme yok', await atar(() => yz.degerlendir('o1', { baglam: 'x', istek: '{}' }), /kapalı/));
  const d = yz.ayarla('o1', { onay: true, acik: true });
  t('onayla açılır; onay zamanı yazılır', d.acik && !!d.onay && d.model === 'kalite');
  t('ayar ofis bazında: başka ofiste kapalı', !yz.durum('o2').acik);
  t('durum ve ayar dosyasında anahtar yok', !JSON.stringify(yz.durum('o1')).includes('sk-ant') && !fs.readFileSync(path.join(dir, 'yz-ayar.json'), 'utf8').includes('sk-ant'));
  t('bilinmeyen model reddedilir', await atar(() => yz.ayarla('o1', { model: 'gpt' }), /Bilinmeyen model/));

  console.log('İstek');
  yanit = { model: 'claude-opus-5-5', stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({ karar: 'supheli', guven: 0.7, gerekce: 'Kira faturası 770 yerine 760\'a kaydedilmiş.', onerilen_hesap: '770.01.05' }) }],
            usage: { input_tokens: 400, cache_creation_input_tokens: 3000, cache_read_input_tokens: 0, output_tokens: 500 } };
  const baglam = 'Firmanın kullandığı hesaplar:\n770.01\tGenel Yönetim\nyanlışlıkla: 12345678901 TR33 0006 1005 1978 6457 8413 26 ali@ornek.com';
  const r = await yz.degerlendir('o1', { baglam, istek: JSON.stringify({ fatura: { karsi_taraf: 'VKN 1234567890' } }) });
  const govde = JSON.stringify(istek);
  t('model tek yerden: claude-opus-5-5', istek.model === MODELLER.kalite.id && istek.model === 'claude-opus-5-5');
  t('ikinci maskeleme: VKN / TCKN / IBAN / e-posta gönderilmez', !/12345678901|1234567890|TR33|ali@ornek/.test(govde.replace(istek._anahtar, '')));
  t('firma bağlamı önbellekte (cache_control), talimat önde sabit', istek.system[1].cache_control && istek.system[1].cache_control.type === 'ephemeral' && /mali müşavir/.test(istek.system[0].text));
  t('yapılandırılmış çıktı (json_schema) ve effort', istek.output_config.format.type === 'json_schema' && istek.output_config.format.schema.properties.karar.enum.length === 3 && istek.output_config.effort === 'medium');
  t('güvenlik reddinde sunucu yedeği (fallbacks default)', istek.fallbacks === 'default' && istek.betas.includes('server-side-fallback-2026-07-01'));
  t('anahtar yalnız istemciye verilir', istek._anahtar === ANAHTAR);
  t('sonuç okunur', r.sonuc.karar === 'supheli' && r.sonuc.guven === 0.7 && r.sonuc.onerilen_hesap === '770.01.05');
  t('maliyet hesaplanır (Opus 5.5 fiyatıyla)', Math.abs(r.maliyet - (400 * 4 + 3000 * 5 + 500 * 20) / 1e6) < 1e-4);
  yz.ayarla('o1', { model: 'ekonomik' });
  await yz.degerlendir('o1', { baglam: 'b', istek: '{}' });
  t('ekonomik seçenek: claude-sonnet-5-5', istek.model === 'claude-sonnet-5-5');
  yanit = { ...yanit, stop_reason: 'refusal', content: [] };
  t('ret açık hata', await atar(() => yz.degerlendir('o1', { baglam: 'b', istek: '{}' }), /değerlendirmedi/));
  yanit = { ...yanit, stop_reason: 'end_turn', content: [{ type: 'text', text: '{"karar":"belki"}' }] };
  t('beklenmeyen yanıt reddedilir', await atar(() => yz.degerlendir('o1', { baglam: 'b', istek: '{}' }), /beklenen biçimde/));
  t('çok büyük veri gönderilmez', await atar(() => yz.degerlendir('o1', { baglam: 'x'.repeat(130000), istek: '{}' }), /boyutta/));
  const g = yz.gosterim({ baglam, istek: { a: 'ali@ornek.com' } });
  t('"Gönderilecek veriyi göster" aynı maskeyle', !/12345678901|ali@ornek/.test(JSON.stringify(g)) && /mali müşavir/.test(g.sistem));
  t('maskele: tutar ve tarih bozulmaz', maskele('1.234,56 TL 15.09.2026 fiş 143') === '1.234,56 TL 15.09.2026 fiş 143');

  console.log('Gerçek SDK, yerel sahte sunucuya (dışarıya bağlanmaz)');
  const http = require('http'); let gelen = null;
  const sunucu = http.createServer((q, s) => { let b = ''; q.on('data', d => b += d); q.on('end', () => {
    gelen = { yol: q.url, basliklar: q.headers, govde: JSON.parse(b) };
    s.setHeader('Content-Type', 'application/json');
    s.end(JSON.stringify({ id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-opus-5-5', stop_reason: 'end_turn', stop_sequence: null,
      content: [{ type: 'text', text: '{"karar":"uygun","guven":0.9,"gerekce":"Hesap uygun.","onerilen_hesap":"770.01"}' }],
      usage: { input_tokens: 10, output_tokens: 20, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } })); }); });
  await new Promise(r => sunucu.listen(0, '127.0.0.1', r));
  const Anthropic = require('@anthropic-ai/sdk'); const A = Anthropic.default || Anthropic;
  const gercek = makeYz({ dir: () => dir, safeStorage: sahteSafe(), istemciYap: k => new A({ apiKey: k, baseURL: 'http://127.0.0.1:' + sunucu.address().port, maxRetries: 0 }) });
  gercek.ayarla('o1', { model: 'kalite' });
  const r2 = await gercek.degerlendir('o1', { baglam: 'Firmanın hesapları', istek: '{"fatura":{}}' });
  sunucu.close();
  t('SDK isteği /v1/messages, beta başlığı ve anahtar başlıkta', gelen.yol.startsWith('/v1/messages') && /server-side-fallback-2026-07-01/.test(gelen.basliklar['anthropic-beta'] || '') && gelen.basliklar['x-api-key'] === ANAHTAR);
  t('SDK gövdesi: model, fallbacks, output_config, önbellek; betas gövdede değil', gelen.govde.model === 'claude-opus-5-5' && gelen.govde.fallbacks === 'default' &&
    gelen.govde.output_config.format.type === 'json_schema' && gelen.govde.system[1].cache_control.type === 'ephemeral' && !('betas' in gelen.govde));
  t('SDK yanıtı okunur', r2.sonuc.karar === 'uygun' && r2.model === 'claude-opus-5-5');
  yz.anahtarSil();
  t('anahtar silinince kapalı', !yz.durum('o1').acik && !yz.durum('o1').anahtarVar);
  process.exit(ok ? 0 : 1);
})().catch(e => { console.log('HATA', e); process.exit(1); });
