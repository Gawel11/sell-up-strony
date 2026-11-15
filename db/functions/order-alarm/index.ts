// Alarm: zamówienie czeka > 4 min bez przyjęcia -> SMS do lokalu (settings.alarm_phone albo telefon lokalu; dema tylko z alarm_phone).
// Wywoływane co minutę przez pg_cron z nagłówkiem x-hook.
import { createClient } from "jsr:@supabase/supabase-js@2";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const out = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  const { data: sec } = await db.from("app_secrets").select("value").eq("name", "push_hook").single();
  if (!sec || req.headers.get("x-hook") !== sec.value) return out({ error: "Brak dostępu" }, 403);
  const token = Deno.env.get("SMSAPI_TOKEN"); if (!token) return out({ ok: false, error: "brak SMSAPI_TOKEN" });
  const now = Date.now();
  const { data: rows } = await db.from("orders").select("id,number,created_at,restaurant_id,restaurants(name,phone,settings)")
    .eq("status", "new").is("alarm_at", null)
    .lt("created_at", new Date(now - 4 * 60e3).toISOString()).gt("created_at", new Date(now - 2 * 3600e3).toISOString()).limit(50);
  const byRest = new Map<string, { ids: string[]; nums: number[]; name: string; phone: string }>();
  for (const o of rows || []) {
    const r = o.restaurants as unknown as { name: string; phone: string | null; settings: Record<string, unknown> };
    const s = (r.settings || {}) as { demo?: boolean; alarm_phone?: string; alarm_sms?: boolean };
    if (s.alarm_sms === false) continue;
    const phone = s.alarm_phone || (s.demo ? null : r.phone);
    if (!phone) continue;
    const e = byRest.get(o.restaurant_id) || { ids: [], nums: [], name: r.name, phone };
    e.ids.push(o.id); e.nums.push(o.number); byRest.set(o.restaurant_id, e);
  }
  let sent = 0;
  for (const [, e] of byRest) {
    const to = e.phone.replace(/\D/g, "").replace(/^(\d{9})$/, "48$1");
    const msg = `${e.name}: ${e.nums.length === 1 ? "zamówienie nr " + e.nums[0] + " czeka" : "zamówienia nr " + e.nums.join(", ") + " czekają"} ponad 4 min i nikt ich nie przyjął. Sprawdź panel kuchni.`;
    const form = new URLSearchParams({ to, message: msg, format: "json", encoding: "utf-8" });
    const from = Deno.env.get("SMSAPI_FROM"); if (from) form.set("from", from);
    const r = await fetch("https://api.smsapi.pl/sms.do", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/x-www-form-urlencoded" }, body: form });
    const j = await r.json().catch(() => ({}));
    if (r.ok && !j.error) sent++; else console.error("smsapi", r.status, JSON.stringify(j));
    await db.from("orders").update({ alarm_at: new Date().toISOString() }).in("id", e.ids);
  }
  return out({ ok: true, sent });
});
