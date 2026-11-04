// Checks a counter PIN against the PBKDF2-SHA256 verifier from the offline pack.
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const fromHex = (h: string) => new Uint8Array(h.match(/../g)!.map((b) => parseInt(b, 16)));

export async function checkPin(pin: string, v: { hash: string; salt: string; iterations: number }): Promise<boolean> {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: fromHex(v.salt), iterations: v.iterations }, material, 256);
  const got = hex(bits);
  // Constant-time-ish compare.
  let diff = got.length ^ v.hash.length;
  for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ (v.hash.charCodeAt(i) || 0);
  return diff === 0;
}

/** Five wrong PINs lock offline sign-in on this device for five minutes. */
export const PIN_TRIES = 5;
export const PIN_LOCK_MS = 5 * 60_000;
