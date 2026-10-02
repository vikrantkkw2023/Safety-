import { getIncidentById } from "./backend";
import type { IncidentRecord } from "./backend";
import { isValidActiveIncident } from "./safetyRules";

export function toLocalActiveIncident(
  incident: IncidentRecord | null,
): {
  id: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  startedAt: string;
  status: "ACTIVE";
} | null {
  if (!incident || incident.status !== "ACTIVE") return null;

  const localCandidate = {
    id: incident.id,
    latitude: incident.latitude,
    longitude: incident.longitude,
    accuracy: incident.accuracy ?? undefined,
    startedAt: incident.started_at,
    status: "ACTIVE" as const,
  };

  return isValidActiveIncident(localCandidate) ? localCandidate : null;
}

export async function recoverIncidentById(
  userId: string,
  incidentId: string,
) {
  const remote = await getIncidentById(userId, incidentId);
  return toLocalActiveIncident(remote);
}
