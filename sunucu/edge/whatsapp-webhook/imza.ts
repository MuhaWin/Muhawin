// MuhaWin · WhatsApp webhook doğrulamaları (saf fonksiyonlar; ağ ve Deno'ya özgü API yok).
// Deno (Edge Function) ve Node (test/whatsapp-imza.mjs) aynı dosyayı kullanır: yalnız Web Crypto.

const enc = new TextEncoder();

// Sabit zamanlı karşılaştırma: uzunluk farkı dışında içerik hakkında zaman bilgisi sızdırmaz.
export function esitMi(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let fark = 0;
  for (let i = 0; i < a.length; i++) fark |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return fark === 0;
}

export async function hmacHex(secret: string, govde: Uint8Array | string): Promise<string> {
  const anahtar = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const imza = new Uint8Array(await crypto.subtle.sign("HMAC", anahtar, typeof govde === "string" ? enc.encode(govde) : govde));
  return Array.from(imza, b => b.toString(16).padStart(2, "0")).join("");
}

// Meta, ham gövdenin (bayt olarak; metne çevirmeden) App Secret ile HMAC-SHA256'sını "X-Hub-Signature-256: sha256=<hex>" başlığında gönderir.
// Secret tanımsızsa her istek reddedilir (yanlışlıkla açık kalmasın).
export async function imzaGecerli(secret: string, govde: Uint8Array | string, baslik: string | null): Promise<boolean> {
  if (!secret || !baslik) return false;
  const m = /^sha256=([0-9a-fA-F]{64})$/.exec(baslik.trim());
  if (!m) return false;
  return esitMi(m[1].toLowerCase(), await hmacHex(secret, govde));
}

// GET abonelik doğrulaması: doğrulama metni tanımsız/boşsa her zaman reddedilir.
export function abonelikGecerli(verify: string, mod: string | null, token: string | null): boolean {
  return !!verify && mod === "subscribe" && token !== null && esitMi(token, verify);
}
