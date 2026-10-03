import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";

export type LiveLocation = {
  incidentId: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  recordedAt: string;
};

export const BACKGROUND_LOCATION_TASK = "safety-active-sos-location";
const ACTIVE_INCIDENT_KEY = "safety.activeIncident.v1";

async function publishLiveLocation(incidentId: string, location: Location.LocationObject) {
  if (!supabase) return false;
  const { error } = await supabase.from("incident_live_locations").upsert({
    incident_id: incidentId,
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracy: location.coords.accuracy ?? null,
    recorded_at: new Date(location.timestamp).toISOString(),
  });
  if (error) throw error;
  return true;
}

if (!TaskManager.isTaskDefined(BACKGROUND_LOCATION_TASK)) {
  TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
    if (error) {
      console.error("Background SOS location task failed", error);
      return;
    }

    const saved = await AsyncStorage.getItem(ACTIVE_INCIDENT_KEY);
    if (!saved) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK).catch(() => undefined);
      return;
    }

    let incident: { id?: unknown; status?: unknown } | null = null;
    try {
      incident = JSON.parse(saved);
    } catch {
      await AsyncStorage.removeItem(ACTIVE_INCIDENT_KEY);
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK).catch(() => undefined);
      return;
    }

    if (typeof incident?.id !== "string" || incident.status !== "ACTIVE") {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK).catch(() => undefined);
      return;
    }

    const locations =
      data && typeof data === "object" && "locations" in data
        ? (data as { locations?: Location.LocationObject[] }).locations ?? []
        : [];

    const latest = locations.at(-1);
    if (!latest) return;

    try {
      await publishLiveLocation(incident.id, latest);
    } catch (publishError) {
      console.error("Background SOS location publish failed", publishError);
    }
  });
}

export async function startLiveLocation(incidentId: string) {
  await AsyncStorage.setItem(ACTIVE_INCIDENT_KEY, JSON.stringify({ id: incidentId, status: "ACTIVE" }));
  const foreground = await Location.getForegroundPermissionsAsync();
  if (foreground.status !== "granted") {
    throw new Error("LOCATION_PERMISSION_DENIED");
  }

  const background = await Location.requestBackgroundPermissionsAsync();
  if (background.status !== "granted") {
    throw new Error("BACKGROUND_LOCATION_PERMISSION_DENIED");
  }

  const registered = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  if (registered) {
    await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  }

  await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
    accuracy: Location.Accuracy.High,
    timeInterval: 5000,
    distanceInterval: 10,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "Safety SOS is active",
      notificationBody: "Your emergency location is being shared with your trusted contacts.",
      notificationColor: "#D92D20",
    },
  });
}

export async function stopLiveLocation() {
  await AsyncStorage.removeItem(ACTIVE_INCIDENT_KEY);
  const registered = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  if (registered) {
    await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  }
}
