export function publicAnalyticsURL(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password)
      return null;
    if (
      url.hash ||
      url.searchParams.has("auth") ||
      url.searchParams.has("code") ||
      url.searchParams.has("__clerk_ticket") ||
      url.searchParams.has("__clerk_db_jwt") ||
      url.searchParams.has("access_token") ||
      url.searchParams.has("refresh_token")
    )
      return null;
    if (
      url.pathname !== "/" &&
      !/^\/legal(?:\/(terms|privacy|messaging|billing|accessibility|sources))?\/?$/.test(
        url.pathname,
      )
    )
      return null;
    const view = url.searchParams.get("view");
    // Garage, account, ticket details and future unreviewed views are private.
    if (url.pathname === "/" && view && !["search", "map"].includes(view))
      return null;
    url.search = "";
    if (
      url.pathname === "/" &&
      view &&
      ["search", "map"].includes(view)
    )
      url.searchParams.set("view", view);
    return url.toString();
  } catch {
    return null;
  }
}

export function privateAnalyticsEvent<T extends { type: string; url: string }>(
  event: T,
  privacy: { doNotTrack?: string | null; globalPrivacyControl?: boolean },
): T | null {
  if (privacy.doNotTrack === "1" || privacy.globalPrivacyControl)
    return null;
  if (event.type !== "pageview") return null;
  const url = publicAnalyticsURL(event.url);
  return url ? { ...event, url } : null;
}
