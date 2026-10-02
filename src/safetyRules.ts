import { getCountryCallingCode, isValidPhoneNumber, parsePhoneNumberWithError } from "libphonenumber-js";

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function getCountryCode(country: string): string {
  return getCountryCallingCode(country as never);
}

export function validateCountryPhone(phone: string, country: string): {
  valid: boolean;
  e164?: string;
  reason?: string;
} {
  try {
    if (!country) return { valid: false, reason: "Select a country." };
    const candidate = phone.trim();
    if (!candidate) return { valid: false, reason: "Enter a phone number." };
    if (!isValidPhoneNumber(candidate, country as never)) {
      return { valid: false, reason: "Enter a valid phone number for the selected country." };
    }
    const parsed = parsePhoneNumberWithError(candidate, country as never);
    return { valid: true, e164: parsed.number };
  } catch {
    return { valid: false, reason: "Enter a valid phone number for the selected country." };
  }
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
