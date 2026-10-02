export type SyncOperation =
  | { type: "PROFILE_UPSERT"; payload: Record<string, string> }
  | { type: "CONTACT_CREATE"; payload: Record<string, string | null> }
  | { type: "INCIDENT_CREATE"; payload: Record<string, string | number | null> }
  | { type: "INCIDENT_STATUS"; payload: Record<string, string | null> };

const MAX_QUEUE_ITEMS = 50;

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
