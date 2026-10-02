"use client";
import { AccountProvider } from "./account-provider";
import { PreferencesProvider } from "./preferences";
export default function AppProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AccountProvider>
      <PreferencesProvider>{children}</PreferencesProvider>
    </AccountProvider>
  );
}
