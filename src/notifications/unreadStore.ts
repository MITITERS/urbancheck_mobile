import { useSyncExternalStore } from "react";

import { getUnreadCount } from "../api/notifications";

/**
 * Contador de avisos sin leer, compartido entre la barra de pestañas (que pinta
 * el badge) y la bandeja (que es donde se leen).
 *
 * Es un store externo y no un contexto de React a propósito: el badge vive en el
 * layout de pestañas y la bandeja es una pantalla hija, así que hacía falta un
 * punto común que ninguna de las dos tuviera que "pasarle" a la otra. Sin esto,
 * el badge solo se enteraba en la siguiente vuelta del sondeo y quedaba mostrando
 * avisos que el usuario ya había leído.
 */

let unread = 0;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): number {
  return unread;
}

export function setUnread(value: number): void {
  const next = Math.max(0, value);
  if (next === unread) return;
  unread = next;
  listeners.forEach((listener) => listener());
}

/** Ajuste optimista, para que el badge responda sin esperar al servidor. */
export function adjustUnread(delta: number): void {
  setUnread(unread + delta);
}

/** Pide el valor autoritativo al backend. Silencioso: nunca rompe la pantalla. */
export async function refreshUnread(): Promise<void> {
  try {
    const { unread: count } = await getUnreadCount();
    setUnread(count);
  } catch {
    // Sin conexión o sesión vencida: dejamos el último valor conocido.
  }
}

export function useUnreadCount(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
