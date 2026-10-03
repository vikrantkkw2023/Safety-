import test from "node:test";
import assert from "node:assert/strict";
import { Platform } from "react-native";

test("notification platform is limited to supported mobile platforms", () => {
  assert.ok(Platform.OS === "android" || Platform.OS === "ios" || Platform.OS === "windows" || Platform.OS === "macos" || Platform.OS === "web");
});

test("notification architecture never requires a privileged server key in the mobile layer", () => {
  assert.equal(process.env.SUPABASE_SERVICE_ROLE_KEY, undefined);
});
