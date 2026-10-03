import { createHash, randomBytes } from "node:crypto";
import { supabase } from "../../../src/supabase";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function makeToken() {
  return randomBytes(32).toString("base64url");
}

export default {
  async fetch(req: Request) {
    if (!supabase) return Response.json({ error: "NOT_CONFIGURED" }, { status: 503 });
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const { data: userData } = await supabase.auth.getUser(auth.slice(7));
    const user = userData.user;
    if (!user) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const body = await req.json().catch(() => null);
    const incidentId = body?.incident_id;
    if (typeof incidentId !== "string") return Response.json({ error: "INVALID_INCIDENT" }, { status: 400 });

    const { data: incident } = await supabase
      .from("emergency_incidents")
      .select("id,status,user_id")
      .eq("id", incidentId)
      .eq("user_id", user.id)
      .eq("status", "ACTIVE")
      .maybeSingle();

    if (!incident) return Response.json({ error: "ACTIVE_INCIDENT_NOT_FOUND" }, { status: 404 });

    const token = makeToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const { error } = await supabase.from("incident_access_tokens").insert({
      incident_id: incident.id,
      token_hash: hashToken(token),
      expires_at: expiresAt,
    });
    if (error) return Response.json({ error: "TOKEN_CREATE_FAILED" }, { status: 500 });

    return Response.json({ token, expires_at: expiresAt });
  },
};
