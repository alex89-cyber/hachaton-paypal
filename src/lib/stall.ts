
import { forecast, type SaleEvent } from "./forecast";
import {
  type Dish,
  type Ingredient,
  type OrderLine,
  menuAvailability,
} from "./inventory";

export type PaymentMethod = "cash" | "card" | "paypal";

export type Sale = {
  id: string;
  lines: OrderLine[];
  method: PaymentMethod;
  totalCents: number;
  at: string;
};

export type ReservationStatus =
  | "held"
  | "authorized"
  | "captured"
  | "voided"
  | "expired";

export type Reservation = {
  id: string;
  customerName: string;
  lines: OrderLine[];
  totalCents: number;
  status: ReservationStatus;
  pickupBy: string;
  createdAt: string;
  paypalOrderId: string | null;
  paypalAuthorizationId: string | null;
  payerId: string | null;
  /** 4 digits the customer says at the counter. Null on reservations made before codes existed. */
  pickupCode: string | null;
};

export const isActive = (r: Reservation) =>
  r.status === "held" || r.status === "authorized";

/** A pickup code not used by any active reservation of the stall. */
export function newPickupCode(reservations: Reservation[]) {
  const taken = new Set(reservations.filter(isActive).map((r) => r.pickupCode));
  for (;;) {
    const code = String(Math.floor(Math.random() * 10_000)).padStart(4, "0");
    if (!taken.has(code)) return code;
  }
}

/** The reservations this browser made, so the stall page can show "Your reservation". */
export const HOLDS_COOKIE = "th_holds";

export const PAYER_COOKIE = "th_payer";

export type StampCard = {
  id: string;
  label: string | null;
  stamps: number;
  updatedAt: string;
};

export type Loyalty = {
  stampsPerReward: number;
  rewardDishId: string | null;
  stamps: Record<string, number>;
  cards: StampCard[];
};

export function phoneCardId(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10
    ? `tel:${digits.slice(-10)}`
    : null;
}

export function cardLabel(c: {
  id: string;
  label: string | null;
}): string {
  if (c.label) return c.label;

  const d = c.id.startsWith("tel:")
    ? c.id.slice(4)
    : "";

  return d
    ? `${d.slice(0, 2)} ${d.slice(2, 6)} ${d.slice(6)}`
    : "PayPal";
}

/* =========================================
   PERSONALIZACIÓN DEL NEGOCIO
   ========================================= */

/**
 * Configuración visual y de contacto de cada negocio.
 *
 * Las propiedades son opcionales para mantener
 * compatibilidad con los negocios ya existentes.
 *
 * Las imágenes se almacenarán en Supabase Storage.
 * Aquí solamente se guardarán sus URLs.
 */

export type StallTypography =
  | "modern"
  | "classic"
  | "rounded"
  | "elegant";

export type StallLayout =
  | "classic"
  | "grid"
  | "compact";

export type StallTheme = {
  primaryColor?: string;
  secondaryColor?: string;
  backgroundColor?: string;
  textColor?: string;
  buttonColor?: string;

  typography?: StallTypography;
  layout?: StallLayout;

  roundedCards?: boolean;
  roundedButtons?: boolean;
};

export type StallOpeningHour = {
  day: number;
  enabled: boolean;
  open: string;
  close: string;
};

export type StallSettings = {
  // Identidad del establecimiento
  logoUrl?: string | null;
  coverUrl?: string | null;
  galleryUrls?: string[];

  descriptionEs?: string;
  descriptionEn?: string;

  taglineEs?: string;
  taglineEn?: string;

  welcomeMessageEs?: string;
  welcomeMessageEn?: string;

  // Dirección y ubicación
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;

  googleMapsUrl?: string;
  latitude?: number | null;
  longitude?: number | null;

  // Información de contacto
  phone?: string;
  whatsapp?: string;
  email?: string;

  instagram?: string;
  facebook?: string;
  tiktok?: string;
  website?: string;

  // Horarios
  openingHours?: StallOpeningHour[];

  // Identidad visual
  theme?: StallTheme;

  // Elementos de la página pública
  showCover?: boolean;
  showDescription?: boolean;
  showLocation?: boolean;
  showOpeningHours?: boolean;
  showSocialLinks?: boolean;
  showGallery?: boolean;
};

/**
 * Configuración inicial para negocios que todavía
 * no han personalizado su página.
 */
export function defaultStallSettings(): StallSettings {
  return {
    logoUrl: null,
    coverUrl: null,
    galleryUrls: [],

    descriptionEs: "",
    descriptionEn: "",

    taglineEs: "",
    taglineEn: "",

    welcomeMessageEs: "",
    welcomeMessageEn: "",

    address: "",
    city: "",
    state: "",
    postalCode: "",
    country: "México",

    googleMapsUrl: "",
    latitude: null,
    longitude: null,

    phone: "",
    whatsapp: "",
    email: "",

    instagram: "",
    facebook: "",
    tiktok: "",
    website: "",

    openingHours: [],

    theme: {
      primaryColor: "#244D38",
      secondaryColor: "#E68B5C",
      backgroundColor: "#FAF9F6",
      textColor: "#24372C",
      buttonColor: "#244D38",

      typography: "modern",
      layout: "classic",

      roundedCards: true,
      roundedButtons: true,
    },

    showCover: true,
    showDescription: true,
    showLocation: true,
    showOpeningHours: true,
    showSocialLinks: true,
    showGallery: true,
  };
}

/* =========================================
   ESTADO DEL NEGOCIO
   ========================================= */

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

  openingCount: Record<string, number>;
  sales: Sale[];

  holdMinutes: number;
  reservations: Reservation[];

  loyalty: Loyalty;

  /**
   * Personalización opcional.
   * Los registros antiguos siguen siendo válidos
   * aunque todavía no tengan settings.
   */
  settings?: StallSettings;
};

