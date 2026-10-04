export const niceDate = (s?: string | null, locale = "en") =>
  s
    ? new Date(s.length === 10 ? s + "T12:00:00" : s).toLocaleDateString(
        locale === "zh" ? "zh-CN" : "en-US",
        { month: "short", day: "numeric", year: "numeric" },
      )
    : locale === "zh"
      ? "未提供"
      : "Not provided";
