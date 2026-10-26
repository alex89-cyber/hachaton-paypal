import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { type Confirmation, PublicStall } from "@/components/PublicStall";
import { getDictionary, hasLocale } from "@/dictionaries";
import { publicSnapshot } from "@/lib/stall";
import { loadStall } from "@/lib/reservations";
import { store } from "@/lib/store";

export default function StallPage({ params, searchParams }: PageProps<"/[lang]/[slug]">) {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-6">
      <Suspense fallback={<p className="text-muted">…</p>}>
        <Stall params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Stall({
  params,
  searchParams,
}: {
  params: PageProps<"/[lang]/[slug]">["params"];
  searchParams: PageProps<"/[lang]/[slug]">["searchParams"];
}) {
  const { lang, slug } = await params;
  if (!hasLocale(lang)) notFound();
  await connection();
  const state = await loadStall(slug);
  if (!state) notFound();
  const t = await getDictionary(lang);
  const confirmation = await confirmationFor(slug, (await searchParams).apartado);
  return (
    <>
      <nav className="mb-4 flex justify-end text-sm">
        <Link className="text-muted underline" href={`/${lang === "es" ? "en" : "es"}/${slug}`}>
          {t.switchLang}
        </Link>
      </nav>
      <PublicStall
        initial={publicSnapshot(state)}
        lang={lang}
        timezone={state.timezone}
        confirmation={confirmation}
        t={t}
      />
    </>
  );
}

/** ?apartado=<id> after PayPal approval, or "cancelled" / "error". */
async function confirmationFor(slug: string, value: string | string[] | undefined): Promise<Confirmation | null> {
  if (typeof value !== "string" || !value) return null;
  if (value === "cancelled") return { kind: "cancelled" };
  if (value === "error") return { kind: "error" };
  const r = await store.getReservation(slug, value).catch(() => null);
  if (!r || r.status === "voided" || r.status === "expired") return { kind: "error" };
  return { kind: "reserved", name: r.customerName, pickupBy: r.pickupBy, totalCents: r.totalCents };
}
