import { useState } from "react";
import { readPref, writePref } from "../lib/storage";

export const PAGE_SIZES = [20, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 20;

/** Rows per page for one list, remembered on this device. */
export function usePageSize(list: string): [number, (n: number) => void] {
  const key = `pageSize.${list}`;
  const [size, setSize] = useState(() => {
    const saved = Number(readPref(key));
    return (PAGE_SIZES as readonly number[]).includes(saved) ? saved : DEFAULT_PAGE_SIZE;
  });
  return [
    size,
    (n: number) => {
      writePref(key, String(n));
      setSize(n);
    },
  ];
}
