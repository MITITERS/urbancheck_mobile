import { Stack } from "expo-router";
import { AuthProvider, useAuth } from "../src/auth/AuthContext";

function RootStack() {
  const { token, isLoading } = useAuth();

  if (isLoading) return null;

  return (
    <Stack>
      <Stack.Protected guard={!!token}>
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={!token}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Screen name="reset-password" options={{ title: "Nueva contraseña" }} />
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
