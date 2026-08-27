/**
 * Record ids are UUIDs because every primary key in the database is a `uuid`
 * column — Postgres rejects anything else outright. Ids are generated on the
 * client so a record can be created offline and keep the same identity once it
 * syncs.
 *
 * These identify rows, they do not protect them: access is decided by Row
 * Level Security on household membership, never by an id being hard to guess.
 * So a non-cryptographic fallback is fine when the platform has no `crypto`.
 */
export function createId(): string {
  const cryptoRef = globalThis.crypto;

  if (typeof cryptoRef?.randomUUID === 'function') {
    return cryptoRef.randomUUID();
  }

  if (typeof cryptoRef?.getRandomValues === 'function') {
    const bytes = cryptoRef.getRandomValues(new Uint8Array(16));
    return formatUuid(bytes);
  }

  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  return formatUuid(bytes);
}

/** Stamps the version 4 and variant bits, then formats as 8-4-4-4-12 hex. */
function formatUuid(bytes: Uint8Array): string {
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex: string[] = [];
  for (let i = 0; i < 16; i += 1) hex.push(bytes[i].toString(16).padStart(2, '0'));

  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-');
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True when `value` is something the database's uuid columns will accept. */
export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}
