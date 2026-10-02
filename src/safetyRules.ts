export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function isValidPhone(phone: string): boolean {
  const digits = normalizePhone(phone);
  return digits.length >= 7 && digits.length <= 15;
}

export function isDuplicatePhone(existingPhones: string[], phone: string): boolean {
  const target = normalizePhone(phone);
  return existingPhones.some((value) => normalizePhone(value) === target);
}

export function isValidActiveIncident(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    Number.isFinite(item.latitude) &&
    Number.isFinite(item.longitude) &&
    typeof item.startedAt === "string" &&
    item.status === "ACTIVE"
  );
}
