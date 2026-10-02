import { getSession, listContacts } from "./backend";
import { loadSyncQueue } from "./queueStorage";
import { retryPendingSync } from "./syncEngine";

export async function initializeBackendSync(): Promise<{
  authenticated: boolean;
  queuedOperations: number;
  syncedOperations: number;
}> {
  const session = await getSession();
  const queue = await loadSyncQueue();

  if (!session?.user?.id) {
    return {
      authenticated: false,
      queuedOperations: queue.length,
      syncedOperations: 0,
    };
  }

  try {
    const result = await retryPendingSync();
    return {
      authenticated: true,
      queuedOperations: result.remaining,
      syncedOperations: result.synced,
    };
  } catch (error) {
    console.error("Backend sync initialization failed", error);
    return {
      authenticated: true,
      queuedOperations: queue.length,
      syncedOperations: 0,
    };
  }
}

export async function recoverBackendContacts() {
  const session = await getSession();
  if (!session?.user?.id) return null;

  try {
    return await listContacts(session.user.id);
  } catch (error) {
    console.error("Backend contact recovery failed", error);
    return null;
  }
}
