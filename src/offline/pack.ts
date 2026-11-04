import { deviceRequest, type OfflinePack } from "../lib/api";
import { db } from "./db";

/** Download this counter's offline pack (prices, stock, customers, PIN verifiers). */
export async function refreshPack(branchId: string, deviceKey: string): Promise<OfflinePack> {
  const pack = await deviceRequest<OfflinePack>("GET", "/sync/pack", deviceKey);
  await db.packs.put({ branchId, pack, fetchedAt: new Date().toISOString() });
  return pack;
}

export async function storedPack(branchId: string): Promise<OfflinePack | undefined> {
  return (await db.packs.get(branchId))?.pack;
}

export async function allPacks(): Promise<OfflinePack[]> {
  return (await db.packs.toArray()).map((r) => r.pack);
}
