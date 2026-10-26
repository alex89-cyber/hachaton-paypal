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
- Data lives in Supabase when `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set; without them the app falls back to an in-memory store. Both implement the same interface (`src/lib/store`), and the demo reset seeds a morning of sales.

## How it uses PayPal and AI

- **PayPal:** reservations use Orders v2 with `intent: AUTHORIZE`. The customer approves when reserving, PayPal holds the funds, the owner's "Delivered" tap captures them, and a no-show voids the authorization so nothing is charged.
- **AI:** Gemini (via the Vercel AI SDK) powers the customer-facing agent, which reads live stock and creates reservations through tools.

## Run locally

```bash
npm install
cp .env.example .env.local   # optional for now: the demo runs without keys
npm run dev                  # http://localhost:3000/es (public page + owner panel)
npm test
```

Apply the database schema with the Supabase CLI (`supabase db push`) or by pasting `supabase/migrations/0001_init.sql` and then `0002_server_access_and_demo.sql` into the Supabase SQL editor, followed by `0003_reservations.sql`, `0004_stamps_and_alerts.sql` and `0005_restock_and_counter_stamps.sql`. The second file also creates the demo stall.

Push alerts need a VAPID key pair: run `npx web-push generate-vapid-keys` and set `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` (optionally `VAPID_SUBJECT`, a `mailto:` or https URL). Without them the alert buttons are hidden.

## Roadmap

Offline sales with background sync (RN-08), WhatsApp or email alerts, multiple employees and branches.

## License

MIT
