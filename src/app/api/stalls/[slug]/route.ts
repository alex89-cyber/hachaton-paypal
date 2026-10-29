import { after, connection } from "next/server";
import { z } from "zod";
import { isActive, ownerView, phoneCardId, publicSnapshot } from "@/lib/stall";
import { PayPalError } from "@/lib/paypal";
import { notifyWaiting } from "@/lib/push";
import { cancel, deliver, loadStall } from "@/lib/reservations";
import { store } from "@/lib/store";
import { demoMode, isOwner, unauthorized } from "@/lib/owner-auth";

// GET  /api/stalls/:slug             public snapshot (RN-07)
// GET  /api/stalls/:slug?view=owner  owner panel data
// POST /api/stalls/:slug             owner actions, see `Action`
// The owner view and every POST need the owner PIN (see owner-auth.ts).

export async function GET(request: Request, ctx: RouteContext<"/api/stalls/[slug]">) {
  await connection();
  const { slug } = await ctx.params;
  const s = await loadStall(slug);
  if (!s) return Response.json({ error: "not_found" }, { status: 404 });
  const view = new URL(request.url).searchParams.get("view");
  if (view === "owner" && !(await isOwner())) return unauthorized();
  return Response.json(view === "owner" ? ownerView(s) : publicSnapshot(s), {
    headers: { "Cache-Control": "no-store" },
  });
}

/** Units the menu editor offers. */
const UNITS = ["g", "kg", "ml", "l", "pz"] as const;

const line = z.object({ dishId: z.string().min(1), qty: z.number().int().min(1).max(50) });

const Action = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("sale"),
    lines: z.array(line).min(1).max(20),
    method: z.enum(["cash", "card"]),
    /** Optional: the customer's phone, to stamp their card. */
    customerPhone: z.string().max(30).optional(),
  }),
  z.object({ action: z.literal("restock"), adds: z.record(z.string(), z.number().min(0).max(1_000_000)) }),
  /** One stamp by hand, on an existing card or a phone. */
  z.object({
    action: z.literal("stamp"),
    cardId: z.string().min(1).max(100).optional(),
    phone: z.string().max(30).optional(),
    name: z.string().max(60).optional(),
  }),
  z.object({ action: z.literal("soldOut"), dishId: z.string().min(1), soldOut: z.boolean() }),
  z.object({ action: z.literal("open"), counts: z.record(z.string(), z.number().min(0).max(1_000_000)) }),
  z.object({ action: z.literal("close") }),
  z.object({ action: z.literal("reset") }),
  z.object({
    action: z.literal("saveMenu"),
    ingredients: z
      .array(z.object({ key: z.string().min(1).max(60), name: z.string().trim().min(1).max(60), unit: z.enum(UNITS) }))
      .max(60),
    dishes: z
      .array(
        z.object({
          id: z.string().max(60).nullable(),
          nameEs: z.string().trim().min(1).max(80),
          nameEn: z.string().trim().max(80),
          priceCents: z.number().int().min(0).max(10_000_000),
          recipe: z.array(z.object({ ingredient: z.string().min(1).max(60), qty: z.number().positive().max(1_000_000) })).max(30),
        }),
      )
      .min(1)
      .max(60),
  }),
  z.object({ action: z.literal("deliver"), reservationId: z.string().min(1) }),
  z.object({ action: z.literal("cancelReservation"), reservationId: z.string().min(1) }),
  z.object({ action: z.literal("redeem"), reservationId: z.string().min(1).optional(), cardId: z.string().min(1).optional() }),
]);

/** Actions that can make a dish available again, or open the stall: tell whoever is waiting. */
const MAY_BRING_BACK = new Set(["open", "soldOut", "cancelReservation", "reset", "restock"]);

/** Owner view after a stamp, with the card it touched so the panel can say "⭐ 4 de 10". */
async function stamped(slug: string, cardId: string, stamps: number) {
  return Response.json({ ...ownerView((await store.get(slug))!), stamped: { cardId, stamps } });
}

