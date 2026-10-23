import "server-only";

const dictionaries = {
  es: () => import("./es.json").then((m) => m.default),
  en: () => import("./en.json").then((m) => m.default),
};

export type Locale = keyof typeof dictionaries;
export const locales = Object.keys(dictionaries) as Locale[];
export const defaultLocale: Locale = "es";

export const hasLocale = (locale: string): locale is Locale => locale in dictionaries;
export const getDictionary = async (locale: Locale) => dictionaries[locale]();

export const fill = (text: string, vars: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
