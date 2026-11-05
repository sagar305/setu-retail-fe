import { useEffect, useState } from "react";
import { apiGet, type PaymentMethod } from "../lib/api";

/** Methods that move money now (not udhaar). */
export function useMoneyMethods(): PaymentMethod[] {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  useEffect(() => {
    apiGet<{ methods: PaymentMethod[] }>("/payment-methods").then((r) => setMethods(r.methods.filter((m) => m.active && m.kind !== "CREDIT")), () => {});
  }, []);
  return methods;
}
