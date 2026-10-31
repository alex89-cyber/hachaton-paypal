
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

/** The customer's stamp card. */
export type StampCardInfo = {
  have: number | null;
  perReward: number;
  reward: string;
};

const POLL_MS = 5_000;
const FEW = 5;

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
  vapidKey: string | null;
  t: Dictionary;
}) {
  const [snap, setSnap] = useState(initial);
  const [now, setNow] = useState(() => Date.now());

  const es = lang === "es";

  useEffect(() => {
    let alive = true;

    const tick = async () => {
      try {
        const res = await fetch(`/api/stalls/${initial.slug}`, {
          cache: "no-store",
        });

        if (res.ok && alive) {
          setSnap(await res.json());
        }
      } catch {
        // Preserve the last valid snapshot.
      }

      if (alive) setNow(Date.now());
    };

    const id = setInterval(tick, POLL_MS);

    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [initial.slug]);

  useEffect(() => {
    if (!snap.isOpen) return;

    forgetWatch(snap.slug, null);

    for (const d of snap.dishes) {
      if (d.portions > 0) {
        forgetWatch(snap.slug, d.id);
      }
    }
  }, [snap]);

  const mins = minutesSince(snap.updatedAt, now);

  const available = snap.dishes.filter((d) => d.portions > 0);
  const gone = snap.dishes.filter((d) => d.portions === 0);
  const dishes = [...available, ...gone];

  return (
    <div className="flex w-full min-w-0 flex-col gap-8 pb-8">

      {/* BUSINESS HEADER */}
      <header className="relative overflow-hidden rounded-3xl border border-line bg-surface p-6 shadow-sm sm:p-8 lg:p-10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-brand/10 blur-3xl"
        />

        <div className="relative flex flex-col gap-5">
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-brand">
              {es ? "Comida recién hecha" : "Freshly prepared food"}
            </p>

            <h1 className="max-w-3xl text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
              {snap.name}
            </h1>

            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
              {es
                ? "Descubre lo que tenemos disponible hoy y aparta tus favoritos de forma sencilla."
                : "Discover what's available today and reserve your favorites easily."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ${
                snap.isOpen
                  ? "bg-ok-soft text-ok"
                  : "bg-bad-soft text-bad"
              }`}
            >
              <span
                className={`size-2.5 rounded-full ${
                  snap.isOpen
                    ? "animate-pulse bg-ok"
                    : "bg-bad"
                }`}
              />
              {snap.isOpen ? t.open : t.closed}
            </span>

            <span className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-xs font-medium text-muted sm:text-sm">
              <span aria-hidden="true">◷</span>
              {mins === 0
                ? t.updatedNow
                : fill(t.updated, { n: mins })}
            </span>
          </div>
        </div>
      </header>

      {/* PAYMENT / RESERVATION CONFIRMATION */}
      {confirmation && (
        <div
          role="status"
          className={`rounded-2xl border p-5 shadow-sm sm:p-6 ${
            confirmation.kind === "reserved"
              ? "border-ok/20 bg-ok-soft text-ok"
              : "border-warn/20 bg-warn-soft text-warn"
          }`}
        >
          {confirmation.kind === "reserved" ? (
            <div className="space-y-2">
              <p className="text-lg font-extrabold sm:text-xl">
                {fill(t.public.confirmedTitle, {
                  name: confirmation.name,
                })}
              </p>

              <p className="text-sm leading-relaxed">
                {fill(t.public.confirmedBody, {
                  time: clock(
                    confirmation.pickupBy,
                    timezone,
                    lang,
                  ),
                  total: money(
                    confirmation.totalCents,
                    snap.currency,
                    lang,
                  ),
                })}
              </p>

              {stampCard && (
                <p className="pt-1 text-sm font-semibold">
                  ⭐ {t.public.stampsNext}
                </p>
              )}
            </div>
          ) : (
            <p className="font-semibold">
              {confirmation.kind === "cancelled"
                ? t.public.cancelledNote
                : t.public.errorNote}
            </p>
          )}
        </div>
      )}

      {/* MENU */}
      <section className="flex min-w-0 flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-brand">
              {es ? "Descubre nuestros sabores" : "Explore our flavors"}
            </p>

            <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              {es ? "Nuestro menú" : "Our menu"}
            </h2>
          </div>

          {snap.isOpen && (
            <span className="rounded-full border border-line bg-surface px-4 py-2 text-xs font-semibold text-muted">
              {available.length}{" "}
              {es ? "platillos disponibles" : "dishes available"}
            </span>
          )}
        </div>

        {!snap.isOpen ? (
          <div className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-6 shadow-sm sm:p-8">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-bad-soft text-2xl">
              ◷
            </div>

            <h3 className="text-xl font-bold">
              {es ? "Por ahora estamos cerrados" : "We're currently closed"}
            </h3>

            <p className="max-w-xl leading-relaxed text-muted">
              {t.closedNote}
            </p>

            {vapidKey && (
              <div className="pt-2">
                <NotifyButton
                  slug={snap.slug}
                  dishId={null}
                  lang={lang}
                  vapidKey={vapidKey}
                  t={t}
                  wide
                />
              </div>
            )}
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {dishes.map((d) => {
              const out = d.portions === 0;
              const few = !out && d.portions <= FEW;

              return (
                <li
                  key={d.id}
                  className={`group flex min-w-0 flex-col justify-between overflow-hidden rounded-3xl border border-line bg-surface p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-6 ${
                    out ? "opacity-75" : ""
                  }`}
                >
                  <div className="space-y-4">

                    <div className="flex items-start justify-between gap-3">
                      <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand/10 text-brand">
                        <svg
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M4 3v7a3 3 0 0 0 6 0V3" />
                          <path d="M7 3v18" />
                          <path d="M20 3c-3 3-4 6-4 10h4V3Z" />
                          <path d="M20 13v8" />
                        </svg>
                      </div>

                      <span
                        className={`max-w-[65%] rounded-full px-3 py-1.5 text-center text-xs font-bold ${
                          out
                            ? "bg-bad-soft text-bad"
                            : few
                              ? "bg-warn-soft text-warn"
                              : "bg-ok-soft text-ok"
                        }`}
                      >
                        {out
                          ? t.soldOut
                          : few
                            ? t.fewLeft
                            : fill(t.left, { n: d.portions })}
                      </span>
                    </div>

                    <div>
                      <h3
                        className={`break-words text-lg font-bold leading-snug sm:text-xl ${
                          out ? "line-through" : ""
                        }`}
                      >
                        {es ? d.nameEs : d.nameEn}
                      </h3>

                      <p className="mt-2 text-sm text-muted">
                        {out
                          ? es
                            ? "No disponible por el momento"
                            : "Currently unavailable"
                          : es
                            ? "Preparado para ti"
                            : "Made for you"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 border-t border-line pt-4">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                      <div>
                        <p className="mb-1 text-xs font-medium text-muted">
                          {es ? "Precio" : "Price"}
                        </p>

                        <p className="text-2xl font-extrabold tracking-tight text-brand">
                          {money(d.priceCents, snap.currency, lang)}
                        </p>
                      </div>

                      {out && vapidKey && (
                        <NotifyButton
                          slug={snap.slug}
                          dishId={d.id}
                          lang={lang}
                          vapidKey={vapidKey}
                          t={t}
                        />
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ORDER ASSISTANT */}
      <section className="min-w-0 space-y-4">
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-brand">
            {es ? "Te ayudamos a elegir" : "We're here to help"}
          </p>

          <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            {es ? "Haz tu pedido" : "Place your order"}
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            {es
              ? "Utiliza nuestro asistente para consultar el menú y realizar tu apartado."
              : "Use our assistant to explore the menu and reserve your food."}
          </p>
        </div>

        <div className="min-w-0 overflow-hidden rounded-3xl border border-line bg-surface shadow-sm">
          <AgentChat
            slug={snap.slug}
            lang={lang}
            currency={snap.currency}
            timezone={timezone}
            isOpen={snap.isOpen}
            t={t}
          />
        </div>
      </section>

      {/* LOYALTY CARD */}
      {stampCard && (
        <section className="min-w-0 space-y-4">
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-brand">
              {es ? "Gracias por volver" : "Thanks for coming back"}
            </p>

            <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              {es ? "Tus recompensas" : "Your rewards"}
            </h2>
          </div>

          <StampCard
            slug={snap.slug}
            card={stampCard}
            t={t}
          />
        </section>
      )}

      <footer className="border-t border-line pt-6 text-center">
        <p className="text-xs text-muted">
          {t.madeWith}
        </p>
      </footer>
    </div>
  );
}

function StampCard({
  slug,
  card,
  t,
}: {
  slug: string;
  card: StampCardInfo;
  t: Dictionary;
}) {
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

    if (res?.ok) {
      location.reload();
    } else {
      setBad(true);
    }
  }

  const have = card.have ?? 0;
  const ready = have >= card.perReward;

  const vars = {
    have,
    n: card.perReward,
    reward: card.reward.toLowerCase(),
  };

  return (
    <section
      className={`flex flex-col gap-5 rounded-3xl border border-line p-5 shadow-sm sm:p-7 ${
        ready ? "bg-warn-soft" : "bg-surface"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-xl font-bold">
          {p.stampsTitle}
        </h3>

        <div className="rounded-full border border-line px-4 py-2 text-sm font-bold">
          {have} / {card.perReward}
        </div>
      </div>

      <ol
        className="grid grid-cols-5 gap-2 sm:grid-cols-10"
        aria-label={fill(p.stampsCount, vars)}
      >
        {Array.from({ length: card.perReward }, (_, i) => (
          <li
            key={i}
            className={`flex aspect-square items-center justify-center rounded-full border-2 text-lg font-bold transition-colors ${
              i < have
                ? "border-brand bg-brand text-white"
                : "border-dashed border-line text-muted"
            }`}
          >
            {i < have
              ? "★"
              : i === card.perReward - 1
                ? "🎁"
                : ""}
          </li>
        ))}
      </ol>

      <p
        className={`text-sm leading-relaxed ${
          ready ? "font-semibold text-warn" : "text-muted"
        }`}
      >
        {ready
          ? fill(p.stampsReady, vars)
          : card.have === null
            ? fill(p.stampsHowTo, vars)
            : `${fill(p.stampsCount, vars)} ${fill(p.stampsHowTo, vars)}`}
      </p>

      {card.have === null && (
        <form
          onSubmit={lookUp}
          className="flex flex-col gap-3"
        >
          <label
            className="text-sm font-semibold"
            htmlFor="stamp-phone"
          >
            {p.stampsPhone}
          </label>

          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              id="stamp-phone"
              value={phone}
              onChange={(e) => {
                setPhone(
                  e.target.value.replace(/[^\d +()-]/g, ""),
                );
                setBad(false);
              }}
              inputMode="tel"
              autoComplete="tel"
              placeholder="55 1234 5678"
              className="min-w-0 flex-1 rounded-2xl border border-line bg-background px-4 py-3 outline-none focus:border-brand"
            />

            <button
              type="submit"
              disabled={phone.replace(/\D/g, "").length < 10}
              className="rounded-2xl bg-brand px-6 py-3 font-bold text-white transition-opacity hover:opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {p.stampsPhoneButton}
            </button>
          </div>

          {bad && (
            <p className="text-sm text-bad">
              {p.stampsBadPhone}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
