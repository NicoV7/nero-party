export function sanitize(input: string): string {
  return input.replace(/<[^>]*>/g, "");
}
