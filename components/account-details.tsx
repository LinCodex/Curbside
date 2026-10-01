"use client";
import { useAccount } from "./account-provider";
import { usePreferences } from "./preferences";
export default function AccountDetails({
  onDeleteAccount,
}: {
  onDeleteAccount: () => void;
}) {
  const { clerk, user } = useAccount();
  const { tr } = usePreferences();
  if (!user)
    return (
      <p role="status">
        {tr("Please sign in again before editing account details.")}
      </p>
    );
  return (
    <div className="account-details-panel stack">
      <p className="small muted">
        {tr(
          "Manage how you sign in. Your saved cars and preferences stay with your account.",
        )}
      </p>
      <p className="account-detail-value">{user.email}</p>
      <button className="button" onClick={() => clerk.openUserProfile()}>
        {tr("Manage account")}
      </button>
      <button
        className="text-link account-delete-link"
        onClick={onDeleteAccount}
      >
        {tr("Delete account")}
      </button>
    </div>
  );
}
