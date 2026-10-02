import { getActiveIncident, getSession } from "./backend";
import type { IncidentRecord } from "./backend";

export async function recoverActiveBackendIncident(): Promise<IncidentRecord | null> {
  const session = await getSession();
  if (!session?.user?.id) return null;

  try {
    return await getActiveIncident(session.user.id);
  } catch (error) {
    console.error("Active incident recovery failed", error);
    return null;
  }
}
