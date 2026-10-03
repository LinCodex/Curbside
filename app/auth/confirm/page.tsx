import type { Metadata } from "next";
import EmailConfirmation from "@/components/email-confirmation";

export const metadata: Metadata = {
  title: "Email confirmation",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function ConfirmEmailPage() {
  return <EmailConfirmation />;
}
