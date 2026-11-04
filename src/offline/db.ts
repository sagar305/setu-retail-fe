// On-device storage (IndexedDB via Dexie). Lives only in this browser.
//  - kv:        device keys, bill-number counters, the offline PIN session
//  - packs:     what each branch's counter needs to bill offline (from /sync/pack)
//  - outbox:    bills made here that the server hasn't confirmed yet
//  - customers: customers added here that the server hasn't confirmed yet
import Dexie, { type EntityTable } from "dexie";
import type { OfflinePack, Order, SyncCustomer, SyncOrder } from "../lib/api";

export type Kv = { key: string; value: unknown };
export type PackRow = { branchId: string; pack: OfflinePack; fetchedAt: string };
export type OutboxStatus = "pending" | "rejected";
export type OutboxOrder = {
  id: string;
  counterId: string;
  branchId: string;
  invoiceNumber: string;
  createdAt: string;
  status: OutboxStatus;
  message?: string;
  payload: SyncOrder;
  /** Shaped like the API's Order, for receipts and "bills on this counter". */
  order: Order;
};
export type OutboxCustomer = { id: string; counterId: string; status: OutboxStatus; payload: SyncCustomer; createdAt: string };

export class SetuDb extends Dexie {
  kv!: EntityTable<Kv, "key">;
  packs!: EntityTable<PackRow, "branchId">;
  outbox!: EntityTable<OutboxOrder, "id">;
  customers!: EntityTable<OutboxCustomer, "id">;
  constructor(name = "setu-retail") {
    super(name);
    this.version(1).stores({
      kv: "key",
      packs: "branchId",
      outbox: "id, counterId, status, createdAt",
      customers: "id, counterId, status",
    });
  }
}

export const db = new SetuDb();

export async function kvGet<T>(key: string): Promise<T | undefined> {
  return (await db.kv.get(key))?.value as T | undefined;
}
export async function kvSet(key: string, value: unknown) {
  await db.kv.put({ key, value });
}
export async function kvDelete(key: string) {
  await db.kv.delete(key);
}
