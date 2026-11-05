import { useState } from "react";
import { useMe } from "../auth/AuthProvider";
import type { Branch } from "../lib/api";
import { currentBranch, rememberBranch } from "../lib/branch";

/** The branch a tool works in, remembered on this device. */
export function useBranchChoice(): [Branch | null, (id: string) => void] {
  const me = useMe();
  const [id, setId] = useState(() => currentBranch(me)?.id ?? "");
  const branch = me.branches.find((b) => b.id === id) ?? currentBranch(me);
  return [
    branch,
    (next: string) => {
      rememberBranch(next);
      setId(next);
    },
  ];
}
