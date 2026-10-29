import type { OrderLine } from "../inventory";
import type { CashUp, PaymentMethod, Reservation, StallState } from "../stall";

export type SaleResult = { ok: true; state: StallState } | { ok: false; reason: "closed" | "short"; short?: string[] };

export type RedeemResult =
  | { ok: true; stampsLeft: number }
  | { ok: false; reason: "closed" | "short" | "not_enough" | "no_reward" };

/** A browser push subscription waiting for the stall to open (dishId null) or a dish to come back. */
export type Watch = {
  dishId: string | null;
  endpoint: string;
  p256dh: string;
  auth: string;
  lang: "es" | "en";
};

export type ReserveResult =
  | { ok: true; reservation: Reservation }
  | { ok: false; reason: "closed" | "short"; short?: string[] };

/** Everything the screens need. The demo runs on memory; Supabase implements the same interface. */
/**
 * The whole menu as the owner edits it. Ingredients are keyed by their id, or
 * by "new:N" when just added, and recipes point at those keys. Anything left
 * out is removed (archived, since past sales still point at it). New
 * ingredients start with no stock.
 */
export type MenuInput = {
  ingredients: { key: string; name: string; unit: string }[];
  dishes: {
    id: string | null;
    nameEs: string;
    nameEn: string;
    priceCents: number;
    recipe: { ingredient: string; qty: number }[];
  }[];
};

export interface StallStore {
  get(slug: string): Promise<StallState | null>;
  open(slug: string, counts: Record<string, number>): Promise<StallState>;
  close(slug: string): Promise<{ state: StallState; cashUp: CashUp }>;
  recordSale(slug: string, lines: OrderLine[], method: PaymentMethod): Promise<SaleResult>;
  setSoldOut(slug: string, dishId: string, soldOut: boolean): Promise<StallState>;
  /** Adds stock mid-day ({ingredientId: amount}); clears "sold out" on dishes made from it. */
  restock(slug: string, adds: Record<string, number>): Promise<{ ok: true; state: StallState } | { ok: false; reason: "closed" }>;
  /** Replaces dishes, prices, ingredients and recipes (see MenuInput). */
  saveMenu(slug: string, menu: MenuInput): Promise<StallState>;
  /** Demo only: put the stall back to its seeded state. */
  reset(slug: string): Promise<StallState>;

  // Reservations. Stock is taken when the reservation is made and given back
  // if it is voided or expires; delivering turns it into a PayPal sale.
  reserve(slug: string, customerName: string, lines: OrderLine[], pickupBy: Date): Promise<ReserveResult>;
  getReservation(slug: string, id: string): Promise<Reservation | null>;
  setPayPalOrder(slug: string, id: string, orderId: string): Promise<void>;
  markAuthorized(slug: string, id: string, authorizationId: string, payerId: string | null): Promise<void>;
  /** authorized → captured, recording the sale. False if it was not authorized. */
  markDelivered(slug: string, id: string): Promise<boolean>;
  /** held/authorized → voided/expired, giving the stock back. False if it was already finished. */
  release(slug: string, id: string, status: "voided" | "expired"): Promise<boolean>;

  // Stamp card. Delivering a reservation with a payer adds the stamp.
  stamps(slug: string, cardId: string): Promise<number>;
  /** One stamp on a card (created if new). Returns the stamps it now has. */
  addStamp(slug: string, cardId: string, label: string | null): Promise<number>;
  /** Spends a reward's stamps and takes the reward dish out of stock. */
  redeem(slug: string, cardId: string): Promise<RedeemResult>;

  // "Avísame cuando haya".
  addWatch(slug: string, watch: Watch): Promise<void>;
  /** Removes and returns the watches that are due: all "opens" ones if open, plus those for these dishes. */
  claimWatches(slug: string, open: boolean, dishIds: string[]): Promise<Watch[]>;
}
