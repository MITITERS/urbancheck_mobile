import { Stack } from "expo-router";
import { AuthProvider, useAuth } from "../src/auth/AuthContext";

function RootStack() {
  const { token, user, isLoading } = useAuth();

  if (isLoading) return null;

  // Contraseña temporal: hasta cambiarla, la única pantalla accesible es esa
  // (US-017). El guard vive acá y no en cada pantalla para que no se pueda
  // saltear navegando directo a una ruta.
  const mustChangePassword = !!token && user?.must_change_password === true;

  return (
    <Stack>
      <Stack.Protected guard={mustChangePassword}>
        <Stack.Screen name="change-password" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={!!token && !mustChangePassword}>
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={!token}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Screen name="reset-password" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootStack />
    </AuthProvider>
  );
}
