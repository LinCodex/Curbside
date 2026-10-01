export function publicAnalyticsURL(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (
      url.hash ||
      url.searchParams.has("auth") ||
      url.searchParams.has("code")
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
    url.search = "";
    if (
      url.pathname === "/" &&
      view &&
      ["garage", "search", "map", "account"].includes(view)
    )
      url.searchParams.set("view", view);
    return url.toString();
  } catch {
    return null;
  }
}
