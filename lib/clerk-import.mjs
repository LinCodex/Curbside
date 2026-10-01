export function importPayload(row) {
  if (
    !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(row.id || "") ||
    !row.email ||
    row.is_anonymous
  )
    throw new Error(
      "Anonymous or unsupported legacy identity; resolve before cutover.",
    );
  if (
    row.encrypted_password &&
    !/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(row.encrypted_password)
  )
    throw new Error(
      "Unsupported legacy password hash; do not import as plaintext.",
    );
  if (
    row.legal_accepted_at &&
    !Number.isFinite(Date.parse(row.legal_accepted_at))
  )
    throw new Error("Invalid legacy consent timestamp.");
  return {
    external_id: row.id,
    email_address: [row.email],
    email_address_identification_status: [
      row.email_confirmed_at ? "verified" : "reserved",
    ],
    ...(row.encrypted_password
      ? {
          password_digest: row.encrypted_password,
          password_hasher: "bcrypt",
          skip_password_checks: true,
        }
      : { skip_password_requirement: true }),
    ...(row.legal_accepted_at
      ? { legal_accepted_at: row.legal_accepted_at }
      : { skip_legal_checks: true }),
  };
}

export function preflightImport(planned, existing) {
  for (const user of planned) {
    const previous = existing.filter(
      (item) => item.external_id === user.external_id,
    );
    const matchingEmail = (item) =>
      item.email_addresses.some(
        (email) =>
          email.email_address.toLowerCase() ===
          user.email_address[0].toLowerCase(),
      );
    if (
      previous.length > 1 ||
      (previous.length === 1 && !matchingEmail(previous[0]))
    )
      throw new Error(
        "Existing external ID has a conflicting identity. Resolve before importing; no ownership is reassigned.",
      );
    if (
      existing.some(
        (item) => matchingEmail(item) && item.external_id !== user.external_id,
      )
    )
      throw new Error(
        "Email collision detected. Import stopped before writing; resolve identity ownership manually.",
      );
  }
}
