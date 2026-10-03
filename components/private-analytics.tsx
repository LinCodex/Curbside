"use client";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import {
  privateAnalyticsEvent,
  privateSpeedEvent,
} from "@/lib/analytics-privacy";
import { useCookieConsent } from "./cookie-consent";
import {
  analyticsConsentAllowed,
  cookieSettingsPlatform,
  readCookieConsent,
} from "@/lib/cookie-consent";
function browserAllowsAnalytics() {
  return analyticsConsentAllowed(readCookieConsent(document.cookie), {
    doNotTrack: navigator.doNotTrack,
    globalPrivacyControl: !!(navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl,
    essentialOnly: cookieSettingsPlatform({
      smallViewport: window.matchMedia("(max-width: 800px)").matches,
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      maxTouchPoints: navigator.maxTouchPoints,
    }) !== "desktop",
  });
}
export default function PrivateAnalytics() {
  const { analyticsEnabled } = useCookieConsent();
  if (!analyticsEnabled) return null;
  return (
    <>
      <Analytics
        beforeSend={(event) =>
          browserAllowsAnalytics()
            ? privateAnalyticsEvent(
                event,
                navigator as Navigator & { globalPrivacyControl?: boolean },
              )
            : null
        }
      />
      <SpeedInsights
        debug={false}
        sampleRate={0.1}
        beforeSend={(event) =>
          browserAllowsAnalytics()
            ? privateSpeedEvent(
                event,
                navigator as Navigator & { globalPrivacyControl?: boolean },
              )
            : null
        }
      />
    </>
  );
}
