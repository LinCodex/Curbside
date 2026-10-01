"use client";
import { SignIn, SignUp, UserButton } from "@clerk/nextjs";
import { useAccount } from "./account-provider";
import { usePreferences } from "./preferences";
export default function ClerkAuthPanel({
  initialMode,
}: {
  initialMode: "login" | "register" | "reset";
}) {
  const { user } = useAccount();
  const { tr } = usePreferences();
  if (user)
    return (
      <div className="stack">
        <UserButton />
        <p>{tr("Your account")}</p>
      </div>
    );
  return initialMode === "register" ? (
    <SignUp
      routing="hash"
      signInUrl="/sign-in"
      fallbackRedirectUrl="/?view=garage"
    />
  ) : (
    <SignIn
      routing="hash"
      signUpUrl="/sign-up"
      fallbackRedirectUrl="/?view=garage"
    />
  );
}
