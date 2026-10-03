import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { getCurrentUser, upsertNotificationDevice } from "./backend";
import { isSupabaseConfigured } from "./supabase";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export type NotificationRegistrationResult =
  | { registered: true; token: string }
  | { registered: false; reason: "NOT_CONFIGURED" | "NO_SESSION" | "PERMISSION_DENIED" | "UNAVAILABLE" };

export async function registerNotificationDevice(): Promise<NotificationRegistrationResult> {
  if (Platform.OS !== "android" && Platform.OS !== "ios") return { registered: false, reason: "UNAVAILABLE" };
  if (!isSupabaseConfigured) return { registered: false, reason: "NOT_CONFIGURED" };

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("sos", {
      name: "Safety SOS",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      sound: "default",
    });
  }

  const user = await getCurrentUser();
  if (!user?.id) return { registered: false, reason: "NO_SESSION" };

  const permissions = await Notifications.getPermissionsAsync();
  let finalStatus = permissions.status;

  if (finalStatus !== "granted") {
    const requested = await Notifications.requestPermissionsAsync();
    finalStatus = requested.status;
  }

  if (finalStatus !== "granted") {
    return { registered: false, reason: "PERMISSION_DENIED" };
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return { registered: false, reason: "UNAVAILABLE" };

  let tokenResult: Notifications.ExpoPushToken;
  try {
    tokenResult = await Notifications.getExpoPushTokenAsync({ projectId });
  } catch (error) {
    console.error("Push token registration failed", error);
    return { registered: false, reason: "UNAVAILABLE" };
  }
  const token = tokenResult.data;
  if (!token) return { registered: false, reason: "UNAVAILABLE" };

  const platform = Platform.OS === "ios" ? "ios" : "android";
  await upsertNotificationDevice(user.id, {
    expo_push_token: token,
    platform,
  });

  return { registered: true, token };
}
