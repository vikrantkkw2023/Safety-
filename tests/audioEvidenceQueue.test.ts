import test from "node:test";
import assert from "node:assert/strict";
import {
  enqueuePendingAudioEvidence,
  loadPendingAudioEvidence,
  removePendingAudioEvidence,
} from "../src/audioEvidenceQueue";

test("audio evidence queue persists and removes pending uploads", async () => {
  const item = {
    id: "AUDIO-1",
    incidentId: "INC-1",
    storagePath: "user/incident/audio.m4a",
    localUri: "file:///audio.m4a",
    startedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
    attempts: 1,
    createdAt: new Date().toISOString(),
  };

  await enqueuePendingAudioEvidence(item);
  const queued = await loadPendingAudioEvidence();
  assert.equal(queued.length, 1);
  assert.equal(queued[0]?.id, "AUDIO-1");

  await removePendingAudioEvidence("AUDIO-1");
  assert.equal((await loadPendingAudioEvidence()).length, 0);
});
