/**
 * Small, dependency-free unique id. Good enough for local-only records;
 * swap for a uuid library if ids ever need to be globally unique.
 */
export function createId(prefix = ''): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}${Date.now().toString(36)}${random}`;
}
