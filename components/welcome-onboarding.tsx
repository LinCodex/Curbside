"use client";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  CarFront,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Share,
  PlusSquare,
} from "lucide-react";
import Link from "next/link";
import { useCookieConsent } from "./cookie-consent";
import { PreferenceChoice, usePreferences } from "./preferences";
import styles from "./welcome-onboarding.module.css";
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
  const { consent, platform, installed, privacySignal, saveChoice } = useCookieConsent();
  const [allowAnalytics, setAllowAnalytics] = useState(consent?.analytics === true);
  useEffect(() => {
    if (step === 4) previewPreferences(draft);
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
    <section className={`welcome-onboarding ${styles.welcome}`}>
      <div className="onboarding-progress" aria-label={tr("Welcome progress")}>
        {[0, 1, 2, 3, 4].map((index) => (
          <span key={index} className={index === step ? "active" : ""} />
        ))}
        <span className="sr-only">{step + 1} / 5</span>
      </div>
      <div
        className={`onboarding-slide ${styles.slide}`}
        key={step}
        aria-live="polite"
      >
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
        ) : step === 2 ? (
          <>
            <div className="onboarding-symbol"><ShieldCheck size={42} strokeWidth={1.35} /></div>
            <h2>{tr("Your privacy, from the start.")}</h2>
            {platform !== "desktop" ? (
              <p>{tr("On mobile, TicketSafe uses essential storage only. Optional analytics are off, so there is nothing to accept.")}</p>
            ) : (
              <>
                <p>{tr("Essential storage keeps sign-in, security and your settings working. Optional analytics help us improve public pages.")}</p>
                <label className={styles.privacyChoice}>
                  <span>
                    <strong>{tr("Optional analytics")}</strong>
                    <small>{tr("Vercel Analytics and Speed Insights measure public visits and page performance. No advertising cookies or private vehicle details.")}</small>
                  </span>
                  <input type="checkbox" checked={allowAnalytics && !privacySignal} disabled={privacySignal} onChange={event => setAllowAnalytics(event.target.checked)} />
                </label>
                <p className="small muted">{tr("Leave this off to use essential storage only. You can change it later in Cookie settings.")}</p>
                {privacySignal && <p className="small muted">{tr("Your browser privacy signal keeps analytics off.")}</p>}
              </>
            )}
            <Link href="/legal/privacy" target="_blank" rel="noopener noreferrer" className="text-link">{tr("Privacy policy")}</Link>
          </>
        ) : step === 3 ? (
          <>
            <div className="onboarding-symbol"><Smartphone size={42} strokeWidth={1.35} /></div>
            <h2>{tr("Your garage, one tap away")}</h2>
            {installed ? (
              <p>{tr("TicketSafe is already opening as a web app on this device.")}</p>
            ) : (
              <>
                <p>{tr("Open your garage like an app, with more room for what matters. No App Store download.")}</p>
                {platform === "ios" ? (
                  <ol className={styles.installSteps}>
                    <li><Share size={20} /><span><strong>{tr("Open this website in Safari")}</strong><small>{tr("Tap the Share button. It may be inside Safari’s More menu.")}</small></span></li>
                    <li><PlusSquare size={20} /><span><strong>{tr("Choose Add to Home Screen")}</strong><small>{tr("Scroll through the actions. If missing, choose Edit Actions to add it.")}</small></span></li>
                    <li><Smartphone size={20} /><span><strong>{tr("Keep Open as Web App on")}</strong><small>{tr("If that option appears, leave it enabled, then tap Add.")}</small></span></li>
                  </ol>
                ) : (
                  <p>{tr("On Android, choose Install app or Add to Home screen from your browser menu. On iPhone or iPad, open this site in Safari and choose Share → Add to Home Screen.")}</p>
                )}
                <p className="small muted">{tr("Inside the app, pull down from the top to refresh. An internet connection is needed for current ticket records.")}</p>
              </>
            )}
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
        {step < 4 ? (
          <button className="primary-action" onClick={() => {
            if (step === 2 && platform === "desktop") saveChoice(allowAnalytics);
            setStep(step + 1);
          }}>
            {tr(step === 2 && platform === "desktop" ? "Continue with these choices" : "Continue")}
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
        {tr("An essential cookie remembers this welcome on this browser.")}{" "}
        {tr("Skipping keeps optional analytics off unless you already allowed them.")}
      </p>
    </section>
  );
}
