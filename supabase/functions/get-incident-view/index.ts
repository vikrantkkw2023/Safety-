import { withSupabase } from "npm:@supabase/server@1";

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    try {
      const { data: authData } = await ctx.supabase.auth.getUser();
      const recipientId = authData.user?.id;
      if (!recipientId) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
      const body = await req.json().catch(() => null);
      const incidentId = body?.incident_id;
      if (typeof incidentId !== "string" || incidentId.length > 128) return Response.json({error:"INVALID_INCIDENT_ID"},{status:400});
      const { data: grant } = await ctx.supabaseAdmin.from("incident_access_grants").select("incident_id,expires_at,revoked_at").eq("incident_id",incidentId).eq("recipient_user_id",recipientId).maybeSingle();
      if (!grant || grant.revoked_at || new Date(grant.expires_at).getTime() <= Date.now()) return Response.json({error:"ACCESS_DENIED"},{status:403});
      const { data: incident } = await ctx.supabaseAdmin.from("emergency_incidents").select("id,status,started_at,latitude,longitude,accuracy,user_id").eq("id",incidentId).maybeSingle();
      if (!incident) return Response.json({error:"INCIDENT_NOT_FOUND"},{status:404});
      const { data: owner } = await ctx.supabaseAdmin.from("profiles").select("name").eq("id",incident.user_id).maybeSingle();
      const { data: location } = await ctx.supabaseAdmin.from("incident_live_locations").select("latitude,longitude,accuracy,recorded_at").eq("incident_id",incidentId).maybeSingle();
      return Response.json({incident:{id:incident.id,status:incident.status,started_at:incident.started_at,latitude:incident.latitude,longitude:incident.longitude,accuracy:incident.accuracy,owner_name:owner?.name??null},latest_location:location??null});
    } catch (error) { console.error(error); return Response.json({error:"INCIDENT_VIEW_FAILED"},{status:500}); }
  }),
};
