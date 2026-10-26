import { cancelApproval, confirmApproval } from "@/lib/reservations";
import { origin } from "@/lib/origin";
import { PAYER_COOKIE } from "@/lib/stall";

// PayPal sends the customer back here (?token=<orderId>). Approved: place the
// hold. Cancelled: give the stock back. Then on to the stall page.
export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const slug = p.get("slug") ?? "";
  const id = p.get("id") ?? "";
  const lang = p.get("lang") === "en" ? "en" : "es";
  const page = `${origin(request)}/${lang}/${encodeURIComponent(slug)}`;

  let outcome = "error";
  let payerId: string | null = null;
  try {
    if (p.get("result") === "cancelled") {
      await cancelApproval(slug, id);
      outcome = "cancelled";
    } else {
      const r = await confirmApproval(slug, id, p.get("token") ?? "");
      if (r?.status === "authorized") outcome = r.id;
      payerId = r?.payerId ?? null;
    }
  } catch (e) {
    console.error("reservation return failed", e);
  }
  const headers = new Headers({ Location: `${page}?apartado=${encodeURIComponent(outcome)}` });
  if (payerId) {
    const secure = page.startsWith("https:") ? "; Secure" : "";
    headers.append(
      "Set-Cookie",
      `${PAYER_COOKIE}=${encodeURIComponent(payerId)}; Path=/; Max-Age=${365 * 24 * 3600}; HttpOnly; SameSite=Lax${secure}`,
    );
  }
  return new Response(null, { status: 303, headers });
}
