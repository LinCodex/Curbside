export type ThemePreference = "system" | "light" | "dark";
export type LanguagePreference = "system" | "en" | "zh";
export type DetailMode = "normal" | "geek";
export const PREFERENCE_KEY = "curbside.preferences.v1";
export function readPreferences(raw: string | null) {
  try {
    const value = JSON.parse(raw || "{}");
    return {
      theme: (["system", "light", "dark"].includes(value?.theme)
        ? value.theme
        : "system") as ThemePreference,
      language: (["system", "en", "zh"].includes(value?.language)
        ? value.language
        : "system") as LanguagePreference,
      detailMode: (value?.detailMode === "geek"
        ? "geek"
        : "normal") as DetailMode,
    };
  } catch {
    return {
      theme: "system" as const,
      language: "system" as const,
      detailMode: "normal" as const,
    };
  }
}
export function resolveLanguage(
  preference: LanguagePreference,
  languages: readonly string[],
) {
  return preference === "system"
    ? /^zh(?:-|$)/i.test(languages[0] || "en")
      ? "zh"
      : "en"
    : preference;
}
export function resolveTheme(preference: ThemePreference, dark: boolean) {
  return preference === "system" ? (dark ? "dark" : "light") : preference;
}
