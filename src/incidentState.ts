export type RecoverableIncident = {
  id: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  startedAt: string;
  status: "ACTIVE";
};

export function shouldRecoverBackendIncident(
  localIncident: { id: string; status: "ACTIVE" | "RESOLVED" } | null,
  remoteIncident: RecoverableIncident | null,
): boolean {
  if (!remoteIncident) return false;
  if (!localIncident) return true;
  return localIncident.status !== "ACTIVE";
}
