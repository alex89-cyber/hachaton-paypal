import { z } from "zod";
import { agentAvailable, chat } from "@/lib/agent";
import { origin } from "@/lib/origin";
import { loadStall } from "@/lib/reservations";

// POST /api/stalls/:slug/chat  { lang, messages }  → { reply, reservation? }
// The client keeps the conversation; only the last turns are sent.

const Body = z.object({
  lang: z.enum(["es", "en"]),
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(600) }))
    .min(1)
    .max(30),
});

export async function POST(request: Request, ctx: RouteContext<"/api/stalls/[slug]/chat">) {
  const { slug } = await ctx.params;
  if (!agentAvailable()) return Response.json({ error: "agent_unavailable" }, { status: 503 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "bad_request" }, { status: 400 });

  const s = await loadStall(slug);
  if (!s) return Response.json({ error: "not_found" }, { status: 404 });

  const messages = parsed.data.messages.slice(-12);
  if (messages[messages.length - 1].role !== "user") return Response.json({ error: "bad_request" }, { status: 400 });

  try {
    const out = await chat(s, messages, { lang: parsed.data.lang, origin: origin(request) });
    return Response.json(out, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("agent failed", e);
    return Response.json({ error: "agent_failed" }, { status: 502 });
  }
}
