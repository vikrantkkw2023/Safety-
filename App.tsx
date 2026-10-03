import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Linking,
  SafeAreaView,
  ScrollView,
  Share,
  Modal,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as Location from "expo-location";
import * as SMS from "expo-sms";
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder } from "expo-audio";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getCountries, getCountryCallingCode } from "libphonenumber-js";
import { isDuplicatePhone, isValidActiveIncident, isValidPhone, normalizePhone, validateCountryPhone } from "./src/safetyRules";
import { persistAndSyncIncident, endAndSyncIncident } from "./src/sosCoordinator";
import { initializeBackendSync, recoverBackendContacts } from "./src/appSync";
import { createEmailAccount, getActiveIncident, getCurrentUser, resetEmailPassword, signInEmailAccount, signOutAccount, getGrantedIncident, createContactLinkInvitation, redeemContactLinkInvitation } from "./src/backend";
import { mergeContacts } from "./src/contactMerge";
import { syncContactWithFallback } from "./src/contactSync";
import { syncProfileWithFallback } from "./src/profileSync";
import { onAuthStateChange } from "./src/backend";
import { registerNotificationDevice } from "./src/notificationRegistration";
import { createAudioEvidence, uploadAudioEvidence, updateAudioEvidenceStatus } from "./src/backend";
import { startLiveLocation, stopLiveLocation } from "./src/liveLocation";
import { isSupabaseConfigured } from "./src/supabase";
import { normalizeEmail, validateEmail, validatePassword } from "./src/authRules";

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
const PROFILE_KEY = "safety.profile.v1";

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
  const [screen, setScreen] = useState<"home" | "contacts" | "signup" | "about" | "recipientEmergency">("signup");
  const [recipientIncidentId, setRecipientIncidentId] = useState<string | null>(null);
  const [recipientView, setRecipientView] = useState<Awaited<ReturnType<typeof getGrantedIncident>> | null>(null);
  const [profile, setProfile] = useState<{ name: string; country: string; phone: string } | null>(null);
  const [signupName, setSignupName] = useState("");
  const [signupCountry, setSignupCountry] = useState("");
  const [signupPhone, setSignupPhone] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authBusy, setAuthBusy] = useState(false);
  const [supabaseAuthAvailable, setSupabaseAuthAvailable] = useState(false);
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [relationship, setRelationship] = useState("");
  const [busy, setBusy] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const handleInviteContact = async (contact: Contact) => {
    if (!isSupabaseConfigured) {
      Alert.alert("Account linking unavailable", "Connect the Safety backend before inviting a trusted contact.");
      return;
    }
    try {
      const invitation = await createContactLinkInvitation(contact.id);
      const link = `safety://link?token=${encodeURIComponent(invitation.token)}`;
      await Share.share({
        title: "Join my Safety trusted contacts",
        message: `Join me as a trusted contact in Safety. Open this link in Safety: ${link}`,
        url: link,
      });
    } catch (error) {
      console.error("Trusted-contact invitation failed", error);
      Alert.alert("Invitation failed", "Safety could not create the invitation. Please try again.");
    }
  };

  const redeemInvitationToken = async (token: string) => {
    if (!isSupabaseConfigured || !token) return;
    try {
      await redeemContactLinkInvitation(token);
      Alert.alert("Trusted contact connected", "This Safety account is now linked as a trusted contact.");
      const recovered = await recoverBackendContacts();
      if (recovered) {
        setContacts(recovered.map((item) => ({
          id: item.id,
          name: item.name,
          phone: item.phone,
          relationship: item.relationship ?? "",
        })));
      }
    } catch (error) {
      console.error("Trusted-contact invitation redemption failed", error);
      Alert.alert("Invitation unavailable", "This invitation may be expired, already used, or not intended for this account.");
    }
  };

  useEffect(() => {
    const handleUrl = ({ url }: { url: string }) => {
      try {
        const parsed = new URL(url);
        const token = parsed.searchParams.get("token");
        if (parsed.protocol === "safety:" && parsed.host === "link" && token) {
          void redeemInvitationToken(token);
        }
      } catch (error) {
        console.error("Safety deep-link handling failed", error);
      }
    };
    void Linking.getInitialURL().then((url) => {
      if (url) handleUrl({ url });
    });
    const subscription = Linking.addEventListener("url", handleUrl);
    return () => subscription.remove();
  }, []);


  const sosInFlightRef = useRef(false);
  const audioRecorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, directory: "document" });
  const audioRecordingRef = useRef(false);
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;
    let lastState = AppState.currentState;
    const subscription = AppState.addEventListener("change", (nextState) => {
      const becameActive = (lastState === "background" || lastState === "inactive") && nextState === "active";
      lastState = nextState;
      if (becameActive) {
        void initializeBackendSync().catch((error) => console.error("Foreground sync retry failed", error));
      }
    });
    const register = async () => {
      try {
        const result = await registerNotificationDevice();
        if (active && !result.registered && result.reason !== "PERMISSION_DENIED") {
          console.log("Push notification registration not available:", result.reason);
        }
      } catch (error) {
        console.error("Push notification registration failed", error);
      }
    };
    void register();
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  const audioStartedAtRef = useRef<string | null>(null);
  const liveLocationSubscriptionRef = useRef<{ remove: () => void } | null>(null);

  useEffect(() => {
    const openIncident = async (incidentId: string) => {
      try {
        const view = await getGrantedIncident(incidentId);
        setRecipientIncidentId(incidentId);
        setRecipientView(view);
        setScreen("recipientEmergency");
      } catch (error) {
        console.error("Emergency access denied", error);
        Alert.alert("Emergency access unavailable", "You are not authorized to view this emergency, or the access has expired.");
      }
    };

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.type === "SOS_ACTIVE" && typeof data.incidentId === "string") {
        void openIncident(data.incidentId);
      }
    });

    void Notifications.getLastNotificationResponseAsync().then((response) => {
      const data = response?.notification.request.content.data;
      if (data?.type === "SOS_ACTIVE" && typeof data.incidentId === "string") {
        void openIncident(data.incidentId);
      }
    });

  }, []);

  useEffect(() => {
    if (screen !== "recipientEmergency" || !recipientIncidentId) return;
    let active = true;
    const refresh = async () => {
      try {
        const view = await getGrantedIncident(recipientIncidentId);
        if (active) setRecipientView(view);
      } catch (error) {
        console.error("Emergency location refresh failed", error);
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [screen, recipientIncidentId]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [savedContacts, savedIncident, savedProfile] = await Promise.all([
          AsyncStorage.getItem(CONTACTS_KEY),
          AsyncStorage.getItem(INCIDENT_KEY),
          AsyncStorage.getItem(PROFILE_KEY),
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

        if (savedProfile) {
          try {
            const parsedProfile = JSON.parse(savedProfile);
            if (
              parsedProfile &&
              typeof parsedProfile.name === "string" &&
              typeof parsedProfile.country === "string" &&
              typeof parsedProfile.phone === "string"
            ) {
              setProfile({
                name: parsedProfile.name,
                country: parsedProfile.country,
                phone: parsedProfile.phone,
              });
              setSignupName(parsedProfile.name);
              setSignupCountry(parsedProfile.country);
              setSignupPhone(parsedProfile.phone);
              setScreen("home");
            } else {
              await AsyncStorage.removeItem(PROFILE_KEY);
            }
          } catch (error) {
            console.error("Invalid saved profile", error);
            await AsyncStorage.removeItem(PROFILE_KEY);
          }
        }

        // Retry previously queued backend work and recover server-side contacts/incidents.
        try {
          await initializeBackendSync();
          const remoteContacts = await recoverBackendContacts();
          if (remoteContacts && mounted) {
            setContacts((current) => mergeContacts(current, remoteContacts));
          }
          const currentUser = await getCurrentUser();
          const remoteActive = currentUser?.id ? await getActiveIncident(currentUser.id) : null;
          if (remoteActive && mounted && !savedIncident) {
            const recovered: Incident = {
              id: remoteActive.client_local_id ?? remoteActive.id,
              latitude: remoteActive.latitude,
              longitude: remoteActive.longitude,
              accuracy: remoteActive.accuracy ?? undefined,
              startedAt: remoteActive.started_at,
              status: "ACTIVE",
            };
            if (isValidActiveIncident(recovered)) {
              await AsyncStorage.setItem(INCIDENT_KEY, JSON.stringify(recovered));
              setActiveIncident(recovered);
            }
          }
        } catch (syncError) {
          console.error("Backend startup sync/recovery failed", syncError);
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

  const completeSignup = async () => {
    const cleanName = signupName.trim();
    if (!cleanName) {
      Alert.alert("Name required", "Enter your name.");
      return;
    }
    if (!signupCountry) {
      Alert.alert("Country required", "Select your country.");
      return;
    }
    const validation = validateCountryPhone(signupPhone, signupCountry);
    if (!validation.valid || !validation.e164) {
      Alert.alert("Invalid phone number", validation.reason ?? "Enter a valid phone number for the selected country.");
      return;
    }
    const nextProfile = { name: cleanName, country: signupCountry, phone: validation.e164 };
    try {
      await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(nextProfile));
      try {
        await syncProfileWithFallback(nextProfile);
      } catch (syncError) {
        console.error("Profile backend sync failed", syncError);
      }
      setProfile(nextProfile);
      setSignupPhone(validation.e164);
      setScreen("home");
    } catch (error) {
      console.error("Could not save profile", error);
      Alert.alert("Could not create account", "Please try again.");
    }
  };

  const handleEmailAuth = async () => {
    const emailError = validateEmail(authEmail);
    const passwordError = validatePassword(authPassword);
    if (emailError) {
      Alert.alert("Invalid email", emailError);
      return;
    }
    if (passwordError) {
      Alert.alert("Invalid password", passwordError);
      return;
    }
    if (!isSupabaseConfigured) {
      Alert.alert("Backend not configured", "Supabase is not configured yet. You can continue with the local test profile.");
      return;
    }

    setAuthBusy(true);
    try {
      const email = normalizeEmail(authEmail);
      if (authMode === "signup") {
        const { data, error } = await createEmailAccount(email, authPassword);
        if (error) throw error;
        if (!data.session) {
          Alert.alert("Check your email", "Your account was created. Complete email verification, then sign in.");
        } else {
          Alert.alert("Account created", "Your Safety account is ready. Continue with your local profile details.");
        }
      } else {
        const { error } = await signInEmailAccount(email, authPassword);
        if (error) throw error;
        Alert.alert("Signed in", "Your Safety account is now connected.");
      }
    } catch (error) {
      console.error("Authentication failed", error);
      const message = error instanceof Error ? error.message : "Authentication failed. Please try again.";
      Alert.alert("Authentication failed", message);
    } finally {
      setAuthBusy(false);
    }
  };

  const handlePasswordReset = async () => {
    const emailError = validateEmail(authEmail);
    if (emailError) {
      Alert.alert("Enter your email", emailError);
      return;
    }
    if (!isSupabaseConfigured) {
      Alert.alert("Backend not configured", "Password recovery becomes available after Supabase is configured.");
      return;
    }
    setAuthBusy(true);
    try {
      await resetEmailPassword(normalizeEmail(authEmail));
      Alert.alert("Check your email", "If an account exists for that address, Supabase will send password recovery instructions.");
    } catch (error) {
      console.error("Password reset failed", error);
      Alert.alert("Password reset failed", "Please check the email address and try again.");
    } finally {
      setAuthBusy(false);
    }
  };

  const countryName = (code: string) => {
    try {
      const displayNames = new Intl.DisplayNames(["en"], { type: "region" });
      return displayNames.of(code) ?? code;
    } catch {
      return code;
    }
  };

  const countries = useMemo(
    () =>
      getCountries()
        .map((code) => ({ code, name: countryName(code), callingCode: getCountryCallingCode(code) }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    []
  );

  const addContact = async () => {
    const cleanName = name.trim();
    const cleanPhone = phone.trim().replace(/\s+/g, " ");
    if (!cleanName || !cleanPhone) {
      Alert.alert("Missing information", "Enter the contact name and phone number.");
      return;
    }
    if (cleanName.length > 80 || cleanPhone.length > 30 || relationship.trim().length > 50) {
      Alert.alert("Input too long", "Keep the name under 80 characters, phone number under 30 characters, and relationship under 50 characters.");
      return;
    }
    if (!isValidPhone(cleanPhone)) {
      Alert.alert("Invalid phone number", "Enter a valid phone number with 7–15 digits.");
      return;
    }
    if (isDuplicatePhone(contacts.map((c) => c.phone), cleanPhone)) {
      Alert.alert("Already added", "This phone number is already a trusted contact.");
      return;
    }
    const newContact: Contact = {
      id: `CONTACT-${Date.now()}`,
      name: cleanName,
      phone: cleanPhone,
      relationship: relationship.trim() || "Trusted contact",
    };
    setContacts((current) => [...current, newContact]);
    try {
      await syncContactWithFallback(newContact);
    } catch (syncError) {
      console.error("Contact backend sync failed", syncError);
    }
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

  const startSOSAudio = async () => {
    if (audioRecordingRef.current) return;
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        console.warn("Microphone permission denied; SOS continues without audio evidence.");
        return;
      }
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
        allowsBackgroundRecording: true,
      });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      audioRecordingRef.current = true;
      audioStartedAtRef.current = new Date().toISOString();
    } catch (error) {
      console.error("SOS audio recording could not start", error);
      audioRecordingRef.current = false;
    }
  };

  const stopSOSAudio = async () => {
    if (!audioRecordingRef.current) return null;
    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri ?? null;
      audioRecordingRef.current = false;
      return uri;
    } catch (error) {
      console.error("SOS audio recording could not stop", error);
      audioRecordingRef.current = false;
      return null;
    }
  };

  const beginSOS = () => {
    if (!storageReady) {
      Alert.alert("Please wait", "Safety is still loading your saved data.");
      return;
    }
    if (activeIncident || busy || countdown !== null || sosInFlightRef.current) return;
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
    if (sosInFlightRef.current || activeIncident) return;
    sosInFlightRef.current = true;
    setBusy(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert(
          "Location permission required",
          "Safety needs location permission to include your current location in an SOS.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Open Settings",
              onPress: () => {
                Linking.openSettings().catch(() => {
                  Alert.alert("Settings unavailable", "Open your phone settings and enable location permission for Safety.");
                });
              },
            },
          ]
        );
        return;
      }

      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        Alert.alert(
          "Location services are off",
          "Turn on your phone's location services so Safety can capture your location.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Open Settings",
              onPress: () => {
                Linking.openSettings().catch(() => {
                  Alert.alert("Settings unavailable", "Open your phone settings and enable location services.");
                });
              },
            },
          ]
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
      void startSOSAudio();
      void startLiveLocation(incident.id).then(() => {
        console.log("Background SOS location tracking started");
      }).catch((error) => console.error("Live location could not start", error));

      // Local activation is authoritative for the user experience; backend sync is best-effort.
      try {
        await persistAndSyncIncident(incident);
      } catch (syncError) {
        console.error("Incident backend sync failed", syncError);
      }

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
      sosInFlightRef.current = false;
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
      if (!isValidPhone(dialNumber)) {
        Alert.alert("Invalid contact number", "This trusted contact has an invalid phone number. Edit or remove the contact.");
        return;
      }
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
            const endedAt = new Date().toISOString();
            liveLocationSubscriptionRef.current?.remove();
            liveLocationSubscriptionRef.current = null;
            await stopLiveLocation().catch((locationError) => console.error("Live location stop failed", locationError));
            const recordedAudioUri = await stopSOSAudio();
            if (recordedAudioUri && audioStartedAtRef.current && supabase) {
              const currentUser = await getCurrentUser();
              if (!currentUser?.id) throw new Error("NO_AUTHENTICATED_USER");
              const storagePath = currentUser.id + "/" + activeIncident.id + "/" + Date.now() + ".m4a";
              let evidenceId: string | null = null;
              try {
                const evidence = await createAudioEvidence(activeIncident.id, {
                  incident_id: activeIncident.id,
                  storage_path: storagePath,
                  started_at: audioStartedAtRef.current,
                  ended_at: endedAt,
                  status: "LOCAL_PENDING_UPLOAD",
                });
                evidenceId = evidence.id;
                await uploadAudioEvidence(activeIncident.id, storagePath, recordedAudioUri);
                await updateAudioEvidenceStatus(activeIncident.id, evidence.id, "UPLOADED");
              } catch (audioError) {
                console.error("Audio evidence upload failed", audioError);
                try {
                  if (evidenceId) {
                    await updateAudioEvidenceStatus(activeIncident.id, evidenceId, "FAILED");
                  }
                } catch (statusError) {
                  console.error("Audio evidence failure status update failed", statusError);
                }
              }
            }
            // Clear the local active state immediately; backend resolution is best-effort and queued on failure.
            await AsyncStorage.removeItem(INCIDENT_KEY);
            setActiveIncident(null);
            audioStartedAtRef.current = null;
            try {
              await endAndSyncIncident(activeIncident, endedAt);
            } catch (syncError) {
              console.error("Incident resolution sync failed", syncError);
            }
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

  if (screen === "signup" && !profile) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.loadingScreen}>
            <Text style={styles.loadingTitle}>SAFETY</Text>
            <Text style={styles.title}>Create your account</Text>
            <Text style={styles.descriptionCenter}>
              Select your country first. The country calling code and phone validation will update automatically.
            </Text>

            <View style={styles.card}>
              <TextInput
                value={signupName}
                onChangeText={setSignupName}
                placeholder="Full name"
                autoCapitalize="words"
                style={styles.input}
              />

              <TouchableOpacity style={styles.countrySelector} onPress={() => setCountryPickerOpen(true)}>
                <Text style={styles.countrySelectorText}>
                  {signupCountry
                    ? `${countryName(signupCountry)}  +${getCountryCallingCode(signupCountry)}`
                    : "Select country"}
                </Text>
                <Text>▼</Text>
              </TouchableOpacity>

              <View style={styles.phoneRow}>
                <View style={styles.codeBox}>
                  <Text style={styles.codeText}>
                    {signupCountry ? `+${getCountryCallingCode(signupCountry)}` : "+"}
                  </Text>
                </View>
                <TextInput
                  value={signupPhone}
                  onChangeText={setSignupPhone}
                  placeholder={signupCountry ? "Phone number" : "Select country first"}
                  keyboardType="phone-pad"
                  editable={Boolean(signupCountry)}
                  style={[styles.input, styles.phoneInput]}
                />
              </View>

              <TouchableOpacity style={styles.primaryButton} onPress={completeSignup}>
                <Text style={styles.primaryButtonText}>Create account</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        <Modal visible={countryPickerOpen} animationType="slide" onRequestClose={() => setCountryPickerOpen(false)}>
          <SafeAreaView style={styles.container}>
            <View style={styles.countryModalHeader}>
              <Text style={styles.sectionTitle}>Select your country</Text>
              <TouchableOpacity onPress={() => setCountryPickerOpen(false)}>
                <Text style={styles.removeText}>Close</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              {countries.map((country) => (
                <TouchableOpacity
                  key={country.code}
                  style={styles.countryRow}
                  onPress={() => {
                    setSignupCountry(country.code);
                    setSignupPhone("");
                    setCountryPickerOpen(false);
                  }}
                >
                  <Text style={styles.countryName}>{country.name}</Text>
                  <Text style={styles.countryCode}>+{country.callingCode}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </SafeAreaView>
        </Modal>
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
              <View style={{ alignItems: "flex-end", gap: 6 }}>
                <TouchableOpacity onPress={() => handleInviteContact(contact)}>
                  <Text style={styles.linkText}>Invite to Safety</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => removeContact(contact.id)}>
                  <Text style={styles.removeText}>Remove</Text>
                </TouchableOpacity>
              </View>
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

  if (screen === "recipientEmergency" && recipientView) {
    const location = recipientView.latest_location ?? recipientView.incident;
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Active Emergency</Text>
          <Text style={styles.subtitle}>
            {recipientView.incident.owner_name ?? "Your trusted contact"} has an active SOS.
          </Text>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Emergency status</Text>
            <Text style={styles.cardText}>{recipientView.incident.status}</Text>
            <Text style={styles.cardText}>
              Location updated: {location.recorded_at ?? recipientView.incident.started_at}
            </Text>
            {location.accuracy != null && (
              <Text style={styles.cardText}>GPS accuracy: {Math.round(location.accuracy)} m</Text>
            )}
          </View>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => void Linking.openURL(mapsUrl(location.latitude, location.longitude))}
          >
            <Text style={styles.primaryButtonText}>Open location in Maps</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => setScreen("home")}>
            <Text style={styles.secondaryButtonText}>Close</Text>
          </TouchableOpacity>
          <Text style={styles.disclaimer}>
            Location visibility is limited to authorized trusted contacts and expires with the access grant.
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
  countrySelector: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: 1, borderColor: "#D0D5DD", borderRadius: 10, padding: 13, marginBottom: 10 },
  countrySelectorText: { fontWeight: "600" },
  phoneRow: { flexDirection: "row", alignItems: "center" },
  codeBox: { borderWidth: 1, borderColor: "#D0D5DD", borderRadius: 10, padding: 13, marginRight: 8, backgroundColor: "#F2F4F7" },
  codeText: { fontWeight: "800" },
  phoneInput: { flex: 1, marginBottom: 10 },
  countryModalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: "#EAECF0" },
  countryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 15, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: "#F2F4F7" },
  countryName: { fontSize: 16 },
  countryCode: { fontWeight: "700", color: "#667085" },
  authLink: { textAlign: "center", color: "#175CD3", fontWeight: "700", marginTop: 12 },
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
