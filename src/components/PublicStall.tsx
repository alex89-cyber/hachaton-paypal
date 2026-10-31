
"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
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

/**
 * Maps the demo dishes to their local photographs.
 * This does not require database changes.
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getDishImage(
  nameEs: string,
  nameEn: string,
): string | null {
  const es = normalize(nameEs);
  const en = normalize(nameEn);

  if (es.includes("quesabirria") || en.includes("quesabirria")) {
    return "/menu/quesabirria.jpg";
  }

  if (
    es.includes("plato de birria") ||
    en.includes("birria plate")
  ) {
    return "/menu/plato-birria.jpg";
  }

  if (es.includes("consome") || en.includes("consome")) {
    return "/menu/consome.jpg";
  }

  if (es.includes("taco") || en.includes("taco")) {
    return "/menu/tacos.jpg";
  }

  return null;
}

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

  // Keep availability synchronized with the business.
  useEffect(() => {
    let alive = true;

    const tick = async () => {
      try {
        const res = await fetch(
          `/api/stalls/${initial.slug}`,
          { cache: "no-store" },
        );

        if (res.ok && alive) {
          setSnap(await res.json());
        }
      } catch {
        // Keep displaying the last valid snapshot.
      }

      if (alive) {
        setNow(Date.now());
      }
    };

    const id = setInterval(tick, POLL_MS);

    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [initial.slug]);

  // A notification that already fired may be requested again.
  useEffect(() => {
    if (!snap.isOpen) return;

    forgetWatch(snap.slug, null);

    for (const dish of snap.dishes) {
      if (dish.portions > 0) {
        forgetWatch(snap.slug, dish.id);
      }
    }
  }, [snap]);

  const mins = minutesSince(snap.updatedAt, now);

  const available = snap.dishes.filter(
    (dish) => dish.portions > 0,
  );

  const gone = snap.dishes.filter(
    (dish) => dish.portions === 0,
  );

  const dishes = [...available, ...gone];

  return (
    <div className="flex w-full min-w-0 flex-col gap-8 pb-10">

      {/* =========================
          BUSINESS HERO
      ========================= */}
      <header className="overflow-hidden rounded-[2rem] border border-line bg-surface shadow-sm">
        <div className="grid lg:grid-cols-[1.15fr_0.85fr]">

          {/* Branding and information */}
          <div className="flex min-w-0 flex-col justify-center gap-5 px-6 py-8 sm:px-8 sm:py-10 lg:px-10">

            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">

              {/* Restaurant logo */}
              <div className="relative h-32 w-32 shrink-0 overflow-hidden rounded-3xl border border-line bg-[#fff9ed] shadow-sm sm:h-36 sm:w-36">
                <Image
                  src="/logo-birria-dona-lupe.png"
                  alt="Logo de Birria Doña Lupe"
                  fill
                  sizes="(min-width: 640px) 144px, 128px"
                  className="object-contain p-1"
                  priority
                />
              </div>

              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">
                  {es
                    ? "Tradición y sabor casero"
                    : "Homestyle tradition and flavor"}
                </p>

                <h1 className="mt-3 break-words text-3xl font-black leading-tight tracking-tight text-[#2e1b14] sm:text-4xl lg:text-[2.7rem]">
                  {snap.name}
                </h1>
              </div>
            </div>

            <p className="max-w-xl text-sm leading-relaxed text-muted sm:text-base">
              {es
                ? "El sabor de la birria tradicional, preparado para ti. Descubre lo que tenemos disponible y aparta tus favoritos antes de que se acaben."
                : "The taste of traditional birria, prepared for you. Explore what's available and reserve your favorites before they sell out."}
            </p>

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

              <span className="inline-flex items-center gap-2 rounded-full border border-line bg-background px-4 py-2 text-sm text-muted">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" />
                </svg>

                {mins === 0
                  ? t.updatedNow
                  : fill(t.updated, { n: mins })}
              </span>
            </div>
          </div>

          {/* Hero photograph */}
          <div className="relative min-h-[240px] overflow-hidden bg-[#f4e5d5] sm:min-h-[320px] lg:min-h-[380px]">
            <Image
              src="/menu/plato-birria.jpg"
              alt={
                es
                  ? "Plato de birria tradicional"
                  : "Traditional birria plate"
              }
              fill
              sizes="(min-width: 1024px) 40vw, 100vw"
              className="object-cover"
              priority
            />

            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
          </div>
        </div>
      </header>

      {/* =========================
          RESERVATION CONFIRMATION
      ========================= */}
      {confirmation && (
        <div
          role="status"
          className={`rounded-3xl border p-5 shadow-sm sm:p-6 ${
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

      {/* =========================
          MENU
      ========================= */}
      <section className="flex min-w-0 flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-brand">
              {es ? "Menú del día" : "Today's menu"}
            </p>

            <h2 className="text-3xl font-black tracking-tight text-[#2e1b14] sm:text-4xl">
              {es
                ? "Lo que todavía hay"
                : "What's still available"}
            </h2>

            <p className="mt-2 max-w-xl text-sm text-muted">
              {es
                ? "Elige entre nuestros platillos y consulta su disponibilidad."
                : "Explore our dishes and check what's available."}
            </p>
          </div>

          {snap.isOpen && (
            <span className="rounded-full border border-line bg-surface px-4 py-2 text-xs font-semibold text-muted sm:text-sm">
              {available.length}{" "}
              {es
                ? "platillos disponibles"
                : "dishes available"}
            </span>
          )}
        </div>

        {!snap.isOpen ? (
          <div className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-6 shadow-sm sm:p-8">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-bad-soft text-bad">
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
            </div>

            <h3 className="text-xl font-bold">
              {es
                ? "Por ahora estamos cerrados"
                : "We're currently closed"}
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
          <ul className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {dishes.map((dish) => {
              const out = dish.portions === 0;
              const few = !out && dish.portions <= FEW;

              const dishName = es
                ? dish.nameEs
                : dish.nameEn;

              const image = getDishImage(
                dish.nameEs,
                dish.nameEn,
              );

              return (
                <li
                  key={dish.id}
                  className={`group overflow-hidden rounded-[1.75rem] border border-line bg-surface shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                    out ? "opacity-75" : ""
                  }`}
                >
                  <div className="flex h-full flex-col sm:flex-row">

                    {/* Dish photo */}
                    <div className="relative h-56 shrink-0 overflow-hidden bg-[#f2e5d8] sm:h-auto sm:w-[42%]">
                      {image ? (
                        <Image
                          src={image}
                          alt={dishName}
                          fill
                          sizes="(min-width: 1024px) 22vw, (min-width: 640px) 42vw, 100vw"
                          className={`object-cover transition-transform duration-300 group-hover:scale-105 ${
                            out ? "grayscale" : ""
                          }`}
                        />
                      ) : (
                        <div className="flex h-full min-h-[200px] items-center justify-center bg-brand/10 text-brand">
                          <svg
                            width="44"
                            height="44"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
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
                      )}
                    </div>

                    {/* Dish information */}
                    <div className="flex min-w-0 flex-1 flex-col justify-between gap-5 p-5 sm:p-6">
                      <div>
                        <span
                          className={`inline-flex rounded-full px-3 py-1.5 text-xs font-bold ${
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
                              : fill(t.left, {
                                  n: dish.portions,
                                })}
                        </span>

                        <h3
                          className={`mt-4 break-words text-xl font-extrabold leading-tight text-[#2e1b14] sm:text-2xl ${
                            out ? "line-through" : ""
                          }`}
                        >
                          {dishName}
                        </h3>

                        <p className="mt-2 text-sm leading-relaxed text-muted">
                          {out
                            ? es
                              ? "Agotado por el momento."
                              : "Currently sold out."
                            : es
                              ? "Consulta y aparta este platillo con nuestro asistente."
                              : "Ask our assistant to reserve this dish."}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-end justify-between gap-3 border-t border-line pt-4">
                        <div>
                          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
                            {es ? "Precio" : "Price"}
                          </p>

                          <p className="text-2xl font-black tracking-tight text-brand">
                            {money(
                              dish.priceCents,
                              snap.currency,
                              lang,
                            )}
                          </p>
                        </div>

                        {out && vapidKey && (
                          <NotifyButton
                            slug={snap.slug}
                            dishId={dish.id}
                            lang={lang}
                            vapidKey={vapidKey}
                            t={t}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* =========================
          ORDER ASSISTANT
      ========================= */}
      <section className="min-w-0 space-y-4">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-brand">
            {es
              ? "Estamos para ayudarte"
              : "We're here to help"}
          </p>

          <h2 className="text-3xl font-black tracking-tight text-[#2e1b14] sm:text-4xl">
            {es
              ? "Haz tu apartado"
              : "Reserve your order"}
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            {es
              ? "Pregunta por tus platillos favoritos, revisa su disponibilidad y solicita tu apartado."
              : "Ask about your favorite dishes, check availability and request your reservation."}
          </p>
        </div>

        <div className="min-w-0 overflow-hidden rounded-[1.75rem] border border-line bg-surface shadow-sm">
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

      {/* =========================
          LOYALTY / STAMP CARD
      ========================= */}
      {stampCard && (
        <section className="min-w-0 space-y-4">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-brand">
              {es
                ? "Gracias por tu preferencia"
                : "Thanks for choosing us"}
            </p>

            <h2 className="text-3xl font-black tracking-tight text-[#2e1b14] sm:text-4xl">
              {es
                ? "Tus recompensas"
                : "Your rewards"}
            </h2>
          </div>

          <StampCard
            slug={snap.slug}
            card={stampCard}
            t={t}
          />
        </section>
      )}

      {/* FOOTER */}
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

  async function lookUp(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const res = await fetch(
      `/api/stalls/${slug}/card`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone }),
      },
    ).catch(() => null);

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
      className={`flex flex-col gap-5 rounded-[1.75rem] border border-line p-5 shadow-sm sm:p-7 ${
        ready
          ? "bg-warn-soft"
          : "bg-surface"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-xl font-bold">
          {p.stampsTitle}
        </h3>

        <div className="rounded-full border border-line bg-background/70 px-4 py-2 text-sm font-bold">
          {have} / {card.perReward}
        </div>
      </div>

      <ol
        className="grid grid-cols-5 gap-2 sm:grid-cols-10"
        aria-label={fill(p.stampsCount, vars)}
      >
        {Array.from(
          { length: card.perReward },
          (_, i) => (
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
          ),
        )}
      </ol>

      <p
        className={`text-sm leading-relaxed ${
          ready
            ? "font-semibold text-warn"
            : "text-muted"
        }`}
      >
        {ready
          ? fill(p.stampsReady, vars)
          : card.have === null
            ? fill(p.stampsHowTo, vars)
            : `${fill(
                p.stampsCount,
                vars,
              )} ${fill(
                p.stampsHowTo,
                vars,
              )}`}
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
                  e.target.value.replace(
                    /[^\d +()-]/g,
                    "",
                  ),
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
              disabled={
                phone.replace(/\D/g, "").length < 10
              }
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
