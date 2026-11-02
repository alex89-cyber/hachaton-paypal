
"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { CSSProperties, FormEvent } from "react";

import type { Dictionary } from "@/dictionaries";
import { clock, fill, minutesSince, money } from "@/lib/format";
import type { PublicSnapshot } from "@/lib/stall";

import { AgentChat } from "./AgentChat";
import { NotifyButton, forgetWatch } from "./NotifyButton";

// ==========================================
// TIPOS
// ==========================================

/** Una reserva activa, como la ve el cliente. */
export type HeldOrder = {
  code: string | null;
  orderNumber: number | null;
  items: string;
  pickupBy: string;
  totalCents: number;
};

export type Confirmation =
  | ({
      kind: "reserved";
      name: string;
    } & HeldOrder)
  | { kind: "cancelled" }
  | { kind: "error" };

export type StampCardInfo = {
  have: number | null;
  perReward: number;
  reward: string;
};

const POLL_MS = 5_000;
const FEW = 5;

// ==========================================
// IMÁGENES
// ==========================================

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getDemoDishImage(
  nameEs: string,
  nameEn: string,
): string | null {
  const es = normalize(nameEs);
  const en = normalize(nameEn);

  if (es.includes("quesabirria") || en.includes("quesabirria")) {
    return "/menu/quesabirria.jpg";
  }

  if (es.includes("plato de birria") || en.includes("birria plate")) {
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

function DishImage({
  imageUrl,
  fallback,
  alt,
  out,
}: {
  imageUrl: string | null;
  fallback: string | null;
  alt: string;
  out: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const customImage = imageUrl && !failed ? imageUrl : null;

  if (customImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        key={customImage}
        src={customImage}
        alt={alt}
        className={`h-full w-full object-cover transition-transform duration-300 group-hover:scale-105 ${
          out ? "grayscale" : ""
        }`}
        onError={() => setFailed(true)}
      />
    );
  }

  if (fallback) {
    return (
      <Image
        src={fallback}
        alt={alt}
        fill
        sizes="(min-width: 1024px) 22vw, (min-width: 640px) 42vw, 100vw"
        className={`object-cover transition-transform duration-300 group-hover:scale-105 ${
          out ? "grayscale" : ""
        }`}
      />
    );
  }

  return (
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
  );
}

function CustomImage({
  src,
  fallback,
  alt,
  className,
}: {
  src: string | null | undefined;
  fallback: string | null;
  alt: string;
  className: string;
}) {
  const [failed, setFailed] = useState(false);
  const custom = src && !failed ? src : null;

  if (custom) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        key={custom}
        src={custom}
        alt={alt}
        className={className}
        onError={() => setFailed(true)}
      />
    );
  }

  if (fallback) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={fallback} alt={alt} className={className} />
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-[#fff4e4] text-5xl">
      🍽️
    </div>
  );
}

// ==========================================
// VALIDACIONES
// ==========================================

function safeColor(value: string | undefined): string | undefined {
  return value && /^#[0-9a-fA-F]{6}$/.test(value)
    ? value
    : undefined;
}

function safeUrl(value: string | null | undefined): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

// ==========================================
// PÁGINA PÚBLICA
// ==========================================

