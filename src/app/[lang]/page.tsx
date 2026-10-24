import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary, hasLocale } from "@/dictionaries";

export default async function Home({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = await getDictionary(lang);
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 p-6">
      <h1 className="text-4xl font-bold">¿Todavía hay?</h1>
      <p className="text-lg">{t.tagline}</p>
      <Link className="underline" href={`/${lang}/birria-dona-lupe`}>
        {t.demoLink}
      </Link>
      <Link className="text-sm opacity-70" href={lang === "es" ? "/en" : "/es"}>
        {t.switchLang}
      </Link>
    </main>
  );
}
