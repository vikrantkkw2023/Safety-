import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Linking,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as Location from "expo-location";
import * as SMS from "expo-sms";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { isDuplicatePhone, isValidActiveIncident, isValidPhone, normalizePhone } from "./src/safetyRules";

type Contact = {
  id: string;
  name: string;
  phone: string;
  relationship: string;
};

type Incident = {
  id: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  startedAt: string;
  status: "ACTIVE" | "RESOLVED";
};

const CONTACTS_KEY = "safety.contacts.v1";
const INCIDENT_KEY = "safety.activeIncident.v1";

// TEST-ONLY emergency service placeholder. This is intentionally invalid and
// must never be dialed or messaged. Replace only after the emergency workflow
// is fully tested and an authorized production integration is approved.
const TEST_EMERGENCY_NUMBER = "+00 000 000 0000";

function mapsUrl(lat: number, lon: number) {
  return `https://maps.google.com/?q=${lat},${lon}`;
}

export default function App() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [activeIncident, setActiveIncident] = useState<Incident | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [screen, setScreen] = useState<"home" | "contacts" | "about">("home");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [relationship, setRelationship] = useState("");
  const [busy, setBusy] = useState(false);
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [savedContacts, savedIncident] = await Promise.all([
          AsyncStorage.getItem(CONTACTS_KEY),
          AsyncStorage.getItem(INCIDENT_KEY),
        ]);

        if (!mounted) return;

        if (savedContacts) {
          try {
            const parsed = JSON.parse(savedContacts);
            if (Array.isArray(parsed)) {
              const validContacts = parsed.filter(
                (item): item is Contact =>
                  item &&
                  typeof item.id === "string" &&
                  typeof item.name === "string" &&
                  typeof item.phone === "string" &&
                  typeof item.relationship === "string"
              );
              setContacts(validContacts);
            }
          } catch (error) {
            console.error("Invalid saved contacts", error);
            await AsyncStorage.removeItem(CONTACTS_KEY);
          }
        }

        if (savedIncident) {
          try {
            const parsed = JSON.parse(savedIncident);
            const validIncident = isValidActiveIncident(parsed);
            if (validIncident) setActiveIncident(parsed);
            else await AsyncStorage.removeItem(INCIDENT_KEY);
          } catch (error) {
            console.error("Invalid saved incident", error);
            await AsyncStorage.removeItem(INCIDENT_KEY);
          }
        }
      } catch (error) {
        console.error("Storage initialization failed", error);
        if (mounted) {
          Alert.alert("Storage error", "Saved Safety data could not be loaded. You can continue, but local data may not be available.");
        }
      } finally {
        if (mounted) setStorageReady(true);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    AsyncStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts)).catch((error) => {
      console.error("Could not save contacts", error);
    });
  }, [contacts, storageReady]);

  const locationText = useMemo(() => {
    if (!activeIncident) return "";
    return `${activeIncident.latitude.toFixed(6)}, ${activeIncident.longitude.toFixed(6)}`;
  }, [activeIncident]);

  const addContact = () => {
    const cleanName = name.trim();
    const cleanPhone = phone.trim().replace(/\s+/g, " ");
    if (!cleanName || !cleanPhone) {
      Alert.alert("Missing information", "Enter the contact name and phone number.");
      return;
    }
    const phoneDigits = normalizePhone(cleanPhone);
    if (!isValidPhone(cleanPhone)) {
      Alert.alert("Invalid phone number", "Enter a valid phone number with 7–15 digits.");
      return;
    }
    if (isDuplicatePhone(contacts.map((c) => c.phone), cleanPhone)) {
      Alert.alert("Already added", "This phone number is already a trusted contact.");
      return;
    }
    setContacts((current) => [
      ...current,
      {
        id: `${Date.now()}-${Math.random()}`,
        name: cleanName,
        phone: cleanPhone,
        relationship: relationship.trim() || "Trusted contact",
      },
    ]);
    setName("");
    setPhone("");
    setRelationship("");
  };

  const removeContact = (id: string) => {
    Alert.alert("Remove contact?", "This person will no longer receive SOS messages.", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => setContacts((c) => c.filter((x) => x.id !== id)) },
    ]);
  };

  const beginSOS = () => {
    if (!storageReady) {
      Alert.alert("Please wait", "Safety is still loading your saved data.");
      return;
    }
    if (activeIncident || busy || countdown !== null) return;
    if (contacts.length === 0) {
      Alert.alert("Add a trusted contact", "Please add at least one trusted contact before activating SOS.");
      setScreen("contacts");
      return;
    }
    setCountdown(5);
  };

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      setCountdown(null);
      activateSOS();
      return;
    }
    const timer = setTimeout(() => setCountdown((n) => (n === null ? null : n - 1)), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const activateSOS = async () => {
    setBusy(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert(
          "Location permission required",
          "Safety needs location permission to include your current location in an SOS. You can enable it in phone settings."
        );
        return;
      }

      const position = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("LOCATION_TIMEOUT")), 15000)),
      ]);

      const incident: Incident = {
        id: `SOS-${Date.now()}`,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy ?? undefined,
        startedAt: new Date().toISOString(),
        status: "ACTIVE",
      };

      await AsyncStorage.setItem(INCIDENT_KEY, JSON.stringify(incident));
      setActiveIncident(incident);

      // The incident is already active even if the device cannot prepare an SMS.
      // Do not turn an SMS failure into an SOS failure.
      try {
        await sendEmergencyMessages(incident);
      } catch (messageError) {
        console.error("Emergency message handoff failed", messageError);
        Alert.alert(
          "SOS active — message not completed",
          "Your emergency session is active, but the SMS handoff could not be completed. Call a trusted contact and share the location from this screen."
        );
      }
    } catch (error) {
      console.error(error);
      const message = error instanceof Error && error.message === "LOCATION_TIMEOUT"
        ? "Location took too long to respond. Check GPS/location services and try again."
        : "We could not obtain your location. Check location services and try again.";
      Alert.alert("SOS could not be completed", message);
    } finally {
      setBusy(false);
    }
  };

  const sendEmergencyMessages = async (incident: Incident) => {
    const body =
      "[TEST MODE] EMERGENCY SOS from my Safety app. I may need help. My current location is: " +
      mapsUrl(incident.latitude, incident.longitude) +
      ". Please contact me and seek appropriate emergency assistance if needed.";

    const available = await SMS.isAvailableAsync();
    if (!available) {
      Alert.alert(
        "SOS active",
        "SMS is not available on this device. Use the emergency screen to call a trusted contact and share the location."
      );
      return;
    }

    // The operating system controls final SMS sending. The app never silently sends messages.
    await SMS.sendSMSAsync(
      contacts.map((c) => c.phone),
      body
    );
  };

  const callContact = async (contact: Contact) => {
    try {
      const dialNumber = contact.phone.replace(/[^\d+]/g, "");
      await Linking.openURL(`tel:${dialNumber}`);
    } catch {
      Alert.alert("Call unavailable", "This device could not open the phone app.");
    }
  };

  const endSOS = async () => {
    if (!activeIncident) return;
    Alert.alert("End emergency?", "Only end SOS if you are safe.", [
      { text: "Keep SOS active", style: "cancel" },
      {
        text: "End emergency",
        style: "destructive",
        onPress: async () => {
          try {
            await AsyncStorage.removeItem(INCIDENT_KEY);
            setActiveIncident(null);
          } catch (error) {
            console.error(error);
            Alert.alert("Could not end SOS", "Please try again.");
          }
        },
      },
    ]);
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <View>
        <Text style={styles.brand}>SAFETY</Text>
        <Text style={styles.subtitle}>Emergency assistance</Text>
      </View>
      <TouchableOpacity style={styles.contactsButton} onPress={() => setScreen("contacts")}>
        <Text style={styles.contactsButtonText}>Contacts</Text>
      </TouchableOpacity>
    </View>
  );

  if (!storageReady) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.loadingScreen}>
          <Text style={styles.loadingTitle}>SAFETY</Text>
          <Text style={styles.descriptionCenter}>Loading your emergency settings…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (screen === "contacts") {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <ScrollView contentContainerStyle={styles.content}>
          {renderHeader()}
          <TouchableOpacity onPress={() => setScreen("home")} style={styles.backButton}>
            <Text style={styles.backText}>← Home</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Trusted contacts</Text>
          <Text style={styles.description}>
            These people can receive your SOS location message. Add only people you trust.
          </Text>

          <View style={styles.card}>
            <TextInput value={name} onChangeText={setName} placeholder="Name" style={styles.input} />
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="Phone number"
              keyboardType="phone-pad"
              style={styles.input}
            />
            <TextInput
              value={relationship}
              onChangeText={setRelationship}
              placeholder="Relationship (optional)"
              style={styles.input}
            />
            <TouchableOpacity style={styles.primaryButton} onPress={addContact}>
              <Text style={styles.primaryButtonText}>Add trusted contact</Text>
            </TouchableOpacity>
          </View>

          {contacts.map((contact) => (
            <View style={styles.contactRow} key={contact.id}>
              <View style={{ flex: 1 }}>
                <Text style={styles.contactName}>{contact.name}</Text>
                <Text style={styles.contactMeta}>{contact.relationship} · {contact.phone}</Text>
              </View>
              <TouchableOpacity onPress={() => removeContact(contact.id)}>
                <Text style={styles.removeText}>Remove</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (countdown !== null) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.countdownScreen}>
          <Text style={styles.warningTitle}>SOS ACTIVATING</Text>
          <Text style={styles.countdown}>{countdown}</Text>
          <Text style={styles.descriptionCenter}>
            Cancel if this was accidental.
          </Text>
          <TouchableOpacity style={styles.cancelButton} onPress={() => setCountdown(null)}>
            <Text style={styles.cancelText}>CANCEL SOS</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (activeIncident) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.activeBanner}>
            <Text style={styles.activeTitle}>SOS ACTIVE</Text>
            <Text style={styles.activeSubtitle}>Your emergency session is active. Location below was captured when SOS started.</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Current location</Text>
            <Text style={styles.location}>{locationText}</Text>
            <Text style={styles.smallText}>
              Accuracy: {activeIncident.accuracy != null ? `±${Math.round(activeIncident.accuracy)} m` : "not available"}
            </Text>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => Linking.openURL(mapsUrl(activeIncident.latitude, activeIncident.longitude))}
            >
              <Text style={styles.secondaryButtonText}>Open location in Maps</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Trusted contacts</Text>
            {contacts.map((contact) => (
              <View style={styles.contactRow} key={contact.id}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.contactName}>{contact.name}</Text>
                  <Text style={styles.contactMeta}>{contact.phone}</Text>
                </View>
                <TouchableOpacity style={styles.callButton} onPress={() => callContact(contact)}>
                  <Text style={styles.callText}>Call</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>

          <TouchableOpacity style={styles.endButton} onPress={endSOS}>
            <Text style={styles.endButtonText}>END EMERGENCY</Text>
          </TouchableOpacity>

          <Text style={styles.disclaimer}>
            This app does not guarantee police, ambulance, or other emergency response. If you are in immediate danger, use your device's official emergency calling service where available.
          </Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.content}>
        {renderHeader()}

        <View style={styles.hero}>
          <Text style={styles.title}>Need help?</Text>
          <Text style={styles.description}>
            Press SOS when you feel unsafe. Safety will capture your current location and prepare an emergency message for your trusted contacts.
          </Text>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Activate emergency SOS"
            disabled={busy}
            style={[styles.sosButton, busy && styles.disabled]}
            onPress={beginSOS}
          >
            <Text style={styles.sosText}>{busy ? "LOCATING..." : "SOS"}</Text>
            <Text style={styles.sosSubtext}>Emergency</Text>
          </TouchableOpacity>

          <Text style={styles.helper}>
            A 5-second cancellation window helps prevent accidental activation.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Before an emergency</Text>
          <Text style={styles.smallText}>
            • Add at least one trusted contact{"\n"}
            • Keep location services available{"\n"}
            • Make sure your phone can send SMS{"\n"}
            • For immediate danger, use your local emergency number
          </Text>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => setScreen("contacts")}>
            <Text style={styles.secondaryButtonText}>Manage trusted contacts</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.disclaimer}>
          Privacy: location is accessed when you activate SOS. MVP 1 stores emergency data locally on the device. Do not rely on this app as a replacement for official emergency services.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F8FA" },
  content: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 28 },
  brand: { fontSize: 24, fontWeight: "900", letterSpacing: 2 },
  subtitle: { color: "#667085", marginTop: 2 },
  contactsButton: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: "#D0D5DD" },
  contactsButtonText: { fontWeight: "700" },
  backButton: { marginBottom: 20 },
  backText: { fontWeight: "700" },
  hero: { alignItems: "center", paddingTop: 8 },
  title: { fontSize: 30, fontWeight: "900", marginBottom: 8 },
  description: { color: "#667085", fontSize: 16, lineHeight: 23, marginBottom: 24 },
  descriptionCenter: { textAlign: "center", color: "#667085", fontSize: 16, marginBottom: 28 },
  sosButton: {
    width: 210, height: 210, borderRadius: 105, backgroundColor: "#D92D20",
    alignItems: "center", justifyContent: "center", elevation: 5,
    shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 5 },
  },
  disabled: { opacity: 0.6 },
  sosText: { color: "white", fontSize: 58, fontWeight: "900", letterSpacing: 2 },
  sosSubtext: { color: "white", fontSize: 16, fontWeight: "700", marginTop: -4 },
  helper: { textAlign: "center", color: "#667085", marginTop: 18, marginBottom: 24 },
  card: { backgroundColor: "white", borderRadius: 16, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: "#EAECF0" },
  sectionTitle: { fontSize: 18, fontWeight: "800", marginBottom: 12 },
  smallText: { color: "#667085", lineHeight: 22 },
  input: { borderWidth: 1, borderColor: "#D0D5DD", borderRadius: 10, padding: 13, marginBottom: 10, backgroundColor: "#fff" },
  primaryButton: { backgroundColor: "#101828", padding: 14, borderRadius: 10, alignItems: "center" },
  primaryButtonText: { color: "white", fontWeight: "800" },
  secondaryButton: { marginTop: 16, borderWidth: 1, borderColor: "#D0D5DD", padding: 13, borderRadius: 10, alignItems: "center" },
  secondaryButtonText: { fontWeight: "800" },
  contactRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F2F4F7" },
  contactName: { fontSize: 16, fontWeight: "800" },
  contactMeta: { color: "#667085", marginTop: 3 },
  removeText: { color: "#D92D20", fontWeight: "700", padding: 8 },
  loadingScreen: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30 },
  loadingTitle: { fontSize: 28, fontWeight: "900", letterSpacing: 2, marginBottom: 12 },
  countdownScreen: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30 },
  warningTitle: { fontSize: 22, fontWeight: "900", marginBottom: 10 },
  countdown: { fontSize: 120, fontWeight: "900" },
  cancelButton: { backgroundColor: "#101828", paddingVertical: 16, paddingHorizontal: 50, borderRadius: 12 },
  cancelText: { color: "white", fontWeight: "900" },
  activeBanner: { backgroundColor: "#101828", borderRadius: 16, padding: 20, marginBottom: 16 },
  activeTitle: { color: "white", fontSize: 26, fontWeight: "900" },
  activeSubtitle: { color: "#D0D5DD", marginTop: 4 },
  location: { fontSize: 18, fontWeight: "800", marginBottom: 6 },
  callButton: { backgroundColor: "#101828", paddingVertical: 9, paddingHorizontal: 16, borderRadius: 9 },
  callText: { color: "white", fontWeight: "800" },
  endButton: { backgroundColor: "#D92D20", padding: 17, borderRadius: 12, alignItems: "center", marginTop: 4 },
  endButtonText: { color: "white", fontWeight: "900", letterSpacing: 0.5 },
  disclaimer: { color: "#667085", fontSize: 12, lineHeight: 18, marginTop: 14, textAlign: "center" },
});
