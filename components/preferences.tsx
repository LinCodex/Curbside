"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { DropdownMenu } from "radix-ui";
import {
  Check,
  Languages,
  Monitor,
  Moon,
  Sun,
  SlidersHorizontal,
} from "lucide-react";
import dictionary from "@/lib/zh.json";
import {
  PREFERENCE_KEY,
  readPreferences,
  resolveLanguage,
  resolveTheme,
  type ThemePreference,
  type LanguagePreference,
} from "@/lib/preferences";

const chinese: Record<string, string> = dictionary;
export function translate(text: string, language: "en" | "zh") {
  if (language === "en") return text;
  if (chinese[text]) return chinese[text];
  const trimmed = text.trim();
  return chinese[trimmed] ? text.replace(trimmed, chinese[trimmed]) : text;
}
const Context = createContext({
  theme: "system" as ThemePreference,
  language: "system" as LanguagePreference,
  resolvedTheme: "dark" as "light" | "dark",
  locale: "en" as "en" | "zh",
  setTheme: (_: ThemePreference) => {},
  setLanguage: (_: LanguagePreference) => {},
  tr: (text: string) => text,
});
export const usePreferences = () => useContext(Context);

export function PreferencesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [preferences, setPreferences] = useState(readPreferences(null));
  const [deviceDark, setDeviceDark] = useState(true);
  const [languages, setLanguages] = useState<readonly string[]>(["en"]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const updateTheme = () => setDeviceDark(media.matches);
    const updateLanguage = () =>
      setLanguages(
        navigator.languages?.length
          ? navigator.languages
          : [navigator.language],
      );
    const updateStorage = (event: StorageEvent) => {
      if (event.key === PREFERENCE_KEY || event.key === null)
        setPreferences(readPreferences(event.newValue));
    };
    try {
      setPreferences(readPreferences(localStorage.getItem(PREFERENCE_KEY)));
    } catch {}
    updateTheme();
    updateLanguage();
    setLoaded(true);
    media.addEventListener("change", updateTheme);
    window.addEventListener("languagechange", updateLanguage);
    window.addEventListener("storage", updateStorage);
    return () => {
      media.removeEventListener("change", updateTheme);
      window.removeEventListener("languagechange", updateLanguage);
      window.removeEventListener("storage", updateStorage);
    };
  }, []);
  const resolvedTheme = resolveTheme(preferences.theme, deviceDark);
  const locale = resolveLanguage(preferences.language, languages);
  useEffect(() => {
    if (!loaded) return;
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.lang = locale === "zh" ? "zh-Hans" : "en";
    document.documentElement.style.colorScheme = resolvedTheme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute(
        "content",
        resolvedTheme === "dark" ? "#050607" : "#f3f5f7",
      );
    try {
      localStorage.setItem(PREFERENCE_KEY, JSON.stringify(preferences));
    } catch {}
  }, [preferences, resolvedTheme, locale, loaded]);
  const tr = useCallback((text: string) => translate(text, locale), [locale]);
  const value = useMemo(
    () => ({
      ...preferences,
      resolvedTheme,
      locale,
      tr,
      setTheme: (theme: ThemePreference) =>
        setPreferences((p) => ({ ...p, theme })),
      setLanguage: (language: LanguagePreference) =>
        setPreferences((p) => ({ ...p, language })),
    }),
    [preferences, resolvedTheme, locale, tr],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function PreferencesMenu() {
  const { theme, language, setTheme, setLanguage, locale, resolvedTheme } =
    usePreferences();
  const zh = locale === "zh";
  const Icon = resolvedTheme === "dark" ? Moon : Sun;
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className="round-control preferences-trigger"
        aria-label={zh ? "外观与语言" : "Appearance and language"}
      >
        <SlidersHorizontal size={18} />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="preferences-menu"
          align="end"
          sideOffset={10}
          collisionPadding={12}
        >
          <DropdownMenu.Label className="preferences-label">
            <Icon size={14} />
            {zh ? "外观" : "Appearance"}
          </DropdownMenu.Label>
          <DropdownMenu.RadioGroup
            value={theme}
            onValueChange={(v) => setTheme(v as ThemePreference)}
          >
            {[
              ["system", zh ? "跟随系统" : "System", Monitor],
              ["light", zh ? "浅色" : "Light", Sun],
              ["dark", zh ? "深色" : "Dark", Moon],
            ].map(([value, label, Glyph]) => {
              const G = Glyph as typeof Sun;
              return (
                <DropdownMenu.RadioItem
                  className="preferences-item"
                  key={value as string}
                  value={value as string}
                  onSelect={(e) => e.preventDefault()}
                >
                  <G size={16} />
                  <span>{label as string}</span>
                  <DropdownMenu.ItemIndicator>
                    <Check size={15} />
                  </DropdownMenu.ItemIndicator>
                </DropdownMenu.RadioItem>
              );
            })}
          </DropdownMenu.RadioGroup>
          <DropdownMenu.Separator className="preferences-divider" />
          <DropdownMenu.Label className="preferences-label">
            <Languages size={14} />
            {zh ? "语言" : "Language"}
          </DropdownMenu.Label>
          <DropdownMenu.RadioGroup
            value={language}
            onValueChange={(v) => setLanguage(v as LanguagePreference)}
          >
            {[
              ["system", zh ? "跟随系统" : "System"],
              ["en", "English"],
              ["zh", "中文（简体）"],
            ].map(([value, label]) => (
              <DropdownMenu.RadioItem
                className="preferences-item"
                key={value}
                value={value}
                onSelect={(e) => e.preventDefault()}
              >
                <span>{label}</span>
                <DropdownMenu.ItemIndicator>
                  <Check size={15} />
                </DropdownMenu.ItemIndicator>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
