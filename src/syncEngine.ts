import { createContact, findContactByPhone, createIncident, findIncidentByLocalId, getSession } from "./backend";
import { loadSyncQueue, saveSyncQueue } from "./queueStorage";
import { removeOperation, type SyncOperation } from "./syncQueue";

export async function retryPendingSync(): Promise<{ remaining: number; synced: number }> {
  const queue = await loadSyncQueue();
  if (queue.length === 0) return { remaining: 0, synced: 0 };

  const session = await getSession();
  if (!session?.user?.id) return { remaining: queue.length, synced: 0 };

  let current = queue;
  let synced = 0;

  for (let index = 0; index < queue.length; index += 1) {
    const operation = queue[index];
    if (!operation) continue;

    try {
      if (operation.type === "CONTACT_CREATE") {
        const phone = operation.payload.phone;
        const existing = await import("./backend").then((m) =>
          m.findContactByPhone(session.user.id, phone)
        );

        if (!existing) {
          await createContact(session.user.id, {
            name: operation.payload.name,
            phone,
            relationship: operation.payload.relationship ?? null,
            country_code: operation.payload.country_code || null,
          });
        }

        current = removeOperation(current, 0);
        synced += 1;
        await saveSyncQueue(current);
        continue;
      }

      // Other operation types remain queued until their dedicated sync handlers exist.
      break;
    } catch (error) {
      console.error("Pending sync failed", operation.type, error);
      break;
    }
  }

  return { remaining: current.length, synced };
}
