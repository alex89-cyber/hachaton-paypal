import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary, hasLocale } from "@/dictionaries";

export default async function Home({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = await getDictionary(lang);
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-10">
      <div>
        <h1 className="text-5xl font-bold tracking-tight text-brand">¿Todavía hay?</h1>
        <p className="mt-3 text-lg">{t.tagline}</p>
      </div>
      <div className="flex flex-col gap-3">
        <Link className="rounded-2xl bg-brand px-5 py-4 text-center font-bold text-white" href={`/${lang}/birria-dona-lupe`}>
          {t.demoLink}
        </Link>
        <Link
          className="rounded-2xl border border-line bg-surface px-5 py-4 text-center font-semibold"
          href={`/${lang}/panel/birria-dona-lupe`}
        >
          {t.ownerLink}
        </Link>
      </div>
      <Link className="text-center text-sm text-muted underline" href={lang === "es" ? "/en" : "/es"}>
        {t.switchLang}
      </Link>
    </main>
  );
}
