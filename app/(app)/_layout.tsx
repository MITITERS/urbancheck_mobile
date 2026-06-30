import { Stack } from "expo-router";

export default function AppLayout() {
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="create-report" options={{ title: "Nuevo reporte" }} />
      <Stack.Screen name="edit-profile" options={{ title: "Editar perfil" }} />
      <Stack.Screen name="report/[id]" options={{ title: "Detalle" }} />
    </Stack>
  );
}
