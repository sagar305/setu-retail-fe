import { useCallback, useState } from "react";
import { readPref, writePref } from "../lib/storage";

const KEY = "setu-retail:sidebar-open";

/** Sidebar open/closed, remembered per device (a cashier who hides it keeps it hidden). */
export function useSidebar() {
  const [open, setOpen] = useState(() => readPref(KEY) !== "false");
  const toggle = useCallback(() => {
    setOpen((was) => {
      writePref(KEY, String(!was));
      return !was;
    });
  }, []);
  return { open, toggle };
}
