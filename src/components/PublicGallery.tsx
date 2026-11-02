
"use client";

import {
  useEffect,
  useState,
} from "react";

import type {
  GalleryPhoto,
} from "@/lib/gallery";

import {
  getGalleryText,
} from "@/lib/gallery";

type Props = {
  photos: GalleryPhoto[];
  lang?: "es" | "en";
};

export default function PublicGallery({
  photos,
  lang = "es",
}: Props) {
  const [activeIndex, setActiveIndex] =
    useState<number | null>(null);

  const es = lang === "es";

  const active =
    activeIndex === null
      ? null
      : photos[activeIndex] ?? null;

  function close() {
    setActiveIndex(null);
  }

  function previous() {
    setActiveIndex((current) => {
      if (current === null) return null;

      return (
        current - 1 + photos.length
      ) % photos.length;
    });
  }

  function next() {
    setActiveIndex((current) => {
      if (current === null) return null;

      return (
        current + 1
      ) % photos.length;
    });
  }

  useEffect(() => {
    if (activeIndex === null) return;

    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActiveIndex(null);
      }

      if (event.key === "ArrowLeft") {
        setActiveIndex((current) =>
          current === null
            ? null
            : (
                current - 1 + photos.length
              ) % photos.length,
        );
      }

      if (event.key === "ArrowRight") {
        setActiveIndex((current) =>
          current === null
            ? null
            : (
                current + 1
              ) % photos.length,
        );
      }
    }

    window.addEventListener(
      "keydown",
      keydown,
    );

    return () => {
      window.removeEventListener(
        "keydown",
        keydown,
      );
    };
  }, [activeIndex, photos.length]);

  if (!photos.length) return null;

  return (
    <>
      <section className="space-y-5">
        <h2 className="text-3xl font-black tracking-tight text-[#2e1b14]">
          {es
            ? "Nuestra galería"
            : "Our gallery"}
        </h2>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((photo, index) => {
            const text =
              getGalleryText(photo, lang);

            return (
              <button
                key={photo.id}
                type="button"
                onClick={() =>
                  setActiveIndex(index)
                }
                className="overflow-hidden rounded-[1.5rem] border border-[#eaded3] bg-white text-left shadow-sm transition hover:-translate-y-1 hover:shadow-md"
                aria-label={
                  text.title ||
                  (es
                    ? `Abrir fotografía ${index + 1}`
                    : `Open photo ${index + 1}`)
                }
              >
                <div className="aspect-square overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.url}
                    alt={
                      text.title ||
                      (es
                        ? `Fotografía ${index + 1}`
                        : `Photo ${index + 1}`)
                    }
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                </div>

                {(text.title || text.caption) && (
                  <div className="space-y-1 p-3">
                    {text.title && (
                      <h3 className="text-sm font-bold text-[#302018]">
                        {text.title}
                      </h3>
                    )}

                    {text.caption && (
                      <p className="text-xs leading-5 text-[#80695d]">
                        {text.caption}
                      </p>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* VISOR AMPLIADO */}

      {active && (
        <div
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              close();
            }
          }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 sm:p-8"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={
              es
                ? "Fotografía ampliada"
                : "Enlarged photo"
            }
            className="relative flex max-h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white"
          >
            <div className="flex items-center justify-between border-b border-[#eaded3] px-4 py-3">
              <span className="text-sm font-semibold text-[#302018]">
                {activeIndex !== null
                  ? `${activeIndex + 1} / ${photos.length}`
                  : ""}
              </span>

              <button
                type="button"
                onClick={close}
                className="rounded-lg px-3 py-2 text-lg font-bold text-[#302018] hover:bg-gray-100"
                aria-label={
                  es
                    ? "Cerrar fotografía"
                    : "Close photo"
                }
              >
                ✕
              </button>
            </div>

            <div className="relative flex min-h-0 flex-1 items-center justify-center bg-[#161616]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={active.url}
                alt={
                  getGalleryText(
                    active,
                    lang,
                  ).title ||
                  "Fotografía ampliada"
                }
                className="max-h-[65vh] max-w-full object-contain"
              />

              {photos.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={previous}
                    aria-label={
                      es
                        ? "Fotografía anterior"
                        : "Previous photo"
                    }
                    className="absolute left-2 rounded-full bg-white/90 px-3 py-2 text-2xl font-bold text-black shadow-md hover:bg-white sm:left-4"
                  >
                    ‹
                  </button>

                  <button
                    type="button"
                    onClick={next}
                    aria-label={
                      es
                        ? "Siguiente fotografía"
                        : "Next photo"
                    }
                    className="absolute right-2 rounded-full bg-white/90 px-3 py-2 text-2xl font-bold text-black shadow-md hover:bg-white sm:right-4"
                  >
                    ›
                  </button>
                </>
              )}
            </div>

            {(() => {
              const text =
                getGalleryText(
                  active,
                  lang,
                );

              return (
                (text.title || text.caption) && (
                  <div className="space-y-1 px-5 py-4">
                    {text.title && (
                      <h3 className="text-lg font-bold text-[#302018]">
                        {text.title}
                      </h3>
                    )}

                    {text.caption && (
                      <p className="text-sm leading-6 text-[#80695d]">
                        {text.caption}
                      </p>
                    )}
                  </div>
                )
              );
            })()}
          </div>
        </div>
      )}
    </>
  );
}
