import { getSession, createContact, findContactByPhone } from "./backend";
import type { ContactRecord } from "./backend";
import { enqueueOperation, type SyncOperation } from "./syncQueue";
import { loadSyncQueue, saveSyncQueue } from "./queueStorage";

export type LocalContact = {
  id: string;
  name: string;
  phone: string;
  relationship: string;
};

export async function syncContactWithFallback(
  contact: LocalContact,
  queue?: SyncOperation[],
): Promise<{ queue: SyncOperation[]; synced: boolean }> {
  let current = queue ?? await loadSyncQueue();
  const payload: Omit<ContactRecord, "id" | "user_id"> = {
    name: contact.name,
    phone: contact.phone,
    relationship: contact.relationship,
    country_code: null,
  };

  const session = await getSession();
  const operation: SyncOperation = {
    type: "CONTACT_CREATE",
    payload: {
      name: contact.name,
      phone: contact.phone,
      relationship: contact.relationship,
      country_code: "",
    },
  };

  if (!session?.user?.id) {
    current = enqueueOperation(current, operation);
    await saveSyncQueue(current);
    return { queue: current, synced: false };
  }

  try {
    const existing = await findContactByPhone(session.user.id, contact.phone);
    if (existing) {
      await saveSyncQueue(current);
      return { queue: current, synced: true };
    }
    await createContact(session.user.id, payload);
    await saveSyncQueue(current);
    return { queue: current, synced: true };
  } catch (error) {
    console.error("Contact sync failed; queued for retry", error);
    current = enqueueOperation(current, operation);
    await saveSyncQueue(current);
    return { queue: current, synced: false };
  }
}
