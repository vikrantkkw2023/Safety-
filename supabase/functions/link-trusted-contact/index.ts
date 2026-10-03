import { withSupabase } from "npm:@supabase/server@1";

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    try {
      const { data } = await ctx.supabase.auth.getUser();
      const userId = data.user?.id;
      if (!userId) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });

      // Legacy direct-link endpoint is intentionally disabled. Use the one-time invitation flow.
      return Response.json({ error: "INVITATION_REQUIRED" }, { status: 410 });
      /*
      const body = await req.json().catch(() => null);
      const contactId = body?.contact_id;
      const linkedUserId = body?.linked_user_id;

      if (typeof contactId !== "string" || typeof linkedUserId !== "string") {
        return Response.json({ error: "INVALID_REQUEST" }, { status: 400 });
      }
      if (linkedUserId === userId) {
        return Response.json({ error: "SELF_LINK_NOT_ALLOWED" }, { status: 400 });
      }

      const { data: contact } = await ctx.supabaseAdmin
        .from("emergency_contacts")
        .select("id,phone,user_id")
        .eq("id", contactId)
        .eq("user_id", userId)
        .maybeSingle();

      if (!contact) return Response.json({ error: "CONTACT_NOT_FOUND" }, { status: 404 });

      const { data: recipient } = await ctx.supabaseAdmin
        .from("profiles")
        .select("id,phone")
        .eq("id", linkedUserId)
        .maybeSingle();

      if (!recipient || recipient.phone !== contact.phone) {
        return Response.json({ error: "PHONE_MISMATCH" }, { status: 403 });
      }

      const { error } = await ctx.supabaseAdmin
        .from("emergency_contacts")
        .update({ linked_user_id: linkedUserId })
        .eq("id", contact.id)
        .eq("user_id", userId);

      if (error) throw error;
      return Response.json({ ok: true, contact_id: contact.id, linked_user_id: linkedUserId });
      */
    } catch (error) {
      console.error("link-trusted-contact failed", error);
      return Response.json({ error: "LINK_FAILED" }, { status: 500 });
    }
  }),
};
