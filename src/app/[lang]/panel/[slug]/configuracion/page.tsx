
"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type {
  CSSProperties,
  ChangeEvent,
  FormEvent,
  ReactNode,
} from "react";

import { CameraCapture } from "@/components/CameraCapture";
import type {
  OwnerView,
  StallOpeningHour,
  StallSettings,
  StallTheme,
  StallCoverPosition,
} from "@/lib/stall";

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

  // Nuevas opciones.
  coverPosition: "right",
  headerBackgroundColor: "#ffffff",
  headerTextColor: "#2e1b14",
};

const DEFAULT_HOURS: StallOpeningHour[] = DAYS.map(
  (_, day) => ({
    day,
    enabled: day !== 0,
    open: "09:00",
    close: "18:00",
  }),
);

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_GALLERY_IMAGES = 20;

type ImageKind = "logo" | "cover" | "gallery";

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

function mergeSettings(
  saved?: StallSettings,
): StallSettings {
  const defaults = defaultSettings();

  return {
    ...defaults,
    ...saved,
    theme: {
      ...defaults.theme,
      ...saved?.theme,
    },
    openingHours: saved?.openingHours?.length
      ? saved.openingHours
      : defaults.openingHours,
    galleryUrls: saved?.galleryUrls ?? [],
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

function validHex(value: string | undefined, fallback: string): string {
  return value && /^#[0-9a-fA-F]{6}$/.test(value)
    ? value
    : fallback;
}

function contrastRatioWhite(hex: string): boolean {
  const channels = [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ].map((value) => {
    const v = value / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });

  const luminance =
    channels[0] * 0.2126 +
    channels[1] * 0.7152 +
    channels[2] * 0.0722;

  return luminance < 0.179;
}

// ==========================================
// ELEMENTOS DEL FORMULARIO
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
        value={validHex(value, "#ffffff")}
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
// SUBIR IMÁGENES / ABRIR CÁMARA
// ==========================================

function ImageUploader({
  title,
  description,
  kind,
  lang,
  disabled,
  imageUrls,
  onUpload,
  onRemove,
  onOpenCamera,
}: {
  title: string;
  description: string;
  kind: ImageKind;
  lang: "es" | "en";
  disabled: boolean;
  imageUrls: string[];
  onUpload: (file: File, kind: ImageKind) => Promise<void>;
  onRemove: (index: number) => void;
  onOpenCamera: (kind: ImageKind) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const es = lang === "es";

  async function selected(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (!files.length) return;

    const chosen =
      kind === "gallery" ? files : files.slice(0, 1);

    for (const file of chosen) {
      try {
        await onUpload(file, kind);
      } catch {
        break;
      }
    }
  }

  return (
    <div className="rounded-2xl border border-[#eaded3] bg-[#fffaf4] p-4 sm:p-5">
      <h3 className="text-base font-bold text-[#302018]">
        {title}
      </h3>

      <p className="mt-1 text-sm text-[#80695d]">
        {description}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => fileRef.current?.click()}
          className="flex items-center justify-center gap-2 rounded-xl border border-[#decbbb] bg-white px-4 py-3 text-sm font-bold text-[#4b3024] transition hover:border-[#a3341f] disabled:opacity-50"
        >
          <span aria-hidden="true">📁</span>
          {es ? "Subir imagen" : "Upload image"}
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={() => onOpenCamera(kind)}
          className="flex items-center justify-center gap-2 rounded-xl border border-[#decbbb] bg-white px-4 py-3 text-sm font-bold text-[#4b3024] transition hover:border-[#a3341f] disabled:opacity-50"
        >
          <span aria-hidden="true">📷</span>
          {es ? "Tomar foto" : "Take photo"}
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple={kind === "gallery"}
        onChange={(event) => void selected(event)}
        className="hidden"
        aria-label={
          es ? "Seleccionar imagen" : "Select image"
        }
      />

      {imageUrls.length > 0 && (
        <div
          className={`mt-5 grid gap-3 ${
            kind === "gallery"
              ? "grid-cols-2 sm:grid-cols-3"
              : "grid-cols-1"
          }`}
        >
          {imageUrls.map((url, index) => (
            <div
              key={`${url}-${index}`}
              className="overflow-hidden rounded-xl border border-[#eaded3] bg-white"
            >
              <div
                className={
                  kind === "cover"
                    ? "h-40"
                    : "aspect-square max-h-48"
                }
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`${title} ${index + 1}`}
                  className={
                    kind === "logo"
                      ? "h-full w-full object-contain p-2"
                      : "h-full w-full object-cover"
                  }
                />
              </div>

              <button
                type="button"
                disabled={disabled}
                onClick={() => onRemove(index)}
                className="w-full border-t border-[#eaded3] px-3 py-2 text-sm font-semibold text-[#a3341f] hover:bg-red-50 disabled:opacity-50"
              >
                {es ? "Quitar imagen" : "Remove image"}
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="mt-3 text-xs text-[#80695d]">
        {es
          ? "Formatos: JPG, PNG o WEBP. Máximo 5 MB por fotografía."
          : "Formats: JPG, PNG or WEBP. Maximum 5 MB per photo."}
      </p>
    </div>
  );
}

// ==========================================
// SELECTOR DE LOS DOS DISEÑOS
// ==========================================

function CoverDesignSelector({
  value,
  onChange,
  lang,
}: {
  value: StallCoverPosition;
  onChange: (value: StallCoverPosition) => void;
  lang: "es" | "en";
}) {
  const es = lang === "es";

  const designs: {
    value: StallCoverPosition;
    label: string;
  }[] = [
    {
      value: "right",
      label: es
        ? "Portada a la derecha"
        : "Cover on the right",
    },
    {
      value: "background",
      label: es
        ? "Portada de fondo"
        : "Background cover",
    },
  ];

  return (
    <fieldset>
      <legend className="mb-3 text-sm font-bold text-[#4b3024]">
        {es ? "Diseño de portada" : "Cover design"}
      </legend>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {designs.map((design) => {
          const selected = value === design.value;

          return (
            <label
              key={design.value}
              className={`cursor-pointer overflow-hidden rounded-2xl border-2 bg-white transition ${
                selected
                  ? "border-[#a3341f] ring-2 ring-[#a3341f]/15"
                  : "border-[#eaded3] hover:border-[#cfa28d]"
              }`}
            >
              <input
                type="radio"
                name="coverPosition"
                value={design.value}
                checked={selected}
                onChange={() => onChange(design.value)}
                className="sr-only"
              />

              <div className="p-2">
                <svg
                  viewBox="0 0 240 125"
                  width="100%"
                  role="img"
                  aria-label={design.label}
                  className="overflow-hidden rounded-xl"
                >
                  <rect
                    width="240"
                    height="125"
                    rx="9"
                    fill="#a85c3d"
                  />

                  {design.value === "right" ? (
                    <>
                      <path
                        d="M140 82 L174 39 L202 75 L220 52 L240 72 V125 H140Z"
                        fill="#d89b70"
                      />
                      <circle
                        cx="208"
                        cy="35"
                        r="13"
                        fill="#f2c58d"
                      />
                      <rect
                        x="5"
                        y="5"
                        width="135"
                        height="115"
                        rx="8"
                        fill="#ffffff"
                      />
                      <rect
                        x="17"
                        y="20"
                        width="32"
                        height="32"
                        rx="8"
                        fill="#d4a890"
                      />
                      <rect
                        x="58"
                        y="24"
                        width="67"
                        height="9"
                        rx="4"
                        fill="#9e6a51"
                      />
                      <rect
                        x="58"
                        y="39"
                        width="54"
                        height="5"
                        rx="2"
                        fill="#c7ada0"
                      />
                      <rect
                        x="17"
                        y="68"
                        width="107"
                        height="5"
                        rx="2"
                        fill="#c7ada0"
                      />
                      <rect
                        x="17"
                        y="80"
                        width="91"
                        height="5"
                        rx="2"
                        fill="#c7ada0"
                      />
                      <rect
                        x="17"
                        y="99"
                        width="48"
                        height="12"
                        rx="6"
                        fill="#b36b4f"
                      />
                    </>
                  ) : (
                    <>
                      <path
                        d="M0 85 L60 19 L114 82 L167 37 L240 90 V125 H0Z"
                        fill="#d89b70"
                      />
                      <circle
                        cx="213"
                        cy="28"
                        r="14"
                        fill="#f2c58d"
                      />
                      <rect
                        x="14"
                        y="15"
                        width="135"
                        height="95"
                        rx="9"
                        fill="#ffffff"
                        fillOpacity=".94"
                      />
                      <rect
                        x="26"
                        y="26"
                        width="28"
                        height="28"
                        rx="7"
                        fill="#d4a890"
                      />
                      <rect
                        x="63"
                        y="30"
                        width="69"
                        height="8"
                        rx="4"
                        fill="#9e6a51"
                      />
                      <rect
                        x="63"
                        y="44"
                        width="56"
                        height="5"
                        rx="2"
                        fill="#c7ada0"
                      />
                      <rect
                        x="26"
                        y="67"
                        width="105"
                        height="5"
                        rx="2"
                        fill="#c7ada0"
                      />
                      <rect
                        x="26"
                        y="79"
                        width="87"
                        height="5"
                        rx="2"
                        fill="#c7ada0"
                      />
                      <rect
                        x="26"
                        y="94"
                        width="48"
                        height="10"
                        rx="5"
                        fill="#b36b4f"
                      />
                    </>
                  )}
                </svg>
              </div>

              <div className="flex items-center gap-2 px-3 pb-4 pt-1">
                <span
                  aria-hidden="true"
                  className={`flex size-5 items-center justify-center rounded-full border-2 text-xs font-bold ${
                    selected
                      ? "border-[#a3341f] bg-[#a3341f] text-white"
                      : "border-[#c7b5a7] bg-white"
                  }`}
                >
                  {selected ? "✓" : ""}
                </span>

                <span className="text-sm font-semibold text-[#302018]">
                  {design.label}
                </span>
              </div>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

// ==========================================
// VISTA PREVIA DEL ENCABEZADO
// ==========================================

function BusinessHeaderPreview({
  name,
  slug,
  settings,
  lang,
}: {
  name: string;
  slug: string;
  settings: StallSettings;
  lang: "es" | "en";
}) {
  const es = lang === "es";

  const theme = {
    ...DEFAULT_THEME,
    ...settings.theme,
  };

  const coverPosition =
    theme.coverPosition === "background"
      ? "background"
      : "right";

  const headerBackgroundColor = validHex(
    theme.headerBackgroundColor,
    "#ffffff",
  );

  const headerTextColor = validHex(
    theme.headerTextColor,
    "#2e1b14",
  );

  const accentColor = validHex(
    theme.primaryColor,
    "#a3341f",
  );

  const isDemo = slug === "birria-dona-lupe";

  const logoPreview =
    settings.logoUrl ||
    (isDemo ? "/logo-birria-dona-lupe.png" : "");

  const coverPreview =
    settings.coverUrl ||
    (isDemo ? "/menu/plato-birria.jpg" : "");

  const tagline =
    (es ? settings.taglineEs : settings.taglineEn) ||
    (isDemo
      ? es
        ? "Tradición y sabor casero"
        : "Homestyle tradition and flavor"
      : "");

  const description =
    (es ? settings.descriptionEs : settings.descriptionEn) ||
    (isDemo
      ? es
        ? "El sabor de la birria tradicional, preparado para ti. Descubre lo que tenemos disponible y aparta tus favoritos antes de que se acaben."
        : "The taste of traditional birria, prepared for you. Explore what's available and reserve your favorites before they sell out."
      : "");

  const welcomeMessage = es
    ? settings.welcomeMessageEs
    : settings.welcomeMessageEn;

  const location = [
    settings.address,
    settings.city,
    settings.state,
  ]
    .filter(Boolean)
    .join(", ");

  const showCover = settings.showCover !== false;
  const backgroundHero =
    showCover && coverPosition === "background";

  const previewFont =
    theme.typography === "classic"
      ? "Georgia, serif"
      : theme.typography === "elegant"
        ? '"Palatino Linotype", Georgia, serif'
        : theme.typography === "rounded"
          ? '"Trebuchet MS", Arial, sans-serif'
          : "Arial, sans-serif";

  const cardStyle: CSSProperties = {
    backgroundColor: headerBackgroundColor,
    color: headerTextColor,
  };

  const image = (
    <>
      {coverPreview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coverPreview}
          alt={es ? "Vista de portada" : "Cover preview"}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-[#f4e5d5] text-5xl">
          🍽️
        </div>
      )}
    </>
  );

  const information = (
    <div
      className={`relative z-10 flex min-w-0 flex-col justify-center gap-4 p-5 sm:p-6 ${
        backgroundHero
          ? "w-full max-w-[540px] rounded-2xl shadow-lg"
          : ""
      }`}
      style={cardStyle}
    >
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#eaded3] bg-[#fff9ed]">
          {logoPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoPreview}
              alt="Logo"
              className="h-full w-full object-contain p-1"
            />
          ) : (
            <span className="text-3xl">🏪</span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          {tagline && (
            <p
              className="text-[10px] font-black uppercase tracking-[0.12em]"
              style={{ color: accentColor }}
            >
              {tagline}
            </p>
          )}

          <h3
            className="mt-1 break-words text-xl font-black leading-tight"
            style={{ color: headerTextColor }}
          >
            {name || (es ? "Mi negocio" : "My business")}
          </h3>
        </div>
      </div>

      {settings.showDescription !== false && description && (
        <p
          className="text-xs leading-relaxed sm:text-sm"
          style={{
            color: headerTextColor,
            opacity: 0.85,
          }}
        >
          {description}
        </p>
      )}

      {welcomeMessage && (
        <p
          className="text-xs font-semibold"
          style={{ color: accentColor }}
        >
          {welcomeMessage}
        </p>
      )}

      {settings.showLocation !== false && location && (
        <p
          className="text-xs"
          style={{
            color: headerTextColor,
            opacity: 0.85,
          }}
        >
          📍 {location}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-green-100 px-3 py-1.5 text-xs font-bold text-green-700">
          ● {es ? "Abierto" : "Open"}
        </span>

        <span
          className="rounded-full border px-3 py-1.5 text-[11px]"
          style={{
            color: headerTextColor,
            borderColor: `${headerTextColor}33`,
          }}
        >
          ◷ {es ? "Actualizado ahora" : "Updated now"}
        </span>
      </div>
    </div>
  );

  return (
    <div
      className="overflow-hidden rounded-[1.6rem] border border-[#eaded3] shadow-sm"
      style={{
        backgroundColor: headerBackgroundColor,
        fontFamily: previewFont,
      }}
    >
      {backgroundHero ? (
        <div className="relative isolate min-h-[300px] p-4 sm:flex sm:items-center sm:p-6">
          <div className="absolute inset-0 -z-20">
            {image}
          </div>

          <div className="pointer-events-none absolute inset-0 -z-10 bg-black/20" />

          {information}
        </div>
      ) : (
        <div
          className={
            showCover
              ? "grid grid-cols-1 md:grid-cols-[1.15fr_0.85fr]"
              : "grid grid-cols-1"
          }
        >
          {information}

          {showCover && (
            <div className="relative min-h-[180px] bg-[#f4e5d5] md:min-h-[270px]">
              {image}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ==========================================
// PÁGINA CON SUSPENSE
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

function BusinessConfigurationContent() {
  const params = useParams<{
    lang: string;
    slug: string;
  }>();

  const lang: "es" | "en" =
    params.lang === "en" ? "en" : "es";

  const slug = params.slug;
  const es = lang === "es";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [name, setName] = useState("");
  const [settings, setSettings] =
    useState<StallSettings>(defaultSettings);

  const [cameraKind, setCameraKind] =
    useState<ImageKind | null>(null);

  const panelHref = `/${lang}/panel/${slug}`;
  const publicHref = `/${lang}/${slug}`;

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
              ? "Necesitas iniciar sesión como dueño."
              : "You must sign in as an owner."
            : es
              ? "No se pudo cargar la configuración."
              : "Could not load settings.",
        );
      }

      const data = (await response.json()) as OwnerView;

      setName(data.name);
      setSettings(mergeSettings(data.settings));
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

  useEffect(() => {
    const timeout = setTimeout(() => {
      void loadData();
    }, 0);

    return () => clearTimeout(timeout);
  }, [loadData]);

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
  // SUBIDA A SUPABASE
  // ========================================

  async function uploadImage(
    file: File,
    kind: ImageKind,
  ): Promise<void> {
    setError("");
    setNotice("");

    const fail = (message: string): never => {
      setError(message);
      throw new Error(message);
    };

    const acceptedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!acceptedTypes.includes(file.type)) {
      fail(
        es
          ? "La imagen debe ser JPG, PNG o WEBP."
          : "The image must be JPG, PNG or WEBP.",
      );
    }

    if (
      file.size === 0 ||
      file.size > MAX_IMAGE_BYTES
    ) {
      fail(
        es
          ? "La imagen debe pesar menos de 5 MB."
          : "The image must be under 5 MB.",
      );
    }

    if (
      kind === "gallery" &&
      (settings.galleryUrls?.length ?? 0) >=
        MAX_GALLERY_IMAGES
    ) {
      fail(
        es
          ? "La galería permite máximo 20 imágenes."
          : "The gallery allows up to 20 images.",
      );
    }

    setUploading(true);

    try {
      const form = new FormData();
      form.append("kind", kind);
      form.append("file", file);

      const response = await fetch(
        `/api/stalls/${encodeURIComponent(slug)}/branding-image`,
        {
          method: "POST",
          body: form,
        },
      );

      const result = await response
        .json()
        .catch(() => null);

      if (!response.ok || !result?.url) {
        const message =
          result?.error === "storage_not_configured"
            ? es
              ? "Supabase Storage no está configurado."
              : "Supabase Storage is not configured."
            : result?.error === "file_too_large"
              ? es
                ? "La fotografía supera los 5 MB."
                : "The photo exceeds 5 MB."
              : result?.error === "unsupported_image" ||
                  result?.error === "invalid_image"
                ? es
                  ? "El formato de imagen no es compatible."
                  : "Unsupported image format."
                : response.status === 401
                  ? es
                    ? "Necesitas iniciar sesión como dueño."
                    : "You must sign in as an owner."
                  : es
                    ? "No se pudo subir la fotografía."
                    : "Could not upload the photograph.";

        throw new Error(message);
      }

      const url: string = result.url;

      if (kind === "logo") {
        update("logoUrl", url);
      } else if (kind === "cover") {
        update("coverUrl", url);
      } else {
        setSettings((current) => ({
          ...current,
          galleryUrls: [
            ...(current.galleryUrls ?? []),
            url,
          ].slice(0, MAX_GALLERY_IMAGES),
        }));
      }

      setNotice(
        es
          ? "Imagen subida. Pulsa Guardar configuración para publicarla."
          : "Image uploaded. Select Save settings to publish it.",
      );
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : es
            ? "Error al subir la imagen."
            : "Image upload error.";

      setError(message);
      throw err;
    } finally {
      setUploading(false);
    }
  }

  // ========================================
  // CÁMARA
  // ========================================

  function openCamera(kind: ImageKind) {
    if (uploading || saving) return;

    setError("");
    setNotice("");

    if (
      kind === "gallery" &&
      (settings.galleryUrls?.length ?? 0) >=
        MAX_GALLERY_IMAGES
    ) {
      setError(
        es
          ? "La galería ya tiene 20 fotografías."
          : "The gallery already has 20 photos.",
      );
      return;
    }

    setCameraKind(kind);
  }

  function removeImage(
    kind: ImageKind,
    index: number,
  ) {
    if (kind === "logo") {
      update("logoUrl", null);
    } else if (kind === "cover") {
      update("coverUrl", null);
    } else {
      update(
        "galleryUrls",
        (settings.galleryUrls ?? []).filter(
          (_, i) => i !== index,
        ),
      );
    }
  }

  // ========================================
  // GUARDAR CONFIGURACIÓN
  // ========================================

  async function save(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (uploading || saving || cameraKind) return;

    setError("");
    setNotice("");

    if (!name.trim()) {
      setError(
        es
          ? "Escribe el nombre del negocio."
          : "Enter the business name.",
      );
      return;
    }

    const urls = [
      settings.logoUrl ?? "",
      settings.coverUrl ?? "",
      settings.googleMapsUrl ?? "",
      settings.instagram ?? "",
      settings.facebook ?? "",
      settings.tiktok ?? "",
      settings.website ?? "",
      ...(settings.galleryUrls ?? []),
    ];

    if (urls.some((url) => !isValidUrl(url))) {
      setError(
        es
          ? "Revisa los enlaces de contacto y las imágenes."
          : "Check contact links and images.",
      );
      return;
    }

    if (
      (settings.galleryUrls?.length ?? 0) >
      MAX_GALLERY_IMAGES
    ) {
      setError(
        es
          ? "La galería permite máximo 20 imágenes."
          : "The gallery allows up to 20 images.",
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
        throw new Error(
          result?.error === "settings_not_supported"
            ? "El almacenamiento no tiene saveSettings."
            : result?.error === "bad_request"
              ? "Algún campo tiene un formato incorrecto."
              : response.status === 401
                ? "Necesitas iniciar sesión."
                : "No se pudo guardar la configuración.",
        );
      }

      const updated = result as OwnerView;

      setName(updated.name);
      setSettings(mergeSettings(updated.settings));

      setNotice(
        es
          ? "¡Configuración guardada correctamente!"
          : "Settings saved successfully!",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Error al guardar.",
      );
    } finally {
      setSaving(false);
    }
  }

  const theme = {
    ...DEFAULT_THEME,
    ...settings.theme,
  };

  const headerBackgroundColor = validHex(
    theme.headerBackgroundColor,
    "#ffffff",
  );

  const headerTextColor = validHex(
    theme.headerTextColor,
    "#2e1b14",
  );

  const coverPosition =
    theme.coverPosition === "background"
      ? "background"
      : "right";

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

          <p className="mt-3 text-red-700">{error}</p>

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
                ? "Personaliza tu página pública con fotografías, colores e información de tu negocio."
                : "Customize your public page with photos, colors and business details."}
            </p>
          </div>

          <Link
            href={publicHref}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-[#eaded3] bg-white px-5 py-3 text-sm font-bold text-[#4b3024] shadow-sm"
          >
            {es
              ? "Ver página pública ↗"
              : "View public page ↗"}
          </Link>
        </div>
      </header>

      <form
        onSubmit={save}
        className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-8 xl:grid-cols-[minmax(0,1fr)_minmax(380px,0.9fr)]"
      >
        <div className="flex min-w-0 flex-col gap-6">
          {/* ==================================
              IDENTIDAD
          ================================== */}

          <Section
            title={
              es ? "Identidad del negocio" : "Business identity"
            }
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
                onChange={(v) =>
                  update("welcomeMessageEs", v)
                }
              />

              <Field
                label="Welcome message in English"
                value={settings.welcomeMessageEn ?? ""}
                maxLength={500}
                multiline
                onChange={(v) =>
                  update("welcomeMessageEn", v)
                }
              />
            </div>
          </Section>

          {/* ==================================
              LOGO Y FOTOGRAFÍAS
          ================================== */}

          <Section
            title={
              es ? "Logo y fotografías" : "Logo and photos"
            }
            description={
              es
                ? "Sube imágenes desde tu computadora o teléfono, o utiliza la cámara. No necesitas pegar enlaces."
                : "Upload images from your computer or phone, or use your camera. No URLs needed."
            }
          >
            <div className="space-y-5">
              <ImageUploader
                title={es ? "Logo del negocio" : "Business logo"}
                description={
                  es
                    ? "Sube una imagen cuadrada de tu logo."
                    : "Upload a square image of your logo."
                }
                kind="logo"
                lang={lang}
                disabled={uploading || saving}
                imageUrls={
                  settings.logoUrl ? [settings.logoUrl] : []
                }
                onUpload={uploadImage}
                onRemove={(i) => removeImage("logo", i)}
                onOpenCamera={openCamera}
              />

              <ImageUploader
                title={
                  es ? "Fotografía de portada" : "Cover photo"
                }
                description={
                  es
                    ? "Elige la fotografía principal que verán tus clientes."
                    : "Choose the main photo customers will see."
                }
                kind="cover"
                lang={lang}
                disabled={uploading || saving}
                imageUrls={
                  settings.coverUrl ? [settings.coverUrl] : []
                }
                onUpload={uploadImage}
                onRemove={(i) => removeImage("cover", i)}
                onOpenCamera={openCamera}
              />

              <ImageUploader
                title={
                  es
                    ? "Galería de fotografías"
                    : "Photo gallery"
                }
                description={
                  es
                    ? "Agrega hasta 20 fotografías de tus platillos, negocio o instalaciones."
                    : "Add up to 20 photos of your food, business or premises."
                }
                kind="gallery"
                lang={lang}
                disabled={uploading || saving}
                imageUrls={settings.galleryUrls ?? []}
                onUpload={uploadImage}
                onRemove={(i) => removeImage("gallery", i)}
                onOpenCamera={openCamera}
              />

              {uploading && (
                <div
                  role="status"
                  className="rounded-xl bg-[#fff3df] px-4 py-3 text-sm font-semibold text-[#8a4a20]"
                >
                  {es
                    ? "Subiendo fotografía ..."
                    : "Uploading photo ..."}
                </div>
              )}

              <p className="text-xs leading-relaxed text-[#80695d]">
                {es
                  ? "Las imágenes se envían a Supabase al seleccionarlas o confirmar una foto. Para mostrarlas en la página pública, pulsa Guardar configuración. Quitar una foto aquí no elimina el archivo de Storage."
                  : "Images upload to Supabase when selected or confirmed. Select Save settings to show them on the public page. Removing an image here does not delete the stored file."}
              </p>
            </div>
          </Section>

          {/* ==================================
              DISEÑO DE PORTADA
          ================================== */}

          <Section
            title={
              es ? "Diseño de portada" : "Cover design"
            }
            description={
              es
                ? "Elige cómo se muestra la fotografía principal en el encabezado de tu negocio."
                : "Choose how the main photograph appears in your business header."
            }
          >
            <CoverDesignSelector
              value={coverPosition}
              onChange={(position) =>
                updateTheme("coverPosition", position)
              }
              lang={lang}
            />

            <p className="mt-4 text-xs leading-relaxed text-[#80695d]">
              {es
                ? "La opción predeterminada es Portada a la derecha. Puedes cambiar entre los dos diseños cuando quieras."
                : "The default is Cover on the right. You can switch between both designs at any time."}
            </p>
          </Section>

          {/* ==================================
              COLORES Y DISEÑO
          ================================== */}

          <Section
            title={
              es ? "Diseño y colores" : "Design and colors"
            }
            description={
              es
                ? "Personaliza el fondo general, el cuadro informativo y sus textos por separado."
                : "Customize the page background, information card and its text separately."
            }
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <ColorField
                label={es ? "Color principal" : "Primary color"}
                value={theme.primaryColor!}
                onChange={(v) =>
                  updateTheme("primaryColor", v)
                }
              />

              <ColorField
                label={
                  es ? "Color secundario" : "Secondary color"
                }
                value={theme.secondaryColor!}
                onChange={(v) =>
                  updateTheme("secondaryColor", v)
                }
              />

              <ColorField
                label={es ? "Fondo general" : "Page background"}
                value={theme.backgroundColor!}
                onChange={(v) =>
                  updateTheme("backgroundColor", v)
                }
              />

              <ColorField
                label={es ? "Texto general" : "Page text"}
                value={theme.textColor!}
                onChange={(v) =>
                  updateTheme("textColor", v)
                }
              />

              <ColorField
                label={es ? "Botones" : "Buttons"}
                value={theme.buttonColor!}
                onChange={(v) =>
                  updateTheme("buttonColor", v)
                }
              />
            </div>

            <div className="mt-6 rounded-2xl border border-[#eaded3] bg-[#fffaf4] p-4 sm:p-5">
              <h3 className="text-base font-black text-[#302018]">
                {es
                  ? "Cuadro de información"
                  : "Information card"}
              </h3>

              <p className="mt-2 text-sm text-[#80695d]">
                {es
                  ? "Estos colores solo afectan el cuadro que contiene el logo, nombre, descripción y estado del negocio."
                  : "These colors only affect the card containing the logo, name, description and business status."}
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <ColorField
                  label={
                    es
                      ? "Color del cuadro"
                      : "Card background"
                  }
                  value={headerBackgroundColor}
                  onChange={(v) => {
                    updateTheme("headerBackgroundColor", v);
                    updateTheme(
                      "headerTextColor",
                      contrastRatioWhite(v)
                        ? "#ffffff"
                        : "#2e1b14",
                    );
                  }}
                />

                <ColorField
                  label={
                    es
                      ? "Texto del cuadro"
                      : "Card text"
                  }
                  value={headerTextColor}
                  onChange={(v) =>
                    updateTheme("headerTextColor", v)
                  }
                />
              </div>

              <div
                className="mt-4 rounded-xl border border-black/10 p-4"
                style={{
                  backgroundColor: headerBackgroundColor,
                  color: headerTextColor,
                }}
              >
                <p className="font-black">
                  {name || (es ? "Mi negocio" : "My business")}
                </p>

                <p className="mt-2 text-sm">
                  {es
                    ? "Así se verá el texto sobre el color seleccionado."
                    : "This is how the text looks on the selected color."}
                </p>
              </div>

              <p className="mt-3 text-xs text-[#80695d]">
                {es
                  ? "Al cambiar el fondo del cuadro, sugerimos automáticamente un color de texto claro u oscuro. Puedes ajustarlo después."
                  : "When you change the card background, we suggest light or dark text automatically. You can adjust it afterwards."}
              </p>
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
                label={
                  es ? "Tarjetas redondeadas" : "Rounded cards"
                }
                checked={theme.roundedCards !== false}
                onChange={(v) =>
                  updateTheme("roundedCards", v)
                }
              />

              <SwitchField
                label={
                  es ? "Botones redondeados" : "Rounded buttons"
                }
                checked={theme.roundedButtons !== false}
                onChange={(v) =>
                  updateTheme("roundedButtons", v)
                }
              />
            </div>
          </Section>

          {/* ==================================
              UBICACIÓN
          ================================== */}

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
                label={
                  es ? "Código postal" : "Postal code"
                }
                value={settings.postalCode ?? ""}
                maxLength={20}
                onChange={(v) =>
                  update("postalCode", v)
                }
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
                  onChange={(v) =>
                    update("googleMapsUrl", v)
                  }
                  placeholder="https://maps.google.com/..."
                />
              </div>
            </div>
          </Section>

          {/* ==================================
              CONTACTO
          ================================== */}

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
                onChange={(v) =>
                  update("whatsapp", v)
                }
              />

              <Field
                label={
                  es ? "Correo electrónico" : "Email"
                }
                value={settings.email ?? ""}
                type="email"
                maxLength={254}
                onChange={(v) => update("email", v)}
              />

              <Field
                label="Instagram"
                value={settings.instagram ?? ""}
                maxLength={2048}
                onChange={(v) =>
                  update("instagram", v)
                }
              />

              <Field
                label="Facebook"
                value={settings.facebook ?? ""}
                maxLength={2048}
                onChange={(v) =>
                  update("facebook", v)
                }
              />

              <Field
                label="TikTok"
                value={settings.tiktok ?? ""}
                maxLength={2048}
                onChange={(v) => update("tiktok", v)}
              />

              <div className="sm:col-span-2">
                <Field
                  label={es ? "Sitio web" : "Website"}
                  value={settings.website ?? ""}
                  maxLength={2048}
                  onChange={(v) =>
                    update("website", v)
                  }
                />
              </div>
            </div>
          </Section>

          {/* ==================================
              HORARIOS
          ================================== */}

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

          {/* ==================================
              SECCIONES VISIBLES
          ================================== */}

          <Section
            title={
              es ? "Secciones visibles" : "Visible sections"
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
                  [
                    "showCover",
                    "Mostrar portada",
                    "Show cover",
                  ],
                  [
                    "showDescription",
                    "Mostrar descripción",
                    "Show description",
                  ],
                  [
                    "showLocation",
                    "Mostrar ubicación",
                    "Show location",
                  ],
                  [
                    "showOpeningHours",
                    "Mostrar horarios",
                    "Show hours",
                  ],
                  [
                    "showSocialLinks",
                    "Mostrar redes sociales",
                    "Show social links",
                  ],
                  [
                    "showGallery",
                    "Mostrar galería",
                    "Show gallery",
                  ],
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

          {/* ==================================
              MENSAJES
          ================================== */}

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

          <button
            type="submit"
            disabled={saving || uploading || cameraKind !== null}
            className="rounded-xl bg-[#a3341f] px-6 py-4 text-base font-bold text-white shadow-sm transition hover:bg-[#872816] disabled:opacity-60"
          >
            {saving
              ? es
                ? "Guardando..."
                : "Saving..."
              : uploading
                ? es
                  ? "Subiendo fotografías..."
                  : "Uploading photos..."
                : es
                  ? "Guardar configuración"
                  : "Save settings"}
          </button>
        </div>

        {/* ==================================
            VISTA PREVIA
        ================================== */}

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

            <BusinessHeaderPreview
              name={name}
              slug={slug}
              settings={settings}
              lang={lang}
            />

            <p className="mt-3 text-xs leading-relaxed text-[#80695d]">
              {es
                ? "La vista previa reproduce la distribución y los colores del encabezado. Los cambios no se publicarán hasta que guardes."
                : "The preview shows the header layout and colors. Changes are not published until you save."}
            </p>

            <Link
              href={publicHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex w-full items-center justify-center rounded-xl border border-[#eaded3] bg-white px-4 py-3 text-sm font-bold text-[#a3341f] transition hover:bg-[#fff4e9]"
            >
              {es
                ? "Ver página pública ↗"
                : "View public page ↗"}
            </Link>
          </div>
        </aside>
      </form>

      {/* CÁMARA: SOLO SE MONTA AL PULSAR TOMAR FOTO */}

      {cameraKind !== null && (
        <CameraCapture
          lang={lang}
          onCapture={(file) =>
            uploadImage(file, cameraKind)
          }
          onClose={() => setCameraKind(null)}
        />
      )}
    </main>
  );
}