export function PublicStall({
  initial,
  lang,
  timezone,
  confirmation,
  holds,
  stampCard,
  vapidKey,
  t,
}: {
  initial: PublicSnapshot;
  lang: "es" | "en";
  timezone: string;
  confirmation: Confirmation | null;
  holds: HeldOrder[];
  stampCard: StampCardInfo | null;
  vapidKey: string | null;
  t: Dictionary;
}) {
  const [snap, setSnap] = useState(initial);
  const [now, setNow] = useState(() => Date.now());

  const es = lang === "es";

  // ========================================
  // PERSONALIZACIÓN
  // ========================================

  const settings = snap.settings;
  const theme = settings?.theme;
  const isDemo = snap.slug === "birria-dona-lupe";

  const logoFallback = isDemo
    ? "/logo-birria-dona-lupe.png"
    : null;

  const coverFallback = isDemo
    ? "/menu/plato-birria.jpg"
    : null;

  const logoUrl = safeUrl(settings?.logoUrl);
  const coverUrl = safeUrl(settings?.coverUrl);

  const tagline =
    (es ? settings?.taglineEs : settings?.taglineEn) ||
    (isDemo
      ? es
        ? "Tradición y sabor casero"
        : "Homestyle tradition and flavor"
      : "");

  const description =
    (es ? settings?.descriptionEs : settings?.descriptionEn) ||
    (isDemo
      ? es
        ? "El sabor de la birria tradicional, preparado para ti. Descubre lo que tenemos disponible y aparta tus favoritos antes de que se acaben."
        : "The taste of traditional birria, prepared for you. Explore what's available and reserve your favorites before they sell out."
      : "");

  const welcomeMessage = es
    ? settings?.welcomeMessageEs
    : settings?.welcomeMessageEn;

  const primaryColor = safeColor(theme?.primaryColor);
  const secondaryColor = safeColor(theme?.secondaryColor);
  const textColor = safeColor(theme?.textColor);
  const backgroundColor = safeColor(theme?.backgroundColor);
  const buttonColor = safeColor(theme?.buttonColor);

  const fontFamily =
    theme?.typography === "classic"
      ? 'Georgia, "Times New Roman", serif'
      : theme?.typography === "elegant"
        ? '"Palatino Linotype", Georgia, serif'
        : theme?.typography === "rounded"
          ? '"Trebuchet MS", Arial, sans-serif'
          : undefined;

  const styles = {
    ...(fontFamily ? { fontFamily } : {}),
    ...(backgroundColor ? { backgroundColor } : {}),
    ...(primaryColor ? { "--brand-custom": primaryColor } : {}),
    ...(secondaryColor ? { "--secondary-custom": secondaryColor } : {}),
    ...(buttonColor ? { "--button-custom": buttonColor } : {}),
  } as CSSProperties;

  const location = [
    settings?.address,
    settings?.city,
    settings?.state,
  ]
    .filter(Boolean)
    .join(", ");

  const mapsUrl = safeUrl(settings?.googleMapsUrl);

  const gallery = (settings?.galleryUrls ?? [])
    .map(safeUrl)
    .filter((url): url is string => url !== null);

  const socials = [
    { label: "Instagram", url: settings?.instagram },
    { label: "Facebook", url: settings?.facebook },
    { label: "TikTok", url: settings?.tiktok },
    {
      label: es ? "Sitio web" : "Website",
      url: settings?.website,
    },
  ].flatMap((item) => {
    const url = safeUrl(item.url);
    return url ? [{ label: item.label, url }] : [];
  });

  const hasHours =
    settings?.showOpeningHours !== false &&
    Boolean(settings?.openingHours?.length);

  const hasContact =
    settings?.showSocialLinks !== false &&
    Boolean(
      socials.length > 0 ||
        settings?.phone ||
        settings?.whatsapp ||
        settings?.email,
    );

  // ========================================
  // ACTUALIZACIÓN DE DISPONIBILIDAD
  // ========================================

  useEffect(() => {
    let alive = true;

    const tick = async () => {
      try {
        const response = await fetch(
          `/api/stalls/${initial.slug}`,
          { cache: "no-store" },
        );

        if (response.ok && alive) {
          setSnap(await response.json());
        }
      } catch {
        // Mantener los últimos datos disponibles.
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
  const available = snap.dishes.filter((dish) => dish.portions > 0);
  const gone = snap.dishes.filter((dish) => dish.portions === 0);
  const dishes = [...available, ...gone];

  // ========================================
  // PÁGINA PÚBLICA CON MÁRGENES MEJORADOS
  // ========================================

  return (
    <div
      className="
        public-stall
        flex w-full min-w-0 flex-col
        gap-10 sm:gap-12 lg:gap-14
        px-4 pt-6 pb-12
        sm:px-8 sm:pt-8 sm:pb-14
        lg:px-12 lg:pt-10 lg:pb-16
        xl:px-16
      "
      style={styles}
    >
      <style>{`
        .public-stall {
          --stall-accent: var(--brand-custom, #a3341f);
        }

        .public-stall .text-brand {
          ${primaryColor ? `color: ${primaryColor};` : ""}
        }

        .public-stall .border-brand {
          ${primaryColor ? `border-color: ${primaryColor};` : ""}
        }

        .public-stall .bg-brand {
          ${
            buttonColor || primaryColor
              ? `background-color: ${buttonColor || primaryColor};`
              : ""
          }
        }
      `}</style>

      {/* ===================================
          CONFIRMACIÓN DE RESERVA
      =================================== */}

      {confirmation && (
        <div
          role="status"
          className={`rounded-3xl border p-6 shadow-sm sm:p-8 ${
            confirmation.kind === "reserved"
              ? "border-ok/20 bg-ok-soft text-ok"
              : "border-warn/20 bg-warn-soft text-warn"
          }`}
        >
          {confirmation.kind === "reserved" ? (
            <div className="space-y-3">
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

              {confirmation.orderNumber && (
                <p className="text-sm font-bold">
                  {fill(t.public.orderNumber, {
                    n: confirmation.orderNumber,
                  })}
                </p>
              )}

              {confirmation.code && (
                <PickupCode
                  code={confirmation.code}
                  t={t}
                />
              )}

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

      {/* RESERVAS ACTIVAS */}

      {holds.map((h) => (
        <div
          key={h.code ?? h.pickupBy}
          role="status"
          className="space-y-3 rounded-3xl border border-ok/20 bg-ok-soft p-6 text-ok shadow-sm sm:p-8"
        >
          <p className="text-lg font-extrabold">
            {t.public.yourHold}
            {h.orderNumber
              ? ` · ${fill(t.public.orderNumber, {
                  n: h.orderNumber,
                })}`
              : ""}
          </p>

          <p className="text-sm leading-relaxed">
            {fill(t.public.reservedSummary, {
              items: h.items,
              total: money(h.totalCents, snap.currency, lang),
              time: clock(h.pickupBy, timezone, lang),
            })}
          </p>

          {h.code && <PickupCode code={h.code} t={t} />}
        </div>
      ))}

      {/* ===================================
          ENCABEZADO DEL NEGOCIO
      =================================== */}

      <header className="overflow-hidden rounded-[2rem] border border-line bg-surface shadow-sm">
        <div
          className={
            settings?.showCover === false
              ? "grid grid-cols-1"
              : "grid lg:grid-cols-[1.15fr_0.85fr]"
          }
        >
          <div className="flex min-w-0 flex-col justify-center gap-6 px-6 py-8 sm:px-9 sm:py-12 lg:px-12 lg:py-14">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-7">
              <div className="relative h-32 w-32 shrink-0 overflow-hidden rounded-3xl border border-line bg-[#fff9ed] shadow-sm sm:h-36 sm:w-36">
                {logoUrl ? (
                  <CustomImage
                    key={logoUrl}
                    src={logoUrl}
                    fallback={logoFallback}
                    alt={`Logo de ${snap.name}`}
                    className="h-full w-full object-contain p-1"
                  />
                ) : logoFallback ? (
                  <Image
                    src={logoFallback}
                    alt={`Logo de ${snap.name}`}
                    fill
                    sizes="(min-width: 640px) 144px, 128px"
                    className="object-contain p-1"
                    priority
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-5xl">
                    🏪
                  </div>
                )}
              </div>

              <div className="min-w-0">
                {tagline && (
                  <p
                    className="text-xs font-bold uppercase tracking-[0.18em] text-brand"
                    style={
                      primaryColor
                        ? { color: primaryColor }
                        : undefined
                    }
                  >
                    {tagline}
                  </p>
                )}

                <h1
                  className="mt-3 break-words text-3xl font-black leading-tight tracking-tight text-[#2e1b14] sm:text-4xl lg:text-[2.7rem]"
                  style={
                    textColor
                      ? { color: textColor }
                      : undefined
                  }
                >
                  {snap.name}
                </h1>
              </div>
            </div>

            {settings?.showDescription !== false && description && (
              <p className="max-w-xl text-sm leading-relaxed text-muted sm:text-base">
                {description}
              </p>
            )}

            {welcomeMessage && (
              <p
                className="max-w-xl text-sm font-semibold leading-relaxed"
                style={
                  primaryColor
                    ? { color: primaryColor }
                    : undefined
                }
              >
                {welcomeMessage}
              </p>
            )}

            {settings?.showLocation !== false && location && (
              <div className="flex items-start gap-2 text-sm text-muted">
                <span aria-hidden="true">📍</span>

                {mapsUrl ? (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold underline underline-offset-4"
                  >
                    {location}
                  </a>
                ) : (
                  <span>{location}</span>
                )}
              </div>
            )}

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

          {settings?.showCover !== false && (
            <div className="relative min-h-[240px] overflow-hidden bg-[#f4e5d5] sm:min-h-[320px] lg:min-h-[380px]">
              {coverUrl ? (
                <CustomImage
                  key={coverUrl}
                  src={coverUrl}
                  fallback={coverFallback}
                  alt={`Portada de ${snap.name}`}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : coverFallback ? (
                <Image
                  src={coverFallback}
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
              ) : (
                <div className="flex min-h-[240px] items-center justify-center text-7xl">
                  🍽️
                </div>
              )}

              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
            </div>
          )}
        </div>
      </header>

      {/* ===================================
          MENÚ PÚBLICO
      =================================== */}

      <section className="flex min-w-0 flex-col gap-6 sm:gap-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p
              className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-brand"
              style={
                primaryColor
                  ? { color: primaryColor }
                  : undefined
              }
            >
              {es ? "Menú del día" : "Today's menu"}
            </p>

            <h2
              className="text-3xl font-black tracking-tight text-[#2e1b14] sm:text-4xl"
              style={
                textColor
                  ? { color: textColor }
                  : undefined
              }
            >
              {es
                ? "Lo que todavía hay"
                : "What's still available"}
            </h2>

            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
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
          <div className="flex flex-col gap-5 rounded-3xl border border-line bg-surface p-6 shadow-sm sm:p-10">
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
          <ul className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6">
            {dishes.map((dish) => {
              const out = dish.portions === 0;
              const few = !out && dish.portions <= FEW;
              const dishName = es ? dish.nameEs : dish.nameEn;

              const fallback = isDemo
                ? getDemoDishImage(dish.nameEs, dish.nameEn)
                : null;

              return (
                <li
                  key={dish.id}
                  className={`group overflow-hidden rounded-[1.75rem] border border-line bg-surface shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                    out ? "opacity-75" : ""
                  }`}
                >
                  <div className="flex h-full flex-col sm:flex-row">
                    <div className="relative h-56 shrink-0 overflow-hidden bg-[#f2e5d8] sm:h-auto sm:w-[42%]">
                      <DishImage
                        key={`${dish.id}-${dish.imageUrl ?? ""}`}
                        imageUrl={dish.imageUrl}
                        fallback={fallback}
                        alt={dishName}
                        out={out}
                      />
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col justify-between gap-6 p-6 sm:p-7">
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
                          style={
                            textColor
                              ? { color: textColor }
                              : undefined
                          }
                        >
                          {dishName}
                        </h3>

                        <p className="mt-3 text-sm leading-relaxed text-muted">
                          {out
                            ? es
                              ? "Agotado por el momento."
                              : "Currently sold out."
                            : es
                              ? "Consulta y aparta este platillo con nuestro asistente."
                              : "Ask our assistant to reserve this dish."}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-end justify-between gap-3 border-t border-line pt-5">
                        <div>
                          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
                            {es ? "Precio" : "Price"}
                          </p>

                          <p
                            className="text-2xl font-black tracking-tight text-brand"
                            style={
                              primaryColor
                                ? { color: primaryColor }
                                : undefined
                            }
                          >
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

      {/* ===================================
          ASISTENTE DE RESERVAS
      =================================== */}

      <section className="min-w-0 space-y-6 sm:space-y-8">
        <div>
          <p
            className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-brand"
            style={
              primaryColor
                ? { color: primaryColor }
                : undefined
            }
          >
            {es ? "Estamos para ayudarte" : "We're here to help"}
          </p>

          <h2
            className="text-3xl font-black tracking-tight text-[#2e1b14] sm:text-4xl"
            style={
              textColor
                ? { color: textColor }
                : undefined
            }
          >
            {es ? "Haz tu apartado" : "Reserve your order"}
          </h2>

          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
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

      {/* ===================================
          RECOMPENSAS
      =================================== */}

      {stampCard && (
        <section className="min-w-0 space-y-6 sm:space-y-8">
          <div>
            <p
              className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-brand"
              style={
                primaryColor
                  ? { color: primaryColor }
                  : undefined
              }
            >
              {es
                ? "Gracias por tu preferencia"
                : "Thanks for choosing us"}
            </p>

            <h2
              className="text-3xl font-black tracking-tight text-[#2e1b14] sm:text-4xl"
              style={
                textColor
                  ? { color: textColor }
                  : undefined
              }
            >
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

      {/* ===================================
          HORARIOS Y CONTACTO CENTRADOS
      =================================== */}

      {(hasHours || hasContact) && (
        <section className="mx-auto flex w-full max-w-6xl flex-wrap items-stretch justify-center gap-6 lg:gap-8">
          {hasHours && (
            <div className="w-full min-w-0 max-w-xl flex-1 basis-[320px] rounded-[1.75rem] border border-line bg-surface p-6 shadow-sm sm:p-8">
              <h2 className="text-xl font-black text-[#2e1b14]">
                {es ? "Horarios de atención" : "Opening hours"}
              </h2>

              <ul className="mt-6 space-y-4 text-sm">
                {(settings?.openingHours ?? [])
                  .slice()
                  .sort((a, b) => a.day - b.day)
                  .map((hour) => {
                    const days = es
                      ? [
                          "Domingo",
                          "Lunes",
                          "Martes",
                          "Miércoles",
                          "Jueves",
                          "Viernes",
                          "Sábado",
                        ]
                      : [
                          "Sunday",
                          "Monday",
                          "Tuesday",
                          "Wednesday",
                          "Thursday",
                          "Friday",
                          "Saturday",
                        ];

                    return (
                      <li
                        key={hour.day}
                        className="flex justify-between gap-4"
                      >
                        <span className="font-semibold">
                          {days[hour.day]}
                        </span>

                        <span className="text-muted">
                          {hour.enabled
                            ? `${hour.open} – ${hour.close}`
                            : es
                              ? "Cerrado"
                              : "Closed"}
                        </span>
                      </li>
                    );
                  })}
              </ul>
            </div>
          )}

          {hasContact && (
            <div className="w-full min-w-0 max-w-xl flex-1 basis-[320px] rounded-[1.75rem] border border-line bg-surface p-6 shadow-sm sm:p-8">
              <h2 className="text-xl font-black text-[#2e1b14]">
                {es
                  ? "Contacto y redes sociales"
                  : "Contact and social media"}
              </h2>

              <div className="mt-6 flex flex-wrap gap-4 text-sm">
                {settings?.phone && (
                  <a
                    href={`tel:${settings.phone.replace(/[^+\d]/g, "")}`}
                    className="font-semibold text-brand underline underline-offset-4"
                  >
                    ☎ {settings.phone}
                  </a>
                )}

                {settings?.whatsapp && (
                  <a
                    href={`https://wa.me/${settings.whatsapp.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-brand underline underline-offset-4"
                  >
                    WhatsApp
                  </a>
                )}

                {settings?.email && (
                  <a
                    href={`mailto:${settings.email}`}
                    className="font-semibold text-brand underline underline-offset-4"
                  >
                    ✉ {settings.email}
                  </a>
                )}

                {socials.map((social) => (
                  <a
                    key={social.label}
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-brand underline underline-offset-4"
                  >
                    {social.label}
                  </a>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ===================================
          GALERÍA
      =================================== */}

      {settings?.showGallery !== false && gallery.length > 0 && (
        <section className="space-y-6">
          <h2 className="text-3xl font-black tracking-tight text-[#2e1b14]">
            {es ? "Nuestra galería" : "Our gallery"}
          </h2>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 lg:gap-6">
            {gallery.map((src, index) => (
              <div
                key={`${src}-${index}`}
                className="aspect-square overflow-hidden rounded-[1.75rem] border border-line bg-surface shadow-sm"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={`${es ? "Fotografía" : "Photo"} ${index + 1}`}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* FOOTER */}

      <footer className="border-t border-line pt-8 text-center">
        <p className="text-xs text-muted">
          {t.madeWith}
        </p>
      </footer>
    </div>
  );
}

// ==========================================
// TARJETA DE SELLOS
// ==========================================

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

  async function lookUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const response = await fetch(
      `/api/stalls/${slug}/card`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone }),
      },
    ).catch(() => null);

    if (response?.ok) {
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
      className={`flex flex-col gap-6 rounded-[1.75rem] border border-line p-6 shadow-sm sm:p-9 ${
        ready ? "bg-warn-soft" : "bg-surface"
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
          (_, index) => (
            <li
              key={index}
              className={`flex aspect-square items-center justify-center rounded-full border-2 text-lg font-bold transition-colors ${
                index < have
                  ? "border-brand bg-brand text-white"
                  : "border-dashed border-line text-muted"
              }`}
            >
              {index < have
                ? "★"
                : index === card.perReward - 1
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
              onChange={(event) => {
                setPhone(
                  event.target.value.replace(
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

// ==========================================
// CÓDIGO DE RECOGIDA — FUNCIÓN NUEVA
// ==========================================

function PickupCode({
  code,
  t,
}: {
  code: string;
  t: Dictionary;
}) {
  return (
    <div className="flex items-center gap-4 pt-1">
      <span className="rounded-2xl bg-surface px-4 py-2 font-mono text-3xl font-black tracking-[0.3em] text-foreground">
        {code}
      </span>

      <span className="text-sm font-semibold leading-snug">
        {t.public.pickupCodeHint}
      </span>
    </div>
  );
}
