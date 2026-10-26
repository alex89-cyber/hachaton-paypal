"use client";

import { useEffect, useState } from "react";
import type { Dictionary } from "@/dictionaries";
import { clock, fill, minutesSince, money } from "@/lib/format";
import type { PublicSnapshot } from "@/lib/stall";
import { AgentChat } from "./AgentChat";

/** Shown after PayPal sends the customer back. */
export type Confirmation =
  | { kind: "reserved"; name: string; pickupBy: string; totalCents: number }
  | { kind: "cancelled" }
  | { kind: "error" };

const POLL_MS = 5_000;
const FEW = 5;

// RN-07: what the customer sees. Polls the snapshot so a sale or a "se acabó"
// on the owner's phone shows up here within seconds.
export function PublicStall({
  initial,
  lang,
  timezone,
  confirmation,
  t,
}: {
  initial: PublicSnapshot;
  lang: "es" | "en";
  timezone: string;
  confirmation: Confirmation | null;
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
            </>
          ) : (
            <p className="font-semibold">
              {confirmation.kind === "cancelled" ? t.public.cancelledNote : t.public.errorNote}
            </p>
          )}
        </div>
      )}

      {!snap.isOpen ? (
        <p className="rounded-2xl bg-surface p-5 text-muted shadow-sm">{t.closedNote}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {[...available, ...gone].map((d) => {
            const out = d.portions === 0;
            const few = !out && d.portions <= FEW;
            return (
              <li
                key={d.id}
                className={`flex items-center justify-between gap-4 rounded-2xl bg-surface p-4 shadow-sm ${out ? "opacity-60" : ""}`}
              >
                <div className="min-w-0">
                  <p className={`truncate text-lg font-semibold ${out ? "line-through" : ""}`}>
                    {lang === "es" ? d.nameEs : d.nameEn}
                  </p>
                  <p className="text-sm text-muted">{money(d.priceCents, snap.currency, lang)}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${
                    out ? "bg-bad-soft text-bad" : few ? "bg-warn-soft text-warn" : "bg-ok-soft text-ok"
                  }`}
                >
                  {out ? t.soldOut : few ? t.fewLeft : fill(t.left, { n: d.portions })}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <AgentChat slug={snap.slug} lang={lang} currency={snap.currency} timezone={timezone} isOpen={snap.isOpen} t={t} />
      <p className="text-center text-xs text-muted">{t.madeWith}</p>
    </div>
  );
}
