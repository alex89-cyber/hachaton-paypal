
"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type {
  CSSProperties,
  FormEvent,
  ReactNode,
} from "react";

import type {
  OwnerView,
  StallOpeningHour,
  StallSettings,
  StallTheme,
} from "@/lib/stall";

// ==========================================
// CONSTANTES
// ==========================================

const DAYS = [
  ["Domingo", "Sunday"],
  ["Lunes", "Monday"],
  ["Martes", "Tuesday"],
  ["Miércoles", "Wednesday"],
  ["Jueves", "Thursday"],
  ["Viernes", "Friday"],
  ["Sábado", "Saturday"],
] as const;

const DEFAULT_THEME: StallTheme = {
  primaryColor: "#a3341f",
  secondaryColor: "#e39b2d",
  backgroundColor: "#ffffff",
  textColor: "#2e1b14",
  buttonColor: "#a3341f",
  typography: "modern",
  layout: "classic",
  roundedCards: true,
  roundedButtons: true,
};

const DEFAULT_HOURS: StallOpeningHour[] =
  DAYS.map((_, day) => ({
    day,
    enabled: day !== 0,
    open: "09:00",
    close: "18:00",
  }));

function defaultSettings(): StallSettings {
  return {
    logoUrl: null,
    coverUrl: null,
    galleryUrls: [],

    descriptionEs: "",
    descriptionEn: "",
    taglineEs: "",
    taglineEn: "",
    welcomeMessageEs: "",
    welcomeMessageEn: "",

    address: "",
    city: "",
    state: "",
    postalCode: "",
    country: "México",
    googleMapsUrl: "",
    latitude: null,
    longitude: null,

    phone: "",
    whatsapp: "",
    email: "",
    instagram: "",
    facebook: "",
    tiktok: "",
    website: "",

    openingHours: DEFAULT_HOURS.map((h) => ({ ...h })),
    theme: { ...DEFAULT_THEME },

    showCover: true,
    showDescription: true,
    showLocation: true,
    showOpeningHours: true,
    showSocialLinks: true,
    showGallery: true,
  };
}

function isValidUrl(value: string): boolean {
  if (!value.trim()) return true;

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

// ==========================================
// COMPONENTES DEL FORMULARIO
// ==========================================

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[1.5rem] border border-[#eaded3] bg-white p-5 shadow-sm sm:p-7">
      <h2 className="text-xl font-black text-[#302018]">
        {title}
      </h2>

      {description && (
        <p className="mt-2 text-sm leading-relaxed text-[#80695d]">
          {description}
        </p>
      )}

      <div className="mt-6">{children}</div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline = false,
  type = "text",
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  type?: string;
  maxLength?: number;
}) {
  const classes =
    "mt-2 w-full rounded-xl border border-[#e7d8ca] bg-white px-4 py-3 text-sm text-[#302018] outline-none transition focus:border-[#a3341f] focus:ring-2 focus:ring-[#a3341f]/10";

  return (
    <label className="block min-w-0">
      <span className="text-sm font-semibold text-[#4b3024]">
        {label}
      </span>

      {multiline ? (
        <textarea
          rows={4}
          value={value}
          maxLength={maxLength}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={classes}
        />
      ) : (
        <input
          type={type}
          value={value}
          maxLength={maxLength}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={classes}
        />
      )}
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center gap-3 rounded-xl border border-[#eaded3] p-3">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-12 cursor-pointer rounded-lg border-0 bg-transparent"
      />

      <span className="min-w-0">
        <span className="block text-sm font-semibold text-[#302018]">
          {label}
        </span>
        <span className="text-xs text-[#80695d]">
          {value}
        </span>
      </span>
    </label>
  );
}

function SwitchField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-[#eaded3] bg-[#fffaf4] px-4 py-3">
      <span className="text-sm font-semibold text-[#302018]">
        {label}
      </span>

      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-5 accent-[#a3341f]"
      />
    </label>
  );
}

// ==========================================
// PÁGINA CON SUSPENSE
// Corrige el error de Next.js con useParams.
// ==========================================

export default function BusinessConfigurationPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-[60vh] items-center justify-center bg-[#fffaf4]">
          <p className="font-semibold text-[#4b3024]">
            Cargando configuración...
          </p>
        </main>
      }
    >
      <BusinessConfigurationContent />
    </Suspense>
  );
}

