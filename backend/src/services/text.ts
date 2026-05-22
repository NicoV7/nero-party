export function sanitize(input: string): string {
  return input.replace(/<[^>]*>/g, "");
}

export function isBlankString(value: unknown): boolean {
  return !value || typeof value !== "string" || value.trim().length === 0;
}
