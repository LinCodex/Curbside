export const PASSWORD_REQUIREMENT =
  "Use at least 8 characters, including a lowercase letter, an uppercase letter, and a digit.";

// Match Supabase's ASCII lowercase/uppercase/digit character requirements.
// Symbols are allowed but not required. Existing passwords remain valid at login.
export function meetsPasswordRequirement(password: string): boolean {
  return (
    Array.from(password).length >= 8 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /[0-9]/.test(password)
  );
}
