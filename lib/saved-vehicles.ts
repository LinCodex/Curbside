import { normalizePlate } from "./domain";

// Whitelist editable columns; never accept ownership, monitoring, or billing input.
export function vehicleInput(input: Record<string, unknown>, editing = false) {
  const nickname = String(input.nickname ?? "").trim();
  if (!nickname || nickname.length > 60)
    throw new Error("Enter a vehicle nickname of 1–60 characters.");
  if (editing) return { nickname };
  const plate = normalizePlate(input);
  const text = (key: string) => {
    const value = String(input[key] ?? "").trim();
    if (value.length > 80)
      throw new Error("Vehicle details must be 80 characters or fewer.");
    return value || null;
  };
  const year = String(input.year ?? "").trim();
  if (
    year &&
    (!/^\d{4}$/.test(year) ||
      +year < 1886 ||
      +year > new Date().getFullYear() + 2)
  )
    throw new Error("Enter a valid vehicle year.");
  return {
    plate: plate.plate,
    state: plate.state,
    plate_type: plate.plateType,
    nickname,
    make: text("make"),
    model: text("model"),
    color: text("color"),
    year: year ? +year : null,
  };
}
