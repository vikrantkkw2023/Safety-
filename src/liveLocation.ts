import * as Location from "expo-location";
import { supabase } from "./supabase";

export type LiveLocation = {
  incidentId: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  recordedAt: string;
};

export async function publishLiveLocation(incidentId: string, location: Location.LocationObject) {
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

export async function startLiveLocation(
  incidentId: string,
  onUpdate?: (location: LiveLocation) => void,
) {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== "granted") throw new Error("LOCATION_PERMISSION_DENIED");

  const subscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      timeInterval: 5000,
      distanceInterval: 10,
    },
    (location) => {
      const value: LiveLocation = {
        incidentId,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy ?? null,
        recordedAt: new Date(location.timestamp).toISOString(),
      };
      onUpdate?.(value);
      void publishLiveLocation(incidentId, location).catch((error) =>
        console.error("Live location publish failed", error),
      );
    },
  );
  return subscription;
}
