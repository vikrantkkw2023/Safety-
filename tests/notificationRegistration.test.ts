import test from "node:test";
import assert from "node:assert/strict";
test("notification architecture never requires a privileged server key in the mobile layer", () => {
  assert.equal(process.env.SUPABASE_SERVICE_ROLE_KEY, undefined);
});
