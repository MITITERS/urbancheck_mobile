import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { acceptTerms, getCurrentTerms, type TermsOfService } from "../src/api/users";
import { useAuth } from "../src/auth/AuthContext";
import { termsMessages as t } from "../src/messages/terms";
import { LegalText } from "../src/terms/LegalText";

/**
 * Aceptación de los términos vigentes en el ingreso (RN-10, C-23).
 *
 * Para las cuentas que ya existían cuando se publicaron los términos, y para
 * todas cada vez que se publica una versión nueva. Como el cambio de
 * contraseña temporal, no tiene otra salida que aceptar o cerrar sesión: el
 * guard del layout raíz la deja como única pantalla accesible.
 */
export default function AcceptTermsScreen() {
  const { setUser, signOut } = useAuth();
  const [terms, setTerms] = useState<TermsOfService | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadFailed(false);
    try {
      setTerms(await getCurrentTerms());
    } catch {
      setLoadFailed(true);
    }
  }, []);

  useEffect(() => {
    getCurrentTerms()
      .then(setTerms)
      .catch(() => setLoadFailed(true));
  }, []);

  async function handleAccept() {
    if (!terms) return;
    setError(null);
    setSaving(true);
    try {
      setUser(await acceptTerms(terms.version));
    } catch {
      // Lo más probable es que se haya publicado otra versión mientras la
      // leía: se recarga el texto para que acepte la vigente.
      setError(t.acceptError);
      void load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <Ionicons name="document-text-outline" size={48} color="#1a73e8" />
      <Text style={styles.title}>{t.gateTitle}</Text>
      <Text style={styles.subtitle}>{t.gateIntro}</Text>

      {loadFailed ? (
        <View style={styles.center}>
          <Text style={styles.error}>{t.loadError}</Text>
          <Pressable onPress={() => void load()}>
            <Text style={styles.linkText}>{t.retry}</Text>
          </Pressable>
        </View>
      ) : !terms ? (
        <ActivityIndicator style={styles.center} color="#1a73e8" />
      ) : (
        <>
          <Text style={styles.version}>{t.version(terms.version)}</Text>
          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            <LegalText terms={terms} />
          </ScrollView>
        </>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={[styles.button, (saving || !terms) && styles.buttonDisabled]}
        onPress={handleAccept}
        disabled={saving || !terms}
        accessibilityRole="button"
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>{t.accept}</Text>
        )}
      </Pressable>

      <Pressable onPress={() => void signOut()} style={styles.link}>
        <Text style={styles.linkText}>{t.signOut}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    paddingTop: 72,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  title: { fontSize: 22, fontWeight: "bold", marginTop: 16, color: "#111827" },
  subtitle: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },
  version: { fontSize: 13, color: "#6b7280", marginTop: 16, alignSelf: "flex-start" },
  body: {
    flex: 1,
    alignSelf: "stretch",
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
  },
  bodyContent: { padding: 16 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  error: { color: "#dc2626", fontSize: 13, marginTop: 8 },
  button: {
    alignSelf: "stretch",
    backgroundColor: "#1a73e8",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    marginTop: 16,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  link: { marginTop: 16, marginBottom: 16 },
  linkText: { color: "#1a73e8", fontSize: 14, fontWeight: "600" },
});
