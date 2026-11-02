
"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";

type Language = "es" | "en";

type StampCardInfo = {
  have: number | null;
  perReward: number;
  reward: string;
};

type LoyaltyAppearance = {
  enabled: boolean;
  stampsPerReward: number;
  rewardText: string;
  rewardConditions: string;
  stampEmoji: string;
  rewardEmoji: string;
  stampColor: string;
};

type Props = {
  slug: string;
  lang: Language;
  card: StampCardInfo;
};

function colorOrDefault(value: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(value)
    ? value
    : "#B4230B";
}

export default function PublicRewardsSection({
  slug,
  lang,
  card,
}: Props) {
  const es = lang === "es";

  const [config, setConfig] =
    useState<LoyaltyAppearance | null>(null);

  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState("");
  const [badPhone, setBadPhone] = useState(false);

  // ========================================
  // CARGAR LA PERSONALIZACIÓN REAL
  // ========================================

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const response = await fetch(
          `/api/stalls/${encodeURIComponent(slug)}/loyalty/public`,
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          throw new Error("loyalty_config_unavailable");
        }

        const data =
          (await response.json()) as LoyaltyAppearance;

        if (!controller.signal.aborted) {
          setConfig(data);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error(
            "Could not load public rewards settings:",
            error,
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => controller.abort();
  }, [slug]);

  // ========================================
  // CONSULTAR TARJETA POR TELÉFONO
  // ========================================

  async function lookUp(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setBadPhone(false);

    try {
      const response = await fetch(
        `/api/stalls/${encodeURIComponent(slug)}/card`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ phone }),
        },
      );

      if (!response.ok) {
        setBadPhone(true);
        return;
      }

      window.location.reload();
    } catch {
      setBadPhone(true);
    }
  }

  // No mostrar un programa desactivado.
  if (config?.enabled === false) {
    return null;
  }

  // Evitar mostrar momentáneamente una
  // tarjeta con estilos anteriores.
  if (loading) {
    return (
      <section
        className="rounded-[1.75rem] border border-line bg-surface p-6 shadow-sm"
        aria-busy="true"
      >
        <p className="text-sm text-muted">
          {es
            ? "Cargando recompensas..."
            : "Loading rewards..."}
        </p>
      </section>
    );
  }

  // Si la API falla, conservamos la tarjeta
  // anterior en lugar de perder el acceso.
  const total = Math.max(
    1,
    Math.min(
      100,
      config?.stampsPerReward ??
        card.perReward,
    ),
  );

  const have = Math.max(0, card.have ?? 0);
  const filled = Math.min(have, total);
  const remaining = Math.max(0, total - filled);

  const stampEmoji = config?.stampEmoji || "⭐";
  const rewardEmoji = config?.rewardEmoji || "🎁";

  const stampColor = colorOrDefault(
    config?.stampColor || "#B4230B",
  );

  const reward =
    config?.rewardText?.trim() ||
    card.reward ||
    (es ? "Tu premio" : "Your reward");

  const conditions =
    config?.rewardConditions?.trim() || "";

  const ready = have >= total;

  return (
    <section className="min-w-0 space-y-6 sm:space-y-8">
      {/* ENCABEZADO */}

      <div>
        <p
          className="mb-3 text-xs font-bold uppercase tracking-[0.2em]"
          style={{ color: stampColor }}
        >
          {es
            ? "Gracias por tu preferencia"
            : "Thanks for choosing us"}
        </p>

        <h2 className="text-3xl font-black tracking-tight text-[#2e1b14] sm:text-4xl">
          {es ? "Tus recompensas" : "Your rewards"}
        </h2>
      </div>

      {/* TARJETA */}

      <div className="rounded-[1.75rem] border border-line bg-surface p-6 shadow-sm sm:p-9">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-xl font-bold text-[#2e1b14]">
            {es ? "Tarjeta de sellos" : "Stamp card"}
          </h3>

          <span className="rounded-full border border-line bg-background/70 px-4 py-2 text-sm font-bold text-[#2e1b14]">
            {have} / {total}
          </span>
        </div>

        {/* SELLOS PERSONALIZADOS */}

        <ol
          className="mt-7 grid grid-cols-5 gap-2 sm:grid-cols-10"
          aria-label={
            es
              ? `${have} de ${total} sellos`
              : `${have} of ${total} stamps`
          }
        >
          {Array.from(
            { length: total },
            (_, index) => {
              const completed = index < filled;
              const isLast = index === total - 1;

              return (
                <li
                  key={index}
                  className="flex aspect-square items-center justify-center rounded-full border-2 text-xl font-bold"
                  style={
                    completed
                      ? {
                          backgroundColor: stampColor,
                          borderColor: stampColor,
                          color: "#ffffff",
                        }
                      : {
                          borderColor: "#eaded3",
                          borderStyle: "dashed",
                          backgroundColor: "#ffffff",
                        }
                  }
                >
                  {completed
                    ? stampEmoji
                    : isLast
                      ? rewardEmoji
                      : ""}
                </li>
              );
            },
          )}
        </ol>

        {/* PROGRESO */}

        <p className="mt-7 text-sm leading-6 text-[#60483d]">
          {ready
            ? es
              ? "¡Completaste los sellos necesarios para tu premio!"
              : "You've collected enough stamps for your reward!"
            : es
              ? `Llevas ${have} de ${total}. Te faltan ${remaining} ${
                  remaining === 1 ? "sello" : "sellos"
                } para completar tu tarjeta.`
              : `You have ${have} of ${total} stamps. ${
                  remaining === 1
                    ? "1 more stamp is needed"
                    : `${remaining} more stamps are needed`
                } to complete your card.`}
        </p>

        {/* PREMIO DEL NEGOCIO */}

        <div className="mt-6 rounded-2xl border border-[#eaded3] bg-[#fffaf4] p-4">
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="text-2xl"
            >
              {rewardEmoji}
            </span>

            <div className="min-w-0">
              <p className="text-sm font-bold text-[#302018]">
                {es ? "Tu premio" : "Your reward"}
              </p>

              <p className="mt-1 break-words text-sm text-[#60483d]">
                {reward}
              </p>

              {conditions && (
                <p className="mt-2 break-words text-xs leading-5 text-[#80695d]">
                  {conditions}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* CONSULTAR SELLOS */}

        {card.have === null && (
          <form
            onSubmit={lookUp}
            className="mt-6 space-y-3"
          >
            <label
              htmlFor="public-loyalty-phone"
              className="block text-sm font-semibold text-[#302018]"
            >
              {es
                ? "Consulta tus sellos con tu teléfono"
                : "Check your stamps using your phone number"}
            </label>

            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                id="public-loyalty-phone"
                type="tel"
                value={phone}
                onChange={(event) => {
                  setPhone(event.target.value);
                  setBadPhone(false);
                }}
                inputMode="tel"
                autoComplete="tel"
                placeholder={
                  es
                    ? "55 1234 5678"
                    : "Your phone number"
                }
                className="min-w-0 flex-1 rounded-2xl border border-line bg-background px-4 py-3 text-[#302018] outline-none focus:border-brand"
              />

              <button
                type="submit"
                disabled={phone.replace(/\D/g, "").length < 10}
                className="rounded-2xl px-6 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  backgroundColor: stampColor,
                }}
              >
                {es ? "Consultar" : "Check"}
              </button>
            </div>

            {badPhone && (
              <p
                role="alert"
                className="text-sm text-red-700"
              >
                {es
                  ? "No se pudo consultar la tarjeta. Revisa el teléfono."
                  : "Could not check your card. Verify your phone number."}
              </p>
            )}
          </form>
        )}
      </div>
    </section>
  );
}
