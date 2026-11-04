import { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Modal, PageHeader } from "../components/ui";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import type { OfflinePack } from "../lib/api";
import { formatMoney } from "../lib/money";
import { db, type OutboxOrder } from "../offline/db";
import { useSync } from "../offline/SyncProvider";
import { Receipt } from "../pos/Receipt";

/** Bills made on this device that the server hasn't confirmed yet. */
export function CounterBillsPage() {
  const online = useOnlineStatus();
  const { state, message, kick, lastSyncAt } = useSync();
  const [rows, setRows] = useState<OutboxOrder[]>([]);
  const [packs, setPacks] = useState<Map<string, OfflinePack>>(new Map());
  const [open, setOpen] = useState<OutboxOrder | null>(null);

  const load = useCallback(() => {
    Promise.all([db.outbox.orderBy("createdAt").reverse().toArray(), db.packs.toArray()]).then(([o, p]) => {
      setRows(o);
      setPacks(new Map(p.map((x) => [x.branchId, x.pack])));
    });
  }, []);
  useEffect(() => {
    load();
    const id = window.setInterval(load, 3000);
    return () => window.clearInterval(id);
  }, [load]);

  const pending = rows.filter((r) => r.status === "pending");
  const rejected = rows.filter((r) => r.status === "rejected");

  return (
    <div className="w-full">
      <PageHeader title="Bills on this counter" description="Bills made here wait on this device until the server has them." actions={<Button onClick={kick} disabled={!online || !pending.length}>Sync now</Button>} />
      <div className="mb-4 flex flex-col gap-3">
        {!online ? <Alert tone="warn">No internet. {pending.length} bill{pending.length === 1 ? "" : "s"} will sync when it's back. Keep this browser's data: clearing it would lose them.</Alert> : null}
        {state === "blocked" ? <Alert tone="warn">{message ?? "The plan has ended."} The owner can redeem a key in Settings → Plan & key; these bills sync right after.</Alert> : null}
        {state === "error" && message ? <Alert tone="error">{message}</Alert> : null}
        {online && !pending.length && !rejected.length ? <Alert tone="ok">Everything on this counter is synced{lastSyncAt ? ` (${new Date(lastSyncAt).toLocaleTimeString("en-IN", { timeStyle: "short" })})` : ""}.</Alert> : null}
        {rejected.length ? <Alert tone="error">{rejected.length} bill{rejected.length === 1 ? " was" : "s were"} refused by the server. Keep the printed copy and tell the owner; the reason is shown below.</Alert> : null}
      </div>
      <Card className="!p-0">
        {rows.length === 0 ? <p className="m-0 p-5 text-muted">No bills waiting.</p> : null}
        {rows.map((r) => (
          <button key={r.id} type="button" onClick={() => setOpen(r)} className="flex min-h-14 w-full flex-wrap items-center gap-3 border-b border-line px-4 py-2 text-left last:border-0 hover:bg-paper">
            <span className="font-semibold">{r.invoiceNumber}</span>
            <span className="text-sm text-muted">{new Date(r.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span>
            <span className="ml-auto font-semibold">{formatMoney(r.order.total)}</span>
            {r.status === "pending" ? <Badge tone="warn">Waiting to sync</Badge> : <Badge tone="error">Refused: {r.message}</Badge>}
          </button>
        ))}
      </Card>
      {open && packs.get(open.branchId) ? (
        <Modal title={`Bill ${open.invoiceNumber}`} onClose={() => setOpen(null)} wide>
          <div className="flex flex-col gap-4">
            <div className="max-h-[55vh] overflow-auto rounded-xl border border-line bg-cream p-3">
              <Receipt order={open.order} settings={packs.get(open.branchId)!.settings} />
            </div>
            <Button onClick={() => window.print()} className="self-start">
              Print receipt
            </Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
