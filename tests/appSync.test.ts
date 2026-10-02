import test from "node:test";
import assert from "node:assert/strict";
import { initializeBackendSync } from "../src/appSync";

test("backend sync initialization safely falls back when Supabase is not configured", async () => {
  const result = await initializeBackendSync();

  assert.equal(result.authenticated, false);
  assert.equal(result.syncedOperations, 0);
  assert.equal(result.queuedOperations >= 0, true);
});
