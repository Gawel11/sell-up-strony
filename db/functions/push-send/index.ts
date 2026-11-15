// Powiadomienia push. type=order (z wyzwalacza bazy, nagłówek x-hook) albo type=broadcast (właściciel z panelu, JWT).
import webpush from "npm:web-push@3.6.7";
import { createClient } from "jsr:@supabase/supabase-js@2";

const URL_ = Deno.env.get("SUPABASE_URL")!, SRV = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const db = createClient(URL_, SRV, { auth: { persistSession: false } });
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const out = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const PAGE: Record<string, string> = { "bubble-tea": "bubble-tea", "forno450": "pizza", "zar": "kebab", "dym-burger": "dym-burger", "obiady-domowe": "obiady-domowe", "bulkaikromka": "bulkaikromka" };

let S: Record<string, string> | null = null;
async function secrets() {
  if (S) return S;
  const { data } = await db.from("app_secrets").select("name,value");
  S = Object.fromEntries((data || []).map((r: { name: string; value: string }) => [r.name, r.value]));
  webpush.setVapidDetails(S.vapid_subject, S.vapid_public, S.vapid_private);
  return S;
}
function siteUrl(r: { slug: string; settings: Record<string, unknown> }) {
  const u = (r.settings as { site_url?: string })?.site_url;
  return u || `https://sell-up.pl/${PAGE[r.slug] || r.slug}/`;
}
async function sendAll(subs: { id: number; endpoint: string; p256dh: string; auth: string }[], payload: Record<string, unknown>) {
  let ok = 0; const dead: number[] = [], good: number[] = [];
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 3600, urgency: "high" });
      ok++; good.push(s.id);
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) dead.push(s.id); else console.error("push", code, String(e).slice(0, 200));
    }
  }));
  if (dead.length) await db.from("push_subscriptions").delete().in("id", dead);
  if (good.length) await db.from("push_subscriptions").update({ last_ok: new Date().toISOString() }).in("id", good);
  return ok;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  let b: Record<string, string> = {};
  try { b = await req.json(); } catch { return out({ error: "Złe dane" }, 400); }
  const sec = await secrets();

  if (b.type === "order") {
    if (req.headers.get("x-hook") !== sec.push_hook) return out({ error: "Brak dostępu" }, 403);
    const { data: o } = await db.from("orders").select("id,number,status,mode,customer_id,restaurant_id,restaurants(name,slug,settings)").eq("id", b.order_id).single();
    if (!o || !o.customer_id) return out({ ok: true, sent: 0 });
    const r = o.restaurants as unknown as { name: string; slug: string; settings: Record<string, unknown> };
    const M: Record<string, [string, string]> = {
      cooking: [`Zamówienie nr ${o.number} przyjęte`, "Już przygotowujemy. Damy znać, gdy będzie gotowe."],
      ready: o.mode === "delivery" ? [`Zamówienie nr ${o.number} gotowe`, "Zaraz wyjedzie do Ciebie."] : [`Nr ${o.number} gotowe do odbioru! 🎉`, "Podejdź do lady i podaj numer."],
      delivering: [`Zamówienie nr ${o.number} w drodze 🛵`, "Kierowca już do Ciebie jedzie."],
      cancelled: [`Zamówienie nr ${o.number} anulowane`, "Zadzwoń do lokalu, jeśli to pomyłka."],
    };
    const m = M[o.status]; if (!m) return out({ ok: true, sent: 0 });
    const { data: subs } = await db.from("push_subscriptions").select("id,endpoint,p256dh,auth").eq("customer_id", o.customer_id).eq("restaurant_id", o.restaurant_id);
    const sent = await sendAll(subs || [], { title: m[0], body: m[1], url: siteUrl(r), tag: "order-" + o.id, venue: r.name });
    return out({ ok: true, sent });
  }

  if (b.type === "broadcast") {
    const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const user = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${jwt}` } }, auth: { persistSession: false } });
    const { data: okM } = await user.rpc("is_manager", { rid: b.restaurant_id });
    if (okM !== true) return out({ error: "Tylko właściciel lub manager może wysyłać wiadomości" }, 403);
    const title = String(b.title || "").trim().slice(0, 60), body = String(b.body || "").trim().slice(0, 180);
    if (title.length < 2 || body.length < 2) return out({ error: "Wpisz tytuł i treść" }, 400);
    const { data: last } = await db.from("push_campaigns").select("created_at").eq("restaurant_id", b.restaurant_id).order("created_at", { ascending: false }).limit(1);
    if (last?.[0] && Date.now() - new Date(last[0].created_at).getTime() < 10 * 60e3) return out({ error: "Następną wiadomość możesz wysłać za kilka minut" }, 429);
    const { data: r } = await db.from("restaurants").select("name,slug,settings").eq("id", b.restaurant_id).single();
    if (!r) return out({ error: "Nie ma takiego lokalu" }, 404);
    const { data: subs } = await db.from("push_subscriptions").select("id,endpoint,p256dh,auth").eq("restaurant_id", b.restaurant_id);
    const sent = await sendAll(subs || [], { title, body, url: siteUrl(r), tag: "promo-" + Date.now(), venue: r.name });
    await db.from("push_campaigns").insert({ restaurant_id: b.restaurant_id, title, body, sent });
    return out({ ok: true, sent, total: (subs || []).length });
  }
  return out({ error: "Nieznany typ" }, 400);
});
