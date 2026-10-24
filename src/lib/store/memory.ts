import { demoDishes, demoIngredients } from "../demo-data";
import { canFulfill, deduct, orderTotalCents } from "../inventory";
import { cashUp, type Sale, type StallState } from "../stall";
import type { StallStore } from "./types";

// In-process store for the demo and for running without Supabase. State lives
// on globalThis so it survives hot reloads in dev; it resets on restart.

const DEMO_SLUG = "birria-dona-lupe";

/** A stall that opened 90 minutes ago and has been selling, so the forecast has data. */
export function seedDemo(now = new Date()): StallState {
  const openedAt = new Date(now.getTime() - 90 * 60_000);
  const sales: Sale[] = [];
  let ingredients = demoIngredients.map((i) => ({ ...i }));
  // One small order every ~3 minutes, heavier on quesabirrias.
  const pattern = ["quesabirria", "birria-plato", "quesabirria", "tacos-dorados", "consome-vaso", "quesabirria"];
  for (let m = 85, k = 0; m > 0; m -= 3, k++) {
    const lines = [{ dishId: pattern[k % pattern.length], qty: k % 4 === 0 ? 2 : 1 }];
    ingredients = deduct(lines, demoDishes, ingredients);
    sales.push({
      id: `seed-${k}`,
      lines,
      method: k % 3 === 0 ? "card" : "cash",
      totalCents: orderTotalCents(lines, demoDishes),
      at: new Date(now.getTime() - m * 60_000).toISOString(),
    });
  }
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
  };
}

const g = globalThis as unknown as { __stalls?: Map<string, StallState> };
const stalls = (g.__stalls ??= new Map([[DEMO_SLUG, seedDemo()]]));

function must(slug: string): StallState {
  const s = stalls.get(slug);
  if (!s) throw new Error(`Unknown stall ${slug}`);
  return s;
}

function save(s: StallState): StallState {
  s.updatedAt = new Date().toISOString();
  stalls.set(s.slug, s);
  return s;
}

export const memoryStore: StallStore = {
  async get(slug) {
    return stalls.get(slug) ?? null;
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

  async reset(slug) {
    if (slug !== DEMO_SLUG) return must(slug);
    return save(seedDemo());
  },
};
