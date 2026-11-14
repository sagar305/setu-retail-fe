import { useSyncExternalStore } from "react";
import { listFor, listsVersion, subscribeLists, type Kind, type ListSet } from "../lib/listData";

/** The whole list once it's loaded on this device (null until then: ask the API page by page). */
export function useLocalList<K extends Kind>(kind: K, key: string | null | undefined): ListSet<K> | null {
  useSyncExternalStore(subscribeLists, listsVersion, listsVersion);
  return key === null || key === undefined ? null : listFor(kind, key);
}
