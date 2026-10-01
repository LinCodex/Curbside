"use client";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  CarFront,
  MapPin,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { PreferenceChoice, usePreferences } from "./preferences";
import {
  readPreferences,
  type ThemePreference,
  type LanguagePreference,
  type DetailMode,
} from "@/lib/preferences";

export default function WelcomeOnboarding({
  finish,
  canSignUp,
}: {
  finish: (signup: boolean) => void;
  canSignUp: boolean;
}) {
  const { tr, savedPreferences, savePreferences, previewPreferences } =
    usePreferences();
  const [step, setStep] = useState(0);
  const [draft, setDraft] =
    useState<ReturnType<typeof readPreferences>>(savedPreferences);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (step === 2) previewPreferences(draft);
  }, [draft, step, previewPreferences]);
  useEffect(() => () => previewPreferences(null), [previewPreferences]);
  const complete = async (signup: boolean) => {
    setSaving(true);
    setError("");
    try {
      await savePreferences(draft);
      finish(signup);
    } catch {
      setError(tr("Settings could not be saved. Please try again."));
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className="welcome-onboarding">
      <div className="onboarding-progress" aria-label={tr("Welcome progress")}>
        {[0, 1, 2].map((index) => (
          <span key={index} className={index === step ? "active" : ""} />
        ))}
        <span className="sr-only">{step + 1} / 3</span>
      </div>
      <div className="onboarding-slide" key={step} aria-live="polite">
        {step === 0 ? (
          <>
            <div className="onboarding-symbol">
              <CarFront size={42} strokeWidth={1.35} />
            </div>
            <span className="eyebrow">{tr("Your NYC driving companion")}</span>
            <h2>{tr("Your plates. One clear picture.")}</h2>
            <p>
              {tr(
                "Find NYC parking and camera tickets, understand the balance, and see where they happened.",
              )}
            </p>
            <div className="onboarding-note">
              <ShieldCheck size={17} />
              {tr("Free to explore.")}
            </div>
          </>
        ) : step === 1 ? (
          <>
            <h2>{tr("A garage that remembers.")}</h2>
            <p>
              {tr(
                "A free account keeps your vehicles and history ready for your next visit.",
              )}
            </p>
            <div className="onboarding-features">
              <div>
                <CarFront />
                <span>
                  <strong>{tr("Your own garage")}</strong>
                  <small>
                    {tr(
                      "Save multiple cars with private nicknames and vehicle details.",
                    )}
                  </small>
                </span>
              </div>
              <div>
                <RefreshCw />
                <span>
                  <strong>{tr("Your saved ticket history")}</strong>
                  <small>
                    {tr(
                      "Saved ticket histories refresh every morning from city data.",
                    )}
                  </small>
                </span>
              </div>
              <div>
                <MapPin />
                <span>
                  <strong>{tr("See the bigger picture")}</strong>
                  <small>
                    {tr(
                      "Review balances and mapped locations with clear source timestamps.",
                    )}
                  </small>
                </span>
              </div>
            </div>
            <p className="small muted">
              {tr(
                "City records can appear after a delay. Check the source timestamps when reviewing your history.",
              )}
            </p>
          </>
        ) : (
          <>
            <h2>{tr("Make it feel like yours.")}</h2>
            <p>
              {tr(
                "Choose your starting settings. You can change them later in Account.",
              )}
            </p>
            <PreferenceChoice
              label={tr("Appearance")}
              value={draft.theme}
              onChange={(value) =>
                setDraft((previous) => ({
                  ...previous,
                  theme: value as ThemePreference,
                }))
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
              onChange={(value) =>
                setDraft((previous) => ({
                  ...previous,
                  language: value as LanguagePreference,
                }))
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
              onChange={(value) =>
                setDraft((previous) => ({
                  ...previous,
                  detailMode: value as DetailMode,
                }))
              }
              options={[
                ["normal", tr("Normal")],
                ["geek", tr("Geek")],
              ]}
            />
            <p className="small muted">
              {tr(
                "Normal shows the essentials. Geek includes every available source field.",
              )}
            </p>
          </>
        )}
      </div>
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      <div className="onboarding-actions">
        {step < 2 ? (
          <button className="primary-action" onClick={() => setStep(step + 1)}>
            {tr("Continue")}
            <ArrowRight size={18} />
          </button>
        ) : (
          canSignUp && (
            <button
              className="primary-action"
              disabled={saving}
              onClick={() => void complete(true)}
            >
              {tr("Create my free account")}
              <ArrowRight size={18} />
            </button>
          )
        )}
        <div className="row spread">
          {step > 0 ? (
            <button
              className="text-link"
              disabled={saving}
              onClick={() => setStep(step - 1)}
            >
              {tr("Back")}
            </button>
          ) : (
            <span />
          )}
          <button
            className="text-link"
            disabled={saving}
            onClick={() => void complete(false)}
          >
            {tr("Continue as guest")}
          </button>
        </div>
      </div>
      <p className="onboarding-cookie small muted">
        {tr("An essential cookie remembers this welcome on this browser.")}
      </p>
    </section>
  );
}
