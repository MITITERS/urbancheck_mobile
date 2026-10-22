import { Stack } from "expo-router";
import { participatesAsCitizen } from "../src/api/users";
import { AuthProvider, useAuth } from "../src/auth/AuthContext";
import { QueryProvider } from "../src/lib/QueryProvider";

function RootStack() {
  const { token, user, isLoading } = useAuth();

  if (isLoading) return null;

  // Contraseña temporal: hasta cambiarla, la única pantalla accesible es esa
  // (US-017). El guard vive acá y no en cada pantalla para que no se pueda
  // saltear navegando directo a una ruta.
  const mustChangePassword = !!token && user?.must_change_password === true;
  // Tutorial de bienvenida (US-051): solo el vecino, y solo mientras su cuenta
  // no lo tenga marcado. Las cuentas preexistentes ya vienen marcadas desde la
  // migración. Se decide acá, junto con la navegación por rol, y no en el feed.
  const needsOnboarding =
    !!token &&
    !mustChangePassword &&
    participatesAsCitizen(user) &&
    !user?.onboarding_completed_at;

  return (
    <Stack>
      <Stack.Protected guard={mustChangePassword}>
        <Stack.Screen name="change-password" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={needsOnboarding}>
        <Stack.Screen
          name="onboarding"
          options={{ headerShown: false, gestureEnabled: false }}
        />
      </Stack.Protected>
      <Stack.Protected guard={!!token && !mustChangePassword && !needsOnboarding}>
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={!token}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Screen name="reset-password" options={{ headerShown: false }} />
      {/* Un reporte compartido (US-030): como el reset, se abre con o sin
          sesión, así que va fuera de los guards. */}
      <Stack.Screen name="r/[token]" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    // La caché envuelve a la sesión: `AuthContext` limpia las consultas al
    // cerrar sesión, así que necesita tener el cliente por encima.
    <QueryProvider>
      <AuthProvider>
        <RootStack />
      </AuthProvider>
    </QueryProvider>
  );
}
