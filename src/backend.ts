import type { SupabaseClient, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export type ProfileRecord = {
  id: string;
  name: string;
  country_code: string;
  phone: string;
};

export type ContactRecord = {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  relationship: string | null;
  country_code: string | null;
};

export type IncidentRecord = {
  id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  started_at: string;
  ended_at: string | null;
  status: "ACTIVE" | "CANCELLED" | "RESOLVED";
};

function configuredClient(): SupabaseClient {
  if (!supabase) {
    throw new Error("SUPABASE_NOT_CONFIGURED");
  }
  return supabase;
}

export async function getCurrentUser(): Promise<User | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user;
}

export async function createEmailAccount(email: string, password: string) {
  const client = configuredClient();
  return client.auth.signUp({ email, password });
}

export async function signInEmailAccount(email: string, password: string) {
  const client = configuredClient();
  return client.auth.signInWithPassword({ email, password });
}

export async function signOutAccount() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function upsertProfile(userId: string, profile: Omit<ProfileRecord, "id">) {
  const client = configuredClient();
  const { data, error } = await client
    .from("profiles")
    .upsert({ id: userId, ...profile }, { onConflict: "id" })
    .select()
    .single();

  if (error) throw error;
  return data as ProfileRecord;
}

export async function listContacts(userId: string) {
  const client = configuredClient();
  const { data, error } = await client
    .from("emergency_contacts")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as ContactRecord[];
}

export async function createIncident(
  userId: string,
  incident: Pick<IncidentRecord, "latitude" | "longitude" | "accuracy" | "started_at">
) {
  const client = configuredClient();
  const { data, error } = await client
    .from("emergency_incidents")
    .insert({
      user_id: userId,
      latitude: incident.latitude,
      longitude: incident.longitude,
      accuracy: incident.accuracy,
      started_at: incident.started_at,
      status: "ACTIVE",
    })
    .select()
    .single();

  if (error) throw error;
  return data as IncidentRecord;
}
