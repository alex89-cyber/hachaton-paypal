import { Suspense } from "react";
import { notFound } from "next/navigation";
import { fill, getDictionary, hasLocale } from "@/dictionaries";
import { demoDishes, demoIngredients } from "@/lib/demo-data";
import { menuAvailability } from "@/lib/inventory";

// RN-07 public page. Reads the demo stall for now; the Supabase read and the
// realtime subscription replace demo-data in week 2.
export default function StallPage({ params }: PageProps<"/[lang]/[slug]">) {
  return (
    <main className="mx-auto w-full max-w-md flex-1 p-6">
      <Suspense fallback={<p className="opacity-60">…</p>}>
        <Stall params={params} />
      </Suspense>
    </main>
  );
}

async function Stall({ params }: { params: PageProps<"/[lang]/[slug]">["params"] }) {
  const { lang, slug } = await params;
  if (!hasLocale(lang) || slug !== "birria-dona-lupe") notFound();
  const t = await getDictionary(lang);
  const left = new Map(menuAvailability(demoDishes, demoIngredients).map((a) => [a.dishId, a.portions]));

  return (
    <>
      <h1 className="text-3xl font-bold">Birria Doña Lupe</h1>
      <p className="mt-1 font-semibold text-green-700">{t.open}</p>
      <ul className="mt-6 divide-y">
        {demoDishes.map((d) => {
          const n = left.get(d.id) ?? 0;
          return (
            <li key={d.id} className="flex justify-between py-3">
              <span>{lang === "es" ? d.nameEs : d.nameEn}</span>
              <span className={n > 0 ? "" : "text-red-700"}>{n > 0 ? fill(t.left, { n }) : t.soldOut}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-6 text-sm opacity-60">{fill(t.updated, { n: 0 })}</p>
    </>
  );
}