/* =========================================
   VISTA PÚBLICA
   ========================================= */

export type PublicDish = {
  id: string;
  nameEs: string;
  nameEn: string;
  imageUrl: string | null;
  priceCents: number;
  portions: number;
};

export type PublicSnapshot = {
  slug: string;
  name: string;
  currency: string;

  isOpen: boolean;
  updatedAt: string;

  dishes: PublicDish[];

  /** Apariencia e información pública del negocio. */
  settings?: StallSettings;
};

export function publicSnapshot(
  s: StallState,
): PublicSnapshot {
  const left = new Map(
    menuAvailability(s.dishes, s.ingredients).map(
      (a) => [a.dishId, a.portions],
    ),
  );

  return {
    slug: s.slug,
    name: s.name,
    currency: s.currency,

    isOpen: s.isOpen,
    updatedAt: s.updatedAt,

    settings: s.settings,

    dishes: s.dishes.map((d) => ({
      id: d.id,
      nameEs: d.nameEs,
      nameEn: d.nameEn,

      imageUrl: d.imageUrl ?? null,

      priceCents: d.priceCents,

      portions: s.isOpen
        ? (left.get(d.id) ?? 0)
        : 0,
    })),
  };
}

/* =========================================
   VISTA DEL DUEÑO
   ========================================= */

export type OwnerDish = PublicDish & {
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

  /** Personalización editable desde el panel. */
  settings?: StallSettings;
};

export function ownerView(
  s: StallState,
  now = new Date(),
): OwnerView {
  const avail = new Map(
    menuAvailability(s.dishes, s.ingredients).map(
      (a) => [a.dishId, a],
    ),
  );

  const events: SaleEvent[] = s.sales.flatMap(
    (sale) =>
      sale.lines.map((l) => ({
        dishId: l.dishId,
        qty: l.qty,
        at: new Date(sale.at),
      })),
  );

  const fc = new Map(
    forecast(
      s.dishes,
      s.ingredients,
      events,
      now,
    ).map((f) => [f.dishId, f]),
  );

  const ingName = new Map(
    s.ingredients.map((i) => [i.id, i.name]),
  );

  return {
    slug: s.slug,
    name: s.name,
    currency: s.currency,

    isOpen: s.isOpen,
    openedAt: s.openedAt,
    updatedAt: s.updatedAt,

    settings: s.settings,

    ingredients: s.ingredients,

    today: cashUp(s),

    loyalty: s.loyalty,

    reservations: [...s.reservations].sort(
      (a, b) =>
        Number(isActive(b)) -
          Number(isActive(a)) ||
        a.pickupBy.localeCompare(b.pickupBy),
    ),

    dishes: s.dishes.map((d) => {
      const a = avail.get(d.id);
      const f = fc.get(d.id);

      const portions = a?.portions ?? 0;

      return {
        id: d.id,

        nameEs: d.nameEs,
        nameEn: d.nameEn,

        imageUrl: d.imageUrl ?? null,

        priceCents: d.priceCents,
        portions,

        recipe: d.recipe,
        soldOut: d.soldOut,

        soldOutAt:
          portions > 0 && f?.soldOutAt
            ? f.soldOutAt.toISOString()
            : null,

        limitingIngredient:
          a?.limitingIngredientId
            ? (
                ingName.get(
                  a.limitingIngredientId,
                ) ?? null
              )
            : null,
      };
    }),
  };
}

/* =========================================
   CORTE DE CAJA
   ========================================= */

export type CashUp = {
  salesCount: number;
  totalCents: number;

  byMethod: Record<PaymentMethod, number>;

  byDish: {
    dishId: string;
    nameEs: string;
    nameEn: string;
    qty: number;
    totalCents: number;
  }[];

  used: {
    ingredientId: string;
    name: string;
    unit: string;
    used: number;
    left: number;
  }[];
};

/**
 * RN-06: Corte de caja del día actual.
 */
export function cashUp(
  s: StallState,
): CashUp {
  const byMethod: Record<PaymentMethod, number> = {
    cash: 0,
    card: 0,
    paypal: 0,
  };

  const perDish = new Map<
    string,
    {
      qty: number;
      totalCents: number;
    }
  >();

  const price = new Map(
    s.dishes.map((d) => [d.id, d.priceCents]),
  );

  for (const sale of s.sales) {
    byMethod[sale.method] += sale.totalCents;

    for (const l of sale.lines) {
      const cur = perDish.get(l.dishId) ?? {
        qty: 0,
        totalCents: 0,
      };

      cur.qty += l.qty;

      cur.totalCents +=
        (price.get(l.dishId) ?? 0) * l.qty;

      perDish.set(l.dishId, cur);
    }
  }

  return {
    salesCount: s.sales.length,

    totalCents:
      byMethod.cash +
      byMethod.card +
      byMethod.paypal,

    byMethod,

    byDish: s.dishes
      .filter((d) => perDish.has(d.id))
      .map((d) => ({
        dishId: d.id,
        nameEs: d.nameEs,
        nameEn: d.nameEn,
        ...perDish.get(d.id)!,
      }))
      .sort(
        (a, b) =>
          b.totalCents - a.totalCents,
      ),

    used: s.ingredients.map((i) => ({
      ingredientId: i.id,
      name: i.name,
      unit: i.unit,

      used: Math.max(
        0,
        (s.openingCount[i.id] ?? i.stock) -
          i.stock,
      ),

      left: i.stock,
    })),
  };
}
