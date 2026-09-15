export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function maskSensitiveValue(value: string, visibleDigits = 4): string {
  const digits = digitsOnly(value);

  if (!digits) {
    return "";
  }

  const visibleCount = Math.min(visibleDigits, digits.length);
  const hiddenCount = digits.length - visibleCount;
  const masked = `${"•".repeat(hiddenCount)}${digits.slice(-visibleCount)}`;

  return masked.replace(/(.{4})(?=.)/g, "$1 ");
}
