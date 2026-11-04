// Bills and customers made on this counter, pushed to the server when online.
// The server is idempotent on ids, so pushing twice is harmless.
import { ApiError, deviceRequest, type SyncResults } from "../lib/api";
import { db, type OutboxCustomer, type OutboxOrder } from "./db";
import { deviceKeyFor } from "./counter";

export type FlushOutcome = { state: "done" | "offline" | "blocked" | "error"; saved: number; rejected: number; message?: string };

export async function queueOrder(row: Omit<OutboxOrder, "status">) {
  await db.outbox.put({ ...row, status: "pending" });
}

export async function queueCustomer(row: Omit<OutboxCustomer, "status">) {
  await db.customers.put({ ...row, status: "pending" });
}

export async function pendingOrders(counterId?: string) {
  const rows = await db.outbox.where("status").equals("pending").toArray();
  return (counterId ? rows.filter((r) => r.counterId === counterId) : rows).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

const isNetwork = (err: unknown) => err instanceof TypeError;

/** Push everything waiting, counter by counter: customers first, then bills in order. */
export async function flushOutbox(): Promise<FlushOutcome> {
  const counters = new Set([...(await db.customers.where("status").equals("pending").toArray()).map((c) => c.counterId), ...(await pendingOrders()).map((o) => o.counterId)]);
  let saved = 0;
  let rejected = 0;
  for (const counterId of counters) {
    const key = await deviceKeyFor(counterId);
    if (!key) continue;
    try {
      const customers = await db.customers.where("status").equals("pending").filter((c) => c.counterId === counterId).toArray();
      if (customers.length) {
        const r = await deviceRequest<SyncResults>("POST", "/sync/customers", key, { customers: customers.map((c) => c.payload) });
        for (const x of r.results) {
          if (x.status === "rejected") await db.customers.update(x.id, { status: "rejected" });
          else await db.customers.delete(x.id);
        }
      }
      const orders = await pendingOrders(counterId);
      for (let i = 0; i < orders.length; i += 50) {
        const chunk = orders.slice(i, i + 50);
        const r = await deviceRequest<SyncResults>("POST", "/sync/orders", key, { orders: chunk.map((o) => o.payload) });
        for (const x of r.results) {
          if (x.status === "saved" || x.status === "duplicate") {
            await db.outbox.delete(x.id);
            saved += 1;
          } else if (x.status === "rejected") {
            await db.outbox.update(x.id, { status: "rejected", message: x.message });
            rejected += 1;
          }
        }
      }
    } catch (err) {
      if (isNetwork(err)) return { state: "offline", saved, rejected };
      if (err instanceof ApiError && err.code === "plan_expired") return { state: "blocked", saved, rejected, message: err.message };
      return { state: "error", saved, rejected, message: err instanceof Error ? err.message : "Sync failed" };
    }
  }
  return { state: "done", saved, rejected };
}
