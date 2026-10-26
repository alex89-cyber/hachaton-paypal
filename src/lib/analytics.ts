// The day's numbers as flat tables for the AG Studio cash-up dashboard. Pure:
// built on the server from StallState, rendered in the browser by AG Studio.

import { cashUp, type PaymentMethod, type ReservationStatus, type StallState } from "./stall";

export type SaleLineRow = {
  /** One row per dish in a sale, so the same sale can span several rows. */
  venta: string;
  hora: string; // ISO, turned into a Date in the browser
  horaDelDia: string; // "14:00", to group by hour
  metodo: string;
  platillo: string;
  cantidad: number;
  importe: number; // in currency units, not cents
  apartado: boolean;
};

export type StockRow = {
  ingrediente: string;
  unidad: string;
  inicial: number;
  usado: number;
  queda: number;
  usadoPct: number; // 0..1
};

export type ReservationRow = {
  cliente: string;
  estado: string;
  platillos: string;
  importe: number;
  creado: string; // ISO
};

export type CashUpTables = {
  currency: string;
  timezone: string;
  openedAt: string | null;
  ventas: SaleLineRow[];
  inventario: StockRow[];
  apartados: ReservationRow[];
};

const METHOD: Record<"es" | "en", Record<PaymentMethod, string>> = {
  es: { cash: "Efectivo", card: "Tarjeta", paypal: "PayPal" },
  en: { cash: "Cash", card: "Card", paypal: "PayPal" },
};

const STATUS: Record<"es" | "en", Record<ReservationStatus, string>> = {
  es: { held: "Esperando pago", authorized: "Pagado, por recoger", captured: "Entregado", voided: "Cancelado", expired: "Vencido" },
  en: { held: "Awaiting payment", authorized: "Paid, to pick up", captured: "Delivered", voided: "Cancelled", expired: "Expired" },
};

export function cashUpTables(s: StallState, lang: "es" | "en"): CashUpTables {
  const dish = new Map(s.dishes.map((d) => [d.id, d]));
  const dishName = (id: string) => {
    const d = dish.get(id);
    return d ? (lang === "es" ? d.nameEs : d.nameEn) : id;
  };
  const hour = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: s.timezone });
  // Sales made from a reservation were paid with PayPal on pickup.
  const fromReservation = new Set(s.sales.filter((x) => x.method === "paypal").map((x) => x.id));

  const ventas = s.sales.flatMap((sale) =>
    sale.lines.map((l) => ({
      venta: sale.id,
      hora: sale.at,
      horaDelDia: `${hour.format(new Date(sale.at))}:00`,
      metodo: METHOD[lang][sale.method],
      platillo: dishName(l.dishId),
      cantidad: l.qty,
      importe: ((dish.get(l.dishId)?.priceCents ?? 0) * l.qty) / 100,
      apartado: fromReservation.has(sale.id),
    })),
  );

  const inventario = cashUp(s).used.map((u) => {
    const inicial = u.used + u.left;
    return {
      ingrediente: u.name,
      unidad: u.unit,
      inicial,
      usado: u.used,
      queda: u.left,
      usadoPct: inicial > 0 ? u.used / inicial : 0,
    };
  });

  const apartados = s.reservations.map((r) => ({
    cliente: r.customerName,
    estado: STATUS[lang][r.status],
    platillos: r.lines.map((l) => `${l.qty} × ${dishName(l.dishId)}`).join(", "),
    importe: r.totalCents / 100,
    creado: r.createdAt,
  }));

  return { currency: s.currency, timezone: s.timezone, openedAt: s.openedAt, ventas, inventario, apartados };
}
