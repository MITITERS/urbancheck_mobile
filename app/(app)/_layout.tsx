import { Stack } from "expo-router";

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        // En iOS el botón de volver muestra el título de la pantalla anterior.
        // Como la anterior es el grupo de pestañas, se leía "(tabs)"; con
        // "minimal" queda solo la flecha.
        headerBackButtonDisplayMode: "minimal",
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="edit-profile" options={{ title: "Editar perfil" }} />
      <Stack.Screen name="edit-report/[id]" options={{ title: "Editar reporte" }} />
      <Stack.Screen name="user/[id]" options={{ title: "Perfil" }} />
    </Stack>
  );
}
