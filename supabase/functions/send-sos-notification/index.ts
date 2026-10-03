import { withSupabase } from "npm:@supabase/server@1";

type ExpoTicket = { status: "ok" | "error"; id?: string; message?: string; details?: unknown };

export default {
  fetch: withSupabase({ auth: "user" }, async (_req, ctx) => {
    try {
      const { data: authData, error: authError } = await ctx.supabase.auth.getUser();
      if (authError || !authData.user) {
        return Response.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
      }

      const body = await _req.json().catch(() => null);
      const incidentId = body && typeof body.incident_id === "string" ? body.incident_id : "";
      if (!incidentId || incidentId.length > 128) {
        return Response.json({ ok: false, error: "INVALID_INCIDENT_ID" }, { status: 400 });
      }

      const { data: incident, error: incidentError } = await ctx.supabaseAdmin
        .from("emergency_incidents")
        .select("id,user_id,status,started_at")
        .eq("user_id", authData.user.id)
        .eq(incidentId ? "id" : "client_local_id", incidentId || clientLocalId)
        .maybeSingle();

      if (incidentError) throw incidentError;
      if (!incident || incident.status !== "ACTIVE") {
        return Response.json({ ok: false, error: "ACTIVE_INCIDENT_NOT_FOUND" }, { status: 404 });
      }

      const { data: contacts, error: contactsError } = await ctx.supabaseAdmin
        .from("emergency_contacts")
        .select("id,name,phone,linked_user_id")
        .eq("user_id", authData.user.id);

      if (contactsError) throw contactsError;
      if (!contacts?.length) return Response.json({ ok: true, sent: 0 });

      const recipientIds = [...new Set(
        (contacts ?? [])
          .map((contact) => contact.linked_user_id)
          .filter((id): id is string => typeof id === "string" && id !== authData.user.id),
      )];

      if (!recipientIds.length) return Response.json({ ok: true, sent: 0, skipped: 0 });

      const grantExpiry = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
      const grantRows = recipientIds.map((recipientUserId) => ({
        incident_id: incident.id,
        recipient_user_id: recipientUserId,
        expires_at: grantExpiry,
        revoked_at: null,
      }));
      const { error: grantError } = await ctx.supabaseAdmin
        .from("incident_access_grants")
        .upsert(grantRows, { onConflict: "incident_id,recipient_user_id" });
      if (grantError) throw grantError;

      const { data: devices, error: devicesError } = await ctx.supabaseAdmin
        .from("notification_devices")
        .select("id,user_id,expo_push_token")
        .in("user_id", recipientIds);

      if (devicesError) throw devicesError;
      if (!devices?.length) return Response.json({ ok: true, sent: 0 });

      const { data: alreadySent, error: sentError } = await ctx.supabaseAdmin
        .from("notification_deliveries")
        .select("device_id")
        .eq("incident_id", incident.id);

      if (sentError) throw sentError;
      const sentDeviceIds = new Set((alreadySent ?? []).map((row) => row.device_id));
      const pending = devices.filter((device) => !sentDeviceIds.has(device.id) && device.expo_push_token);

      if (!pending.length) return Response.json({ ok: true, sent: 0, skipped: devices.length });

      const messages = pending.map((device) => ({
        to: device.expo_push_token,
        sound: "default",
        title: "Safety SOS",
        body: "A trusted contact has activated an SOS. Open Safety to view the emergency.",
        data: { incidentId: incident.id, type: "SOS_ACTIVE" },
      }));

      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(messages),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`EXPO_PUSH_HTTP_${response.status}: ${text.slice(0, 500)}`);
      }

      const result = (await response.json()) as { data?: ExpoTicket[] };
      const tickets = result.data ?? [];

      const deliveryRows = pending.map((device, index) => {
        const ticket = tickets[index];
        return {
          incident_id: incident.id,
          device_id: device.id,
          status: ticket?.status === "ok" ? "SENT" : "FAILED",
          provider_ticket_id: ticket?.id ?? null,
          error_message: ticket?.message ?? null,
        };
      });

      const { error: deliveryError } = await ctx.supabaseAdmin
        .from("notification_deliveries")
        .upsert(deliveryRows, { onConflict: "incident_id,device_id" });

      if (deliveryError) throw deliveryError;

      const staleDeviceIds = pending
        .filter((device, index) => {
          const ticket = tickets[index];
          return ticket?.status === "error" &&
            typeof ticket.message === "string" &&
            /DeviceNotRegistered|InvalidCredentials/i.test(ticket.message);
        })
        .map((device) => device.id);

      if (staleDeviceIds.length) {
        await ctx.supabaseAdmin
          .from("notification_devices")
          .delete()
          .in("id", staleDeviceIds);
      }

      return Response.json({
        ok: true,
        sent: deliveryRows.filter((row) => row.status === "SENT").length,
        failed: deliveryRows.filter((row) => row.status === "FAILED").length,
      });
    } catch (error) {
      console.error("send-sos-notification failed", error);
      return Response.json({ ok: false, error: "NOTIFICATION_FAILED" }, { status: 500 });
    }
  }),
};
