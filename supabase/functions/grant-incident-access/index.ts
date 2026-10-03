import { withSupabase } from "npm:@supabase/server@1";

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    try {
      const { data: authData } = await ctx.supabase.auth.getUser();
      const ownerId = authData.user?.id;
      if (!ownerId) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
      const body = await req.json().catch(() => null);
      const incidentId = body?.incident_id;
      const recipientUserId = body?.recipient_user_id;
      const expiresAt = body?.expires_at;
      if (typeof incidentId !== "string" || typeof recipientUserId !== "string" || typeof expiresAt !== "string")
        return Response.json({ error: "INVALID_REQUEST" }, { status: 400 });
      const expiry = new Date(expiresAt);
      if (!Number.isFinite(expiry.getTime()) || expiry.getTime() <= Date.now())
        return Response.json({ error: "INVALID_EXPIRY" }, { status: 400 });
      const maxExpiry = Date.now() + 2 * 60 * 60 * 1000;
      if (expiry.getTime() > maxExpiry)
        return Response.json({ error: "EXPIRY_TOO_FAR" }, { status: 400 });
      const { data: incident } = await ctx.supabaseAdmin.from("emergency_incidents").select("id,status,user_id").eq("id", incidentId).eq("user_id", ownerId).eq("status","ACTIVE").maybeSingle();
      if (!incident) return Response.json({ error: "ACTIVE_INCIDENT_NOT_FOUND" }, { status: 404 });
      const { data: contacts } = await ctx.supabaseAdmin.from("emergency_contacts").select("phone,linked_user_id").eq("user_id", ownerId);
      const trusted = contacts?.some((c) => c.linked_user_id === recipientUserId);
      if (!trusted)
        return Response.json({ error: "RECIPIENT_NOT_TRUSTED_CONTACT" }, { status: 403 });
      const { error } = await ctx.supabaseAdmin.from("incident_access_grants").upsert({incident_id:incidentId,recipient_user_id:recipientUserId,expires_at:expiry.toISOString(),revoked_at:null},{onConflict:"incident_id,recipient_user_id"});
      if (error) throw error;
      return Response.json({ok:true,incident_id:incidentId,recipient_user_id:recipientUserId,expires_at:expiry.toISOString()});
    } catch (error) { console.error(error); return Response.json({error:"GRANT_FAILED"},{status:500}); }
  }),
};
