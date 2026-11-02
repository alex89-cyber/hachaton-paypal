
import { connection } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import {
  isOwner,
  unauthorized,
} from "@/lib/owner-auth";

import {
  validateLoyaltyConfig,
} from "@/lib/loyalty-config";

import type {
  LoyaltyConfigInput,
  LoyaltyCardStatus,
} from "@/lib/store/types";

// ==========================================
// ¿TODAVÍA HAY?
// API DE RECOMPENSAS POR NEGOCIO
//
// GET  /api/stalls/[slug]/loyalty
// POST /api/stalls/[slug]/loyalty
//
// Requiere las migraciones 0010 y 0011.
//
// No modifica directamente pagos,
// reservas ni inventario.
// ==========================================

const NO_STORE = {
  "Cache-Control": "no-store",
};

// ==========================================
// NEXT.JS 16 ROUTE CONTEXT
// ==========================================

/**
 * Se utiliza un tipo explícito para evitar
 * errores cuando Next.js todavía no ha
 * regenerado los tipos de rutas.
 */
type LoyaltyRouteContext = {
  params: Promise<{
    slug: string;
  }>;
};

// ==========================================
// BUSINESS TYPES
// ==========================================

type BusinessRow = {
  id: string;
  slug: string;
  timezone: string;

  loyalty_enabled: boolean;
  stamps_per_reward: number;
  reward_dish_id: string | null;

  loyalty_period_kind:
    LoyaltyConfigInput["periodKind"];

  loyalty_period_days: number;

  loyalty_expiry_action:
    LoyaltyConfigInput["expiryAction"];

  loyalty_reward_valid_days: number | null;
};

// ==========================================
// VALIDATION
// ==========================================

const configurationSchema = z.object({
  action: z.literal("saveConfig"),

  enabled: z.boolean(),

  stampsPerReward: z
    .number()
    .int()
    .min(1)
    .max(100),

  rewardDishId: z
    .string()
    .uuid()
    .nullable(),

  periodKind: z.enum([
    "none",
    "calendar_week",
    "calendar_month",
    "rolling_days",
  ]),

  periodDays: z
    .number()
    .int()
    .min(1)
    .max(365),

  expiryAction: z.enum([
    "reset",
    "keep",
  ]),

  rewardValidDays: z
    .number()
    .int()
    .min(1)
    .max(365)
    .nullable(),
});

const cardSchema = z.object({
  action: z.literal("getCard"),

  cardId: z
    .string()
    .trim()
    .min(1)
    .max(100),
});

const actionSchema = z.discriminatedUnion(
  "action",
  [
    configurationSchema,
    cardSchema,
  ],
);

// ==========================================
// SUPABASE SERVER CLIENT
// ==========================================

function getDatabase() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase environment variables are missing",
    );
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// ==========================================
// HELPERS
// ==========================================

async function getBusiness(
  slug: string,
): Promise<BusinessRow | null> {
  const db = getDatabase();

  const { data, error } = await db
    .from("businesses")
    .select(`
      id,
      slug,
      timezone,
      loyalty_enabled,
      stamps_per_reward,
      reward_dish_id,
      loyalty_period_kind,
      loyalty_period_days,
      loyalty_expiry_action,
      loyalty_reward_valid_days
    `)
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as BusinessRow | null;
}

function toPublicConfig(
  business: BusinessRow,
): LoyaltyConfigInput {
  return {
    enabled:
      business.loyalty_enabled,

    stampsPerReward:
      business.stamps_per_reward,

    rewardDishId:
      business.reward_dish_id,

    periodKind:
      business.loyalty_period_kind,

    periodDays:
      business.loyalty_period_days,

    expiryAction:
      business.loyalty_expiry_action,

    rewardValidDays:
      business.loyalty_reward_valid_days,
  };
}

function jsonError(
  error: string,
  status: number,
) {
  return Response.json(
    { error },
    {
      status,
      headers: NO_STORE,
    },
  );
}

// ==========================================
// GET: CONFIGURACIÓN DEL NEGOCIO
// ==========================================

