"use client";
import { AccountProvider } from "./account-provider";
import { PreferencesProvider } from "./preferences";
import { NotificationPreferencesProvider } from "./notification-preferences";
import { CookieConsentProvider } from "./cookie-consent";
import AccountPresence from "./account-presence";
export default function AppProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AccountProvider>
      <NotificationPreferencesProvider>
        <PreferencesProvider>
          <CookieConsentProvider>
            {children}
            <AccountPresence />
          </CookieConsentProvider>
        </PreferencesProvider>
      </NotificationPreferencesProvider>
    </AccountProvider>
  );
}
