import { demoDishes, demoIngredients, demoSeedSales } from "../demo-data";
import { canFulfill, deduct, orderTotalCents, restore } from "../inventory";
import { cashUp, isActive, type Reservation, type Sale, type StallState, type StampCard } from "../stall";
import type { StallStore, Watch } from "./types";

// In-process store for the demo and for running without Supabase. State lives
// on globalThis so it survives hot reloads in dev; it resets on restart.

const DEMO_SLUG = "birria-dona-lupe";

/** A stall that opened 90 minutes ago and has been selling, so the forecast has data. */
export function seedDemo(now = new Date()): StallState {
  const openedAt = new Date(now.getTime() - 90 * 60_000);
  const sales: Sale[] = [];
  let ingredients = demoIngredients.map((i) => ({ ...i }));
  demoSeedSales().forEach((seed, k) => {
    const lines = [{ dishId: seed.dishId, qty: seed.qty }];
    ingredients = deduct(lines, demoDishes, ingredients);
    sales.push({
      id: `seed-${k}`,
      lines,
      method: seed.method,
      totalCents: orderTotalCents(lines, demoDishes),
      at: new Date(now.getTime() - seed.minutesAgo * 60_000).toISOString(),
    });
  });
  return {
    slug: DEMO_SLUG,
    name: "Birria Doña Lupe",
    currency: "MXN",
    timezone: "America/Mexico_City",
    isOpen: true,
    openedAt: openedAt.toISOString(),
    updatedAt: sales.at(-1)!.at,
    dishes: demoDishes.map((d) => ({ ...d, recipe: d.recipe.map((r) => ({ ...r })) })),
    ingredients,
    openingCount: Object.fromEntries(demoIngredients.map((i) => [i.id, i.stock])),
    sales,
    holdMinutes: 45,
    reservations: [],
    loyalty: { stampsPerReward: 10, rewardDishId: "quesabirria", stamps: {}, cards: [] },
  };
}

const g = globalThis as unknown as {
  __stalls?: Map<string, StallState>;
  __cards?: Map<string, StampCard & { slug: string }>;
  __watches?: Map<string, Watch[]>;
};
const stalls = (g.__stalls ??= new Map([[DEMO_SLUG, seedDemo()]]));
// Kept apart from the stall so "Reiniciar demo" does not wipe customers' cards.
const cards = (g.__cards ??= new Map<string, StampCard & { slug: string }>());
const watches = (g.__watches ??= new Map<string, Watch[]>());
const cardKey = (slug: string, payerId: string) => `${slug}\u0000${payerId}`;

const stampsOf = (slug: string, id: string) => cards.get(cardKey(slug, id))?.stamps ?? 0;

function stamp(slug: string, id: string, label: string | null, delta: number): number {
  const cur = cards.get(cardKey(slug, id));
  const next = {
    slug,
    id,
    label: label || cur?.label || null,
    stamps: (cur?.stamps ?? 0) + delta,
    updatedAt: new Date().toISOString(),
  };
  cards.set(cardKey(slug, id), next);
  return next.stamps;
}

/** The stall with its payers' current stamps and the recent cards filled in. */
function withStamps(s: StallState): StallState {
  const stamps: Record<string, number> = {};
  for (const r of s.reservations) if (r.payerId) stamps[r.payerId] = stampsOf(s.slug, r.payerId);
  const recent = [...cards.values()]
    .filter((c) => c.slug === s.slug)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 50)
    .map(({ id, label, stamps, updatedAt }) => ({ id, label, stamps, updatedAt }));
  s.loyalty = { ...s.loyalty, stamps, cards: recent };
  return s;
}

function must(slug: string): StallState {
  const s = stalls.get(slug);
  if (!s) throw new Error(`Unknown stall ${slug}`);
  return s;
}

function reservation(s: StallState, id: string): Reservation | undefined {
  return s.reservations.find((r) => r.id === id);
}

function save(s: StallState): StallState {
  s.updatedAt = new Date().toISOString();
  stalls.set(s.slug, s);
  return s;
}

