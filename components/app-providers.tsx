"use client";
import { AccountProvider } from "./account-provider";
import { PreferencesProvider } from "./preferences";
import { NotificationPreferencesProvider } from "./notification-preferences";
export default function AppProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AccountProvider>
      <NotificationPreferencesProvider>
        <PreferencesProvider>{children}</PreferencesProvider>
      </NotificationPreferencesProvider>
    </AccountProvider>
  );
}
