import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { CashUpStudio } from "@/components/studio/CashUpStudio";
import { RefreshButton } from "@/components/studio/RefreshButton";
import { getDictionary, hasLocale } from "@/dictionaries";
import { cashUpTables } from "@/lib/analytics";
import { loadStall } from "@/lib/reservations";

// The day's cash-up as an AG Studio dashboard. Wide screen first (a tablet or
// laptop at closing time); on a phone the board scrolls sideways.
export default function CashUpPage({ params }: PageProps<"/[lang]/panel/[slug]/corte">) {
  return (
    <main className="flex h-dvh w-full flex-col">
      <Suspense fallback={<p className="p-4 text-muted">…</p>}>
        <Report params={params} />
      </Suspense>
    </main>
  );
}

async function Report({ params }: { params: PageProps<"/[lang]/panel/[slug]/corte">["params"] }) {
  const { lang, slug } = await params;
  if (!hasLocale(lang)) notFound();
  await connection();
  const state = await loadStall(slug);
  if (!state) notFound();
  const t = await getDictionary(lang);
  const day = state.openedAt ?? new Date().toISOString();
  const dateLabel = new Intl.DateTimeFormat(lang === "es" ? "es-MX" : "en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: state.timezone,
  }).format(new Date(day));
  return (
    <>
      <header className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line bg-surface px-4 py-2">
        <Link href={`/${lang}/panel/${slug}`} className="text-sm font-semibold text-brand">
          {t.studio.back}
        </Link>
        <h1 className="text-lg font-bold">
          {t.studio.title} · {state.name}
        </h1>
        <span className="text-sm text-muted first-letter:uppercase">{dateLabel}</span>
        <span className="flex-1" />
        <p className="hidden max-w-md text-xs text-muted lg:block">{t.studio.hint}</p>
        <RefreshButton label={t.studio.refresh} />
      </header>
      <div className="min-h-0 flex-1 overflow-x-auto">
        <CashUpStudio tables={cashUpTables(state, lang)} lang={lang} stallName={state.name} dateLabel={dateLabel} />
      </div>
    </>
  );
}
