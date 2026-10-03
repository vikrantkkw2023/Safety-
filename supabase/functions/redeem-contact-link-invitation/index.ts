import { withSupabase } from "npm:@supabase/server@1";

async function hash(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    try {
      const { data } = await ctx.supabase.auth.getUser();
      const recipientId = data.user?.id;
      if (!recipientId) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });

      const body = await req.json().catch(() => null);
      const rawToken = body?.token;
      if (typeof rawToken !== "string" || rawToken.length < 20 || rawToken.length > 256) {
        return Response.json({ error: "INVALID_TOKEN" }, { status: 400 });
      }

      const tokenHash = await hash(rawToken);
      const { data: invitation } = await ctx.supabaseAdmin
        .from("contact_link_invitations")
        .select("id,contact_id,owner_user_id,expires_at,consumed_at")
        .eq("token_hash", tokenHash)
        .maybeSingle();

      if (!invitation || invitation.consumed_at || new Date(invitation.expires_at).getTime() <= Date.now()) {
        return Response.json({ error: "INVITATION_INVALID_OR_EXPIRED" }, { status: 403 });
      }
      if (invitation.owner_user_id === recipientId) {
        return Response.json({ error: "SELF_LINK_NOT_ALLOWED" }, { status: 400 });
      }

      const { data: recipient } = await ctx.supabaseAdmin
        .from("profiles")
        .select("id,phone")
        .eq("id", recipientId)
        .maybeSingle();

      const { data: contact } = await ctx.supabaseAdmin
        .from("emergency_contacts")
        .select("id,user_id,phone,linked_user_id")
        .eq("id", invitation.contact_id)
        .eq("user_id", invitation.owner_user_id)
        .maybeSingle();

      if (!recipient || !contact || contact.linked_user_id) {
        return Response.json({ error: "CONTACT_LINK_UNAVAILABLE" }, { status: 409 });
      }
      if (recipient.phone !== contact.phone) {
        return Response.json({ error: "PHONE_MISMATCH" }, { status: 403 });
      }

      const { data: contactId, error: redeemError } = await ctx.supabaseAdmin
        .rpc("redeem_contact_link_invitation", {
          p_token_hash: tokenHash,
          p_recipient_user_id: recipientId,
        });

      if (redeemError) {
        const message = typeof redeemError.message === "string" ? redeemError.message : "";
        if (message.includes("INVITATION_INVALID_OR_EXPIRED")) {
          return Response.json({ error: "INVITATION_INVALID_OR_EXPIRED" }, { status: 403 });
        }
        if (message.includes("SELF_LINK_NOT_ALLOWED")) {
          return Response.json({ error: "SELF_LINK_NOT_ALLOWED" }, { status: 400 });
        }
        if (message.includes("PHONE_MISMATCH")) {
          return Response.json({ error: "PHONE_MISMATCH" }, { status: 403 });
        }
        if (message.includes("CONTACT_LINK_UNAVAILABLE")) {
          return Response.json({ error: "CONTACT_LINK_UNAVAILABLE" }, { status: 409 });
        }
        throw redeemError;
      }

      return Response.json({ ok: true, contact_id: contactId });
    } catch (error) {
      console.error("redeem-contact-link-invitation failed", error);
      return Response.json({ error: "INVITATION_REDEEM_FAILED" }, { status: 500 });
    }
  }),
};
