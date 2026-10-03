import { Platform } from "react-native";
import { getCurrentUser, upsertNotificationDevice } from "./backend";
import { isSupabaseConfigured } from "./supabase";

export type NotificationRegistrationResult =
  | { registered: true; token: string }
  | { registered: false; reason: "NOT_CONFIGURED" | "NO_SESSION" | "PERMISSION_DENIED" | "UNAVAILABLE" };

export async function registerNotificationDevice(
  getToken: () => Promise<string | null>,
): Promise<NotificationRegistrationResult> {
  if (!isSupabaseConfigured) return { registered: false, reason: "NOT_CONFIGURED" };

  const user = await getCurrentUser();
  if (!user?.id) return { registered: false, reason: "NO_SESSION" };

  const token = await getToken();
  if (!token) return { registered: false, reason: "UNAVAILABLE" };

  const platform = Platform.OS === "ios" ? "ios" : "android";
  await upsertNotificationDevice(user.id, {
    expo_push_token: token,
    platform,
  });

  return { registered: true, token };
}
