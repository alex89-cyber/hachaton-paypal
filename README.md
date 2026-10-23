# ¿Todavía hay? ("Still got any?")

A minimal point of sale for street food stalls that sell until they run out. Every sale deducts ingredients by recipe, and a public page shows, live, whether the stall is open and which dishes are still left. An AI agent answers customers' "¿todavía hay?" and reserves their order with a PayPal payment that is only charged when they pick it up.

Built for the [PayPal AI Hackathon](https://paypalaihackathon.devpost.com/).

## Status

Work in progress. Done so far:

- Recipe-based inventory with shared ingredients (`src/lib/inventory.ts`) and sell-out forecast (`src/lib/forecast.ts`), with unit tests.
- Supabase schema with row-level security and atomic stock functions (`supabase/migrations/0001_init.sql`).
- PayPal Orders v2 client for authorize → capture on pickup → void on no-show (`src/lib/paypal.ts`).
- Bilingual (ES/EN) routing and a first public page for the demo stall, *Birria Doña Lupe*.

## How it uses PayPal and AI

- **PayPal:** reservations use Orders v2 with `intent: AUTHORIZE`. The customer approves when reserving, PayPal holds the funds, the owner's "Delivered" tap captures them, and a no-show voids the authorization so nothing is charged.
- **AI:** Gemini (via the Vercel AI SDK) powers the customer-facing agent, which reads live stock and creates reservations through tools.

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in PayPal sandbox, Gemini and Supabase keys
npm run dev                  # http://localhost:3000/es/birria-dona-lupe
npm test
```

Apply the database schema with the Supabase CLI (`supabase db push`) or by pasting `supabase/migrations/0001_init.sql` into the Supabase SQL editor.

## Roadmap

Offline sales with background sync (RN-08), purchase alerts, multiple employees and branches.

## License

MIT
