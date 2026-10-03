import { createIncident, findIncidentByLocalId, getSession, updateIncidentStatus } from "./backend";
import type { IncidentRecord } from "./backend";
import { enqueueOperation, type SyncOperation } from "./syncQueue";

export type LocalIncident = {
  id: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  startedAt: string;
  status: "ACTIVE" | "RESOLVED";
};

export async function syncIncidentCreate(
  incident: LocalIncident,
  queue: SyncOperation[],
): Promise<{ queue: SyncOperation[]; synced: boolean; remoteIncidentId?: string }> {
  const session = await getSession();
  if (!session?.user?.id) {
    return {
      queue: enqueueOperation(queue, {
        type: "INCIDENT_CREATE",
        payload: {
          local_id: incident.id,
          latitude: incident.latitude,
          longitude: incident.longitude,
          accuracy: incident.accuracy ?? null,
          started_at: incident.startedAt,
          status: incident.status,
        },
      }),
      synced: false,
    };
  }

  try {
    const existing = await findIncidentByLocalId(session.user.id, incident.id);
    if (existing) return { queue, synced: true, remoteIncidentId: existing.id };

    const created = await createIncident(session.user.id, {
      client_local_id: incident.id,
      latitude: incident.latitude,
      longitude: incident.longitude,
      accuracy: incident.accuracy ?? null,
      started_at: incident.startedAt,
    });
    return { queue, synced: true, remoteIncidentId: created.id };
  } catch {
    return {
      queue: enqueueOperation(queue, {
        type: "INCIDENT_CREATE",
        payload: {
          local_id: incident.id,
          latitude: incident.latitude,
          longitude: incident.longitude,
          accuracy: incident.accuracy ?? null,
          started_at: incident.startedAt,
        },
      }),
      synced: false,
    };
  }
}

export async function syncIncidentEnd(
  userId: string,
  localIncidentId: string,
  endedAt: string,
): Promise<IncidentRecord> {
  const remote = await findIncidentByLocalId(userId, localIncidentId);
  if (!remote) throw new Error("REMOTE_INCIDENT_NOT_FOUND");
  return updateIncidentStatus(userId, remote.id, "RESOLVED", endedAt);
}
