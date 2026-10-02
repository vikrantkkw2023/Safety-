import { getSession, createContact, findContactByPhone } from "./backend";
import type { ContactRecord } from "./backend";
import { enqueueOperation, type SyncOperation } from "./syncQueue";

export type LocalContact = {
  id: string;
  name: string;
  phone: string;
  relationship: string;
};

export async function syncContactWithFallback(
  contact: LocalContact,
  queue: SyncOperation[]
): Promise<{ queue: SyncOperation[]; synced: boolean }> {
  const session = await getSession();
  if (!session?.user?.id) {
    return { queue, synced: false };
  }

  const payload: Omit<ContactRecord, "id" | "user_id"> = {
    name: contact.name,
    phone: contact.phone,
    relationship: contact.relationship,
    country_code: null,
  };

  try {
    const existing = await findContactByPhone(session.user.id, contact.phone);
    if (existing) return { queue, synced: true };
    await createContact(session.user.id, payload);
    return { queue, synced: true };
  } catch {
    return {
      queue: enqueueOperation(queue, {
        type: "CONTACT_CREATE",
        payload: {
          name: contact.name,
          phone: contact.phone,
          relationship: contact.relationship,
          country_code: "",
        },
      }),
      synced: false,
    };
  }
}