export const memoryStore: StallStore = {
  async get(slug) {
    const s = stalls.get(slug);
    return s ? withStamps(s) : null;
  },

  async open(slug, counts) {
    const s = must(slug);
    s.ingredients = s.ingredients.map((i) => ({ ...i, stock: Math.max(0, counts[i.id] ?? i.stock) }));
    s.openingCount = Object.fromEntries(s.ingredients.map((i) => [i.id, i.stock]));
    s.dishes = s.dishes.map((d) => ({ ...d, soldOut: false }));
    s.sales = [];
    s.isOpen = true;
    s.openedAt = new Date().toISOString();
    return save(s);
  },

  async close(slug) {
    const s = must(slug);
    const summary = cashUp(s);
    s.isOpen = false;
    return { state: save(s), cashUp: summary };
  },

  async recordSale(slug, lines, method) {
    const s = must(slug);
    if (!s.isOpen) return { ok: false, reason: "closed" };
    const check = canFulfill(lines, s.dishes, s.ingredients);
    if (!check.ok) return { ok: false, reason: "short", short: check.shortIngredientIds };
    s.ingredients = deduct(lines, s.dishes, s.ingredients);
    s.sales.push({
      id: crypto.randomUUID(),
      lines,
      method,
      totalCents: orderTotalCents(lines, s.dishes),
      at: new Date().toISOString(),
    });
    return { ok: true, state: save(s) };
  },

  async setSoldOut(slug, dishId, soldOut) {
    const s = must(slug);
    s.dishes = s.dishes.map((d) => (d.id === dishId ? { ...d, soldOut } : d));
    return save(s);
  },

  async restock(slug, adds) {
    const s = must(slug);
    if (!s.isOpen) return { ok: false, reason: "closed" };
    const added = new Set(Object.entries(adds).filter(([, n]) => n > 0).map(([id]) => id));
    s.ingredients = s.ingredients.map((i) => (added.has(i.id) ? { ...i, stock: i.stock + adds[i.id] } : i));
    for (const id of added) s.openingCount[id] = (s.openingCount[id] ?? 0) + adds[id];
    s.dishes = s.dishes.map((d) => (d.recipe.some((r) => added.has(r.ingredientId)) ? { ...d, soldOut: false } : d));
    return { ok: true, state: withStamps(save(s)) };
  },

  async reset(slug) {
    if (slug !== DEMO_SLUG) return must(slug);
    return save(seedDemo());
  },

  async reserve(slug, customerName, lines, pickupBy) {
    const s = must(slug);
    if (!s.isOpen) return { ok: false, reason: "closed" };
    const check = canFulfill(lines, s.dishes, s.ingredients);
    if (!check.ok) return { ok: false, reason: "short", short: check.shortIngredientIds };
    s.ingredients = deduct(lines, s.dishes, s.ingredients);
    const r: Reservation = {
      id: crypto.randomUUID(),
      customerName,
      lines,
      totalCents: orderTotalCents(lines, s.dishes),
      status: "held",
      pickupBy: pickupBy.toISOString(),
      createdAt: new Date().toISOString(),
      paypalOrderId: null,
      paypalAuthorizationId: null,
      payerId: null,
    };
    s.reservations.push(r);
    save(s);
    return { ok: true, reservation: { ...r } };
  },

  async getReservation(slug, id) {
    const r = reservation(must(slug), id);
    return r ? { ...r } : null;
  },

  async setPayPalOrder(slug, id, orderId) {
    const r = reservation(must(slug), id);
    if (r) r.paypalOrderId = orderId;
  },

  async markAuthorized(slug, id, authorizationId, payerId) {
    const s = must(slug);
    const r = reservation(s, id);
    if (r?.status !== "held") return;
    r.status = "authorized";
    r.paypalAuthorizationId = authorizationId;
    r.payerId = payerId;
    save(s);
  },

  async markDelivered(slug, id) {
    const s = must(slug);
    const r = reservation(s, id);
    if (r?.status !== "authorized") return false;
    r.status = "captured";
    s.sales.push({ id: crypto.randomUUID(), lines: r.lines, method: "paypal", totalCents: r.totalCents, at: new Date().toISOString() });
    if (r.payerId) stamp(slug, r.payerId, r.customerName, 1);
    save(s);
    return true;
  },

  async release(slug, id, status) {
    const s = must(slug);
    const r = reservation(s, id);
    if (!r || !isActive(r)) return false;
    r.status = status;
    s.ingredients = restore(r.lines, s.dishes, s.ingredients);
    save(s);
    return true;
  },

  async stamps(slug, cardId) {
    return stampsOf(slug, cardId);
  },

  async addStamp(slug, cardId, label) {
    must(slug);
    const n = stamp(slug, cardId, label, 1);
    save(must(slug));
    return n;
  },

  async redeem(slug, cardId) {
    const s = must(slug);
    const { stampsPerReward, rewardDishId } = s.loyalty;
    if (!s.isOpen) return { ok: false, reason: "closed" };
    if (!rewardDishId) return { ok: false, reason: "no_reward" };
    const have = stampsOf(slug, cardId);
    if (have < stampsPerReward) return { ok: false, reason: "not_enough" };
    const lines = [{ dishId: rewardDishId, qty: 1 }];
    if (s.dishes.find((d) => d.id === rewardDishId)?.soldOut || !canFulfill(lines, s.dishes, s.ingredients).ok) {
      return { ok: false, reason: "short" };
    }
    s.ingredients = deduct(lines, s.dishes, s.ingredients);
    stamp(slug, cardId, null, -stampsPerReward);
    save(s);
    return { ok: true, stampsLeft: have - stampsPerReward };
  },

  async addWatch(slug, watch) {
    must(slug);
    const list = (watches.get(slug) ?? []).filter((w) => !(w.endpoint === watch.endpoint && w.dishId === watch.dishId));
    watches.set(slug, [...list, watch]);
  },

  async claimWatches(slug, open, dishIds) {
    const due = (w: Watch) => (w.dishId === null ? open : dishIds.includes(w.dishId));
    const list = watches.get(slug) ?? [];
    watches.set(slug, list.filter((w) => !due(w)));
    return list.filter(due);
  },
};
