import { authorizeOrder, captureAuthorization, voidAuthorization } from "@/lib/paypal";
import { enabled, failure } from "../shared";

// PayPal sends the buyer back here with ?token=<orderId>. Places the hold, then
// captures it (what "Entregado" will do) or voids it (a no-show).
export async function GET(request: Request) {
  if (!enabled()) return Response.json({ error: "not_found" }, { status: 404 });
  const params = new URL(request.url).searchParams;
  const orderId = params.get("token");
  const mode = params.get("mode");
  const steps: Record<string, unknown>[] = [{ step: "approved_by_buyer", orderId }];
  const noStore = { headers: { "Cache-Control": "no-store" } };

  if (mode === "cancelled") return Response.json({ ok: false, steps, note: "Buyer cancelled on PayPal" }, noStore);
  if (!orderId) return Response.json({ ok: false, error: "missing token" }, { status: 400 });

  try {
    const auth = await authorizeOrder(orderId);
    steps.push({ step: "authorize", ...auth });
    if (mode === "void") {
      await voidAuthorization(auth.authorizationId);
      steps.push({ step: "void", status: "VOIDED" });
    } else {
      const cap = await captureAuthorization(auth.authorizationId);
      steps.push({ step: "capture", captureId: cap.id, status: cap.status });
    }
    return Response.json({ ok: true, steps }, noStore);
  } catch (e) {
    return failure(e, steps);
  }
}
