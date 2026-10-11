// Page background (--bg) per theme; also used as the browser chrome tint.
export const THEME_COLORS = { light: "#f3f4f6", dark: "#0b0d10" } as const;

export function applyThemeColor(theme: "light" | "dark") {
  document
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((meta) => meta.setAttribute("content", THEME_COLORS[theme]));
}
