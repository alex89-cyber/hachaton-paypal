import "server-only";
import { PayPalError } from "@/lib/paypal";
export { origin } from "@/lib/origin";

// Sandbox smoke test for the reserve → hold → capture/void flow. Off in live mode.

export const enabled = () => process.env.PAYPAL_ENV !== "live";

export function failure(e: unknown, steps: unknown[]) {
  const error =
    e instanceof PayPalError
      ? { step: e.step, status: e.status, body: e.body.slice(0, 600) }
      : { message: e instanceof Error ? e.message : String(e) };
  return Response.json({ ok: false, steps, error }, { status: 502, headers: { "Cache-Control": "no-store" } });
}
