export const ONBOARDING_COOKIE = "curbside_onboarding";
export function hasOnboarded(cookies: string) {
  return cookies
    .split(";")
    .some((part) => part.trim() === ONBOARDING_COOKIE + "=1");
}
export function onboardingCookie(secure: boolean) {
  return `${ONBOARDING_COOKIE}=1; Path=/; Max-Age=31536000; SameSite=Lax${secure ? "; Secure" : ""}`;
}
