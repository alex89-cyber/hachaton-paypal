
"use client";

import { useState } from "react";

type Props = {
  slug: string;
  lang: "es" | "en";
};

const messages = {
  es: {
    title: "Canjear recompensa",
    description:
      "Cuando recibas tu premio, pide al negocio su PIN de 6 dígitos.",
    placeholder: "PIN de 6 dígitos",
    submit: "Confirmar canje",
    working: "Validando PIN...",
    success: "¡Recompensa canjeada correctamente!",
    invalid_pin: "El PIN es incorrecto.",
    pin_locked:
      "Demasiados intentos. Intenta más tarde.",
    pin_changed:
      "El PIN ha cambiado. Solicita el código vigente.",
    not_enough_stamps:
      "Todavía no tienes suficientes sellos.",
    card_not_identified:
      "Primero identifica tu tarjeta con tu teléfono.",
    pin_not_ready:
      "El negocio todavía no ha configurado su PIN.",
    error: "No se pudo realizar el canje.",
  },
  en: {
    title: "Redeem reward",
    description:
      "When you receive your reward, ask the business for its 6-digit PIN.",
    placeholder: "6-digit PIN",
    submit: "Confirm redemption",
    working: "Validating PIN...",
    success: "Reward redeemed successfully!",
    invalid_pin: "Incorrect PIN.",
    pin_locked:
      "Too many attempts. Try again later.",
    pin_changed:
      "The PIN has changed. Ask for the current code.",
    not_enough_stamps:
      "You don't have enough stamps yet.",
    card_not_identified:
      "Identify your stamp card using your phone first.",
    pin_not_ready:
      "The business hasn't configured its PIN yet.",
    error: "Could not redeem the reward.",
  },
} as const;

export default function RewardPinRedeemer({
  slug,
  lang,
}: Props) {
  const t = messages[lang];

  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function redeem() {
    if (busy || pin.length !== 6) return;

    setBusy(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `/api/stalls/${encodeURIComponent(slug)}/rewards/redeem`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ pin }),
        },
      );

      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        stampsRemaining?: number;
      };

      if (!response.ok || !data.ok) {
        const code =
          data.error as keyof typeof t;

        setError(t[code] || t.error);
        return;
      }

      setPin("");
      setSuccess(t.success);

      // Recargar la tarjeta para mostrar
      // el saldo restante real.
      window.setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch {
      setError(t.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-5 rounded-2xl border border-[#eaded3] bg-[#fffaf4] p-5">
      <h3 className="font-black text-[#302018]">
        🔐 {t.title}
      </h3>

      <p className="mt-2 text-sm leading-6 text-[#80695d]">
        {t.description}
      </p>

      <label className="mt-4 block">
        <span className="sr-only">
          {t.placeholder}
        </span>

        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          maxLength={6}
          value={pin}
          onChange={(event) => {
            setPin(
              event.target.value
                .replace(/\D/g, "")
                .slice(0, 6),
            );

            setError("");
          }}
          placeholder={t.placeholder}
          className="w-full rounded-xl border border-[#decbbb] bg-white px-4 py-3 text-center font-mono text-2xl tracking-[0.25em] text-[#302018] outline-none focus:border-[#a3341f]"
        />
      </label>

      <button
        type="button"
        disabled={busy || pin.length !== 6}
        onClick={() => void redeem()}
        className="mt-4 w-full rounded-xl bg-[#a3341f] px-5 py-3 font-bold text-white disabled:opacity-50"
      >
        {busy ? t.working : t.submit}
      </button>

      {error && (
        <p
          role="alert"
          className="mt-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      {success && (
        <p
          role="status"
          className="mt-3 text-sm font-semibold text-green-700"
        >
          {success}
        </p>
      )}
    </section>
  );
}
