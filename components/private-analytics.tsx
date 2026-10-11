"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import {
  privateAnalyticsEvent,
  privateSpeedEvent,
  publicAnalyticsURL,
  spaAnalyticsTarget,
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
  const pathname = usePathname();
  const seenPath = useRef(pathname);
  const lastUrl = useRef<string | null>(null);
  const [speedReady, setSpeedReady] = useState(false);
  useEffect(() => {
    if (seenPath.current === pathname) return;
    seenPath.current = pathname;
    lastUrl.current = null;
  }, [pathname]);
  useEffect(() => {
    if (!analyticsEnabled) return;
    const markSpeed = () => {
      if (publicAnalyticsURL(location.href)) setSpeedReady(true);
    };
    lastUrl.current = publicAnalyticsURL(location.href);
    markSpeed();
    const original = history.replaceState.bind(history);
    history.replaceState = ((...args: Parameters<History["replaceState"]>) => {
      original(...args);
      markSpeed();
      // A pathname change is already reported by <Analytics>. Home views only
      // rewrite the query string, so those need a pageview from here.
      if (location.pathname !== seenPath.current) {
        seenPath.current = location.pathname;
        lastUrl.current = publicAnalyticsURL(location.href);
        return;
      }
      if (location.pathname !== "/") {
        lastUrl.current = null;
        return;
      }
      const target = spaAnalyticsTarget(location.href, lastUrl.current);
      if (!target) {
        if (!publicAnalyticsURL(location.href)) lastUrl.current = null;
        return;
      }
      lastUrl.current = target;
      window.va?.("pageview", { route: "/", path: "/" });
    }) as History["replaceState"];
    return () => {
      history.replaceState = original;
    };
  }, [analyticsEnabled]);
  if (!analyticsEnabled) return null;
  const privacy = () =>
    navigator as Navigator & { globalPrivacyControl?: boolean };
  return (
    <>
      <Analytics
        beforeSend={(event) =>
          browserAllowsAnalytics()
            ? privateAnalyticsEvent(event, privacy())
            : null
        }
      />
      {speedReady && (
        <SpeedInsights
          debug={false}
          sampleRate={0.1}
          beforeSend={(event) =>
            browserAllowsAnalytics()
              ? privateSpeedEvent(event, privacy())
              : null
          }
        />
      )}
    </>
  );
}
