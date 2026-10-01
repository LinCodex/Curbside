"use client";
import { Analytics } from "@vercel/analytics/next";
import { privateAnalyticsEvent } from "@/lib/analytics-privacy";
export default function PrivateAnalytics() {
  return (
    <Analytics
      beforeSend={(event) =>
        privateAnalyticsEvent(
          event,
          navigator as Navigator & { globalPrivacyControl?: boolean },
        )
      }
    />
  );
}
