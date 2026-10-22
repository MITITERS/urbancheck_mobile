import * as SecureStore from "expo-secure-store";

import { completeOnboarding, type UserProfile } from "../api/users";

/**
 * La marca del tutorial de bienvenida (US-051) y su reintento.
 *
 * La marca de verdad vive en el backend (`onboarding_completed_at`). Si al
 * terminar u omitir el tutorial el POST falla por red, el vecino entra al feed
 * igual —no se lo bloquea por algo que no le importa— y se deja anotado en el
 * teléfono que la marca quedó pendiente. En el siguiente ingreso se reintenta
 * en silencio y el tutorial **no** vuelve a mostrarse (escenario 10).
 *
 * La anotación local es solo un recordatorio de reintento, por cuenta: no
 * decide nada por sí sola en otro dispositivo, donde manda el backend.
 */

const PENDING_VALUE = "1";

function pendingKey(userId: number) {
  return `urbancheck_onboarding_pending_${userId}`;
}

function markedLocally(user: UserProfile): UserProfile {
  return { ...user, onboarding_completed_at: new Date().toISOString() };
}

/**
 * Marca el tutorial como visto. Nunca rechaza: devuelve el perfil con la marca
 * puesta, la confirme el servidor o no.
 */
export async function markOnboardingSeen(user: UserProfile): Promise<UserProfile> {
  try {
    return await completeOnboarding();
  } catch {
    await SecureStore.setItemAsync(pendingKey(user.id), PENDING_VALUE).catch(() => {});
    return markedLocally(user);
  }
}

/**
 * Se llama al cargar el perfil en el arranque de la sesión. Si quedó una marca
 * pendiente, la reintenta; mientras siga sin confirmarse, el perfil vuelve
 * marcado igual para que el tutorial no reaparezca.
 */
export async function reconcileOnboarding(
  user: UserProfile | null,
): Promise<UserProfile | null> {
  if (!user) return user;
  try {
    const key = pendingKey(user.id);
    const pending = (await SecureStore.getItemAsync(key)) === PENDING_VALUE;
    if (!pending) return user;
    if (user.onboarding_completed_at) {
      await SecureStore.deleteItemAsync(key);
      return user;
    }
    try {
      const confirmed = await completeOnboarding();
      await SecureStore.deleteItemAsync(key).catch(() => {});
      return confirmed;
    } catch {
      return markedLocally(user);
    }
  } catch {
    return user;
  }
}
