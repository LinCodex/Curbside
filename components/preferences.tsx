"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useLayoutEffect,
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
import { useAccount } from "./account-provider";
import {
  PREFERENCE_KEY,
  preferenceKey,
  readPreferences,
  resolveLanguage,
  resolveTheme,
  type ThemePreference,
  type LanguagePreference,
  type DetailMode,
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
  detailMode: "normal" as DetailMode,
  resolvedTheme: "dark" as "light" | "dark",
  locale: "en" as "en" | "zh",
  setTheme: (_: ThemePreference) => {
    void _;
  },
  setLanguage: (_: LanguagePreference) => {
    void _;
  },
  setDetailMode: (_: DetailMode) => {
    void _;
  },
  profileId: null as string | null,
  profileLoading: false,
  savedPreferences: readPreferences(null),
  savePreferences: async (_: ReturnType<typeof readPreferences>) => {
    void _;
  },
  previewPreferences: (_: ReturnType<typeof readPreferences> | null) => {
    void _;
  },
  tr: (text: string) => text,
});
export const usePreferences = () => useContext(Context);

export function PreferencesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [preferences, setPreferences] = useState(readPreferences(null));
  const [preview, setPreview] = useState<ReturnType<
    typeof readPreferences
  > | null>(null);
  const [deviceDark, setDeviceDark] = useState(true);
  const [languages, setLanguages] = useState<readonly string[]>(["en"]);
  const [loaded, setLoaded] = useState(false);
  const auth = useAccount();
  const profileId = auth.user?.id || null;
  const activeProfile = useRef(profileId);
  const activeKey = useRef(PREFERENCE_KEY);
  useLayoutEffect(() => {
    activeProfile.current = profileId;
    activeKey.current = preferenceKey(profileId);
  }, [profileId]);
  const [profileLoading, setProfileLoading] = useState(false);
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
      if (event.key === activeKey.current || event.key === null)
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
  const displayed = preview || preferences;
  const previewPreferences = useCallback(
    (next: ReturnType<typeof readPreferences> | null) => {
      setPreview(next);
    },
    [],
  );
  const resolvedTheme = resolveTheme(displayed.theme, deviceDark);
  const locale = resolveLanguage(displayed.language, languages);
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
  }, [resolvedTheme, locale, loaded]);
  useEffect(() => {
    let alive = true;
    const key = preferenceKey(profileId);
    setPreview(null);
    try {
      setPreferences(readPreferences(localStorage.getItem(key)));
    } catch {
      setPreferences(readPreferences(null));
    }
    if (!profileId || !auth.client) {
      setProfileLoading(false);
      return;
    }
    setProfileLoading(true);
    auth.client
      .from("curbside_preferences")
      .select("theme,language,detail_mode")
      .eq("user_id", profileId)
      .maybeSingle()
      .then(async ({ data, error }) => {
        if (!alive) return;
        if (!error && data) {
          const next = readPreferences(
            JSON.stringify({ ...data, detailMode: data.detail_mode }),
          );
          setPreferences(next);
          try {
            localStorage.setItem(key, JSON.stringify(next));
          } catch {}
        } else if (
          !error &&
          !data &&
          auth.user?.user_metadata?.curbside_preferences
        ) {
          // Only display preferences, never authorization, come from signup metadata.
          const next = readPreferences(
            JSON.stringify(auth.user.user_metadata.curbside_preferences),
          );
          const saved = await auth.client!.from("curbside_preferences").insert({
            user_id: profileId,
            theme: next.theme,
            language: next.language,
            detail_mode: next.detailMode,
          });
          if (!alive) return;
          if (!saved.error) {
            setPreferences(next);
            try {
              localStorage.setItem(key, JSON.stringify(next));
            } catch {}
          }
        }
        setProfileLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [profileId, auth.client]);
  const savePreferences = useCallback(
    async (next: ReturnType<typeof readPreferences>) => {
      const owner = profileId;
      const normalized = readPreferences(JSON.stringify(next));
      if (owner && auth.client) {
        const { data: identity, error: identityError } =
          await auth.client.auth.getUser();
        if (
          identityError ||
          identity.user?.id !== owner ||
          !identity.user.email_confirmed_at
        )
          throw new Error(
            "Your session changed. Sign in again before saving settings.",
          );
        const fields = {
          theme: normalized.theme,
          language: normalized.language,
          detail_mode: normalized.detailMode,
        };
        const update = () =>
          auth
            .client!.from("curbside_preferences")
            .update(fields)
            .eq("user_id", owner)
            .select("user_id");
        const result = await update();
        if (result.error)
          throw new Error("Settings could not be saved. Please try again.");
        if (!result.data?.length) {
          const inserted = await auth.client
            .from("curbside_preferences")
            .insert({ user_id: owner, ...fields });
          if (
            inserted.error &&
            !(inserted.error.code === "23505" && !(await update()).error)
          )
            throw new Error("Settings could not be saved. Please try again.");
        }
      }
      if (activeProfile.current !== owner)
        throw new Error(
          "Your session changed. Sign in again before saving settings.",
        );
      try {
        localStorage.setItem(preferenceKey(owner), JSON.stringify(normalized));
      } catch {}
      setPreferences(normalized);
      setPreview(null);
    },
    [profileId, auth.client],
  );
  const tr = useCallback((text: string) => translate(text, locale), [locale]);
  const value = useMemo(
    () => ({
      ...displayed,
      resolvedTheme,
      locale,
      tr,
      profileId,
      profileLoading,
      savedPreferences: preferences,
      setTheme: (theme: ThemePreference) =>
        void savePreferences({ ...preferences, theme }).catch(() => {}),
      setLanguage: (language: LanguagePreference) =>
        void savePreferences({ ...preferences, language }).catch(() => {}),
      setDetailMode: (detailMode: DetailMode) =>
        void savePreferences({ ...preferences, detailMode }).catch(() => {}),
      savePreferences,
      previewPreferences,
    }),
    [
      displayed,
      preferences,
      resolvedTheme,
      locale,
      tr,
      previewPreferences,
      savePreferences,
      profileId,
      profileLoading,
    ],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function PreferencesPanel({
  onSave,
  onCancel,
}: {
  onSave: () => void;
  onCancel: () => void;
}) {
  const {
    theme,
    language,
    detailMode,
    savePreferences,
    previewPreferences,
    profileId,
    profileLoading,
    savedPreferences,
    tr,
  } = usePreferences();
  const [draft, setDraft] = useState({ theme, language, detailMode });
  useEffect(() => {
    if (!profileLoading) setDraft(savedPreferences);
    // Reinitialize only when the bound account finishes loading, not while editing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId, profileLoading]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    previewPreferences(draft);
  }, [draft, previewPreferences]);
  useEffect(() => () => previewPreferences(null), [previewPreferences]);
  return (
    <section
      className="preference-panel preference-popup"
      aria-label={tr("Display settings")}
    >
      <p className="small muted">
        {tr(
          "Choose Apply to save your changes.",
        )}
      </p>
      <PreferenceChoice
        label={tr("Appearance")}
        value={draft.theme}
        onChange={(v) =>
          setDraft((p) => ({ ...p, theme: v as ThemePreference }))
        }
        options={[
          ["system", tr("System")],
          ["light", tr("Light")],
          ["dark", tr("Dark")],
        ]}
      />
      <PreferenceChoice
        label={tr("Language")}
        value={draft.language}
        onChange={(v) =>
          setDraft((p) => ({ ...p, language: v as LanguagePreference }))
        }
        options={[
          ["system", tr("System")],
          ["en", "English"],
          ["zh", "中文"],
        ]}
      />
      <PreferenceChoice
        label={tr("Detail level")}
        value={draft.detailMode}
        onChange={(v) =>
          setDraft((p) => ({ ...p, detailMode: v as DetailMode }))
        }
        options={[
          ["normal", tr("Normal")],
          ["geek", tr("Geek")],
        ]}
      />
      <p className="preference-explanation" aria-live="polite">
        {tr(
          draft.detailMode === "normal"
            ? "Balances, status, dates, and locations."
            : "All available city records and source details.",
        )}
      </p>
      <p className="preference-device-note">
        {tr(
          profileId
            ? "Synced to your account."
            : "Saved on this device.",
        )}
      </p>
      {error && (
        <p className="notice error" role="alert">
          {tr(error)}
        </p>
      )}
      <div className="preference-actions">
        <button
          className="button secondary"
          disabled={saving}
          onClick={onCancel}
        >
          {tr("Cancel")}
        </button>
        <button
          className="button primary"
          disabled={saving || profileLoading}
          onClick={async () => {
            setSaving(true);
            setError("");
            try {
              await savePreferences(draft);
              onSave();
            } catch (err) {
              setError(
                err instanceof Error
                  ? err.message
                  : "Settings could not be saved. Please try again.",
              );
            } finally {
              setSaving(false);
            }
          }}
        >
          <Check size={16} />
          {tr(saving ? "Saving…" : "Apply")}
        </button>
      </div>
    </section>
  );
}

export function PreferenceChoice({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[][];
}) {
  const onKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    const key = event.key;
    if (
      ![
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "Home",
        "End",
      ].includes(key)
    )
      return;
    event.preventDefault();
    const next =
      key === "Home"
        ? 0
        : key === "End"
          ? options.length - 1
          : (index +
              (["ArrowRight", "ArrowDown"].includes(key) ? 1 : -1) +
              options.length) %
            options.length;
    onChange(options[next][0]);
    (
      event.currentTarget.parentElement?.children[next] as HTMLButtonElement
    )?.focus();
  };
  return (
    <div className="preference-choice">
      <span>{label}</span>
      <div className="preference-segments" role="radiogroup" aria-label={label}>
        {options.map(([id, text], index) => (
          <button
            type="button"
            role="radio"
            aria-checked={value === id}
            tabIndex={value === id ? 0 : -1}
            key={id}
            onClick={() => onChange(id)}
            onKeyDown={(e) => onKeyDown(e, index)}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
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