// ==========================================
// CONTENIDO DE CONFIGURACIÓN
// ==========================================

function BusinessConfigurationContent() {
  const params = useParams<{
    lang: string;
    slug: string;
  }>();

  const lang = params.lang;
  const slug = params.slug;
  const es = lang !== "en";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [name, setName] = useState("");
  const [settings, setSettings] =
    useState<StallSettings>(defaultSettings);

  const panelHref = `/${lang}/panel/${slug}`;
  const publicHref = `/${lang}/${slug}`;

  // ========================================
  // CARGAR DATOS DEL NEGOCIO
  // ========================================

  const loadData = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/stalls/${encodeURIComponent(slug)}?view=owner`,
        { cache: "no-store" },
      );

      if (!response.ok) {
        throw new Error(
          response.status === 401
            ? es
              ? "Debes iniciar sesión como dueño."
              : "You must sign in as an owner."
            : es
              ? "No se pudo cargar la configuración."
              : "Could not load business settings.",
        );
      }

      const data = (await response.json()) as OwnerView;
      const defaults = defaultSettings();

      setName(data.name);
      setSettings({
        ...defaults,
        ...data.settings,
        theme: {
          ...defaults.theme,
          ...data.settings?.theme,
        },
        openingHours:
          data.settings?.openingHours?.length
            ? data.settings.openingHours
            : defaults.openingHours,
        galleryUrls:
          data.settings?.galleryUrls ?? [],
      });
      setError("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Error de conexión",
      );
    } finally {
      setLoading(false);
    }
  }, [slug, es]);

  // Ejecutar la carga de forma asíncrona.
  // Evita actualizar el estado sincrónicamente
  // dentro del cuerpo del efecto.

  useEffect(() => {
    const timeout = setTimeout(() => {
      void loadData();
    }, 0);

    return () => clearTimeout(timeout);
  }, [loadData]);

  // ========================================
  // EDITAR CONFIGURACIÓN
  // ========================================

  function update<K extends keyof StallSettings>(
    key: K,
    value: StallSettings[K],
  ) {
    setNotice("");
    setSettings((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function updateTheme<K extends keyof StallTheme>(
    key: K,
    value: StallTheme[K],
  ) {
    setNotice("");
    setSettings((current) => ({
      ...current,
      theme: {
        ...DEFAULT_THEME,
        ...current.theme,
        [key]: value,
      },
    }));
  }

  function updateHour(
    day: number,
    patch: Partial<StallOpeningHour>,
  ) {
    const hours = settings.openingHours ?? DEFAULT_HOURS;

    update(
      "openingHours",
      hours.map((hour) =>
        hour.day === day
          ? { ...hour, ...patch }
          : hour,
      ),
    );
  }

  // ========================================
  // GUARDAR EN SUPABASE / MEMORIA
  // ========================================

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setNotice("");

    if (!name.trim()) {
      setError(
        es
          ? "Escribe el nombre de tu negocio."
          : "Enter your business name.",
      );
      return;
    }

    const allUrls = [
      settings.logoUrl ?? "",
      settings.coverUrl ?? "",
      settings.googleMapsUrl ?? "",
      settings.instagram ?? "",
      settings.facebook ?? "",
      settings.tiktok ?? "",
      settings.website ?? "",
      ...(settings.galleryUrls ?? []),
    ];

    if (allUrls.some((value) => !isValidUrl(value))) {
      setError(
        es
          ? "Revisa los enlaces. Deben comenzar con https:// o http://."
          : "Links must begin with https:// or http://.",
      );
      return;
    }

    if ((settings.galleryUrls?.length ?? 0) > 20) {
      setError(
        es
          ? "Puedes agregar máximo 20 fotografías."
          : "You can add up to 20 photos.",
      );
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(
        `/api/stalls/${encodeURIComponent(slug)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "saveSettings",
            name: name.trim(),
            settings,
          }),
        },
      );

      const result = await response
        .json()
        .catch(() => null);

      if (!response.ok) {
        const message =
          result?.error === "settings_not_supported"
            ? "El almacenamiento aún no tiene saveSettings."
            : result?.error === "bad_request"
              ? "Algún campo tiene un formato no permitido."
              : response.status === 401
                ? "Necesitas iniciar sesión."
                : "No se pudo guardar la configuración.";

        throw new Error(message);
      }

      const updated = result as OwnerView;
      const defaults = defaultSettings();

      setName(updated.name);
      setSettings({
        ...defaults,
        ...updated.settings,
        theme: {
          ...defaults.theme,
          ...updated.settings?.theme,
        },
        openingHours:
          updated.settings?.openingHours?.length
            ? updated.settings.openingHours
            : defaults.openingHours,
      });

      setNotice(
        es
          ? "¡Configuración guardada correctamente!"
          : "Settings saved successfully!",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Error de conexión",
      );
    } finally {
      setSaving(false);
    }
  }

  // ========================================
  // DATOS PARA LA VISTA PREVIA
  // ========================================

  const theme = {
    ...DEFAULT_THEME,
    ...settings.theme,
  };

  const previewStyle: CSSProperties = {
    backgroundColor: theme.backgroundColor,
    color: theme.textColor,
    fontFamily:
      theme.typography === "classic"
        ? "Georgia, serif"
        : theme.typography === "elegant"
          ? '"Palatino Linotype", Georgia, serif'
          : theme.typography === "rounded"
            ? '"Trebuchet MS", Arial, sans-serif'
            : "Arial, sans-serif",
  };

  const previewTagline = es
    ? settings.taglineEs
    : settings.taglineEn;

  const previewDescription = es
    ? settings.descriptionEs
    : settings.descriptionEn;

  const demoLogo =
    slug === "birria-dona-lupe"
      ? "/logo-birria-dona-lupe.png"
      : "";

  const demoCover =
    slug === "birria-dona-lupe"
      ? "/menu/plato-birria.jpg"
      : "";

  const logoPreview =
    isValidUrl(settings.logoUrl ?? "")
      ? settings.logoUrl || demoLogo
      : demoLogo;

  const coverPreview =
    isValidUrl(settings.coverUrl ?? "")
      ? settings.coverUrl || demoCover
      : demoCover;

  // ========================================
  // ESTADO DE CARGA Y ERROR
  // ========================================

  if (loading) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center bg-[#fffaf4] p-8">
        <p className="font-semibold text-[#4b3024]">
          {es
            ? "Cargando configuración..."
            : "Loading settings..."}
        </p>
      </main>
    );
  }

  if (error && !name) {
    return (
      <main className="min-h-screen bg-[#fffaf4] p-6">
        <div className="mx-auto max-w-xl rounded-2xl border bg-white p-6">
          <h1 className="text-2xl font-black">
            {es
              ? "No se pudo abrir Configuración"
              : "Could not open Settings"}
          </h1>

          <p className="mt-3 text-red-700">
            {error}
          </p>

          <Link
            href={panelHref}
            className="mt-5 inline-block font-semibold text-[#a3341f] underline"
          >
            {es ? "Volver al panel" : "Back to dashboard"}
          </Link>
        </div>
      </main>
    );
  }

  // ========================================
  // FORMULARIO PRINCIPAL
  // ========================================

  return (
    <main className="min-h-screen bg-[#fffaf4] pb-20">
      {/* ENCABEZADO */}

      <header className="border-b border-[#eaded3] bg-white px-4 py-7 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              href={panelHref}
              className="text-sm font-semibold text-[#a3341f] hover:underline"
            >
              ← {es ? "Volver al panel" : "Back to dashboard"}
            </Link>

            <p className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-[#a3341f]">
              {es
                ? "ADMINISTRACIÓN DEL NEGOCIO"
                : "BUSINESS MANAGEMENT"}
            </p>

            <h1 className="mt-2 text-3xl font-black text-[#302018] sm:text-4xl">
              {es
                ? "Configuración de mi negocio"
                : "Business settings"}
            </h1>

            <p className="mt-2 text-sm text-[#80695d]">
              {es
                ? "Personaliza la página que ven tus clientes."
                : "Customize your customer-facing page."}
            </p>
          </div>

          <Link
            href={publicHref}
            target="_blank"
            className="rounded-xl border border-[#eaded3] bg-white px-5 py-3 text-sm font-bold text-[#4b3024] shadow-sm"
          >
            {es ? "Ver página pública ↗" : "View public page ↗"}
          </Link>
        </div>
      </header>

      <form
        onSubmit={save}
        className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-8 xl:grid-cols-[minmax(0,1fr)_380px]"
      >
        <div className="flex min-w-0 flex-col gap-6">

          {/* IDENTIDAD */}

          <Section
            title={es ? "Identidad del negocio" : "Business identity"}
            description={
              es
                ? "Edita el nombre y los textos que verá el cliente."
                : "Edit the name and text shown to customers."
            }
          >
            <div className="grid gap-5">
              <Field
                label={es ? "Nombre del negocio" : "Business name"}
                value={name}
                maxLength={120}
                onChange={(v) => {
                  setName(v);
                  setNotice("");
                }}
              />

              <Field
                label="Eslogan en español"
                value={settings.taglineEs ?? ""}
                maxLength={180}
                onChange={(v) => update("taglineEs", v)}
                placeholder="Tradición y sabor casero"
              />

              <Field
                label="Tagline in English"
                value={settings.taglineEn ?? ""}
                maxLength={180}
                onChange={(v) => update("taglineEn", v)}
                placeholder="Homestyle tradition and flavor"
              />

              <Field
                label="Descripción en español"
                value={settings.descriptionEs ?? ""}
                maxLength={2000}
                multiline
                onChange={(v) => update("descriptionEs", v)}
              />

              <Field
                label="Description in English"
                value={settings.descriptionEn ?? ""}
                maxLength={2000}
                multiline
                onChange={(v) => update("descriptionEn", v)}
              />

              <Field
                label="Mensaje de bienvenida en español"
                value={settings.welcomeMessageEs ?? ""}
                maxLength={500}
                multiline
                onChange={(v) => update("welcomeMessageEs", v)}
              />

              <Field
                label="Welcome message in English"
                value={settings.welcomeMessageEn ?? ""}
                maxLength={500}
                multiline
                onChange={(v) => update("welcomeMessageEn", v)}
              />
            </div>
          </Section>

          {/* FOTOGRAFÍAS */}

          <Section
            title={es ? "Logo y fotografías" : "Logo and photos"}
            description={
              es
                ? "En esta etapa puedes pegar enlaces de imágenes. La carga directa desde tu dispositivo se agregará después."
                : "For now, use image URLs. Direct file uploads will be added next."
            }
          >
            <div className="grid gap-5">
              <Field
                label="URL del logo"
                value={settings.logoUrl ?? ""}
                maxLength={2048}
                placeholder="https://..."
                onChange={(v) => update("logoUrl", v || null)}
              />

              <Field
                label="URL de la portada"
                value={settings.coverUrl ?? ""}
                maxLength={2048}
                placeholder="https://..."
                onChange={(v) => update("coverUrl", v || null)}
              />

              <label className="block">
                <span className="text-sm font-semibold text-[#4b3024]">
                  {es
                    ? "Galería (una URL por línea)"
                    : "Gallery (one URL per line)"}
                </span>

                <textarea
                  rows={5}
                  value={(settings.galleryUrls ?? []).join("\n")}
                  onChange={(e) =>
                    update(
                      "galleryUrls",
                      e.target.value
                        .split("\n")
                        .map((v) => v.trim())
                        .filter(Boolean),
                    )
                  }
                  placeholder={"https://...\nhttps://..."}
                  className="mt-2 w-full rounded-xl border border-[#e7d8ca] bg-white px-4 py-3 text-sm outline-none focus:border-[#a3341f]"
                />
              </label>
            </div>
          </Section>

          {/* COLORES Y DISEÑO */}

          <Section
            title={es ? "Diseño y colores" : "Design and colors"}
            description={
              es
                ? "Elige los colores y el estilo visual de tu negocio."
                : "Choose the colors and visual style of your business."
            }
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <ColorField
                label={es ? "Color principal" : "Primary color"}
                value={theme.primaryColor!}
                onChange={(v) => updateTheme("primaryColor", v)}
              />

              <ColorField
                label={es ? "Color secundario" : "Secondary color"}
                value={theme.secondaryColor!}
                onChange={(v) => updateTheme("secondaryColor", v)}
              />

              <ColorField
                label={es ? "Fondo" : "Background"}
                value={theme.backgroundColor!}
                onChange={(v) => updateTheme("backgroundColor", v)}
              />

              <ColorField
                label={es ? "Texto" : "Text"}
                value={theme.textColor!}
                onChange={(v) => updateTheme("textColor", v)}
              />

              <ColorField
                label={es ? "Botones" : "Buttons"}
                value={theme.buttonColor!}
                onChange={(v) => updateTheme("buttonColor", v)}
              />
            </div>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-semibold">
                  {es ? "Tipografía" : "Typography"}
                </span>

                <select
                  value={theme.typography}
                  onChange={(e) =>
                    updateTheme(
                      "typography",
                      e.target.value as NonNullable<
                        StallTheme["typography"]
                      >,
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-[#e7d8ca] bg-white px-4 py-3"
                >
                  <option value="modern">Moderna</option>
                  <option value="classic">Clásica</option>
                  <option value="rounded">Redondeada</option>
                  <option value="elegant">Elegante</option>
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-semibold">
                  {es ? "Distribución" : "Layout"}
                </span>

                <select
                  value={theme.layout}
                  onChange={(e) =>
                    updateTheme(
                      "layout",
                      e.target.value as NonNullable<
                        StallTheme["layout"]
                      >,
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-[#e7d8ca] bg-white px-4 py-3"
                >
                  <option value="classic">Clásica</option>
                  <option value="grid">Cuadrícula</option>
                  <option value="compact">Compacta</option>
                </select>
              </label>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <SwitchField
                label={es ? "Tarjetas redondeadas" : "Rounded cards"}
                checked={theme.roundedCards !== false}
                onChange={(v) => updateTheme("roundedCards", v)}
              />

              <SwitchField
                label={es ? "Botones redondeados" : "Rounded buttons"}
                checked={theme.roundedButtons !== false}
                onChange={(v) => updateTheme("roundedButtons", v)}
              />
            </div>
          </Section>

          {/* UBICACIÓN */}

          <Section title={es ? "Ubicación" : "Location"}>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field
                  label={es ? "Dirección" : "Address"}
                  value={settings.address ?? ""}
                  maxLength={300}
                  onChange={(v) => update("address", v)}
                />
              </div>

              <Field
                label={es ? "Ciudad" : "City"}
                value={settings.city ?? ""}
                maxLength={100}
                onChange={(v) => update("city", v)}
              />

              <Field
                label={es ? "Estado" : "State"}
                value={settings.state ?? ""}
                maxLength={100}
                onChange={(v) => update("state", v)}
              />

              <Field
                label={es ? "Código postal" : "Postal code"}
                value={settings.postalCode ?? ""}
                maxLength={20}
                onChange={(v) => update("postalCode", v)}
              />

              <Field
                label={es ? "País" : "Country"}
                value={settings.country ?? ""}
                maxLength={100}
                onChange={(v) => update("country", v)}
              />

              <div className="sm:col-span-2">
                <Field
                  label="Enlace de Google Maps"
                  value={settings.googleMapsUrl ?? ""}
                  maxLength={2048}
                  placeholder="https://maps.google.com/..."
                  onChange={(v) => update("googleMapsUrl", v)}
                />
              </div>
            </div>
          </Section>

          {/* CONTACTO */}

          <Section
            title={
              es
                ? "Contacto y redes sociales"
                : "Contact and social media"
            }
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label={es ? "Teléfono" : "Phone"}
                value={settings.phone ?? ""}
                maxLength={40}
                onChange={(v) => update("phone", v)}
              />

              <Field
                label="WhatsApp"
                value={settings.whatsapp ?? ""}
                maxLength={40}
                onChange={(v) => update("whatsapp", v)}
              />

              <Field
                label={es ? "Correo electrónico" : "Email"}
                value={settings.email ?? ""}
                type="email"
                maxLength={254}
                onChange={(v) => update("email", v)}
              />

              <Field
                label="Instagram"
                value={settings.instagram ?? ""}
                maxLength={2048}
                placeholder="https://instagram.com/..."
                onChange={(v) => update("instagram", v)}
              />

              <Field
                label="Facebook"
                value={settings.facebook ?? ""}
                maxLength={2048}
                placeholder="https://facebook.com/..."
                onChange={(v) => update("facebook", v)}
              />

              <Field
                label="TikTok"
                value={settings.tiktok ?? ""}
                maxLength={2048}
                placeholder="https://tiktok.com/@..."
                onChange={(v) => update("tiktok", v)}
              />

              <div className="sm:col-span-2">
                <Field
                  label={es ? "Sitio web" : "Website"}
                  value={settings.website ?? ""}
                  maxLength={2048}
                  placeholder="https://..."
                  onChange={(v) => update("website", v)}
                />
              </div>
            </div>
          </Section>

          {/* HORARIOS */}

          <Section
            title={
              es
                ? "Horarios de atención"
                : "Opening hours"
            }
          >
            <div className="space-y-3">
              {(settings.openingHours ?? [])
                .slice()
                .sort((a, b) => a.day - b.day)
                .map((hour) => (
                  <div
                    key={hour.day}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-[#eaded3] p-4"
                  >
                    <label className="flex min-w-[130px] flex-1 items-center gap-2">
                      <input
                        type="checkbox"
                        checked={hour.enabled}
                        onChange={(e) =>
                          updateHour(hour.day, {
                            enabled: e.target.checked,
                          })
                        }
                        className="size-5 accent-[#a3341f]"
                      />

                      <span className="text-sm font-semibold">
                        {DAYS[hour.day]?.[es ? 0 : 1]}
                      </span>
                    </label>

                    <input
                      type="time"
                      value={hour.open}
                      disabled={!hour.enabled}
                      onChange={(e) =>
                        updateHour(hour.day, {
                          open: e.target.value,
                        })
                      }
                      className="rounded-lg border border-[#eaded3] px-3 py-2 disabled:opacity-40"
                    />

                    <span className="text-sm text-[#80695d]">
                      –
                    </span>

                    <input
                      type="time"
                      value={hour.close}
                      disabled={!hour.enabled}
                      onChange={(e) =>
                        updateHour(hour.day, {
                          close: e.target.value,
                        })
                      }
                      className="rounded-lg border border-[#eaded3] px-3 py-2 disabled:opacity-40"
                    />
                  </div>
                ))}
            </div>
          </Section>

          {/* VISIBILIDAD */}

          <Section
            title={
              es
                ? "Secciones visibles"
                : "Visible sections"
            }
            description={
              es
                ? "Decide qué partes de la página podrán ver tus clientes."
                : "Choose what customers can see."
            }
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["showCover", "Mostrar portada", "Show cover"],
                  ["showDescription", "Mostrar descripción", "Show description"],
                  ["showLocation", "Mostrar ubicación", "Show location"],
                  ["showOpeningHours", "Mostrar horarios", "Show hours"],
                  ["showSocialLinks", "Mostrar redes sociales", "Show social links"],
                  ["showGallery", "Mostrar galería", "Show gallery"],
                ] as const
              ).map(([key, labelEs, labelEn]) => (
                <SwitchField
                  key={key}
                  label={es ? labelEs : labelEn}
                  checked={settings[key] !== false}
                  onChange={(v) => update(key, v)}
                />
              ))}
            </div>
          </Section>

          {/* MENSAJES */}

          {error && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700"
            >
              {error}
            </div>
          )}

          {notice && (
            <div
              role="status"
              className="rounded-xl border border-green-200 bg-green-50 px-5 py-4 text-sm font-semibold text-green-800"
            >
              {notice}
            </div>
          )}

          {/* GUARDAR */}

          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-[#a3341f] px-6 py-4 text-base font-bold text-white shadow-sm transition hover:bg-[#872816] disabled:opacity-60"
          >
            {saving
              ? es
                ? "Guardando..."
                : "Saving..."
              : es
                ? "Guardar configuración"
                : "Save settings"}
          </button>
        </div>

        {/* ====================================
            VISTA PREVIA
        ==================================== */}

        <aside className="min-w-0">
          <div className="sticky top-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-black text-[#302018]">
                {es ? "Vista previa" : "Preview"}
              </h2>

              <span className="rounded-full bg-[#f4e6d9] px-3 py-1 text-xs font-semibold text-[#a3341f]">
                {es ? "Vista en edición" : "Editing preview"}
              </span>
            </div>

            <div
              className="overflow-hidden border border-[#eaded3] shadow-sm"
              style={{
                ...previewStyle,
                borderRadius:
                  theme.roundedCards === false
                    ? 6
                    : 24,
              }}
            >
              {settings.showCover !== false && (
                <div className="h-40 bg-[#f4e5d5]">
                  {coverPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={coverPreview}
                      alt="Vista previa de portada"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-5xl">
                      🍽️
                    </div>
                  )}
                </div>
              )}

              <div className="p-5">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#eaded3] bg-white">
                    {logoPreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={logoPreview}
                        alt="Vista previa del logo"
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <span className="text-3xl">🏪</span>
                    )}
                  </div>

                  <div className="min-w-0">
                    <p
                      className="text-xs font-bold"
                      style={{
                        color: theme.primaryColor,
                      }}
                    >
                      {previewTagline || (es ? "Tu eslogan" : "Your tagline")}
                    </p>

                    <h3 className="mt-1 break-words text-xl font-black">
                      {name || (es ? "Mi negocio" : "My business")}
                    </h3>
                  </div>
                </div>

                {settings.showDescription !== false && (
                  <p className="text-sm leading-relaxed opacity-80">
                    {previewDescription ||
                      (es
                        ? "Aquí aparecerá la descripción de tu negocio."
                        : "Your business description will appear here.")}
                  </p>
                )}

                <div className="mt-5 flex flex-wrap gap-2">
                  <span
                    className="px-3 py-2 text-xs font-bold text-white"
                    style={{
                      backgroundColor: theme.buttonColor,
                      borderRadius:
                        theme.roundedButtons === false ? 4 : 999,
                    }}
                  >
                    {es ? "Ver menú" : "View menu"}
                  </span>

                  <span
                    className="px-3 py-2 text-xs font-bold"
                    style={{
                      backgroundColor: theme.secondaryColor,
                      color: theme.textColor,
                      borderRadius:
                        theme.roundedButtons === false ? 4 : 999,
                    }}
                  >
                    {es ? "Hacer apartado" : "Reserve"}
                  </span>
                </div>

                {settings.showLocation !== false &&
                  (settings.city || settings.address) && (
                    <p className="mt-5 text-xs opacity-80">
                      📍{" "}
                      {[
                        settings.address,
                        settings.city,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  )}
              </div>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-[#80695d]">
              {es
                ? "Esta vista previa es simplificada. Guarda los cambios para verlos en la página pública."
                : "This is a simplified preview. Save changes to see them on the public page."}
            </p>
          </div>
        </aside>
      </form>
    </main>
  );
}
