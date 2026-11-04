export type BarcodeKind = "CODE128" | "EAN13" | "QR";

/** EAN-13 when the code is 13 digits with a valid check digit; otherwise Code 128. */
export function kindFor(code: string): BarcodeKind {
  if (!/^\d{13}$/.test(code)) return "CODE128";
  const sum = [...code.slice(0, 12)].reduce((s, d, i) => s + Number(d) * (i % 2 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === Number(code[12]) ? "EAN13" : "CODE128";
}
