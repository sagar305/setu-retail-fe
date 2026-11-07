import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Badge, Button, Card, Modal, PageHeader } from "../components/ui";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import type { OfflinePack } from "../lib/api";
import { formatMoney } from "../lib/money";
import { db, type OutboxOrder, type PendingChange } from "../offline/db";
import { dismissChange } from "../lib/changes";
import { useSync } from "../offline/SyncProvider";
import { Receipt } from "../pos/Receipt";
import { printReceipt, receiptPaper } from "../pos/print";
import { designFor } from "../lib/receiptDesign";

/** Bills made on this device that the server hasn't confirmed yet. */
export function CounterBillsPage() {
  const online = useOnlineStatus();
  const { state, message, kick, lastSyncAt } = useSync();
  const [rows, setRows] = useState<OutboxOrder[]>([]);
  const [packs, setPacks] = useState<Map<string, OfflinePack>>(new Map());
  const [open, setOpen] = useState<OutboxOrder | null>(null);
  const [changes, setChanges] = useState<PendingChange[]>([]);
  const receiptRef = useRef<HTMLDivElement>(null);
  const openPack = open ? packs.get(open.branchId) : undefined;
  const openDesign = openPack ? designFor(openPack.receiptTemplates ?? [], openPack.branch.receiptTemplateId) : null;

  const load = useCallback(() => {
    Promise.all([db.outbox.orderBy("createdAt").reverse().toArray(), db.packs.toArray(), db.changes.orderBy("createdAt").reverse().toArray()]).then(([o, p, c]) => {
      setRows(o);
      setChanges(c);
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
      <PageHeader title="Waiting to sync" description="Bills and other changes made here wait on this device until the cloud has them." actions={<Button onClick={kick} disabled={!online || !pending.length}>Sync now</Button>} />
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
      <h2 className="mt-6 mb-2 text-lg font-semibold">Other changes on this device</h2>
      <p className="m-0 mb-3 text-sm text-muted">Products, customers, expenses, payments and more are saved here first and sent in the background.</p>
      <Card className="!p-0">
        {changes.length === 0 ? <p className="m-0 p-5 text-muted">Nothing waiting.</p> : null}
        {changes.map((c) => (
          <div key={c.id} className="flex min-h-14 flex-wrap items-center gap-3 border-b border-line px-4 py-2 last:border-0">
            <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{c.label}</span>
            <span className="text-sm text-muted">{new Date(c.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span>
            {c.status === "pending" ? (
              <Badge tone="warn">Waiting to sync</Badge>
            ) : (
              <>
                <Badge tone="error">Not saved: {c.message}</Badge>
                <Button variant="ghost" onClick={() => void dismissChange(c.id).then(load)}>
                  Dismiss
                </Button>
              </>
            )}
          </div>
        ))}
      </Card>
      {open && packs.get(open.branchId) ? (
        <Modal title={`Bill ${open.invoiceNumber}`} onClose={() => setOpen(null)} wide>
          <div className="flex flex-col gap-4">
            <div ref={receiptRef} className="max-h-[55vh] overflow-auto rounded-xl border border-line bg-cream p-3">
              <Receipt order={open.order} settings={packs.get(open.branchId)!.settings} template={openDesign} />
            </div>
            <Button onClick={() => printReceipt(receiptRef.current, receiptPaper(packs.get(open.branchId)!.settings, openDesign))} className="self-start">
              Print receipt
            </Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
