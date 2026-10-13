import { Stack } from "expo-router";

import { UnreadProvider } from "../../src/notifications/UnreadContext";

export default function AppLayout() {
  return (
    // Envuelve al área autenticada y no a la raíz: el contador se le pregunta
    // al backend, así que solo tiene sentido con una sesión abierta.
    <UnreadProvider>
      <Stack
        // Solo la flecha, sin el nombre de la pantalla anterior. Por defecto
        // iOS lo escribe al lado, y acá ese nombre es el de un grupo de rutas
        // —"(tabs)"—, que no significa nada para quien usa la app.
        screenOptions={{ headerBackButtonDisplayMode: "minimal" }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="edit-profile" options={{ title: "Editar perfil" }} />
        <Stack.Screen
          name="edit-report/[id]"
          options={{ title: "Editar reporte" }}
        />
        <Stack.Screen name="user/[id]" options={{ title: "Perfil" }} />
        {/* El detalle de un trabajo de la bandeja del operario (US-045). Vive
            fuera de las pestañas: el operario llega desde su bandeja y vuelve
            con la flecha, sin barra de navegación que no le corresponde. */}
        <Stack.Screen
          name="work-report/[id]"
          options={{ title: "Trabajo asignado" }}
        />
        {/* El cierre del operario (US-046) y la objeción del vecino (US-048):
            dos formularios con cámara obligatoria, cada uno del suyo. */}
        <Stack.Screen
          name="close-report/[id]"
          options={{ title: "Registrar la resolución" }}
        />
        <Stack.Screen
          name="appeal-report/[id]"
          options={{ title: "Objetar el cierre" }}
        />
        <Stack.Screen
          name="notification-preferences"
          options={{ title: "Notificaciones" }}
        />
      </Stack>
    </UnreadProvider>
  );
}
