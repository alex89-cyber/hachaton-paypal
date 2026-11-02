
"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  calculateLoyaltyPeriod,
} from "@/lib/loyalty-period";

import {
  DEFAULT_LOYALTY_CONFIG,
  validateLoyaltyConfig,
} from "@/lib/loyalty-config";

import type {
  LoyaltyConfigInput,
} from "@/lib/store/types";

// ============================================
// ¿TODAVÍA HAY?
// EDITOR VISUAL DE RECOMPENSAS
// ============================================

type RewardDish = {
  id: string;
  nameEs: string;
  nameEn: string;
  imageUrl: string | null;
};

type LoyaltyApiResponse = {
  slug: string;
  timezone: string;
  config: LoyaltyConfigInput;
  dishes: RewardDish[];
};

type Props = {
  slug: string;
};

const EMOJIS = [
  "⭐",
  "🌮",
  "☕",
  "🍔",
  "🍕",
  "❤️",
  "🔥",
  "🎁",
  "🏆",
  "🎉",
];

const COLORS = [
  "#B4230B",
  "#1F7A4D",
  "#2563EB",
  "#7C3AED",
  "#D97706",
  "#DB2777",
];

function getErrorMessage(
  data: unknown,
  fallback: string,
): string {
  if (
    typeof data === "object" &&
    data !== null
  ) {
    if (
      "message" in data &&
      typeof data.message === "string"
    ) {
      return data.message;
    }

    if (
      "error" in data &&
      typeof data.error === "string"
    ) {
      return data.error;
    }
  }

  return fallback;
}

function formatDate(
  date: Date,
  timezone: string,
) {
  try {
    return new Intl.DateTimeFormat(
      "es-MX",
      {
        timeZone: timezone,
        day: "numeric",
        month: "long",
        year: "numeric",
      },
    ).format(date);
  } catch {
    return date.toLocaleDateString("es-MX");
  }
}

