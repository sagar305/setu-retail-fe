import type { ReceiptTemplate } from "./api";

/** The design a branch prints with: its own, else the business default, else none (classic). */
export function designFor(templates: ReceiptTemplate[], branchTemplateId: string | null | undefined): ReceiptTemplate | null {
  return templates.find((t) => t.id === branchTemplateId) ?? templates.find((t) => t.isDefault) ?? templates[0] ?? null;
}
