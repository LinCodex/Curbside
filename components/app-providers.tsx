"use client";
import { useEffect, useState } from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { enUS, zhCN } from "@clerk/localizations";
import { shadcn } from "@clerk/ui/themes";
import { AccountProvider } from "./account-provider";
import { PreferencesProvider } from "./preferences";
export default function AppProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  const [chinese, setChinese] = useState(false);
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const update = () => {
      setChinese(document.documentElement.lang.startsWith("zh"));
      setDark(document.documentElement.dataset.theme === "dark");
    };
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["lang", "data-theme"],
    });
    update();
    return () => observer.disconnect();
  }, []);
  return (
    <ClerkProvider
      localization={chinese ? zhCN : enUS}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/?view=garage"
      signUpFallbackRedirectUrl="/?view=garage"
      appearance={{
        theme: shadcn,
        variables: {
          colorBackground: dark ? "#111c2d" : "#ffffff",
          colorForeground: dark ? "#ecf2fc" : "#111827",
          colorPrimary: dark ? "#91b7ff" : "#1f4b75",
          colorInput: dark ? "#23344e" : "#f3f5f7",
          colorInputForeground: dark ? "#ecf2fc" : "#111827",
        },
        elements: {
          formFieldInput: {
            background: dark ? "#1b2a40" : "#f3f5f7",
            border: "1px solid #64748b",
          },
          formFieldCheckboxInput: {
            border: "1px solid #64748b",
          },
          footer: {
            background: dark ? "#162235" : "#f3f5f7",
            color: dark ? "#ecf2fc" : "#111827",
          },
          footerActionText: { color: dark ? "#ecf2fc" : "#111827" },
          formButtonPrimary: {
            background: dark ? "#91b7ff" : "#1f4b75",
            color: dark ? "#080f1b" : "#ffffff",
          },
        },
      }}
    >
      <AccountProvider>
        <PreferencesProvider>{children}</PreferencesProvider>
      </AccountProvider>
    </ClerkProvider>
  );
}
