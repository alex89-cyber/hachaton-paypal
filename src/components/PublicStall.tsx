"use client";

import { useEffect, useState } from "react";
import type { Dictionary } from "@/dictionaries";
import { clock, fill, minutesSince, money } from "@/lib/format";
import type { PublicSnapshot } from "@/lib/stall";
import { AgentChat } from "./AgentChat";
import { NotifyButton, forgetWatch } from "./NotifyButton";

/** Shown after PayPal sends the customer back. */
export type Confirmation =
  | { kind: "reserved"; name: string; pickupBy: string; totalCents: number }
  | { kind: "cancelled" }
  | { kind: "error" };

/** The customer's stamp card. `have` is null until they have paid once with PayPal here. */
export type StampCardInfo = { have: number | null; perReward: number; reward: string };

const POLL_MS = 5_000;
const FEW = 5;

// RN-07: what the customer sees. Polls the snapshot so a sale or a "se acabó"
// on the owner's phone shows up here within seconds.
export function PublicStall({
  initial,
  lang,
  timezone,
  confirmation,
  stampCard,
  vapidKey,
  t,
}: {
  initial: PublicSnapshot;
  lang: "es" | "en";
  timezone: string;
  confirmation: Confirmation | null;
  stampCard: StampCardInfo | null;
  /** Set when push alerts are configured on the server. */
  vapidKey: string | null;
  t: Dictionary;
}) {
  const [snap, setSnap] = useState(initial);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch(`/api/stalls/${initial.slug}`, { cache: "no-store" });
        if (res.ok && alive) setSnap(await res.json());
      } catch {
        // Keep showing the last snapshot; the "updated X min ago" line tells the customer how fresh it is.
      }
      if (alive) setNow(Date.now());
    };
    const id = setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [initial.slug]);

  // An alert that fired is done: offer it again the next time it runs out.
  useEffect(() => {
    if (!snap.isOpen) return;
    forgetWatch(snap.slug, null);
    for (const d of snap.dishes) if (d.portions > 0) forgetWatch(snap.slug, d.id);
  }, [snap]);

  const mins = minutesSince(snap.updatedAt, now);
  const available = snap.dishes.filter((d) => d.portions > 0);
  const gone = snap.dishes.filter((d) => d.portions === 0);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">{snap.name}</h1>
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${
              snap.isOpen ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad"
            }`}
          >
            <span className={`size-2 rounded-full ${snap.isOpen ? "animate-pulse bg-ok" : "bg-bad"}`} />
            {snap.isOpen ? t.open : t.closed}
          </span>
          <span className="text-sm text-muted">{mins === 0 ? t.updatedNow : fill(t.updated, { n: mins })}</span>
        </div>
      </header>

      {confirmation && (
        <div
          role="status"
          className={`rounded-2xl p-4 ${confirmation.kind === "reserved" ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn"}`}
        >
          {confirmation.kind === "reserved" ? (
            <>
              <p className="text-lg font-bold">{fill(t.public.confirmedTitle, { name: confirmation.name })}</p>
              <p className="text-sm">
                {fill(t.public.confirmedBody, {
                  time: clock(confirmation.pickupBy, timezone, lang),
                  total: money(confirmation.totalCents, snap.currency, lang),
                })}
              </p>
              {stampCard && <p className="mt-1 text-sm font-semibold">⭐ {t.public.stampsNext}</p>}
            </>
          ) : (
            <p className="font-semibold">
              {confirmation.kind === "cancelled" ? t.public.cancelledNote : t.public.errorNote}
            </p>
          )}
        </div>
      )}

      {!snap.isOpen ? (
        <div className="flex flex-col gap-3 rounded-2xl bg-surface p-5 shadow-sm">
          <p className="text-muted">{t.closedNote}</p>
          {vapidKey && <NotifyButton slug={snap.slug} dishId={null} lang={lang} vapidKey={vapidKey} t={t} wide />}
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {[...available, ...gone].map((d) => {
            const out = d.portions === 0;
            const few = !out && d.portions <= FEW;
            return (
              <li
                key={d.id}
                className="flex items-center justify-between gap-4 rounded-2xl bg-surface p-4 shadow-sm"
              >
                <div className={`min-w-0 ${out ? "opacity-60" : ""}`}>
                  <p className={`truncate text-lg font-semibold ${out ? "line-through" : ""}`}>
                    {lang === "es" ? d.nameEs : d.nameEn}
                  </p>
                  <p className="text-sm text-muted">{money(d.priceCents, snap.currency, lang)}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-sm font-semibold ${
                      out ? "bg-bad-soft text-bad" : few ? "bg-warn-soft text-warn" : "bg-ok-soft text-ok"
                    }`}
                  >
                    {out ? t.soldOut : few ? t.fewLeft : fill(t.left, { n: d.portions })}
                  </span>
                  {out && vapidKey && (
                    <NotifyButton slug={snap.slug} dishId={d.id} lang={lang} vapidKey={vapidKey} t={t} />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <AgentChat slug={snap.slug} lang={lang} currency={snap.currency} timezone={timezone} isOpen={snap.isOpen} t={t} />
      {stampCard && <StampCard slug={snap.slug} card={stampCard} t={t} />}
      <p className="text-center text-xs text-muted">{t.madeWith}</p>
    </div>
  );
}

function StampCard({ slug, card, t }: { slug: string; card: StampCardInfo; t: Dictionary }) {
  const p = t.public;
  const [phone, setPhone] = useState("");
  const [bad, setBad] = useState(false);
  async function lookUp(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/stalls/${slug}/card`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    }).catch(() => null);
    if (res?.ok) location.reload();
    else setBad(true);
  }
  const have = card.have ?? 0;
  const ready = have >= card.perReward;
  const vars = { have, n: card.perReward, reward: card.reward.toLowerCase() };
  return (
    <section className={`flex flex-col gap-3 rounded-2xl p-4 shadow-sm ${ready ? "bg-warn-soft" : "bg-surface"}`}>
      <h2 className="text-lg font-bold">{p.stampsTitle}</h2>
      <ol className="grid grid-cols-5 gap-2" aria-label={fill(p.stampsCount, vars)}>
        {Array.from({ length: card.perReward }, (_, i) => (
          <li
            key={i}
            className={`flex aspect-square items-center justify-center rounded-full border-2 text-lg ${
              i < have ? "border-brand bg-brand text-white" : "border-dashed border-line text-muted"
            }`}
          >
            {i < have ? "★" : i === card.perReward - 1 ? "🎁" : ""}
          </li>
        ))}
      </ol>
      <p className={`text-sm ${ready ? "font-semibold text-warn" : "text-muted"}`}>
        {ready
          ? fill(p.stampsReady, vars)
          : card.have === null
            ? fill(p.stampsHowTo, vars)
            : `${fill(p.stampsCount, vars)} ${fill(p.stampsHowTo, vars)}`}
      </p>
      {card.have === null && (
        <form onSubmit={lookUp} className="flex flex-col gap-2">
          <label className="text-sm font-semibold" htmlFor="stamp-phone">
            {p.stampsPhone}
          </label>
          <div className="flex gap-2">
            <input
              id="stamp-phone"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value.replace(/[^\d +()-]/g, ""));
                setBad(false);
              }}
              inputMode="tel"
              autoComplete="tel"
              placeholder="55 1234 5678"
              className="min-w-0 flex-1 rounded-full border border-line bg-background px-4 py-2.5"
            />
            <button
              type="submit"
              disabled={phone.replace(/\D/g, "").length < 10}
              className="rounded-full bg-brand px-5 font-semibold text-white active:scale-95 disabled:opacity-50"
            >
              {p.stampsPhoneButton}
            </button>
          </div>
          {bad && <p className="text-sm text-bad">{p.stampsBadPhone}</p>}
        </form>
      )}
    </section>
  );
}
