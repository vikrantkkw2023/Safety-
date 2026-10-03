import { createContact, createIncident, deleteContactByPhone, findContactByPhone, findIncidentByLocalId, getSession, updateIncidentStatus, upsertProfile } from "./backend";
import { loadSyncQueue, saveSyncQueue } from "./queueStorage";
import { removeOperation, type SyncOperation } from "./syncQueue";

export async function retryPendingSync(): Promise<{ remaining: number; synced: number }> {
  let current = await loadSyncQueue();
  if (current.length === 0) return { remaining: 0, synced: 0 };

  const session = await getSession();
  if (!session?.user?.id) return { remaining: current.length, synced: 0 };

  let synced = 0;

  while (current.length > 0) {
    const operation = current[0];
    if (!operation) break;

    try {
      if (operation.type === "PROFILE_UPSERT") {
        const name = operation.payload.name;
        const countryCode = operation.payload.country_code;
        const phone = operation.payload.phone;
        if (!name || !countryCode || !phone) throw new Error("INVALID_PROFILE_PAYLOAD");
        await upsertProfile(session.user.id, { name, country_code: countryCode, phone });
      } else if (operation.type === "CONTACT_CREATE") {
        const phone = operation.payload.phone;
        if (!phone) throw new Error("INVALID_CONTACT_PAYLOAD");
        const existing = await findContactByPhone(session.user.id, phone);
        if (!existing) {
          await createContact(session.user.id, {
            name: operation.payload.name ?? "Trusted contact",
            phone,
            relationship: operation.payload.relationship ?? null,
            country_code: operation.payload.country_code || null,
          });
        }
      } else if (operation.type === "CONTACT_DELETE") {
        const phone = operation.payload.phone;
        if (!phone) throw new Error("INVALID_CONTACT_DELETE_PAYLOAD");
        await deleteContactByPhone(session.user.id, phone);
      } else if (operation.type === "INCIDENT_CREATE") {
        const localId = operation.payload.local_id;
        if (!localId) throw new Error("MISSING_LOCAL_INCIDENT_ID");
        const existing = await findIncidentByLocalId(session.user.id, localId);
        if (!existing) {
          await createIncident(session.user.id, {
            client_local_id: localId,
            latitude: Number(operation.payload.latitude),
            longitude: Number(operation.payload.longitude),
            accuracy: operation.payload.accuracy == null ? null : Number(operation.payload.accuracy),
            started_at: String(operation.payload.started_at),
          });
        }
      } else if (operation.type === "INCIDENT_STATUS") {
        const localId = operation.payload.incident_id;
        if (!localId) throw new Error("MISSING_LOCAL_INCIDENT_ID");
        const remote = await findIncidentByLocalId(session.user.id, localId);
        if (!remote) break;

        const status = operation.payload.status;
        if (status !== "RESOLVED" && status !== "CANCELLED" && status !== "ACTIVE") {
          throw new Error("INVALID_INCIDENT_STATUS");
        }
        await updateIncidentStatus(
          session.user.id,
          remote.id,
          status,
          operation.payload.ended_at ?? null,
        );
      }

      current = removeOperation(current, 0);
      synced += 1;
      await saveSyncQueue(current);
    } catch (error) {
      console.error("Pending sync failed", operation.type, error);
      break;
    }
  }

  return { remaining: current.length, synced };
}
