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

export async function createEmailAccount(email: string, password: string, redirectTo?: string) {
  const client = configuredClient();
  return client.auth.signUp({
    email,
    password,
    options: redirectTo ? { emailRedirectTo: redirectTo } : undefined,
  });
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

export async function findIncidentByLocalId(userId: string, localId: string) {
  const client = configuredClient();
  const { data, error } = await client
    .from("emergency_incidents")
    .select("*")
    .eq("user_id", userId)
    .eq("client_local_id", localId)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as IncidentRecord | null;
}

export async function createIncident(
  userId: string,
  incident: Pick<IncidentRecord, "latitude" | "longitude" | "accuracy" | "started_at"> & { client_local_id?: string }
) {
  const client = configuredClient();
  const { data, error } = await client
    .from("emergency_incidents")
    .insert({
      user_id: userId,
      client_local_id: incident.client_local_id,
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


export async function findContactByPhone(userId: string, phone: string) {
  const client = configuredClient();
  const { data, error } = await client
    .from("emergency_contacts")
    .select("*")
    .eq("user_id", userId)
    .eq("phone", phone)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as ContactRecord | null;
}

export async function createContact(
  userId: string,
  contact: Omit<ContactRecord, "id" | "user_id">
) {
  const client = configuredClient();
  const { data, error } = await client
    .from("emergency_contacts")
    .insert({ user_id: userId, ...contact })
    .select()
    .single();

  if (error) throw error;
  return data as ContactRecord;
}

export async function updateIncidentStatus(
  userId: string,
  incidentId: string,
  status: IncidentRecord["status"],
  endedAt: string | null
) {
  const client = configuredClient();
  const { data, error } = await client
    .from("emergency_incidents")
    .update({ status, ended_at: endedAt })
    .eq("id", incidentId)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw error;
  return data as IncidentRecord;
}


export async function getActiveIncident(userId: string) {
  const client = configuredClient();
  const { data, error } = await client
    .from("emergency_incidents")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "ACTIVE")
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as IncidentRecord | null;
}

export async function listProfile(userId: string) {
  const client = configuredClient();
  const { data, error } = await client
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as ProfileRecord | null;
}


export function isBackendError(error: unknown): boolean {
  return Boolean(error);
}

export async function syncContactIfAuthenticated(
  userId: string,
  contact: Omit<ContactRecord, "id" | "user_id">
) {
  return createContact(userId, contact);
}

export async function syncProfileIfAuthenticated(
  userId: string,
  profile: Omit<ProfileRecord, "id">
) {
  return upsertProfile(userId, profile);
}


export async function getSession() {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export function onAuthStateChange(callback: Parameters<SupabaseClient["auth"]["onAuthStateChange"]>[0]) {
  if (!supabase) return { data: { subscription: { unsubscribe: () => undefined } } };
  return supabase.auth.onAuthStateChange(callback);
}