export async function GET(
  _request: Request,
  ctx: LoyaltyRouteContext,
) {
  await connection();

  if (!(await isOwner())) {
    return unauthorized();
  }

  try {
    const { slug } = await ctx.params;

    const business = await getBusiness(slug);

    if (!business) {
      return jsonError(
        "not_found",
        404,
      );
    }

    const db = getDatabase();

    const { data: dishes, error } =
      await db
        .from("dishes")
        .select(
          "id, name_es, name_en, image_url",
        )
        .eq(
          "business_id",
          business.id,
        )
        .order("sort");

    if (error) {
      throw new Error(error.message);
    }

    return Response.json(
      {
        slug:
          business.slug,

        timezone:
          business.timezone,

        config:
          toPublicConfig(business),

        dishes: (dishes ?? []).map(
          (dish) => ({
            id:
              dish.id,

            nameEs:
              dish.name_es,

            nameEn:
              dish.name_en,

            imageUrl:
              dish.image_url,
          }),
        ),
      },
      {
        headers: NO_STORE,
      },
    );
  } catch (error) {
    console.error(
      "GET loyalty configuration failed",
      error,
    );

    return jsonError(
      "loyalty_load_failed",
      500,
    );
  }
}

// ==========================================
// POST: GUARDAR O CONSULTAR TARJETA
// ==========================================

export async function POST(
  request: Request,
  ctx: LoyaltyRouteContext,
) {
  if (!(await isOwner())) {
    return unauthorized();
  }

  const body = await request
    .json()
    .catch(() => null);

  const parsed =
    actionSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(
      "invalid_request",
      400,
    );
  }

  const { slug } = await ctx.params;

  const action = parsed.data;

  try {
    const business =
      await getBusiness(slug);

    if (!business) {
      return jsonError(
        "not_found",
        404,
      );
    }

    const db = getDatabase();

    // ======================================
    // CONSULTAR TARJETA DEL CLIENTE
    // ======================================

    if (action.action === "getCard") {
      const { data, error } =
        await db.rpc(
          "get_loyalty_card",
          {
            p_business:
              business.id,

            p_card:
              action.cardId,
          },
        );

      if (error) {
        throw new Error(
          error.message,
        );
      }

      return Response.json(
        {
          card:
            data as LoyaltyCardStatus,

          timezone:
            business.timezone,
        },
        {
          headers: NO_STORE,
        },
      );
    }

    // ======================================
    // GUARDAR CONFIGURACIÓN
    // ======================================

    const config: LoyaltyConfigInput = {
      enabled:
        action.enabled,

      stampsPerReward:
        action.stampsPerReward,

      rewardDishId:
        action.rewardDishId,

      periodKind:
        action.periodKind,

      periodDays:
        action.periodDays,

      expiryAction:
        action.expiryAction,

      rewardValidDays:
        action.rewardValidDays,
    };

    const validation =
      validateLoyaltyConfig(config);

    if (!validation.ok) {
      return Response.json(
        {
          error:
            validation.reason,

          message:
            validation.message,
        },
        {
          status: 400,
          headers: NO_STORE,
        },
      );
    }

    // ======================================
    // VERIFICAR EL PLATILLO DE PREMIO
    // ======================================

    /**
     * El premio seleccionado debe pertenecer
     * al mismo negocio.
     *
     * Así evitamos asignar platillos de
     * otros establecimientos.
     */
    if (config.rewardDishId) {
      const { data: dish, error } =
        await db
          .from("dishes")
          .select("id")
          .eq(
            "business_id",
            business.id,
          )
          .eq(
            "id",
            config.rewardDishId,
          )
          .maybeSingle();

      if (error) {
        throw new Error(
          error.message,
        );
      }

      if (!dish) {
        return jsonError(
          "reward_not_found",
          400,
        );
      }
    }

    // ======================================
    // GUARDAR REGLAS EN SUPABASE
    // ======================================

    const { error } =
      await db.rpc(
        "save_loyalty_config",
        {
          p_business:
            business.id,

          p_enabled:
            config.enabled,

          p_stamps_per_reward:
            config.stampsPerReward,

          p_reward_dish:
            config.rewardDishId,

          p_period_kind:
            config.periodKind,

          p_period_days:
            config.periodDays,

          p_expiry_action:
            config.expiryAction,

          p_reward_valid_days:
            config.rewardValidDays,
        },
      );

    if (error) {
      throw new Error(
        error.message,
      );
    }

    // ======================================
    // DEVOLVER CONFIGURACIÓN ACTUALIZADA
    // ======================================

    const updated =
      await getBusiness(slug);

    if (!updated) {
      return jsonError(
        "not_found",
        404,
      );
    }

    return Response.json(
      {
        ok: true,

        config:
          toPublicConfig(updated),
      },
      {
        headers: NO_STORE,
      },
    );
  } catch (error) {
    console.error(
      "POST loyalty failed",
      error,
    );

    return jsonError(
      "loyalty_operation_failed",
      500,
    );
  }
}
