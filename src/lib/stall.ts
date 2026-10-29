// Stall state and the views derived from it. Pure: the stores load and save
// StallState, everything shown on screen is computed here.

import { forecast, type SaleEvent } from "./forecast";
import { type Dish, type Ingredient, type OrderLine, menuAvailability } from "./inventory";

export type PaymentMethod = "cash" | "card" | "paypal";

export type Sale = {
  id: string;
  lines: OrderLine[];
  method: PaymentMethod;
  totalCents: number;
  at: string; // ISO
};

/**
 * held: stock set aside, waiting for the customer to approve on PayPal.
 * authorized: PayPal holds the money until pickup. captured: delivered and charged.
 * voided / expired: stock went back, nothing charged.
 */
export type ReservationStatus = "held" | "authorized" | "captured" | "voided" | "expired";

export type Reservation = {
  id: string;
  customerName: string;
  lines: OrderLine[];
  totalCents: number;
  status: ReservationStatus;
  pickupBy: string; // ISO
  createdAt: string; // ISO
  paypalOrderId: string | null;
  paypalAuthorizationId: string | null;
  /** PayPal payer id, known once the customer approves. Keys the stamp card. */
  payerId: string | null;
};

export const isActive = (r: Reservation) => r.status === "held" || r.status === "authorized";

/** Remembers the customer's PayPal payer id so the stall page can show their stamp card. */
export const PAYER_COOKIE = "th_payer";

/**
 * A customer's stamp card at one stall. `id` is their PayPal payer id, or
 * "tel:<10 digits>" for customers the owner stamps at the counter.
 */
export type StampCard = { id: string; label: string | null; stamps: number; updatedAt: string };

/** Stamp card: every PayPal order handed over (or counter sale with a phone) adds a stamp; stampsPerReward of them buy the reward dish. */
export type Loyalty = {
  stampsPerReward: number;
  rewardDishId: string | null;
  /** Unspent stamps by card id, for the payers in `reservations`. */
  stamps: Record<string, number>;
  /** Most recently used cards, newest first. */
  cards: StampCard[];
};

/** "55 1234 5678", "+52 55-1234-5678"… → "tel:5512345678". Null if it is not a 10-digit phone. */
export function phoneCardId(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10 ? `tel:${digits.slice(-10)}` : null;
}

/** What the owner sees for a card: its label, or the phone formatted. */
export function cardLabel(c: { id: string; label: string | null }): string {
  if (c.label) return c.label;
  const d = c.id.startsWith("tel:") ? c.id.slice(4) : "";
  return d ? `${d.slice(0, 2)} ${d.slice(2, 6)} ${d.slice(6)}` : "PayPal";
}

export type StallState = {
  slug: string;
  name: string;
  currency: string;
  timezone: string;
  isOpen: boolean;
  openedAt: string | null;
  updatedAt: string;
  dishes: Dish[];
  ingredients: Ingredient[];
  /** Stock at the opening count (RN-02), to report usage in the cash-up. */
  openingCount: Record<string, number>;
  /** Sales since the last opening. */
  sales: Sale[];
  /** How long a reservation waits for pickup. */
  holdMinutes: number;
  /** Active reservations plus recent finished ones. */
  reservations: Reservation[];
  loyalty: Loyalty;
};

export type PublicDish = {
  id: string;
  nameEs: string;
  nameEn: string;
  priceCents: number;
  portions: number;
};

/** What the customer page shows (RN-07). No sales, no stock in grams. */
export type PublicSnapshot = {
  slug: string;
  name: string;
  currency: string;
  isOpen: boolean;
  updatedAt: string;
  dishes: PublicDish[];
};

export function publicSnapshot(s: StallState): PublicSnapshot {
  const left = new Map(menuAvailability(s.dishes, s.ingredients).map((a) => [a.dishId, a.portions]));
  return {
    slug: s.slug,
    name: s.name,
    currency: s.currency,
    isOpen: s.isOpen,
    updatedAt: s.updatedAt,
    dishes: s.dishes.map((d) => ({
      id: d.id,
      nameEs: d.nameEs,
      nameEn: d.nameEn,
      priceCents: d.priceCents,
      portions: s.isOpen ? (left.get(d.id) ?? 0) : 0,
    })),
  };
}

