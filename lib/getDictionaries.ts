import "server-only";

export const dictionaries = {
  en: () => import("@/dictionaries/en.json").then((module) => module.default),
  de: () => import("@/dictionaries/de.json").then((module) => module.default),
};

export type Dictionaries = keyof typeof dictionaries;
export const getDictionary = async (locale: Dictionaries) =>
  dictionaries[locale]();
