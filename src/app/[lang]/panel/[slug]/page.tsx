import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { OwnerPanel } from "@/components/OwnerPanel";
import { getDictionary, hasLocale } from "@/dictionaries";
import { ownerView } from "@/lib/stall";
import { store } from "@/lib/store";

export default function PanelPage({ params }: PageProps<"/[lang]/panel/[slug]">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <Suspense fallback={<p className="p-4 text-muted">…</p>}>
        <Panel params={params} />
      </Suspense>
    </main>
  );
}

async function Panel({ params }: { params: PageProps<"/[lang]/panel/[slug]">["params"] }) {
  const { lang, slug } = await params;
  if (!hasLocale(lang)) notFound();
  await connection();
  const state = await store.get(slug);
  if (!state) notFound();
  const t = await getDictionary(lang);
  return <OwnerPanel initial={ownerView(state)} lang={lang} timezone={state.timezone} t={t} />;
}
