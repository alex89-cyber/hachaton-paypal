import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { demoDbIds, demoIngredients, demoSeedSales } from "../demo-data";
import type { Dish, Ingredient } from "../inventory";
import { cashUp, type PaymentMethod, type Reservation, type ReservationStatus, type Sale, type StallState } from "../stall";
import type { ReserveResult, SaleResult, StallStore } from "./types";

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
  hold_minutes: number;
  updated_at: string;
};

type ReservationRow = {
  id: string;
  customer_name: string;
  total_cents: number;
  status: ReservationStatus;
  pickup_by: string;
  created_at: string;
  paypal_order_id: string | null;
  paypal_authorization_id: string | null;
  reservation_items: { dish_id: string; qty: number }[];
};

const RESERVATION_COLS =
  "id, customer_name, total_cents, status, pickup_by, created_at, paypal_order_id, paypal_authorization_id, reservation_items(dish_id, qty)";

const toReservation = (r: ReservationRow): Reservation => ({
  id: r.id,
  customerName: r.customer_name,
  totalCents: r.total_cents,
  status: r.status,
  pickupBy: new Date(r.pickup_by).toISOString(),
  createdAt: new Date(r.created_at).toISOString(),
  paypalOrderId: r.paypal_order_id,
  paypalAuthorizationId: r.paypal_authorization_id,
  lines: r.reservation_items.map((l) => ({ dishId: l.dish_id, qty: l.qty })),
});

/** Maps the stock functions' errors to the reasons the screens understand. */
function stockError(error: { message: string; details?: string }): { reason: "closed" | "short"; short: string[] } | null {
  if (error.message.includes("closed")) return { reason: "closed", short: [] };
  if (error.message.includes("insufficient_stock")) {
    const detail = error.details ?? "";
    return { reason: "short", short: detail && detail !== "sold_out" ? detail.split(",") : [] };
  }
  return null;
}

async function businessBySlug(slug: string): Promise<BusinessRow | null> {
  return check(await db().from("businesses").select("*").eq("slug", slug).maybeSingle(), "business");
}

async function load(b: BusinessRow): Promise<StallState> {
  const recent = new Date(Date.now() - 24 * 3600_000).toISOString();
  const [ingRes, dishRes, dayRes, resRes] = await Promise.all([
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
    db().from("reservations").select(RESERVATION_COLS).eq("business_id", b.id).gte("created_at", recent).order("created_at"),
  ]);
  const reservations = ((check(resRes, "reservations") ?? []) as ReservationRow[]).map(toReservation);

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
    holdMinutes: b.hold_minutes,
    reservations,
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
      const e = stockError(r.error);
      if (e) return { ok: false, ...e };
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
    check(await db().from("reservations").delete().eq("business_id", b.id), "clear reservations");
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

  async reserve(slug, customerName, lines, pickupBy): Promise<ReserveResult> {
    const b = await must(slug);
    const r = await db().rpc("reserve", {
      p_business: b.id,
      p_customer: customerName,
      p_lines: toDbLines(lines),
      p_pickup_by: pickupBy.toISOString(),
    });
    if (r.error) {
      const e = stockError(r.error);
      if (e) return { ok: false, ...e };
      throw new Error(`Supabase reserve: ${r.error.message}`);
    }
    const created = await this.getReservation(slug, r.data as string);
    if (!created) throw new Error("Supabase reserve: reservation not found after insert");
    return { ok: true, reservation: created };
  },

  async getReservation(slug, id) {
    const b = await must(slug);
    const row = check(
      await db().from("reservations").select(RESERVATION_COLS).eq("id", id).eq("business_id", b.id).maybeSingle(),
      "reservation",
    ) as ReservationRow | null;
    return row ? toReservation(row) : null;
  },

  async setPayPalOrder(slug, id, orderId) {
    const b = await must(slug);
    check(
      await db().from("reservations").update({ paypal_order_id: orderId }).eq("id", id).eq("business_id", b.id),
      "set order",
    );
  },

  async markAuthorized(slug, id, authorizationId) {
    const b = await must(slug);
    check(
      await db()
        .from("reservations")
        .update({ status: "authorized", paypal_authorization_id: authorizationId, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("business_id", b.id)
        .eq("status", "held"),
      "authorize",
    );
    check(await db().from("businesses").update({ updated_at: new Date().toISOString() }).eq("id", b.id), "touch");
  },

  async markDelivered(slug, id) {
    await must(slug);
    const saleId = check(await db().rpc("deliver_reservation", { p_reservation: id }), "deliver");
    return saleId != null;
  },

  async release(slug, id, status) {
    await must(slug);
    return Boolean(check(await db().rpc("release_reservation", { p_reservation: id, p_status: status }), "release"));
  },
};
