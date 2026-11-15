// Logowanie klienta kodem SMS (SMSAPI). Akcje: send {phone, venue}, verify {phone, code}.
// Zwraca token sesji; dalsze operacje przez RPC cust_* z tym tokenem.
import { createClient } from "jsr:@supabase/supabase-js@2";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const out = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

async function sha(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
function normPhone(p: string) {
  let d = String(p || "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 9) d = "48" + d;
  return /^[0-9]{10,15}$/.test(d) ? d : null;
}
const PEPPER = Deno.env.get("OTP_PEPPER") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!.slice(-24);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return out({ error: "Metoda niedozwolona" }, 405);
  let body: Record<string, string> = {};
  try { body = await req.json(); } catch { return out({ error: "Złe dane" }, 400); }
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "?";
  const phone = normPhone(body.phone);
  if (!phone) return out({ error: "Podaj poprawny numer telefonu" }, 400);

  if (body.action === "send") {
    const token = Deno.env.get("SMSAPI_TOKEN");
    if (!token) return out({ error: "Logowanie SMS nie jest jeszcze włączone" }, 503);
    const since10 = new Date(Date.now() - 10 * 60e3).toISOString();
    const since60 = new Date(Date.now() - 60 * 60e3).toISOString();
    const [{ count: perPhone }, { count: perIp }, { data: last }] = await Promise.all([
      db.from("otp_codes").select("id", { count: "exact", head: true }).eq("phone", phone).gte("created_at", since10),
      db.from("otp_codes").select("id", { count: "exact", head: true }).eq("ip", ip).gte("created_at", since60),
      db.from("otp_codes").select("created_at").eq("phone", phone).order("created_at", { ascending: false }).limit(1),
    ]);
    if ((perPhone ?? 0) >= 3) return out({ error: "Za dużo prób. Spróbuj za 10 minut." }, 429);
    if ((perIp ?? 0) >= 10) return out({ error: "Za dużo prób. Spróbuj za godzinę." }, 429);
    if (last?.[0] && Date.now() - new Date(last[0].created_at).getTime() < 45e3)
      return out({ error: "Kod został już wysłany. Poczekaj chwilę." }, 429);

    const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");
    const venue = String(body.venue || "").replace(/[^\p{L}\p{N} &.'-]/gu, "").slice(0, 30);
    const msg = `Twój kod logowania${venue ? " do " + venue : ""}: ${code}. Ważny 5 minut.\n\n@sell-up.pl #${code}`;
    const form = new URLSearchParams({ to: phone, message: msg, format: "json", encoding: "utf-8" });
    const from = Deno.env.get("SMSAPI_FROM");
    if (from) form.set("from", from);
    const r = await fetch("https://api.smsapi.pl/sms.do", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) {
      console.error("smsapi", r.status, JSON.stringify(j));
      return out({ error: "Nie udało się wysłać SMS. Spróbuj za chwilę." }, 502);
    }
    await db.from("otp_codes").insert({ phone, code_hash: await sha(PEPPER + phone + code), ip });
    return out({ ok: true });
  }

  if (body.action === "verify") {
    const code = String(body.code || "").replace(/\D/g, "");
    if (code.length !== 6) return out({ error: "Wpisz 6 cyfr z SMS" }, 400);
    const { data: rows } = await db.from("otp_codes").select("*").eq("phone", phone).eq("used", false)
      .gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }).limit(1);
    const row = rows?.[0];
    if (!row) return out({ error: "Kod wygasł. Wyślij nowy." }, 400);
    if (row.attempts >= 5) return out({ error: "Za dużo błędnych prób. Wyślij nowy kod." }, 429);
    if (row.code_hash !== await sha(PEPPER + phone + code)) {
      await db.from("otp_codes").update({ attempts: row.attempts + 1 }).eq("id", row.id);
      return out({ error: "Błędny kod" }, 400);
    }
    await db.from("otp_codes").update({ used: true }).eq("id", row.id);
    let { data: cust } = await db.from("customers").select("id,name,code").eq("phone", phone).maybeSingle();
    if (!cust) {
      const ins = await db.from("customers").insert({ phone }).select("id,name,code").single();
      if (ins.error) {
        const again = await db.from("customers").select("id,name,code").eq("phone", phone).single();
        cust = again.data;
      } else cust = ins.data;
    }
    if (!cust) return out({ error: "Coś poszło nie tak. Spróbuj ponownie." }, 500);
    const raw = crypto.getRandomValues(new Uint8Array(32));
    const session = [...raw].map((x) => x.toString(16).padStart(2, "0")).join("");
    await db.from("customer_sessions").insert({ token_hash: await sha(session), customer_id: cust.id });
    return out({ token: session, name: cust.name, code: cust.code });
  }

  return out({ error: "Nieznana akcja" }, 400);
});
