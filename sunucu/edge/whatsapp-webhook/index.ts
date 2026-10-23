// MuhaWin · WhatsApp Business Cloud API webhook (Supabase Edge Function)
// Kurulum: supabase functions deploy whatsapp-webhook --no-verify-jwt
// Secrets:  WA_TOKEN (Meta kalıcı erişim belirteci), WA_VERIFY_TOKEN (Meta panelinde yazdığınız doğrulama metni)
//           SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY otomatik gelir.
// Meta → WhatsApp → Configuration → Webhook: Callback URL = https://<proje>.supabase.co/functions/v1/whatsapp-webhook
// Alan: messages. Mükellefin gönderdiği fotoğraf / belge indirilir, "wa-fisler" kovasına yazılır, wa_gelen'e eklenir,
// mükellefe kısa "alındı" yanıtı gider (servis mesajı; numara başına ayda 1.000 ücretsiz).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const TOKEN = Deno.env.get("WA_TOKEN") ?? "";
const VERIFY = Deno.env.get("WA_VERIFY_TOKEN") ?? "";
const GRAPH = "https://graph.facebook.com/v21.0";

async function medyaIndir(id: string): Promise<{ buf: Uint8Array; mime: string } | null> {
  const m = await fetch(`${GRAPH}/${id}`, { headers: { Authorization: `Bearer ${TOKEN}` } });
  if (!m.ok) return null;
  const j = await m.json();
  const r = await fetch(j.url, { headers: { Authorization: `Bearer ${TOKEN}` } });
  if (!r.ok) return null;
  return { buf: new Uint8Array(await r.arrayBuffer()), mime: j.mime_type || r.headers.get("content-type") || "image/jpeg" };
}
async function yanitla(phoneId: string, to: string, text: string) {
  try {
    await fetch(`${GRAPH}/${phoneId}/messages`, { method: "POST", headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: text } }) });
  } catch (_) { /* yanıt gitmezse akış bozulmaz */ }
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (req.method === "GET") {           // Meta webhook doğrulaması
    if (url.searchParams.get("hub.mode") === "subscribe" && url.searchParams.get("hub.verify_token") === VERIFY)
      return new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200 });
    return new Response("doğrulama başarısız", { status: 403 });
  }
  if (req.method !== "POST") return new Response("", { status: 405 });
  let body: any; try { body = await req.json(); } catch { return new Response("", { status: 400 }); }
  let alinan = 0;
  for (const entry of body.entry ?? []) for (const ch of entry.changes ?? []) {
    const v = ch.value ?? {}; const phoneId = v.metadata?.phone_number_id;
    if (!phoneId) continue;
    const { data: num } = await sb.from("wa_numaralar").select("office_id").eq("phone_number_id", phoneId).maybeSingle();
    if (!num) continue;                 // bu numara bir ofise bağlı değil
    const adlar: Record<string, string> = {};
    for (const c of v.contacts ?? []) adlar[c.wa_id] = c.profile?.name ?? "";
    for (const msg of v.messages ?? []) {
      const from = msg.from as string; const ad = adlar[from] ?? "";
      const medya = msg.image ?? msg.document ?? null;
      const metin = msg.text?.body ?? medya?.caption ?? "";
      if (!medya) {                     // yalnız yazı: bilgi ver
        if (metin) await yanitla(phoneId, from, "Merhaba, bu numaraya fiş ve belgelerinizin fotoğrafını gönderebilirsiniz; muhasebe ofisiniz MuhaWin ile işleyecektir.");
        continue;
      }
      const { data: var_ } = await sb.from("wa_gelen").select("id").eq("wa_mesaj_id", msg.id).maybeSingle();
      if (var_) continue;               // tekrar gönderilen webhook
      const m = await medyaIndir(medya.id);
      if (!m) continue;
      const uz = (m.mime.split("/")[1] || "jpg").replace("jpeg", "jpg").split(";")[0];
      const yol = `${num.office_id}/${crypto.randomUUID()}.${uz}`;
      const up = await sb.storage.from("wa-fisler").upload(yol, m.buf, { contentType: m.mime, upsert: false });
      if (up.error) continue;
      await sb.from("wa_gelen").insert({ office_id: num.office_id, wa_mesaj_id: msg.id, telefon: from, gonderen_ad: ad, metin, mime: m.mime, dosya: yol,
        zaman: msg.timestamp ? new Date(Number(msg.timestamp) * 1000).toISOString() : new Date().toISOString() });
      alinan++;
    }
    if (alinan) { const from = v.messages?.[0]?.from; if (from) await yanitla(phoneId, from, alinan === 1 ? "Fişiniz alındı, teşekkürler. ✅" : `${alinan} fiş alındı, teşekkürler. ✅`); }
  }
  return new Response(JSON.stringify({ ok: true, alinan }), { headers: { "Content-Type": "application/json" } });
});
