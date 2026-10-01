"use client";
import { Analytics } from "@vercel/analytics/next";
import { publicAnalyticsURL } from "@/lib/analytics-privacy";
export default function PrivateAnalytics() {
  return (
    <Analytics
      beforeSend={(event) => {
        if (
          navigator.doNotTrack === "1" ||
          (navigator as Navigator & { globalPrivacyControl?: boolean })
            .globalPrivacyControl
        )
          return null;
        if (event.type !== "pageview") return null;
        const url = publicAnalyticsURL(event.url);
        return url ? { ...event, url } : null;
      }}
    />
  );
}