export async function POST(request: Request, ctx: RouteContext<"/api/stalls/[slug]">) {
  const { slug } = await ctx.params;
  if (!(await isOwner())) return unauthorized();
  if (!(await store.get(slug))) return Response.json({ error: "not_found" }, { status: 404 });

  const parsed = Action.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "bad_request" }, { status: 400 });
  const a = parsed.data;

  if (MAY_BRING_BACK.has(a.action)) {
    after(async () => {
      const s = await store.get(slug);
      if (s) await notifyWaiting(s).catch((e) => console.error("push: notify failed", e));
    });
  }

  switch (a.action) {
    case "sale": {
      const card = a.customerPhone ? phoneCardId(a.customerPhone) : null;
      if (a.customerPhone && !card) return Response.json({ error: "bad_phone" }, { status: 400 });
      const r = await store.recordSale(slug, a.lines, a.method);
      if (!r.ok) return Response.json({ error: r.reason, short: r.short ?? [] }, { status: 409 });
      if (card) return stamped(slug, card, await store.addStamp(slug, card, null));
      return Response.json(ownerView(r.state));
    }
    case "restock": {
      const r = await store.restock(slug, a.adds);
      if (!r.ok) return Response.json({ error: r.reason }, { status: 409 });
      return Response.json(ownerView(r.state));
    }
    case "stamp": {
      const card = a.cardId ?? (a.phone ? phoneCardId(a.phone) : null);
      if (!card) return Response.json({ error: "bad_phone" }, { status: 400 });
      return stamped(slug, card, await store.addStamp(slug, card, a.name?.trim() || null));
    }
    case "soldOut":
      return Response.json(ownerView(await store.setSoldOut(slug, a.dishId, a.soldOut)));
    case "open":
      return Response.json(ownerView(await store.open(slug, a.counts)));
    case "close": {
      const { state, cashUp } = await store.close(slug);
      return Response.json({ ...ownerView(state), closedCashUp: cashUp });
    }
    case "saveMenu": {
      const s = (await store.get(slug))!;
      const keys = new Set(a.ingredients.map((i) => i.key));
      const names = new Set(a.ingredients.map((i) => i.name.toLowerCase()));
      if (names.size !== a.ingredients.length) return Response.json({ error: "duplicate_ingredient" }, { status: 400 });
      if (a.dishes.some((d) => d.recipe.some((r) => !keys.has(r.ingredient))))
        return Response.json({ error: "bad_recipe" }, { status: 400 });
      // A dish someone has reserved can't go: its stock comes back when the hold ends.
      const kept = new Set(a.dishes.flatMap((d) => (d.id ? [d.id] : [])));
      const held = s.reservations.filter((r) => isActive(r) && r.lines.some((l) => !kept.has(l.dishId)));
      if (held.length) return Response.json({ error: "dish_reserved" }, { status: 409 });
      const next = await store.saveMenu(slug, {
        ingredients: a.ingredients,
        dishes: a.dishes.map((d) => ({ ...d, nameEn: d.nameEn || d.nameEs })),
      });
      return Response.json(ownerView(next));
    }
    case "reset":
      if (!demoMode()) return Response.json({ error: "demo_off" }, { status: 403 });
      return Response.json(ownerView(await store.reset(slug)));
    case "deliver":
    case "cancelReservation": {
      try {
        if (a.action === "deliver") {
          const r = await deliver(slug, a.reservationId);
          if (r !== "ok") return Response.json({ error: r }, { status: 409 });
        } else {
          await cancel(slug, a.reservationId);
        }
      } catch (e) {
        console.error(`${a.action} failed`, e);
        return Response.json({ error: e instanceof PayPalError ? "paypal" : "failed" }, { status: 502 });
      }
      return Response.json(ownerView((await store.get(slug))!));
    }
    case "redeem": {
      const card = a.cardId ?? (a.reservationId ? (await store.getReservation(slug, a.reservationId))?.payerId : null);
      if (!card) return Response.json({ error: "not_found" }, { status: 404 });
      const res = await store.redeem(slug, card);
      if (!res.ok) return Response.json({ error: res.reason }, { status: 409 });
      return Response.json(ownerView((await store.get(slug))!));
    }
  }
}
