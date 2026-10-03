import { createClient } from "npm:@supabase/supabase-js@2";

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sha256(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function makeToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return bytesToBase64Url(bytes);
}

export default {
  async fetch(req: Request) {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) return Response.json({ error: "NOT_CONFIGURED" }, { status: 503 });

    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data: userData } = await admin.auth.getUser(auth.slice(7));
    const user = userData.user;
    if (!user) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const body = await req.json().catch(() => null);
    const incidentId = body?.incident_id;
    if (typeof incidentId !== "string" || incidentId.length > 128) {
      return Response.json({ error: "INVALID_INCIDENT" }, { status: 400 });
    }

    const { data: incident } = await admin
      .from("emergency_incidents")
      .select("id,status,user_id")
      .eq("id", incidentId)
      .eq("user_id", user.id)
      .eq("status", "ACTIVE")
      .maybeSingle();

    if (!incident) return Response.json({ error: "ACTIVE_INCIDENT_NOT_FOUND" }, { status: 404 });

    const token = makeToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const { error } = await admin.from("incident_access_tokens").insert({
      incident_id: incident.id,
      token_hash: await sha256(token),
      expires_at: expiresAt,
    });

    if (error) return Response.json({ error: "TOKEN_CREATE_FAILED" }, { status: 500 });
    return Response.json({ token, expires_at: expiresAt });
  },
};