export type OwnerDish = PublicDish & {
  /** What one portion uses, so the panel can show how many dishes a count makes. */
  recipe: Dish["recipe"];
  soldOut: boolean;
  soldOutAt: string | null;
  limitingIngredient: string | null;
};

export type OwnerView = {
  slug: string;
  name: string;
  currency: string;
  isOpen: boolean;
  openedAt: string | null;
  updatedAt: string;
  dishes: OwnerDish[];
  ingredients: Ingredient[];
  today: CashUp;
  reservations: Reservation[];
  loyalty: Loyalty;
};

export function ownerView(s: StallState, now = new Date()): OwnerView {
  const avail = new Map(menuAvailability(s.dishes, s.ingredients).map((a) => [a.dishId, a]));
  const events: SaleEvent[] = s.sales.flatMap((sale) =>
    sale.lines.map((l) => ({ dishId: l.dishId, qty: l.qty, at: new Date(sale.at) })),
  );
  const fc = new Map(forecast(s.dishes, s.ingredients, events, now).map((f) => [f.dishId, f]));
  const ingName = new Map(s.ingredients.map((i) => [i.id, i.name]));

  return {
    slug: s.slug,
    name: s.name,
    currency: s.currency,
    isOpen: s.isOpen,
    openedAt: s.openedAt,
    updatedAt: s.updatedAt,
    ingredients: s.ingredients,
    today: cashUp(s),
    loyalty: s.loyalty,
    reservations: [...s.reservations].sort(
      (a, b) => Number(isActive(b)) - Number(isActive(a)) || a.pickupBy.localeCompare(b.pickupBy),
    ),
    dishes: s.dishes.map((d) => {
      const a = avail.get(d.id);
      const f = fc.get(d.id);
      const portions = a?.portions ?? 0;
      return {
        id: d.id,
        nameEs: d.nameEs,
        nameEn: d.nameEn,
        priceCents: d.priceCents,
        portions,
        recipe: d.recipe,
        soldOut: d.soldOut,
        soldOutAt: portions > 0 && f?.soldOutAt ? f.soldOutAt.toISOString() : null,
        limitingIngredient: a?.limitingIngredientId ? (ingName.get(a.limitingIngredientId) ?? null) : null,
      };
    }),
  };
}

export type CashUp = {
  salesCount: number;
  totalCents: number;
  byMethod: Record<PaymentMethod, number>;
  byDish: { dishId: string; nameEs: string; nameEn: string; qty: number; totalCents: number }[];
  /** Ingredient used since opening: opening count minus what is left. */
  used: { ingredientId: string; name: string; unit: string; used: number; left: number }[];
};

/** RN-06: corte de caja for the current day. */
export function cashUp(s: StallState): CashUp {
  const byMethod: Record<PaymentMethod, number> = { cash: 0, card: 0, paypal: 0 };
  const perDish = new Map<string, { qty: number; totalCents: number }>();
  const price = new Map(s.dishes.map((d) => [d.id, d.priceCents]));

  for (const sale of s.sales) {
    byMethod[sale.method] += sale.totalCents;
    for (const l of sale.lines) {
      const cur = perDish.get(l.dishId) ?? { qty: 0, totalCents: 0 };
      cur.qty += l.qty;
      cur.totalCents += (price.get(l.dishId) ?? 0) * l.qty;
      perDish.set(l.dishId, cur);
    }
  }

  return {
    salesCount: s.sales.length,
    totalCents: byMethod.cash + byMethod.card + byMethod.paypal,
    byMethod,
    byDish: s.dishes
      .filter((d) => perDish.has(d.id))
      .map((d) => ({ dishId: d.id, nameEs: d.nameEs, nameEn: d.nameEn, ...perDish.get(d.id)! }))
      .sort((a, b) => b.totalCents - a.totalCents),
    used: s.ingredients.map((i) => ({
      ingredientId: i.id,
      name: i.name,
      unit: i.unit,
      used: Math.max(0, (s.openingCount[i.id] ?? i.stock) - i.stock),
      left: i.stock,
    })),
  };
}
