// On-device storage (IndexedDB via Dexie). Lives only in this browser.
//  - kv:        device keys, bill-number counters, the offline PIN session
//  - packs:     what each branch's counter needs to bill offline (from /sync/pack)
//  - outbox:    bills made here that the server hasn't confirmed yet
//  - customers: customers added here that the server hasn't confirmed yet
//  - money:     expenses, payments received and payments made here, waiting to sync
//  - changes:   any other change made here (product, customer, expense…),
//               waiting to reach the cloud (lib/changes.ts)
//  - responses: the last answer to each GET the app made, so screens open
//               instantly and still work offline (lib/cache.ts)
import Dexie, { type EntityTable } from "dexie";
import type { OfflinePack, Order, SyncCustomer, SyncMoneyOp, SyncOrder } from "../lib/api";

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

export type OutboxMoney = {
  id: string;
  counterId: string;
  branchId: string;
  createdAt: string;
  status: OutboxStatus;
  message?: string;
  payload: SyncMoneyOp;
  /** What it was, for "on this counter", e.g. "Payment from Meera". */
  label: string;
};

/** How a change shows on screen before the cloud has it (Phase 9b, lib/changes.ts). */
export type Effect =
  | { kind: "update"; id: string; fields: Record<string, unknown> }
  | { kind: "remove"; id: string }
  | { kind: "insert"; into: string; key: string; item: Record<string, unknown> & { id: string } };

/** A change saved on this device, waiting to reach the cloud (sent with an Idempotency-Key = id). */
export type PendingChange = {
  id: string;
  userId: string;
  method: "POST" | "PATCH" | "PUT" | "DELETE";
  path: string;
  body?: unknown;
  /** What it was, for the sync panel ("Price of Tea → ₹120"). */
  label: string;
  effects: Effect[];
  createdAt: string;
  status: "pending" | "rejected";
  message?: string;
};

/** A cached GET answer. `owner` is the signed-in user it belongs to. */
export type CachedResponse = { key: string; owner: string; path: string; data: unknown; fetchedAt: number; usedAt: number };

export class SetuDb extends Dexie {
  kv!: EntityTable<Kv, "key">;
  packs!: EntityTable<PackRow, "branchId">;
  outbox!: EntityTable<OutboxOrder, "id">;
  customers!: EntityTable<OutboxCustomer, "id">;
  money!: EntityTable<OutboxMoney, "id">;
  responses!: EntityTable<CachedResponse, "key">;
  changes!: EntityTable<PendingChange, "id">;
  constructor(name = "setu-retail") {
    super(name);
    this.version(1).stores({
      kv: "key",
      packs: "branchId",
      outbox: "id, counterId, status, createdAt",
      customers: "id, counterId, status",
    });
    this.version(2).stores({ money: "id, counterId, status, createdAt" });
    this.version(3).stores({ responses: "key, owner, usedAt" });
    this.version(4).stores({ changes: "id, userId, status, createdAt" });
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
