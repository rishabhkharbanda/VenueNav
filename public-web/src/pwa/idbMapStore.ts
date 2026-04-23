import { openDB, type IDBPDatabase } from "idb";
import type { MapPayload, PublicMapMeta } from "@/types/map";

const DB = "venuenav-public-v1";
const PAYLOAD = "mapPayload";
const META = "mapMeta";

let _db: IDBPDatabase | null = null;

export async function idbInit(): Promise<void> {
  await getDb();
}

async function getDb(): Promise<IDBPDatabase> {
  if (_db) return _db;
  _db = await openDB(DB, 1, {
    upgrade(b) {
      if (!b.objectStoreNames.contains(PAYLOAD)) b.createObjectStore(PAYLOAD);
      if (!b.objectStoreNames.contains(META)) b.createObjectStore(META);
    },
  });
  return _db;
}

export async function putMapPayload(mapId: string, payload: MapPayload): Promise<void> {
  const d = await getDb();
  await d.put(PAYLOAD, { payload, savedAt: Date.now() }, mapId);
}

export async function getMapPayload(mapId: string): Promise<MapPayload | null> {
  const d = await getDb();
  const row = (await d.get(PAYLOAD, mapId)) as { payload: MapPayload } | undefined;
  if (!row?.payload) return null;
  return row.payload;
}

export async function putMapMetaKey(eventSlug: string, mapSlug: string, meta: PublicMapMeta): Promise<void> {
  const d = await getDb();
  const k = `${eventSlug}::${mapSlug}`;
  await d.put(META, { meta, savedAt: Date.now() }, k);
}

export async function getMapMetaByEvent(eventSlug: string, mapSlug: string): Promise<PublicMapMeta | null> {
  const d = await getDb();
  const k = `${eventSlug}::${mapSlug}`;
  const row = (await d.get(META, k)) as { meta: PublicMapMeta } | undefined;
  if (!row?.meta) return null;
  return row.meta;
}
