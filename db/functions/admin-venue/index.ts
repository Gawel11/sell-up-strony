// Nowy lokal (tylko admin Sell-UP): restauracja + menu skopiowane z dema danej branży + konto właściciela.
// Wywołanie z panelu z tokenem zalogowanego admina (verify_jwt=true).
import { createClient } from "jsr:@supabase/supabase-js@2";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const out = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

// branża -> demo, z którego kopiujemy menu i wygląd; strona: gotowy szablon z ?l=slug albo (na razie) brak
const TPL: Record<string, { from: string; page?: string }> = {
  kebab: { from: "zar", page: "/kebab/?l=" },
  pizza: { from: "forno450", page: "/pizza/?l=" },
  burger: { from: "dym-burger" },
  obiady: { from: "obiady-domowe" },
  piekarnia: { from: "bulkaikromka" },
  inne: { from: "bubble-tea" },
};
const PL: Record<string, string> = { "ą": "a", "ć": "c", "ę": "e", "ł": "l", "ń": "n", "ó": "o", "ś": "s", "ź": "z", "ż": "z" };
const slugify = (s: string) => s.toLowerCase().replace(/[ąćęłńóśźż]/g, (c) => PL[c]).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
const pass = () => { const a = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789"; const r = crypto.getRandomValues(new Uint8Array(12)); return Array.from(r, (x) => a[x % a.length]).join(""); };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer /, "");
    const { data: u } = await db.auth.getUser(jwt);
    if (!u?.user) return out({ error: "Zaloguj się ponownie" }, 401);
    const { data: adm } = await db.from("app_admins").select("user_id").eq("user_id", u.user.id).maybeSingle();
    if (!adm) return out({ error: "Tylko administrator Sell-UP" }, 403);

    const b = await req.json();
    const name = String(b.name || "").trim().slice(0, 80);
    const module = String(b.module || "");
    const tpl = TPL[module];
    if (name.length < 2) return out({ error: "Podaj nazwę lokalu" }, 400);
    if (!tpl) return out({ error: "Wybierz branżę" }, 400);
    const plan = ["start", "pro", "pro_ai"].includes(b.plan) ? b.plan : "pro";
    const email = String(b.email || "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return out({ error: "Podaj e-mail właściciela (login do panelu)" }, 400);
    let slug = slugify(String(b.slug || "") || name);
    if (slug.length < 3) return out({ error: "Adres strony za krótki" }, 400);
    const { data: taken } = await db.from("restaurants").select("slug").like("slug", slug + "%");
    if (taken?.some((t) => t.slug === slug)) { let i = 2; while (taken.some((t) => t.slug === `${slug}-${i}`)) i++; slug = `${slug}-${i}`; }

    // wzór z dema
    const { data: src } = await db.from("restaurants").select("*").eq("slug", tpl.from).single();
    const st = { ...(src.settings || {}) } as Record<string, unknown>;
    delete st.demo; delete st.alarm_phone; delete st.promo; delete st.dish;
    st.plan = plan;
    st.brand = { ...((st.brand as Record<string, unknown>) || {}), name, sub: "" };
    if (b.city) st.city = String(b.city).slice(0, 60);
    const phone = String(b.phone || "").trim().slice(0, 20) || null;
    const { data: rest, error: e1 } = await db.from("restaurants").insert({
      slug, name, module: src.module, phone, address: String(b.address || "").trim().slice(0, 200) || null,
      delivery_fee: src.delivery_fee, free_delivery_from: src.free_delivery_from, min_order: src.min_order, is_open: true, settings: st,
    }).select("id, slug").single();
    if (e1) return out({ error: "Nie udało się utworzyć lokalu: " + e1.message }, 400);

    // menu
    const { data: menu } = await db.from("menu_items").select("kind, code, category, name, description, price, variants, data, max_qty, active, sort").eq("restaurant_id", src.id);
    if (menu?.length) await db.from("menu_items").insert(menu.map((m) => ({ ...m, restaurant_id: rest.id })));

    // konto właściciela (nowe albo istniejące)
    let uid: string | null = null, password: string | null = null, existed = false;
    const pw = String(b.password || "") || pass();
    const { data: cu, error: e2 } = await db.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: { name: b.owner || null } });
    if (cu?.user) { uid = cu.user.id; password = pw; }
    else {
      for (let page = 1; page <= 20 && !uid; page++) {
        const { data: l } = await db.auth.admin.listUsers({ page, perPage: 200 });
        const f = l?.users?.find((x) => (x.email || "").toLowerCase() === email); if (f) { uid = f.id; existed = true; }
        if (!l?.users?.length || l.users.length < 200) break;
      }
      if (!uid) return out({ error: "Lokal utworzony, ale konto właściciela nie: " + (e2?.message || "błąd"), slug }, 400);
    }
    await db.from("restaurant_staff").upsert([{ restaurant_id: rest.id, user_id: uid, role: "owner" }, { restaurant_id: rest.id, user_id: u.user.id, role: "owner" }], { onConflict: "restaurant_id,user_id" });

    return out({ ok: true, slug, id: rest.id, page: tpl.page ? tpl.page + slug : null, email, password, existed, menu: menu?.length || 0 });
  } catch (e) {
    return out({ error: String(e) }, 500);
  }
});
