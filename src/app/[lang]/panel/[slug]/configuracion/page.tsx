
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

    return (
      url.protocol === "https:" ||
      url.protocol === "http:"
    );
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
// SELECTOR DE IMÁGENES
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
        // El componente principal muestra el error.
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
        {/* SUBIR DESDE EL DISPOSITIVO */}

        <button
          type="button"
          disabled={disabled}
          onClick={() => fileRef.current?.click()}
          className="flex items-center justify-center gap-2 rounded-xl border border-[#decbbb] bg-white px-4 py-3 text-sm font-bold text-[#4b3024] transition hover:border-[#a3341f] disabled:opacity-50"
        >
          <span aria-hidden="true">📁</span>
          {es ? "Subir imagen" : "Upload image"}
        </button>

        {/* ABRIR LA CÁMARA REAL */}

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

      {/* SOLO SELECCIÓN DE ARCHIVOS.
          La cámara se controla con CameraCapture. */}

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

      {/* IMÁGENES CARGADAS */}

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

// ==========================================
// CONTENIDO DE CONFIGURACIÓN
// ==========================================

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

  // NUEVO:
  // null = cámara cerrada.
  // logo / cover / gallery = cámara para esa sección.
  const [cameraKind, setCameraKind] =
    useState<ImageKind | null>(null);

  const panelHref = `/${lang}/panel/${slug}`;
  const publicHref = `/${lang}/${slug}`;

  // ========================================
  // CARGAR CONFIGURACIÓN
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

  // ========================================
  // ACTUALIZAR CAMPOS
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
  // SUBIR IMÁGENES
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

    if (file.size === 0 || file.size > MAX_IMAGE_BYTES) {
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

      // IMPORTANTE:
      // La cámara necesita recibir el error
      // para no cerrarse cuando falle la subida.
      throw err;
    } finally {
      setUploading(false);
    }
  }

  // ========================================
  // ABRIR Y CERRAR CÁMARA
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

    // El componente CameraCapture se monta
    // únicamente después de este clic.
    // Ahí el navegador solicitará el permiso.
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

  // ========================================
  // VISTA PREVIA
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

  const logoPreview = settings.logoUrl || demoLogo;
  const coverPreview = settings.coverUrl || demoCover;

  // ========================================
  // CARGANDO
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
            {es
              ? "Volver al panel"
              : "Back to dashboard"}
          </Link>
        </div>
      </main>
    );
  }

  // ========================================
  // PÁGINA PRINCIPAL
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
                ? "Personaliza tu página pública con fotografías, colores e información de tu negocio."
                : "Customize your public page with photos, colors and business details."}
            </p>
          </div>

          <Link
            href={publicHref}
            target="_blank"
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
        className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-8 xl:grid-cols-[minmax(0,1fr)_380px]"
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
                label={
                  es ? "Nombre del negocio" : "Business name"
                }
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
                title={
                  es ? "Logo del negocio" : "Business logo"
                }
                description={
                  es
                    ? "Sube una imagen cuadrada de tu logo."
                    : "Upload a square image of your logo."
                }
                kind="logo"
                lang={lang}
                disabled={uploading || saving}
                imageUrls={
                  settings.logoUrl
                    ? [settings.logoUrl]
                    : []
                }
                onUpload={uploadImage}
                onRemove={(index) =>
                  removeImage("logo", index)
                }
                onOpenCamera={openCamera}
              />

              <ImageUploader
                title={
                  es
                    ? "Fotografía de portada"
                    : "Cover photo"
                }
                description={
                  es
                    ? "Elige la foto principal que verán tus clientes."
                    : "Choose the main photo customers will see."
                }
                kind="cover"
                lang={lang}
                disabled={uploading || saving}
                imageUrls={
                  settings.coverUrl
                    ? [settings.coverUrl]
                    : []
                }
                onUpload={uploadImage}
                onRemove={(index) =>
                  removeImage("cover", index)
                }
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
                onRemove={(index) =>
                  removeImage("gallery", index)
                }
                onOpenCamera={openCamera}
              />

              {uploading && (
                <div
                  role="status"
                  className="rounded-xl bg-[#fff3df] px-4 py-3 text-sm font-semibold text-[#8a4a20]"
                >
                  {es
                    ? "Subiendo fotografía a Supabase..."
                    : "Uploading photo to Supabase..."}
                </div>
              )}

              <p className="text-xs leading-relaxed text-[#80695d]">
                {es
                  ? "Las imágenes se envían a Supabase al seleccionarlas o al confirmar una fotografía de la cámara. No aparecerán en tu página pública hasta que guardes la configuración. Quitar una foto del formulario no borra el archivo almacenado."
                  : "Images upload to Supabase when selected or confirmed from the camera. They do not appear on your public page until you save settings. Removing a photo here does not delete the stored file."}
              </p>
            </div>
          </Section>

          {/* ==================================
              DISEÑO Y COLORES
          ================================== */}

          <Section
            title={
              es ? "Diseño y colores" : "Design and colors"
            }
            description={
              es
                ? "Elige los colores y el estilo visual de tu negocio."
                : "Choose the colors and visual style of your business."
            }
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <ColorField
                label={
                  es ? "Color principal" : "Primary color"
                }
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
                label={es ? "Fondo" : "Background"}
                value={theme.backgroundColor!}
                onChange={(v) =>
                  updateTheme("backgroundColor", v)
                }
              />

              <ColorField
                label={es ? "Texto" : "Text"}
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
                  es
                    ? "Tarjetas redondeadas"
                    : "Rounded cards"
                }
                checked={theme.roundedCards !== false}
                onChange={(v) =>
                  updateTheme("roundedCards", v)
                }
              />

              <SwitchField
                label={
                  es
                    ? "Botones redondeados"
                    : "Rounded buttons"
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
                onChange={(v) => update("whatsapp", v)}
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
              HORARIOS DE ATENCIÓN
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

          {/* GUARDAR */}

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
                {es
                  ? "Vista en edición"
                  : "Editing preview"}
              </span>
            </div>

            <div
              className="overflow-hidden border border-[#eaded3] shadow-sm"
              style={{
                ...previewStyle,
                borderRadius:
                  theme.roundedCards === false ? 6 : 24,
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
                      {previewTagline ||
                        (es
                          ? "Tu eslogan"
                          : "Your tagline")}
                    </p>

                    <h3 className="mt-1 break-words text-xl font-black">
                      {name ||
                        (es
                          ? "Mi negocio"
                          : "My business")}
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
                        theme.roundedButtons === false
                          ? 4
                          : 999,
                    }}
                  >
                    {es ? "Ver menú" : "View menu"}
                  </span>

                  <span
                    className="px-3 py-2 text-xs font-bold"
                    style={{
                      backgroundColor:
                        theme.secondaryColor,
                      color: theme.textColor,
                      borderRadius:
                        theme.roundedButtons === false
                          ? 4
                          : 999,
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

      {/* ==================================
          VENTANA DE CÁMARA WEB
          Se monta solo después del clic.
      ================================== */}

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
