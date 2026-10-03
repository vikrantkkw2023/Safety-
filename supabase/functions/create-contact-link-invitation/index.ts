import { withSupabase } from "npm:@supabase/server@1";

async function hash(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function token() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let raw = "";
  for (const b of bytes) raw += String.fromCharCode(b);
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    try {
      const { data } = await ctx.supabase.auth.getUser();
      const ownerId = data.user?.id;
      if (!ownerId) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
      const body = await req.json().catch(() => null);
      const contactId = body?.contact_id;
      if (typeof contactId !== "string") return Response.json({ error: "INVALID_CONTACT" }, { status: 400 });

      const { data: contact } = await ctx.supabaseAdmin
        .from("emergency_contacts")
        .select("id,user_id,linked_user_id")
        .eq("id", contactId)
        .eq("user_id", ownerId)
        .maybeSingle();

      if (!contact) return Response.json({ error: "CONTACT_NOT_FOUND" }, { status: 404 });
      if (contact.linked_user_id) return Response.json({ error: "CONTACT_ALREADY_LINKED" }, { status: 409 });

      const rawToken = token();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const { error } = await ctx.supabaseAdmin.from("contact_link_invitations").insert({
        contact_id: contact.id,
        owner_user_id: ownerId,
        token_hash: await hash(rawToken),
        expires_at: expiresAt,
      });

      if (error) throw error;
      return Response.json({ ok: true, token: rawToken, expires_at: expiresAt });
    } catch (error) {
      console.error("create-contact-link-invitation failed", error);
      return Response.json({ error: "INVITATION_CREATE_FAILED" }, { status: 500 });
    }
  }),
};
