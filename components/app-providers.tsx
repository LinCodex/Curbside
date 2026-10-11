"use client";
import { AccountProvider } from "./account-provider";
import { PreferencesProvider } from "./preferences";
import { NotificationPreferencesProvider } from "./notification-preferences";
import { CookieConsentProvider } from "./cookie-consent";
import AccountPresence from "./account-presence";
import AppUpdater from "./app-updater";
import { AnnouncementPrefetch } from "./announcement-settings";
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
            <AnnouncementPrefetch />
            <AppUpdater />
          </CookieConsentProvider>
        </PreferencesProvider>
      </NotificationPreferencesProvider>
    </AccountProvider>
  );
}
