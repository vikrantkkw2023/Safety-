export function validateEmail(email: string): string | null {
  const value = email.trim();
  if (!value) return "Email is required.";
  if (value.length > 254) return "Email is too long.";
  if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(value)) {
    return "Enter a valid email address.";
  }
  return null;
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) return "Password must contain at least 8 characters.";
  if (password.length > 128) return "Password is too long.";
  return null;
}


export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
