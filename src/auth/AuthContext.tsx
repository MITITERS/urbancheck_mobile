import * as SecureStore from "expo-secure-store";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { getSession } from "../api/auth";
import { setSessionToken, setUnauthorizedHandler } from "../api/client";
import { getMe, type UserProfile } from "../api/users";

const SECURE_STORE_KEY = "urbancheck_session_token";

interface AuthState {
  token: string | null;
  user: UserProfile | null;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  signIn: (token: string, rememberMe: boolean) => Promise<void>;
  signOut: () => Promise<void>;
  setUser: (user: UserProfile) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    token: null,
    user: null,
    isLoading: true,
  });

  const signOut = useCallback(async () => {
    setSessionToken(null);
    await SecureStore.deleteItemAsync(SECURE_STORE_KEY).catch(() => {});
    setState({ token: null, user: null, isLoading: false });
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(signOut);
  }, [signOut]);

  // Hydrate session from SecureStore on mount
  useEffect(() => {
    async function hydrate() {
      try {
        const storedToken = await SecureStore.getItemAsync(SECURE_STORE_KEY);
        if (!storedToken) {
          setState((s) => ({ ...s, isLoading: false }));
          return;
        }
        setSessionToken(storedToken);
        const session = await getSession();
        const token = session.meta.session_token ?? storedToken;
        setSessionToken(token);
        // El perfil se carga acá y no en cada pantalla: el rol y el flag de
        // contraseña temporal deciden qué se muestra desde el primer render.
        const user = await getMe().catch(() => null);
        setState({ token, user, isLoading: false });
      } catch {
        setSessionToken(null);
        await SecureStore.deleteItemAsync(SECURE_STORE_KEY).catch(() => {});
        setState({ token: null, user: null, isLoading: false });
      }
    }
    void hydrate();
  }, []);

  const signIn = useCallback(async (token: string, rememberMe: boolean) => {
    setSessionToken(token);
    if (rememberMe) {
      await SecureStore.setItemAsync(SECURE_STORE_KEY, token);
    }
    const user = await getMe().catch(() => null);
    setState({ token, user, isLoading: false });
  }, []);

  const setUser = useCallback((user: UserProfile) => {
    setState((s) => ({ ...s, user }));
  }, []);

  /** Vuelve a leer el perfil: se usa tras cambiar la contraseña temporal. */
  const refreshUser = useCallback(async () => {
    const user = await getMe().catch(() => null);
    if (user) setState((s) => ({ ...s, user }));
  }, []);

  return (
    <AuthContext.Provider
      value={{ ...state, signIn, signOut, setUser, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
