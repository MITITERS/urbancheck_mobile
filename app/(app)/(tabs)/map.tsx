import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function MapTab() {
  return (
    <View style={styles.container}>
      <Ionicons name="map-outline" size={64} color="#ccc" style={{ marginBottom: 16 }} />
      <Text style={styles.title}>Mapa próximamente</Text>
      <Text style={styles.subtitle}>Aquí podrás visualizar todos los reportes geolocalizados.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f8f9fa", padding: 24 },
  title: { fontSize: 18, fontWeight: "bold", color: "#374151", marginBottom: 8 },
  subtitle: { fontSize: 14, color: "#6b7280", textAlign: "center", lineHeight: 20 },
});
