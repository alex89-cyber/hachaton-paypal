import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { PublicStall } from "@/components/PublicStall";
import { getDictionary, hasLocale } from "@/dictionaries";
import { publicSnapshot } from "@/lib/stall";
import { store } from "@/lib/store";

export default function StallPage({ params }: PageProps<"/[lang]/[slug]">) {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-6">
      <Suspense fallback={<p className="text-muted">…</p>}>
        <Stall params={params} />
      </Suspense>
    </main>
  );
}

async function Stall({ params }: { params: PageProps<"/[lang]/[slug]">["params"] }) {
  const { lang, slug } = await params;
  if (!hasLocale(lang)) notFound();
  await connection();
  const state = await store.get(slug);
  if (!state) notFound();
  const t = await getDictionary(lang);
  return (
    <>
      <nav className="mb-4 flex justify-end text-sm">
        <Link className="text-muted underline" href={`/${lang === "es" ? "en" : "es"}/${slug}`}>
          {t.switchLang}
        </Link>
      </nav>
      <PublicStall initial={publicSnapshot(state)} lang={lang} t={t} />
    </>
  );
}
