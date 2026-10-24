import type { OrderLine } from "../inventory";
import type { CashUp, PaymentMethod, StallState } from "../stall";

export type SaleResult = { ok: true; state: StallState } | { ok: false; reason: "closed" | "short"; short?: string[] };

/** Everything the screens need. The demo runs on memory; Supabase implements the same interface. */
export interface StallStore {
  get(slug: string): Promise<StallState | null>;
  open(slug: string, counts: Record<string, number>): Promise<StallState>;
  close(slug: string): Promise<{ state: StallState; cashUp: CashUp }>;
  recordSale(slug: string, lines: OrderLine[], method: PaymentMethod): Promise<SaleResult>;
  setSoldOut(slug: string, dishId: string, soldOut: boolean): Promise<StallState>;
  /** Demo only: put the stall back to its seeded state. */
  reset(slug: string): Promise<StallState>;
}
