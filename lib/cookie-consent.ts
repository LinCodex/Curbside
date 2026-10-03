export const CONSENT_COOKIE = "ticketsafe_consent";
// Change only when optional purposes/providers change, not for editorial policy updates.
export const CONSENT_VERSION = "2026-10-02.1";
export const CONSENT_LIFETIME = 180 * 24 * 60 * 60 * 1000;
export type CookieConsent = {
  version: string;
  analytics: boolean;
  decidedAt: number;
};
export function createCookieConsent(
  analytics: boolean,
  now = Date.now(),
): CookieConsent {
  return { version: CONSENT_VERSION, analytics, decidedAt: now };
}
export function readCookieConsent(
  cookies: string,
  now = Date.now(),
): CookieConsent | null {
  try {
    const matches = cookies
      .split(";")
      .map((item) => item.trim())
      .filter((item) => item.startsWith(CONSENT_COOKIE + "="));
    if (matches.length !== 1) return null;
    const value = JSON.parse(
      decodeURIComponent(matches[0].slice(CONSENT_COOKIE.length + 1)),
    );
    if (
      value.version !== CONSENT_VERSION ||
      typeof value.analytics !== "boolean" ||
      !Number.isSafeInteger(value.decidedAt) ||
      value.decidedAt > now ||
      now - value.decidedAt >= CONSENT_LIFETIME
    )
      return null;
    return {
      version: value.version,
      analytics: value.analytics,
      decidedAt: value.decidedAt,
    };
  } catch {
    return null;
  }
}
export function cookieConsentHeader(consent: CookieConsent, secure: boolean) {
  return `${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(consent))}; Path=/; Max-Age=${CONSENT_LIFETIME / 1000}; SameSite=Lax${secure ? "; Secure" : ""}`;
}
export function analyticsConsentAllowed(
  consent: CookieConsent | null,
  privacy: { doNotTrack?: string | null; globalPrivacyControl?: boolean; essentialOnly?: boolean },
) {
  return (
    consent?.analytics === true &&
    !privacy.essentialOnly &&
    privacy.doNotTrack !== "1" &&
    !privacy.globalPrivacyControl
  );
}

export function cookieSettingsPlatform(browser: {
  smallViewport: boolean;
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
}): "desktop" | "ios" | "mobile" {
  if (/iPhone|iPad|iPod/i.test(browser.userAgent) ||
      (browser.platform === "MacIntel" && browser.maxTouchPoints > 1)) return "ios";
  return browser.smallViewport || /Android|Mobile/i.test(browser.userAgent) ? "mobile" : "desktop";
}
