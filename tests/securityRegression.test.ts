import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function read(path: string) {
  return readFile(path, "utf8");
}

test("mobile bundle never contains a Supabase service-role secret", async () => {
  const app = await read("src/supabase.ts");
  const sourceFiles = [
    app,
    await read("App.tsx"),
    await read("src/backend.ts"),
  ].join("\n");

  assert.equal(sourceFiles.includes("SUPABASE_SERVICE_ROLE_KEY"), false);
  assert.equal(sourceFiles.includes("service_role"), false);
});

test("database does not allow deletion of active incidents through owner RLS", async () => {
  const sql = await read("database/mvp1.sql");
  assert.match(sql, /create policy "incidents owner delete resolved"/);
  assert.match(sql, /status <> 'ACTIVE'/);
  assert.doesNotMatch(sql, /create policy "incidents own rows"[\s\S]*for all/);
});

test("database revokes recipient access when an incident ends", async () => {
  const sql = await read("database/mvp1.sql");
  assert.match(sql, /create or replace function public\.revoke_incident_access_on_end/);
  assert.match(sql, /old\.status = 'ACTIVE' and new\.status <> 'ACTIVE'/);
  assert.match(sql, /update public\.incident_access_grants/);
});

test("native background capabilities are explicitly configured", async () => {
  const appJson = JSON.parse(await read("app.json"));
  const plugins = appJson.expo.plugins as unknown[];
  const locationPlugin = plugins.find(
    (plugin) => Array.isArray(plugin) && plugin[0] === "expo-location",
  ) as unknown[] | undefined;
  const audioPlugin = plugins.find(
    (plugin) => Array.isArray(plugin) && plugin[0] === "expo-audio",
  ) as unknown[] | undefined;

  assert.equal(Boolean(locationPlugin), true);
  assert.equal(Boolean(audioPlugin), true);
  assert.equal((locationPlugin?.[1] as Record<string, unknown>)?.isAndroidBackgroundLocationEnabled, true);
  assert.equal((locationPlugin?.[1] as Record<string, unknown>)?.isIosBackgroundLocationEnabled, true);
  assert.equal((audioPlugin?.[1] as Record<string, unknown>)?.enableBackgroundRecording, true);
});


test("database enforces a one-way incident lifecycle", async () => {
  const sql = await read("database/mvp1.sql");
  assert.match(sql, /create or replace function public\.enforce_incident_lifecycle/);
  assert.match(sql, /old\.status <> 'ACTIVE'/);
  assert.match(sql, /INCIDENT_ALREADY_ENDED/);
  assert.match(sql, /INCIDENT_IMMUTABLE_FIELDS/);
});


test("versioned migration safely recreates named policies", async () => {
  const sql = await read("supabase/migrations/20261003_000001_initial_safety.sql");
  const policies = [...sql.matchAll(/create policy "([^"]+)"/g)].map((match) => match[1]);
  for (const policy of policies) {
    assert.equal(sql.includes(`drop policy if exists "${policy}"`), true);
  }
});


test("receipt worker is not exposed through Supabase JWT auth", async () => {
  const config = await read("supabase/config.toml");
  assert.match(config, /\[functions\.check-notification-receipts\]\s*verify_jwt = false/);
});

test("receipt worker is scheduled through the protected maintenance workflow", async () => {
  const workflow = await read(".github/workflows/notification-receipts.yml");
  assert.match(workflow, /cron: "\*\/15 \* \* \* \*"/);
  assert.match(workflow, /x-safety-worker-secret/);
  assert.match(workflow, /SUPABASE_PROJECT_ID/);
});


test("Expo release config has both native application identifiers", async () => {
  const app = JSON.parse(await read("app.json"));
  assert.equal(app.expo.android.package, "com.safety.emergency");
  assert.equal(app.expo.ios.bundleIdentifier, "com.safety.emergency");
  assert.equal(app.expo.scheme, "safety");
});