export default function LoyaltySettingsEditor({
  slug,
}: Props) {
  // ==========================================
  // DATOS DEL NEGOCIO
  // ==========================================

  const [config, setConfig] =
    useState<LoyaltyConfigInput>({
      ...DEFAULT_LOYALTY_CONFIG,
    });

  const [dishes, setDishes] =
    useState<RewardDish[]>([]);

  const [timezone, setTimezone] =
    useState("America/Mexico_City");

  // ==========================================
  // APARIENCIA DE EJEMPLO
  // ==========================================

  const [stampEmoji, setStampEmoji] =
    useState("⭐");

  const [rewardEmoji, setRewardEmoji] =
    useState("🎁");

  const [stampColor, setStampColor] =
    useState("#B4230B");

  const [previewStamps, setPreviewStamps] =
    useState(3);

  // ==========================================
  // ESTADOS
  // ==========================================

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  // ==========================================
  // CARGAR CONFIGURACIÓN
  // ==========================================

  useEffect(() => {
    const controller =
      new AbortController();

    async function load() {
      setLoading(true);
      setError("");
      setSuccess("");

      try {
        const response = await fetch(
          `/api/stalls/${encodeURIComponent(
            slug,
          )}/loyalty`,
          {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
          },
        );

        const data: unknown =
          await response.json();

        if (!response.ok) {
          throw new Error(
            getErrorMessage(
              data,
              "No se pudo cargar la configuración.",
            ),
          );
        }

        const result =
          data as LoyaltyApiResponse;

        if (controller.signal.aborted) {
          return;
        }

        setConfig(result.config);
        setDishes(result.dishes ?? []);

        setTimezone(
          result.timezone ||
            "America/Mexico_City",
        );
      } catch (err) {
        if (controller.signal.aborted) {
          return;
        }

        setError(
          err instanceof Error
            ? err.message
            : "Ocurrió un error al cargar.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      controller.abort();
    };
  }, [slug]);

  // ==========================================
  // ACTUALIZAR CAMPOS
  // ==========================================

  function updateConfig<K extends keyof LoyaltyConfigInput>(
    key: K,
    value: LoyaltyConfigInput[K],
  ) {
    setConfig((current) => ({
      ...current,
      [key]: value,
    }));

    setSuccess("");
    setError("");
  }

  // ==========================================
  // PREVIA DEL PERIODO
  // ==========================================

  const periodPreview = useMemo(() => {
    try {
      return calculateLoyaltyPeriod(
        {
          periodKind: config.periodKind,
          periodDays: config.periodDays,
          expiryAction:
            config.expiryAction,
          timezone,
        },
        new Date(),
      );
    } catch {
      return null;
    }
  }, [
    config.periodKind,
    config.periodDays,
    config.expiryAction,
    timezone,
  ]);

  const expirationText = useMemo(() => {
    if (!periodPreview?.endsAt) {
      return "Los sellos no tienen fecha de vencimiento.";
    }

    // endsAt es exclusivo:
    // el último instante del periodo
    // corresponde al día anterior.
    const lastMoment = new Date(
      new Date(
        periodPreview.endsAt,
      ).getTime() - 1,
    );

    return `Tienes hasta el ${formatDate(
      lastMoment,
      timezone,
    )} para completar tus sellos.`;
  }, [
    periodPreview,
    timezone,
  ]);

  const selectedDish = dishes.find(
    (dish) =>
      dish.id === config.rewardDishId,
  );

  const visibleStamps = Math.min(
    previewStamps,
    config.stampsPerReward,
  );

  const remaining = Math.max(
    0,
    config.stampsPerReward -
      visibleStamps,
  );

  // ==========================================
  // GUARDAR REGLAS
  // ==========================================

  async function saveConfiguration() {
    setError("");
    setSuccess("");

    const validation =
      validateLoyaltyConfig(config);

    if (!validation.ok) {
      setError(validation.message);
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(
        `/api/stalls/${encodeURIComponent(
          slug,
        )}/loyalty`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            action: "saveConfig",
            ...validation.config,
          }),
        },
      );

      const data: unknown =
        await response.json();

      if (!response.ok) {
        throw new Error(
          getErrorMessage(
            data,
            "No se pudieron guardar las recompensas.",
          ),
        );
      }

      if (
        typeof data === "object" &&
        data !== null &&
        "config" in data
      ) {
        const saved = data as {
          config: LoyaltyConfigInput;
        };

        setConfig(saved.config);
      }

      setSuccess(
        "¡Configuración de recompensas guardada correctamente!",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Ocurrió un error al guardar.",
      );
    } finally {
      setSaving(false);
    }
  }

  // ==========================================
  // ESTILOS
  // ==========================================

  const cardClass =
    "rounded-2xl border border-[#E9DACC] bg-white p-5 shadow-sm";

  const labelClass =
    "mb-2 block text-sm font-semibold text-[#38251D]";

  const inputClass =
    "w-full rounded-xl border border-[#E7D7C9] bg-white px-3 py-3 text-sm text-[#38251D] outline-none focus:border-[#B4230B]";

  // ==========================================
  // LOADING
  // ==========================================

  if (loading) {
    return (
      <section className={cardClass}>
        <p className="text-sm text-[#705B50]">
          Cargando configuración de
          recompensas...
        </p>
      </section>
    );
  }

  // ==========================================
  // INTERFAZ
  // ==========================================

  return (
    <section className="space-y-5">
      {/* ENCABEZADO */}

      <div>
        <h2 className="text-2xl font-bold text-[#38251D]">
          Programa de recompensas
        </h2>

        <p className="mt-2 text-sm leading-6 text-[#80695C]">
          Decide cómo tus clientes ganan
          sellos, cuántos necesitan,
          cuándo vencen y qué premio
          reciben.
        </p>
      </div>

      {/* ACTIVAR / DESACTIVAR */}

      <div className={cardClass}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-[#38251D]">
              Activar recompensas
            </h3>

            <p className="mt-1 text-sm text-[#80695C]">
              Si lo desactivas, tus
              clientes dejarán de recibir
              nuevos sellos.
            </p>
          </div>

          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(event) =>
              updateConfig(
                "enabled",
                event.target.checked,
              )
            }
            className="h-5 w-5 accent-[#B4230B]"
            aria-label="Activar programa de recompensas"
          />
        </div>

        {!config.enabled && (
          <p className="mt-4 rounded-xl bg-[#FFF3E8] p-3 text-sm text-[#83501C]">
            El programa está desactivado.
            Los sellos y premios anteriores
            no se borrarán.
          </p>
        )}
      </div>

      {/* CANTIDAD DE SELLOS */}

      <div className={cardClass}>
        <h3 className="mb-4 font-bold text-[#38251D]">
          Cantidad de sellos
        </h3>

        <label
          htmlFor="loyalty-stamps"
          className={labelClass}
        >
          ¿Cuántos sellos necesita el
          cliente para ganar?
        </label>

        <input
          id="loyalty-stamps"
          type="number"
          min={1}
          max={100}
          value={
            config.stampsPerReward
          }
          onChange={(event) =>
            updateConfig(
              "stampsPerReward",
              Number(event.target.value),
            )
          }
          className={inputClass}
        />

        <p className="mt-3 text-sm text-[#80695C]">
          Ejemplo: si eliges 5, el cliente
          necesitará juntar 5 sellos
          para obtener su premio.
        </p>
      </div>

      {/* PREMIO */}

      <div className={cardClass}>
        <h3 className="mb-4 font-bold text-[#38251D]">
          Premio para el cliente
        </h3>

        <label
          htmlFor="loyalty-reward-dish"
          className={labelClass}
        >
          Selecciona el platillo de regalo
        </label>

        <select
          id="loyalty-reward-dish"
          value={
            config.rewardDishId ?? ""
          }
          onChange={(event) =>
            updateConfig(
              "rewardDishId",
              event.target.value || null,
            )
          }
          className={inputClass}
        >
          <option value="">
            Sin premio seleccionado
          </option>

          {dishes.map((dish) => (
            <option
              key={dish.id}
              value={dish.id}
            >
              {dish.nameEs}
            </option>
          ))}
        </select>

        <p className="mt-3 text-sm text-[#80695C]">
          {selectedDish
            ? `Premio seleccionado: ${selectedDish.nameEs}.`
            : "Selecciona el premio que recibirá el cliente."}
        </p>
      </div>

      {/* VENCIMIENTO */}

      <div className={cardClass}>
        <h3 className="mb-4 font-bold text-[#38251D]">
          Vigencia de los sellos
        </h3>

        <label
          htmlFor="loyalty-period"
          className={labelClass}
        >
          ¿Cuánto tiempo tiene el
          cliente para juntar sellos?
        </label>

        <select
          id="loyalty-period"
          value={config.periodKind}
          onChange={(event) =>
            updateConfig(
              "periodKind",
              event.target.value as
                LoyaltyConfigInput["periodKind"],
            )
          }
          className={inputClass}
        >
          <option value="none">
            Sin vencimiento
          </option>

          <option value="calendar_week">
            Por semana calendario
          </option>

          <option value="calendar_month">
            Por mes calendario
          </option>

          <option value="rolling_days">
            Días desde el primer sello
          </option>
        </select>

        {config.periodKind ===
          "rolling_days" && (
          <div className="mt-4">
            <label
              htmlFor="loyalty-days"
              className={labelClass}
            >
              Número de días
            </label>

            <input
              id="loyalty-days"
              type="number"
              min={1}
              max={365}
              value={config.periodDays}
              onChange={(event) =>
                updateConfig(
                  "periodDays",
                  Number(
                    event.target.value,
                  ),
                )
              }
              className={inputClass}
            />
          </div>
        )}

        {config.periodKind !==
          "none" && (
          <div className="mt-5">
            <label
              htmlFor="loyalty-expiry"
              className={labelClass}
            >
              ¿Qué ocurre al vencer el
              periodo?
            </label>

            <select
              id="loyalty-expiry"
              value={
                config.expiryAction
              }
              onChange={(event) =>
                updateConfig(
                  "expiryAction",
                  event.target.value as
                    LoyaltyConfigInput["expiryAction"],
                )
              }
              className={inputClass}
            >
              <option value="reset">
                Reiniciar sellos incompletos
              </option>

              <option value="keep">
                Conservar sellos acumulados
              </option>
            </select>
          </div>
        )}

        <div className="mt-4 rounded-xl bg-[#FFF6EE] p-4">
          <p className="text-sm font-semibold text-[#38251D]">
            📅 Fecha límite de ejemplo
          </p>

          <p className="mt-2 text-sm leading-6 text-[#755D50]">
            {expirationText}
          </p>

          <p className="mt-2 text-xs leading-5 text-[#927C6E]">
            Las fechas se calculan
            utilizando la zona horaria
            del negocio: {timezone}.
          </p>
        </div>
      </div>

      {/* VIGENCIA DEL PREMIO */}

      <div className={cardClass}>
        <h3 className="mb-4 font-bold text-[#38251D]">
          Vigencia del premio ganado
        </h3>

        <label
          htmlFor="loyalty-reward-validity"
          className={labelClass}
        >
          ¿Cuánto tiempo tiene el cliente
          para canjear su premio?
        </label>

        <select
          id="loyalty-reward-validity"
          value={
            config.rewardValidDays === null
              ? "none"
              : "limited"
          }
          onChange={(event) =>
            updateConfig(
              "rewardValidDays",
              event.target.value === "none"
                ? null
                : 30,
            )
          }
          className={inputClass}
        >
          <option value="none">
            El premio no vence
          </option>

          <option value="limited">
            El premio vence después
            de ciertos días
          </option>
        </select>

        {config.rewardValidDays !==
          null && (
          <div className="mt-4">
            <label
              htmlFor="loyalty-reward-days"
              className={labelClass}
            >
              Días para canjear
            </label>

            <input
              id="loyalty-reward-days"
              type="number"
              min={1}
              max={365}
              value={
                config.rewardValidDays
              }
              onChange={(event) =>
                updateConfig(
                  "rewardValidDays",
                  Number(
                    event.target.value,
                  ),
                )
              }
              className={inputClass}
            />
          </div>
        )}
      </div>

      {/* PERSONALIZACIÓN VISUAL */}

      <div className={cardClass}>
        <h3 className="mb-4 font-bold text-[#38251D]">
          Apariencia de la tarjeta
        </h3>

        <p className="mb-4 text-sm text-[#80695C]">
          Prueba distintos emojis y
          colores para visualizar la
          tarjeta de recompensas.
        </p>

        <label className={labelClass}>
          Emoji de los sellos
        </label>

        <div className="mb-5 flex flex-wrap gap-2">
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() =>
                setStampEmoji(emoji)
              }
              aria-label={`Usar emoji ${emoji}`}
              aria-pressed={
                stampEmoji === emoji
              }
              className={`flex h-11 w-11 items-center justify-center rounded-xl border text-xl transition ${
                stampEmoji === emoji
                  ? "border-[#B4230B] bg-[#FFF3EC] ring-1 ring-[#B4230B]"
                  : "border-[#E7D7C9] bg-white"
              }`}
            >
              {emoji}
            </button>
          ))}
        </div>

        <label className={labelClass}>
          Emoji del premio
        </label>

        <div className="mb-5 flex flex-wrap gap-2">
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() =>
                setRewardEmoji(emoji)
              }
              aria-label={`Usar emoji de premio ${emoji}`}
              aria-pressed={
                rewardEmoji === emoji
              }
              className={`flex h-11 w-11 items-center justify-center rounded-xl border text-xl transition ${
                rewardEmoji === emoji
                  ? "border-[#B4230B] bg-[#FFF3EC] ring-1 ring-[#B4230B]"
                  : "border-[#E7D7C9] bg-white"
              }`}
            >
              {emoji}
            </button>
          ))}
        </div>

        <label className={labelClass}>
          Color de los sellos
        </label>

        <div className="flex flex-wrap gap-3">
          {COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() =>
                setStampColor(color)
              }
              aria-label={`Seleccionar color ${color}`}
              aria-pressed={
                stampColor === color
              }
              style={{
                backgroundColor: color,
              }}
              className={`h-9 w-9 rounded-full border-4 ${
                stampColor === color
                  ? "border-[#38251D]"
                  : "border-white"
              } shadow-sm`}
            />
          ))}
        </div>

        <p className="mt-4 text-xs leading-5 text-[#927C6E]">
          Los emojis y colores de esta
          sección son una vista de
          demostración. Todavía no se
          guardan en Supabase; los
          conectaremos con la
          personalización visual.
        </p>
      </div>

      {/* VISTA PREVIA DE LA TARJETA */}

      <div className={cardClass}>
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-bold text-[#38251D]">
            Vista previa del cliente
          </h3>

          <span className="rounded-full bg-[#F8EEE6] px-3 py-1 text-xs font-semibold text-[#96523F]">
            Ejemplo
          </span>
        </div>

        {!config.enabled ? (
          <div className="mt-4 rounded-xl bg-[#F8F3EF] p-4 text-sm text-[#705B50]">
            El programa de recompensas
            está desactivado. La tarjeta
            no se mostrará como un
            programa activo al cliente.
          </div>
        ) : (
          <>
            <div className="mt-5 flex items-center justify-between gap-3">
              <p className="font-semibold text-[#38251D]">
                Mi tarjeta de sellos
              </p>

              <span className="text-sm font-bold text-[#B4230B]">
                {visibleStamps} /{" "}
                {config.stampsPerReward}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-5 gap-2 sm:grid-cols-10">
              {Array.from({
                length: Math.max(
                  0,
                  Math.min(
                    100,
                    config.stampsPerReward,
                  ),
                ),
              }).map((_, index) => {
                const filled =
                  index < visibleStamps;

                return (
                  <div
                    key={index}
                    className="flex aspect-square items-center justify-center rounded-full border border-[#E9DACC] text-base"
                    style={{
                      backgroundColor: filled
                        ? stampColor
                        : "#FAF5F0",
                    }}
                  >
                    {filled ? (
                      <span>
                        {stampEmoji}
                      </span>
                    ) : index ===
                      config.stampsPerReward -
                        1 ? (
                      <span>
                        {rewardEmoji}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <p className="mt-4 text-sm font-semibold text-[#38251D]">
              {remaining === 0
                ? "¡Completaste los sellos necesarios!"
                : `Te faltan ${remaining} ${
                    remaining === 1
                      ? "sello"
                      : "sellos"
                  } para ganar.`}
            </p>

            <div className="mt-4 rounded-xl bg-[#FFF6EE] p-4 text-sm text-[#755D50]">
              <p>📅 {expirationText}</p>

              <p className="mt-2">
                {config.expiryAction === "reset" &&
                config.periodKind !== "none"
                  ? "Si no completas la tarjeta antes del vencimiento, los sellos incompletos se reinician."
                  : "Los sellos acumulados se conservan según las reglas del negocio."}
              </p>

              <p className="mt-2">
                🎁 Premio:{" "}
                {selectedDish?.nameEs ??
                  "Sin seleccionar"}
              </p>

              <p className="mt-2">
                {config.rewardValidDays === null
                  ? "El premio ganado no tiene vencimiento configurado."
                  : `Una vez ganado, tendrás ${config.rewardValidDays} días para canjear el premio.`}
              </p>
            </div>

            <div className="mt-5">
              <label
                htmlFor="loyalty-preview-stamps"
                className={labelClass}
              >
                Probar cantidad de sellos
                del cliente
              </label>

              <input
                id="loyalty-preview-stamps"
                type="range"
                min={0}
                max={Math.max(
                  1,
                  config.stampsPerReward,
                )}
                value={visibleStamps}
                onChange={(event) =>
                  setPreviewStamps(
                    Number(
                      event.target.value,
                    ),
                  )
                }
                className="w-full accent-[#B4230B]"
              />
            </div>
          </>
        )}
      </div>

      {/* MENSAJES */}

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
        </div>
      )}

      {success && (
        <div
          role="status"
          className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800"
        >
          {success}
        </div>
      )}

      {/* GUARDAR */}

      <button
        type="button"
        disabled={saving || loading}
        onClick={() =>
          void saveConfiguration()
        }
        className="w-full rounded-xl bg-[#B4230B] px-5 py-4 text-sm font-bold text-white transition hover:bg-[#931E0A] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving
          ? "Guardando recompensas..."
          : "Guardar programa de recompensas"}
      </button>

      <p className="text-center text-xs leading-5 text-[#927C6E]">
        Los cambios guardados afectan
        las reglas del negocio. Los
        sellos históricos no se eliminan
        por cambiar la cantidad
        necesaria para un premio.
      </p>
    </section>
  );
}
