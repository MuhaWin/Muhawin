// MuhaWin · bekleyen WhatsApp fişlerini MuhaWin'e ver (Supabase Edge Function, kullanıcı JWT'si ile)
// Kurulum: supabase functions deploy whatsapp-al
// GET  → ofisin alınmamış fişleri, her biri için 10 dakikalık imzalı indirme adresi
// POST {ids:[...]} → alındı işaretle
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const URL_ = Deno.env.get("SUPABASE_URL")!;
const SERVICE = createClient(URL_, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

Deno.serve(async (req) => {
  const auth = req.headers.get("Authorization") ?? "";
  const user = createClient(URL_, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: me } = await user.auth.getUser();
  if (!me?.user) return new Response(JSON.stringify({ error: "Giriş gerekli" }), { status: 401, headers: { "Content-Type": "application/json" } });
  if (req.method === "POST") {
    const b = await req.json().catch(() => ({}));
    const { data, error } = await user.rpc("wa_alindi", { p_ids: b.ids ?? [] });
    return new Response(JSON.stringify({ ok: !error, adet: data ?? 0, error: error?.message }), { headers: { "Content-Type": "application/json" } });
  }
  const { data: rows, error } = await user.rpc("wa_bekleyenler");
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { "Content-Type": "application/json" } });
  const out = [];
  for (const r of rows ?? []) {
    const s = await SERVICE.storage.from("wa-fisler").createSignedUrl(r.dosya, 600);
    out.push({ id: r.id, telefon: r.telefon, ad: r.gonderen_ad, metin: r.metin, mime: r.mime, zaman: r.zaman, url: s.data?.signedUrl ?? null });
  }
  return new Response(JSON.stringify({ fisler: out }), { headers: { "Content-Type": "application/json" } });
});
