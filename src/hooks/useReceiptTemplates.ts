import { useEffect, useState } from "react";
import { apiGet, type ReceiptTemplate } from "../lib/api";

/** Saved receipt designs (online screens; billing uses the offline pack's copy). */
export function useReceiptTemplates(): ReceiptTemplate[] {
  const [templates, setTemplates] = useState<ReceiptTemplate[]>([]);
  useEffect(() => {
    apiGet<{ templates: ReceiptTemplate[] }>("/receipt-templates").then((r) => setTemplates(r.templates), () => {});
  }, []);
  return templates;
}
