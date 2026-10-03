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
  readCookieConsent,
} from "@/lib/cookie-consent";
export default function PrivateAnalytics() {
  const { analyticsEnabled } = useCookieConsent();
  if (!analyticsEnabled) return null;
  return (
    <>
      <Analytics
        beforeSend={(event) =>
          analyticsConsentAllowed(
            readCookieConsent(document.cookie),
            navigator as Navigator & { globalPrivacyControl?: boolean },
          )
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
          analyticsConsentAllowed(
            readCookieConsent(document.cookie),
            navigator as Navigator & { globalPrivacyControl?: boolean },
          )
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
