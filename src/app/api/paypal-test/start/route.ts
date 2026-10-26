import { createReservationOrder } from "@/lib/paypal";
import { enabled, failure, origin } from "../shared";

// GET /api/paypal-test/start[?mode=void]  creates a $45 MXN order and sends you to PayPal to approve it.
export async function GET(request: Request) {
  if (!enabled()) return Response.json({ error: "not_found" }, { status: 404 });
  const mode = new URL(request.url).searchParams.get("mode") === "void" ? "void" : "capture";
  const base = origin(request);
  try {
    const { orderId, approveUrl } = await createReservationOrder({
      reservationId: `test-${crypto.randomUUID()}`,
      businessName: "Birria Doña Lupe",
      currency: "MXN",
      items: [{ name: "Quesabirria", qty: 1, unitCents: 4500 }],
      returnUrl: `${base}/api/paypal-test/return?mode=${mode}`,
      cancelUrl: `${base}/api/paypal-test/return?mode=cancelled`,
      locale: "es-MX",
    });
    if (new URL(request.url).searchParams.has("json")) return Response.json({ ok: true, orderId, approveUrl });
    return Response.redirect(approveUrl, 302);
  } catch (e) {
    return failure(e, [{ step: "create_order", base }]);
  }
}
