import { createClient } from "npm:@supabase/supabase-js@2";

const EXPO_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "UNAUTHORIZED" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: "SERVER_NOT_CONFIGURED" }, 500);

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return json({ error: "UNAUTHORIZED" }, 401);

  const admin = createClient(supabaseUrl, serviceRoleKey);

  const { data: deliveries, error: deliveryError } = await admin
    .from("notification_deliveries")
    .select("id, provider_ticket_id, incident_id, device_id")
    .eq("status", "SENT")
    .is("receipt_checked_at", null)
    .not("provider_ticket_id", "is", null)
    .order("created_at", { ascending: true })
    .limit(100);

  if (deliveryError) return json({ error: deliveryError.message }, 500);

  const authorized = [];
  for (const delivery of deliveries ?? []) {
    const { data: incident } = await admin
      .from("emergency_incidents")
      .select("user_id")
      .eq("id", delivery.incident_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (incident) authorized.push(delivery);
  }

  if (!authorized.length) return json({ ok: true, checked: 0 });

  const ticketIds = authorized.map((d) => d.provider_ticket_id).filter((id): id is string => Boolean(id));
  const response = await fetch(EXPO_RECEIPTS_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ids: ticketIds }),
  });

  if (!response.ok) return json({ error: "EXPO_RECEIPT_REQUEST_FAILED" }, 502);
  const payload = await response.json() as {
    data?: Record<string, { status?: string; message?: string; details?: { error?: string } }>;
  };

  let checked = 0;
  let failed = 0;
  let removedDevices = 0;

  for (const delivery of authorized) {
    const ticketId = delivery.provider_ticket_id;
    if (!ticketId) continue;
    const receipt = payload.data?.[ticketId];
    if (!receipt) continue;

    const errorCode = receipt.details?.error ?? "";
    const errorMessage = receipt.message ?? (errorCode || null);
    const isError = receipt.status === "error";

    await admin.from("notification_deliveries").update({
      receipt_checked_at: new Date().toISOString(),
      receipt_error: errorMessage,
      status: isError ? "FAILED" : "SENT",
      updated_at: new Date().toISOString(),
    }).eq("id", delivery.id);

    checked++;
    if (isError) failed++;

    if (errorCode === "DeviceNotRegistered" || errorCode === "InvalidCredentials") {
      await admin.from("notification_devices").delete().eq("id", delivery.device_id);
      removedDevices++;
    }
  }

  return json({ ok: true, checked, failed, removedDevices });
});
