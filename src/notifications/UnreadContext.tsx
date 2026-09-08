import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";

import { getUnreadCount } from "../api/notifications";

/**
 * Contador de avisos sin leer, compartido entre el badge de la campana y la
 * bandeja.
 *
 * Vive en un contexto y no en la pantalla de avisos porque el badge tiene que
 * poder mostrarse justamente cuando esa pantalla no está montada. El número lo
 * da el backend (`/api/notifications/unread_count/`) y no la lista cargada: la
 * bandeja está paginada, así que contar lo que hay en pantalla daría de menos
 * en cuanto haya más de una página.
 *
 * Todavía no hay push (`send_push()` es un stub en el backend), así que la
 * única forma de enterarse de un aviso nuevo sin abrir la bandeja es preguntar
 * cada tanto.
 */

/** Cada cuánto se vuelve a preguntar mientras la app está en primer plano. */
export const UNREAD_POLL_INTERVAL_MS = 60_000;

/** A partir de acá el badge muestra "99+" en vez del número. */
export const UNREAD_BADGE_CAP = 99;

interface UnreadContextValue {
  /** Avisos sin leer, o 0 mientras todavía no se pudo averiguar. */
  unread: number;
  /** Vuelve a preguntarle al backend. */
  refreshUnread: () => Promise<void>;
  /** Ajuste optimista, para no esperar al round-trip al marcar uno leído. */
  applyUnreadDelta: (delta: number) => void;
  /** El usuario marcó toda la bandeja. */
  clearUnread: () => void;
}

const UnreadContext = createContext<UnreadContextValue | null>(null);

/** Formato del badge: el número, o "99+" si no entra. */
export function formatUnreadBadge(unread: number): string | undefined {
  if (unread <= 0) return undefined;
  return unread > UNREAD_BADGE_CAP ? `${UNREAD_BADGE_CAP}+` : String(unread);
}

export function UnreadProvider({ children }: { children: React.ReactNode }) {
  const [unread, setUnread] = useState(0);
  // Evita que una respuesta lenta pise un ajuste optimista más nuevo.
  const requestId = useRef(0);

  const refreshUnread = useCallback(async () => {
    const id = ++requestId.current;
    try {
      const { unread: count } = await getUnreadCount();
      if (id === requestId.current) setUnread(count);
    } catch {
      // Un badge desactualizado no es motivo para molestar al usuario: se
      // vuelve a intentar en el próximo ciclo.
    }
  }, []);

  const applyUnreadDelta = useCallback((delta: number) => {
    requestId.current++;
    setUnread((current) => Math.max(0, current + delta));
  }, []);

  const clearUnread = useCallback(() => {
    requestId.current++;
    setUnread(0);
  }, []);

  useEffect(() => {
    void refreshUnread();

    const interval = setInterval(() => {
      void refreshUnread();
    }, UNREAD_POLL_INTERVAL_MS);

    // Al volver del segundo plano el contador puede tener minutos de atraso, y
    // es justo el momento en que el usuario mira la pantalla.
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") void refreshUnread();
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [refreshUnread]);

  return (
    <UnreadContext.Provider
      value={{ unread, refreshUnread, applyUnreadDelta, clearUnread }}
    >
      {children}
    </UnreadContext.Provider>
  );
}

export function useUnread(): UnreadContextValue {
  const value = useContext(UnreadContext);
  if (!value) {
    throw new Error("useUnread debe usarse dentro de <UnreadProvider>");
  }
  return value;
}
