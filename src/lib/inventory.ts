// Pure inventory logic: no I/O, so it runs the same on the server, in the
// agent's tools and in tests.

export type Ingredient = {
  id: string;
  name: string;
  unit: string;
  /** Current stock, in `unit`. Set by the opening count, lowered by sales and holds. */
  stock: number;
};

export type RecipeItem = { ingredientId: string; qty: number };

export type Dish = {
  id: string;
  nameEs: string;
  nameEn: string;
  priceCents: number;
  /** Manual "se acabó" switch (RN-05). */
  soldOut: boolean;
  recipe: RecipeItem[];
};

export type Availability = {
  dishId: string;
  /** Whole portions that can still be made with the current stock. */
  portions: number;
  /** Ingredient that runs out first for this dish, if any. */
  limitingIngredientId: string | null;
};

/** RN-04: portions left per dish, limited by the scarcest ingredient. */
export function availability(dish: Dish, stock: Map<string, number>): Availability {
  if (dish.soldOut || dish.recipe.length === 0) {
    return { dishId: dish.id, portions: 0, limitingIngredientId: null };
  }
  let portions = Infinity;
  let limiting: string | null = null;
  for (const item of dish.recipe) {
    const left = stock.get(item.ingredientId) ?? 0;
    const n = item.qty > 0 ? Math.floor(left / item.qty + 1e-9) : Infinity;
    if (n < portions) {
      portions = n;
      limiting = item.ingredientId;
    }
  }
  return {
    dishId: dish.id,
    portions: Number.isFinite(portions) ? Math.max(0, portions) : 0,
    limitingIngredientId: limiting,
  };
}

export function stockMap(ingredients: Ingredient[]): Map<string, number> {
  return new Map(ingredients.map((i) => [i.id, i.stock]));
}

export function menuAvailability(dishes: Dish[], ingredients: Ingredient[]): Availability[] {
  const stock = stockMap(ingredients);
  return dishes.map((d) => availability(d, stock));
}

export type OrderLine = { dishId: string; qty: number };

/** Ingredient usage for a set of order lines, summed per ingredient. */
export function usage(lines: OrderLine[], dishes: Dish[]): Map<string, number> {
  const byId = new Map(dishes.map((d) => [d.id, d]));
  const total = new Map<string, number>();
  for (const line of lines) {
    const dish = byId.get(line.dishId);
    if (!dish) throw new Error(`Unknown dish ${line.dishId}`);
    for (const item of dish.recipe) {
      total.set(item.ingredientId, (total.get(item.ingredientId) ?? 0) + item.qty * line.qty);
    }
  }
  return total;
}

/**
 * Checks that an order (a counter sale or a reservation) fits the current stock.
 * Shared ingredients are counted once across all lines, so two dishes that both
 * use birria meat cannot each claim the last kilo.
 */
export function canFulfill(
  lines: OrderLine[],
  dishes: Dish[],
  ingredients: Ingredient[],
): { ok: true } | { ok: false; shortIngredientIds: string[] } {
  const byId = new Map(dishes.map((d) => [d.id, d]));
  if (lines.some((l) => byId.get(l.dishId)?.soldOut)) {
    return { ok: false, shortIngredientIds: [] };
  }
  const stock = stockMap(ingredients);
  const short = [...usage(lines, dishes)]
    .filter(([id, needed]) => needed > (stock.get(id) ?? 0) + 1e-9)
    .map(([id]) => id);
  return short.length ? { ok: false, shortIngredientIds: short } : { ok: true };
}

/** Stock after taking `lines` out (sale or hold). Negative results are clamped to 0. */
export function deduct(lines: OrderLine[], dishes: Dish[], ingredients: Ingredient[]): Ingredient[] {
  const used = usage(lines, dishes);
  return ingredients.map((i) => ({ ...i, stock: Math.max(0, i.stock - (used.get(i.id) ?? 0)) }));
}

/** Stock after giving `lines` back (an expired or voided reservation). */
export function restore(lines: OrderLine[], dishes: Dish[], ingredients: Ingredient[]): Ingredient[] {
  const used = usage(lines, dishes);
  return ingredients.map((i) => ({ ...i, stock: i.stock + (used.get(i.id) ?? 0) }));
}

export function orderTotalCents(lines: OrderLine[], dishes: Dish[]): number {
  const byId = new Map(dishes.map((d) => [d.id, d]));
  return lines.reduce((sum, l) => sum + (byId.get(l.dishId)?.priceCents ?? 0) * l.qty, 0);
}
