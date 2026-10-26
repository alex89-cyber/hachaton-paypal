import { cancelApproval, confirmApproval } from "@/lib/reservations";
import { origin } from "@/lib/origin";

// PayPal sends the customer back here (?token=<orderId>). Approved: place the
// hold. Cancelled: give the stock back. Then on to the stall page.
export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const slug = p.get("slug") ?? "";
  const id = p.get("id") ?? "";
  const lang = p.get("lang") === "en" ? "en" : "es";
  const page = `${origin(request)}/${lang}/${encodeURIComponent(slug)}`;

  let outcome = "error";
  try {
    if (p.get("result") === "cancelled") {
      await cancelApproval(slug, id);
      outcome = "cancelled";
    } else {
      const r = await confirmApproval(slug, id, p.get("token") ?? "");
      if (r?.status === "authorized") outcome = r.id;
    }
  } catch (e) {
    console.error("reservation return failed", e);
  }
  return Response.redirect(`${page}?apartado=${encodeURIComponent(outcome)}`, 303);
}
