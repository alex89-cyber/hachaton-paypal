import type { OrderLine } from "../inventory";
import type { CashUp, PaymentMethod, Reservation, StallState } from "../stall";

export type SaleResult = { ok: true; state: StallState } | { ok: false; reason: "closed" | "short"; short?: string[] };

export type ReserveResult =
  | { ok: true; reservation: Reservation }
  | { ok: false; reason: "closed" | "short"; short?: string[] };

/** Everything the screens need. The demo runs on memory; Supabase implements the same interface. */
export interface StallStore {
  get(slug: string): Promise<StallState | null>;
  open(slug: string, counts: Record<string, number>): Promise<StallState>;
  close(slug: string): Promise<{ state: StallState; cashUp: CashUp }>;
  recordSale(slug: string, lines: OrderLine[], method: PaymentMethod): Promise<SaleResult>;
  setSoldOut(slug: string, dishId: string, soldOut: boolean): Promise<StallState>;
  /** Demo only: put the stall back to its seeded state. */
  reset(slug: string): Promise<StallState>;

  // Reservations. Stock is taken when the reservation is made and given back
  // if it is voided or expires; delivering turns it into a PayPal sale.
  reserve(slug: string, customerName: string, lines: OrderLine[], pickupBy: Date): Promise<ReserveResult>;
  getReservation(slug: string, id: string): Promise<Reservation | null>;
  setPayPalOrder(slug: string, id: string, orderId: string): Promise<void>;
  markAuthorized(slug: string, id: string, authorizationId: string): Promise<void>;
  /** authorized → captured, recording the sale. False if it was not authorized. */
  markDelivered(slug: string, id: string): Promise<boolean>;
  /** held/authorized → voided/expired, giving the stock back. False if it was already finished. */
  release(slug: string, id: string, status: "voided" | "expired"): Promise<boolean>;
}
