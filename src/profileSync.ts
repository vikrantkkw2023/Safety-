import { getSession, upsertProfile } from "./backend";
import { loadSyncQueue, saveSyncQueue } from "./queueStorage";
import { enqueueOperation, type SyncOperation } from "./syncQueue";

export type LocalProfile = {
  name: string;
  country: string;
  phone: string;
};

export async function syncProfileWithFallback(
  profile: LocalProfile,
  queue?: SyncOperation[],
): Promise<{ queue: SyncOperation[]; synced: boolean }> {
  let current = queue ?? await loadSyncQueue();
  const operation: SyncOperation = {
    type: "PROFILE_UPSERT",
    payload: {
      name: profile.name,
      country_code: profile.country,
      phone: profile.phone,
    },
  };

  const session = await getSession();
  if (!session?.user?.id) {
    current = enqueueOperation(current, operation);
    await saveSyncQueue(current);
    return { queue: current, synced: false };
  }

  try {
    await upsertProfile(session.user.id, {
      name: profile.name,
      country_code: profile.country,
      phone: profile.phone,
    });
    await saveSyncQueue(current);
    return { queue: current, synced: true };
  } catch (error) {
    console.error("Profile sync failed; queued for retry", error);
    current = enqueueOperation(current, operation);
    await saveSyncQueue(current);
    return { queue: current, synced: false };
  }
}
