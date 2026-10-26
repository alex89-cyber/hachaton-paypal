import "server-only";
import { PayPalError } from "@/lib/paypal";

// Sandbox smoke test for the reserve → hold → capture/void flow. Off in live mode.

export const enabled = () => process.env.PAYPAL_ENV !== "live";

/** Public origin of this request (Render sits behind a proxy). */
export function origin(request: Request) {
  const h = request.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? new URL(request.url).host;
  const proto = h.get("x-forwarded-proto")?.split(",")[0] ?? new URL(request.url).protocol.replace(":", "");
  return `${proto}://${host}`;
}

export function failure(e: unknown, steps: unknown[]) {
  const error =
    e instanceof PayPalError
      ? { step: e.step, status: e.status, body: e.body.slice(0, 600) }
      : { message: e instanceof Error ? e.message : String(e) };
  return Response.json({ ok: false, steps, error }, { status: 502, headers: { "Cache-Control": "no-store" } });
}
