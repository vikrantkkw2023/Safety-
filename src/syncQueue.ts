export type SyncOperation =
  | { type: "PROFILE_UPSERT"; payload: Record<string, string> }
  | { type: "CONTACT_CREATE"; payload: Record<string, string | null> }
  | { type: "CONTACT_DELETE"; payload: Record<string, string | null> }
  | { type: "INCIDENT_CREATE"; payload: Record<string, string | number | null> }
  | { type: "INCIDENT_STATUS"; payload: Record<string, string | null> };

const MAX_QUEUE_ITEMS = 50;

export const SYNC_QUEUE_KEY = "safety.syncQueue.v1";

export function enqueueOperation(queue: SyncOperation[], operation: SyncOperation): SyncOperation[] {
  if (queue.length >= MAX_QUEUE_ITEMS) {
    return [...queue.slice(queue.length - MAX_QUEUE_ITEMS + 1), operation];
  }
  return [...queue, operation];
}

export function removeOperation(queue: SyncOperation[], index: number): SyncOperation[] {
  if (index < 0 || index >= queue.length) return queue;
  return queue.filter((_, i) => i !== index);
}


export function parseSyncQueue(raw: string | null): SyncOperation[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSyncOperation);
  } catch {
    return [];
  }
}

function isSyncOperation(value: unknown): value is SyncOperation {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  if (typeof item.type !== "string" || !item.payload || typeof item.payload !== "object") return false;
  return ["PROFILE_UPSERT", "CONTACT_CREATE", "CONTACT_DELETE", "INCIDENT_CREATE", "INCIDENT_STATUS"].includes(item.type);
}

export function serializeSyncQueue(queue: SyncOperation[]): string {
  return JSON.stringify(queue.slice(-MAX_QUEUE_ITEMS));
}
