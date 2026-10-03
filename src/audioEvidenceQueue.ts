import AsyncStorage from "@react-native-async-storage/async-storage";

export type PendingAudioEvidence = {
  id: string;
  incidentId: string;
  storagePath: string;
  localUri: string;
  startedAt: string;
  endedAt: string;
  evidenceId?: string;
  attempts: number;
  createdAt: string;
};

const KEY = "safety.pendingAudioEvidence.v1";
const MAX_ITEMS = 20;

export async function loadPendingAudioEvidence(): Promise<PendingAudioEvidence[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is PendingAudioEvidence =>
        item &&
        typeof item.id === "string" &&
        typeof item.incidentId === "string" &&
        typeof item.storagePath === "string" &&
        typeof item.localUri === "string" &&
        typeof item.startedAt === "string" &&
        typeof item.endedAt === "string" &&
        typeof item.attempts === "number" &&
        typeof item.createdAt === "string"
      )
      .slice(-MAX_ITEMS);
  } catch {
    return [];
  }
}

export async function savePendingAudioEvidence(items: PendingAudioEvidence[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(items.slice(-MAX_ITEMS)));
}

export async function enqueuePendingAudioEvidence(item: PendingAudioEvidence) {
  const items = await loadPendingAudioEvidence();
  const withoutDuplicate = items.filter((existing) => existing.id !== item.id);
  await savePendingAudioEvidence([...withoutDuplicate, item]);
}

export async function removePendingAudioEvidence(id: string) {
  const items = await loadPendingAudioEvidence();
  await savePendingAudioEvidence(items.filter((item) => item.id !== id));
}
