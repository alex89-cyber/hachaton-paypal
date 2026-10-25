import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { demoDbIds, demoIngredients, demoSeedSales } from "../demo-data";
import type { Dish, Ingredient } from "../inventory";
import { cashUp, type PaymentMethod, type Sale, type StallState } from "../stall";
import type { SaleResult, StallStore } from "./types";

// Supabase-backed store. Runs on the server with the secret key; stock moves go
// through the SQL functions in supabase/migrations so they stay atomic.

let client: SupabaseClient | null = null;

function db(): SupabaseClient {
  return (client ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  }));
}

function check<T>(r: { data: T; error: { message: string } | null }, what: string): T {
  if (r.error) throw new Error(`Supabase ${what}: ${r.error.message}`);
  return r.data;
}

type BusinessRow = {
  id: string;
  slug: string;
  name: string;
  currency: string;
  timezone: string;
  is_open: boolean;
  updated_at: string;
};

async function businessBySlug(slug: string): Promise<BusinessRow | null> {
  return check(await db().from("businesses").select("*").eq("slug", slug).maybeSingle(), "business");
}

async function load(b: BusinessRow): Promise<StallState> {
  const [ingRes, dishRes, dayRes] = await Promise.all([
    db().from("ingredients").select("id, name, unit, stock").eq("business_id", b.id).order("name"),
    db()
      .from("dishes")
      .select("id, name_es, name_en, price_cents, sold_out, sort, recipe_items(ingredient_id, qty)")
      .eq("business_id", b.id)
      .order("sort"),
    db()
      .from("days")
      .select("id, opened_at, opening_count")
      .eq("business_id", b.id)
      .is("closed_at", null)
      .order("opened_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const ingredients: Ingredient[] = (check(ingRes, "ingredients") ?? []).map((i) => ({
    id: i.id,
    name: i.name,
    unit: i.unit,
    stock: Number(i.stock),
  }));
  const dishes: Dish[] = (check(dishRes, "dishes") ?? []).map((d) => ({
    id: d.id,
    nameEs: d.name_es,
    nameEn: d.name_en,
    priceCents: d.price_cents,
    soldOut: d.sold_out,
    recipe: (d.recipe_items as { ingredient_id: string; qty: number }[]).map((r) => ({
      ingredientId: r.ingredient_id,
      qty: Number(r.qty),
    })),
  }));
  const day = check(dayRes, "day") as { id: string; opened_at: string; opening_count: Record<string, number> } | null;

  let sales: Sale[] = [];
  if (day) {
    const rows = check(
      await db()
        .from("sales")
        .select("id, method, total_cents, created_at, sale_items(dish_id, qty)")
        .eq("day_id", day.id)
        .order("created_at"),
      "sales",
    );
    sales = (rows ?? []).map((s) => ({
      id: s.id,
      method: s.method as PaymentMethod,
      totalCents: s.total_cents,
      at: new Date(s.created_at).toISOString(),
      lines: (s.sale_items as { dish_id: string; qty: number }[]).map((l) => ({ dishId: l.dish_id, qty: l.qty })),
    }));
  }

  return {
    slug: b.slug,
    name: b.name,
    currency: b.currency,
    timezone: b.timezone,
    isOpen: b.is_open,
    openedAt: day?.opened_at ? new Date(day.opened_at).toISOString() : null,
    updatedAt: new Date(b.updated_at).toISOString(),
    dishes,
    ingredients,
    openingCount: Object.fromEntries(Object.entries(day?.opening_count ?? {}).map(([k, v]) => [k, Number(v)])),
    sales,
  };
}

async function must(slug: string): Promise<BusinessRow> {
  const b = await businessBySlug(slug);
  if (!b) throw new Error(`Unknown stall ${slug}`);
  return b;
}

const toDbLines = (lines: { dishId: string; qty: number }[]) => lines.map((l) => ({ dish_id: l.dishId, qty: l.qty }));

export const supabaseStore: StallStore = {
  async get(slug) {
    const b = await businessBySlug(slug);
    return b ? load(b) : null;
  },

  async open(slug, counts) {
    const b = await must(slug);
    check(await db().rpc("open_day", { p_business: b.id, p_counts: counts }), "open_day");
    return load(await must(slug));
  },

  async close(slug) {
    const before = await load(await must(slug));
    const summary = cashUp(before);
    check(await db().rpc("close_day", { p_business: (await must(slug)).id }), "close_day");
    return { state: await load(await must(slug)), cashUp: summary };
  },

  async recordSale(slug, lines, method): Promise<SaleResult> {
    const b = await must(slug);
    const r = await db().rpc("record_sale", { p_business: b.id, p_lines: toDbLines(lines), p_method: method });
    if (r.error) {
      if (r.error.message.includes("closed")) return { ok: false, reason: "closed" };
      if (r.error.message.includes("insufficient_stock")) {
        const detail = (r.error as { details?: string }).details ?? "";
        return { ok: false, reason: "short", short: detail && detail !== "sold_out" ? detail.split(",") : [] };
      }
      throw new Error(`Supabase record_sale: ${r.error.message}`);
    }
    return { ok: true, state: await load(await must(slug)) };
  },

  async setSoldOut(slug, dishId, soldOut) {
    const b = await must(slug);
    check(await db().from("dishes").update({ sold_out: soldOut }).eq("id", dishId).eq("business_id", b.id), "sold_out");
    check(await db().from("businesses").update({ updated_at: new Date().toISOString() }).eq("id", b.id), "touch");
    return load(await must(slug));
  },

  async reset(slug) {
    const b = await must(slug);
    if (b.id !== demoDbIds.business) return load(b);

    // Back to the morning of the demo: full stock, opened, then the seeded sales
    // with their timestamps moved into the past so the forecast has a pace.
    check(await db().from("sales").delete().eq("business_id", b.id), "clear sales");
    check(await db().from("days").delete().eq("business_id", b.id), "clear days");
    const counts = Object.fromEntries(demoIngredients.map((i) => [demoDbIds.ingredients[i.id], i.stock]));
    check(await db().rpc("open_day", { p_business: b.id, p_counts: counts }), "open_day");

    const now = Date.now();
    for (const seed of demoSeedSales()) {
      const lines = [{ dish_id: demoDbIds.dishes[seed.dishId], qty: seed.qty }];
      const saleId = check(
        await db().rpc("record_sale", { p_business: b.id, p_lines: lines, p_method: seed.method }),
        "seed sale",
      ) as string;
      check(
        await db()
          .from("sales")
          .update({ created_at: new Date(now - seed.minutesAgo * 60_000).toISOString() })
          .eq("id", saleId),
        "seed time",
      );
    }
    check(
      await db()
        .from("days")
        .update({ opened_at: new Date(now - 90 * 60_000).toISOString() })
        .eq("business_id", b.id)
        .is("closed_at", null),
      "seed day",
    );
    return load(await must(slug));
  },
};
