import { loadSyncQueue, saveSyncQueue } from "./queueStorage";
import { syncIncidentCreate, syncIncidentEnd, type LocalIncident } from "./incidentSync";
import { enqueueOperation } from "./syncQueue";
import { getSession } from "./backend";

export async function persistAndSyncIncident(incident: LocalIncident) {
  const queue = await loadSyncQueue();
  const result = await syncIncidentCreate(incident, queue);
  await saveSyncQueue(result.queue);
  return result;
}

export async function endAndSyncIncident(
  incident: LocalIncident,
  endedAt: string,
) {
  const session = await getSession();

  if (!session?.user?.id) {
    const queue = await loadSyncQueue();
    const next = enqueueOperation(queue, {
      type: "INCIDENT_STATUS",
      payload: {
        incident_id: incident.id,
        status: "RESOLVED",
        ended_at: endedAt,
      },
    });
    await saveSyncQueue(next);
    return { synced: false, queued: true };
  }

  try {
    await syncIncidentEnd(session.user.id, incident.id, endedAt);
    return { synced: true, queued: false };
  } catch {
    const queue = await loadSyncQueue();
    const next = enqueueOperation(queue, {
      type: "INCIDENT_STATUS",
      payload: {
        incident_id: incident.id,
        status: "RESOLVED",
        ended_at: endedAt,
      },
    });
    await saveSyncQueue(next);
    return { synced: false, queued: true };
  }
}
