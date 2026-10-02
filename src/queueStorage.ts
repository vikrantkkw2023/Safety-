import AsyncStorage from "@react-native-async-storage/async-storage";
import { parseSyncQueue, serializeSyncQueue, type SyncOperation, SYNC_QUEUE_KEY } from "./syncQueue";

export async function loadSyncQueue(): Promise<SyncOperation[]> {
  return parseSyncQueue(await AsyncStorage.getItem(SYNC_QUEUE_KEY));
}

export async function saveSyncQueue(queue: SyncOperation[]): Promise<void> {
  await AsyncStorage.setItem(SYNC_QUEUE_KEY, serializeSyncQueue(queue));
}
