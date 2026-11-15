// Lead z dema: zapis (cust_demo_lead), SMS do testującego z linkiem do podglądu kuchni (raz na dobę),
// e-mail (lead-mail) i SMS do Sell-UP, gdy ktoś ma albo planuje lokal (app_secrets.lead_phone).
// verify_jwt=false: dostęp sprawdza RPC po tokenie sesji klienta.
import { createClient } from "jsr:@supabase/supabase-js@2";
const URL_ = Deno.env.get("SUPABASE_URL")!, SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(URL_, SRK, { auth: { persistSession: false } });
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const out = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const uuid = /^[0-9a-f-]{36}$/;

async function sms(to: string, message: string) {
  const token = Deno.env.get("SMSAPI_TOKEN"); if (!token) return false;
  const form = new URLSearchParams({ to: to.replace(/\D/g, "").replace(/^(\d{9})$/, "48$1"), message, format: "json", encoding: "utf-8" });
  const from = Deno.env.get("SMSAPI_FROM"); if (from) form.set("from", from);
  const r = await fetch("https://api.smsapi.pl/sms.do", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/x-www-form-urlencoded" }, body: form });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) { console.error("smsapi", r.status, JSON.stringify(j)); return false; }
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const b = await req.json();
    const token = String(b.token || ""), slug = String(b.slug || "").slice(0, 60);
    const order = uuid.test(b.order || "") ? b.order : null, track = uuid.test(b.track || "") ? b.track : null;
    const { data: res, error } = await db.rpc("cust_demo_lead", { p_token: token, p_slug: slug, p_venue: b.venue ?? null, p_consent: !!b.consent, p_order: order, p_track: track });
    if (error) return out({ ok: false, error: error.message, code: error.code }, 400);
    if (!res?.ok) return out({ ok: true, demo: false });
    const { data: lead } = await db.from("leads").select("*").eq("id", res.id).single();
    const done: Record<string, boolean> = {};
    // 1) SMS do testującego z linkiem do kuchni (raz na dobę na leada)
    if (track && order && !lead.sms_at) {
      const { data: o } = await db.from("orders").select("number").eq("id", order).single();
      const ok = await sms(lead.phone, `Sell-UP: zamowienie nr ${o?.number ?? ""} jest w kuchni. Zobacz je oczami lokalu: https://sell-up.pl/kuchnia/demo.html?t=${track}`);
      if (ok) await db.from("leads").update({ sms_at: new Date().toISOString() }).eq("id", lead.id);
      done.sms = ok;
    }
    // 2) e-mail do Sell-UP (lead-mail pilnuje, żeby był raz)
    if (res.new) fetch(`${URL_}/functions/v1/lead-mail`, { method: "POST", headers: { Authorization: `Bearer ${SRK}`, "Content-Type": "application/json" }, body: JSON.stringify({ id: lead.id }) }).catch(() => {});
    // 3) SMS do Sell-UP, gdy ma albo planuje lokal
    if (["tak", "planuje"].includes(lead.has_venue) && !lead.alert_at) {
      const { data: sec } = await db.from("app_secrets").select("value").eq("name", "lead_phone").maybeSingle();
      if (sec?.value) {
        const ok = await sms(sec.value, `Nowy lead z dema (${slug}): ${lead.name || "bez imienia"}, tel. ${String(lead.phone).replace(/^48/, "")}, ${lead.has_venue === "tak" ? "MA LOKAL" : "planuje lokal"}, zgoda na telefon: ${lead.consent ? "TAK" : "nie"}.`);
        if (ok) await db.from("leads").update({ alert_at: new Date().toISOString() }).eq("id", lead.id);
        done.alert = ok;
      }
    }
    return out({ ok: true, demo: true, ...done });
  } catch (e) {
    return out({ ok: false, error: String(e) }, 500);
  }
});
