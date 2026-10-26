import { connection } from "next/server";
import { z } from "zod";
import { ownerView, publicSnapshot } from "@/lib/stall";
import { PayPalError } from "@/lib/paypal";
import { cancel, deliver, loadStall } from "@/lib/reservations";
import { store } from "@/lib/store";

// GET  /api/stalls/:slug             public snapshot (RN-07)
// GET  /api/stalls/:slug?view=owner  owner panel data
// POST /api/stalls/:slug             owner actions, see `Action`
// Owner routes are open while the demo runs on the memory store; they move
// behind Supabase auth with the Supabase store.

export async function GET(request: Request, ctx: RouteContext<"/api/stalls/[slug]">) {
  await connection();
  const { slug } = await ctx.params;
  const s = await loadStall(slug);
  if (!s) return Response.json({ error: "not_found" }, { status: 404 });
  const view = new URL(request.url).searchParams.get("view");
  return Response.json(view === "owner" ? ownerView(s) : publicSnapshot(s), {
    headers: { "Cache-Control": "no-store" },
  });
}

const line = z.object({ dishId: z.string().min(1), qty: z.number().int().min(1).max(50) });

const Action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("sale"), lines: z.array(line).min(1).max(20), method: z.enum(["cash", "card"]) }),
  z.object({ action: z.literal("soldOut"), dishId: z.string().min(1), soldOut: z.boolean() }),
  z.object({ action: z.literal("open"), counts: z.record(z.string(), z.number().min(0).max(1_000_000)) }),
  z.object({ action: z.literal("close") }),
  z.object({ action: z.literal("reset") }),
  z.object({ action: z.literal("deliver"), reservationId: z.string().min(1) }),
  z.object({ action: z.literal("cancelReservation"), reservationId: z.string().min(1) }),
]);

export async function POST(request: Request, ctx: RouteContext<"/api/stalls/[slug]">) {
  const { slug } = await ctx.params;
  if (!(await store.get(slug))) return Response.json({ error: "not_found" }, { status: 404 });

  const parsed = Action.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "bad_request" }, { status: 400 });
  const a = parsed.data;

  switch (a.action) {
    case "sale": {
      const r = await store.recordSale(slug, a.lines, a.method);
      if (!r.ok) return Response.json({ error: r.reason, short: r.short ?? [] }, { status: 409 });
      return Response.json(ownerView(r.state));
    }
    case "soldOut":
      return Response.json(ownerView(await store.setSoldOut(slug, a.dishId, a.soldOut)));
    case "open":
      return Response.json(ownerView(await store.open(slug, a.counts)));
    case "close": {
      const { state, cashUp } = await store.close(slug);
      return Response.json({ ...ownerView(state), closedCashUp: cashUp });
    }
    case "reset":
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
  }
}
