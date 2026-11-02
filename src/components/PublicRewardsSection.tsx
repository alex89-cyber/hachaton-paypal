
"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import RewardPinRedeemer from "./RewardPinRedeemer";

// ==========================================
// TIPOS
// ==========================================

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

// ==========================================
// FUNCIONES AUXILIARES
// ==========================================

function colorOrDefault(
  value: string,
): string {
  return /^#[0-9a-fA-F]{6}$/.test(value)
    ? value
    : "#B4230B";
}

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================

export default function PublicRewardsSection({
  slug,
  lang,
  card,
}: Props) {
  const es = lang === "es";

  // Configuración del negocio
  const [config, setConfig] =
    useState<LoyaltyAppearance | null>(null);

  const [loading, setLoading] =
    useState(true);

  // Consulta por teléfono
  const [phone, setPhone] =
    useState("");

  const [badPhone, setBadPhone] =
    useState(false);

  const [checkingPhone, setCheckingPhone] =
    useState(false);

  // ========================================
  // CARGAR PERSONALIZACIÓN DESDE SUPABASE
  // ========================================

  useEffect(() => {
    const controller = new AbortController();

    async function loadConfig() {
      try {
        const response = await fetch(
          `/api/stalls/${encodeURIComponent(
            slug,
          )}/loyalty/public`,
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          throw new Error(
            "loyalty_config_unavailable",
          );
        }

        const data =
          (await response.json()) as LoyaltyAppearance;

        if (!controller.signal.aborted) {
          setConfig(data);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error(
            "No se pudo cargar la configuración de recompensas:",
            error,
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadConfig();

    return () => {
      controller.abort();
    };
  }, [slug]);

  // ========================================
  // CONSULTAR TARJETA POR TELÉFONO
  // ========================================

  async function lookUp(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (checkingPhone) return;

    setBadPhone(false);
    setCheckingPhone(true);

    try {
      const response = await fetch(
        `/api/stalls/${encodeURIComponent(
          slug,
        )}/card`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "same-origin",
          body: JSON.stringify({
            phone: phone.trim(),
          }),
        },
      );

      if (!response.ok) {
        setBadPhone(true);
        return;
      }

      // La API guarda la identificación de
      // la tarjeta en la cookie del cliente.
      // Recargamos para obtener el saldo.
      window.location.reload();
    } catch {
      setBadPhone(true);
    } finally {
      setCheckingPhone(false);
    }
  }

  // ========================================
  // PROGRAMA DESACTIVADO
  // ========================================

  if (config?.enabled === false) {
    return null;
  }

  // ========================================
  // ESTADO DE CARGA
  // ========================================

  if (loading) {
    return (
      <section
        className="rounded-[1.75rem] border border-[#eaded3] bg-white p-6 shadow-sm"
        aria-busy="true"
      >
        <p className="text-sm text-[#80695d]">
          {es
            ? "Cargando recompensas..."
            : "Loading rewards..."}
        </p>
      </section>
    );
  }

  // ========================================
  // DATOS DE LA TARJETA
  // ========================================

  const total = Math.max(
    1,
    Math.min(
      100,
      config?.stampsPerReward ??
        card.perReward,
    ),
  );

  const have = Math.max(
    0,
    card.have ?? 0,
  );

  const filled = Math.min(
    have,
    total,
  );

  const remaining = Math.max(
    0,
    total - filled,
  );

  const stampEmoji =
    config?.stampEmoji || "⭐";

  const rewardEmoji =
    config?.rewardEmoji || "🎁";

  const stampColor =
    colorOrDefault(
      config?.stampColor || "#B4230B",
    );

  const reward =
    config?.rewardText?.trim() ||
    card.reward ||
    (es
      ? "Tu premio"
      : "Your reward");

  const conditions =
    config?.rewardConditions?.trim() ||
    "";

  // ========================================
  // RECOMPENSA COMPLETADA
  // ========================================

  const ready =
    card.have !== null &&
    have >= total;

  return (
    <section className="min-w-0 space-y-6 sm:space-y-8">
      {/* ==================================
          ENCABEZADO
      ================================== */}

      <div>
        <p
          className="mb-3 text-xs font-bold uppercase tracking-[0.2em]"
          style={{
            color: stampColor,
          }}
        >
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

      {/* ==================================
          TARJETA DE SELLOS
      ================================== */}

      <div className="rounded-[1.75rem] border border-[#eaded3] bg-white p-6 shadow-sm sm:p-9">
        {/* TÍTULO Y CONTADOR */}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-xl font-bold text-[#2e1b14]">
            {es
              ? "Tarjeta de sellos"
              : "Stamp card"}
          </h3>

          <span className="rounded-full border border-[#eaded3] bg-[#fffaf4] px-4 py-2 text-sm font-bold text-[#2e1b14]">
            {have} / {total}
          </span>
        </div>

        {/* ==================================
            SELLOS PERSONALIZADOS
        ================================== */}

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
              const completed =
                index < filled;

              const isLast =
                index === total - 1;

              return (
                <li
                  key={index}
                  className="flex aspect-square min-w-0 items-center justify-center rounded-full border-2 text-xl font-bold sm:text-2xl"
                  style={
                    completed
                      ? {
                          backgroundColor:
                            stampColor,
                          borderColor:
                            stampColor,
                          color: "#ffffff",
                        }
                      : {
                          borderColor:
                            "#eaded3",
                          borderStyle:
                            "dashed",
                          backgroundColor:
                            "#ffffff",
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

        {/* ==================================
            PROGRESO
        ================================== */}

        <div className="mt-7">
          {ready ? (
            <p className="text-sm font-medium leading-6 text-[#60483d]">
              {es
                ? "¡Completaste los sellos necesarios para tu premio!"
                : "You have collected enough stamps for your reward!"}
            </p>
          ) : (
            <p className="text-sm leading-6 text-[#60483d]">
              {es
                ? `Llevas ${have} de ${total}. Te faltan ${remaining} ${
                    remaining === 1
                      ? "sello"
                      : "sellos"
                  } para completar tu tarjeta.`
                : `You have ${have} of ${total} stamps. ${
                    remaining === 1
                      ? "1 more stamp is needed"
                      : `${remaining} more stamps are needed`
                  } to complete your card.`}
            </p>
          )}
        </div>

        {/* ==================================
            PREMIO PERSONALIZADO
        ================================== */}

        <div className="mt-6 rounded-2xl border border-[#eaded3] bg-[#fffaf4] p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="text-2xl"
            >
              {rewardEmoji}
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-[#302018]">
                {es
                  ? "Tu premio"
                  : "Your reward"}
              </p>

              <p className="mt-1 break-words text-sm leading-6 text-[#60483d]">
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

        {/* ==================================
            CANJEAR CON PIN
            SOLO SI COMPLETÓ LOS SELLOS
        ================================== */}

        {ready && (
          <div className="mt-6">
            <div className="mb-4 rounded-2xl border border-[#dcebdd] bg-[#f0faf1] p-4">
              <div className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="text-2xl"
                >
                  🎉
                </span>

                <div className="min-w-0">
                  <p className="font-bold text-[#246b35]">
                    {es
                      ? "¡Tu recompensa está lista!"
                      : "Your reward is ready!"}
                  </p>

                  <p className="mt-1 text-sm leading-6 text-[#426e4b]">
                    {es
                      ? "Cuando recibas tu premio, solicita al negocio su PIN de seis dígitos para confirmar el canje."
                      : "When you receive your reward, ask the business for its six-digit PIN to confirm redemption."}
                  </p>
                </div>
              </div>
            </div>

            {/* FORMULARIO REAL DE PIN */}

            <RewardPinRedeemer
              slug={slug}
              lang={lang}
            />
          </div>
        )}

        {/* ==================================
            CONSULTAR TARJETA
            POR TELÉFONO
        ================================== */}

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
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(event) => {
                  setPhone(
                    event.target.value,
                  );

                  setBadPhone(false);
                }}
                placeholder={
                  es
                    ? "55 1234 5678"
                    : "Your phone number"
                }
                className="min-w-0 flex-1 rounded-2xl border border-[#eaded3] bg-white px-4 py-3 text-[#302018] outline-none focus:border-[#a63822]"
              />

              <button
                type="submit"
                disabled={
                  checkingPhone ||
                  phone.replace(
                    /\D/g,
                    "",
                  ).length < 10
                }
                className="rounded-2xl px-6 py-3 font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  backgroundColor:
                    stampColor,
                }}
              >
                {checkingPhone
                  ? es
                    ? "Consultando..."
                    : "Checking..."
                  : es
                    ? "Consultar"
                    : "Check"}
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
