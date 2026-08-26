import { Stack } from "expo-router";

import { UnreadProvider } from "../../src/notifications/UnreadContext";

export default function AppLayout() {
  return (
    // Envuelve al área autenticada y no a la raíz: el contador se le pregunta
    // al backend, así que solo tiene sentido con una sesión abierta.
    <UnreadProvider>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="edit-profile" options={{ title: "Editar perfil" }} />
        <Stack.Screen
          name="notification-preferences"
          options={{ title: "Notificaciones" }}
        />
      </Stack>
    </UnreadProvider>
  );
}
