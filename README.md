# ¿Todavía hay? ("Still got any?")

A minimal point of sale for street food stalls that sell until they run out. Every sale deducts ingredients by recipe, and a public page shows, live, whether the stall is open and which dishes are still left. An AI agent answers customers' "¿todavía hay?" and reserves their order with a PayPal payment that is only charged when they pick it up.

Built for the [PayPal AI Hackathon](https://paypalaihackathon.devpost.com/).

## Status

Work in progress. Done so far:

- Recipe-based inventory with shared ingredients (`src/lib/inventory.ts`) and sell-out forecast (`src/lib/forecast.ts`), with unit tests.
- Supabase schema with row-level security and atomic stock functions (`supabase/migrations/0001_init.sql`).
- PayPal Orders v2 client for authorize → capture on pickup → void on no-show (`src/lib/paypal.ts`).
- Bilingual (ES/EN) routing.
- **Owner panel** (`/es/panel/birria-dona-lupe`): one-tap sales with a running ticket, cash or card, "sold out" switch per dish, portions left and sell-out forecast per dish, opening count and cash-up (corte de caja).
- **Public page** (`/es/birria-dona-lupe`): open/closed, dishes left and freshness, refreshed every few seconds.
- **"¿Todavía hay?" agent**: customers ask in Spanish or English and reserve; PayPal holds the payment until pickup.
- **Stamp card**: every reserved order paid with PayPal and handed over adds a stamp to the payer's card (keyed by their PayPal payer id). 10 stamps earn a free quesabirria, redeemed from the owner panel.
- **"Avísame cuando haya"**: when the stall is closed or a dish is sold out, customers can turn on a browser push alert (Web Push, no paid provider). It is sent once when the stall opens or the dish comes back. On iPhone it works after adding the page to the home screen.
- **Cash-up in AG Studio** (`/es/panel/birria-dona-lupe/corte`): the day's sales, inventory and reservations as an AG Studio dashboard that opens ready (KPIs, sales per dish and hour, payment methods, ingredient usage, sales grid), themed in the stall's colours, with a custom "Ticket del corte" receipt widget (`src/components/studio`). Studio's AI agents answer the owner in Spanish ("¿Qué platillo me deja más?") and can add or change widgets; their LLM turns go to Gemini through `/api/studio/llm`, so the key stays on the server.
- Data lives in Supabase when `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set; without them the app falls back to an in-memory store. Both implement the same interface (`src/lib/store`), and the demo reset seeds a morning of sales.

## How it uses PayPal and AI

- **PayPal:** reservations use Orders v2 with `intent: AUTHORIZE`. The customer approves when reserving, PayPal holds the funds, the owner's "Delivered" tap captures them, and a no-show voids the authorization so nothing is charged.
- **AI:** Gemini (via the Vercel AI SDK) powers the customer-facing agent, which reads live stock and creates reservations through tools.
- **AG Studio agents:** the cash-up dashboard uses the Studio Agent Framework (`createAiHarness` with AG's built-in agents) on a custom `AgLlmAdapter` (`src/components/studio/geminiAdapter.ts`) that sends each turn to Gemini on our server. Studio runs its own tools in the browser.

## Run locally

```bash
npm install
cp .env.example .env.local   # optional for now: the demo runs without keys
npm run dev                  # http://localhost:3000/es (public page + owner panel)
npm test
```

Apply the database schema with the Supabase CLI (`supabase db push`) or by pasting `supabase/migrations/0001_init.sql` and then `0002_server_access_and_demo.sql` into the Supabase SQL editor, followed by `0003_reservations.sql`, `0004_stamps_and_alerts.sql` and `0005_restock_and_counter_stamps.sql`. The second file also creates the demo stall.

Push alerts need a VAPID key pair: run `npx web-push generate-vapid-keys` and set `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` (optionally `VAPID_SUBJECT`, a `mailto:` or https URL). Without them the alert buttons are hidden.

AG Studio runs without a license key, with a watermark. To remove it, set `NEXT_PUBLIC_AG_STUDIO_LICENSE` (a Studio Pro with AI key) before building. The Studio agents use the same `GOOGLE_GENERATIVE_AI_API_KEY` as the customer agent (`STUDIO_GEMINI_MODEL` overrides the model, `gemini-flash-latest` by default).

## Roadmap

Offline sales with background sync (RN-08), WhatsApp or email alerts, multiple employees and branches.

## License

MIT
