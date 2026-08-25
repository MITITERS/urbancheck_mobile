import * as Location from "expo-location";
import { useCallback, useEffect, useState } from "react";

import type { Coordinates } from "../api/validation";

export type LocationPermissionState =
  | "checking"
  | "granted"
  | "denied"
  | "blocked";

interface ValidatorLocation {
  permission: LocationPermissionState;
  coords: Coordinates | null;
  /** Motivo legible de por qué no hay ubicación, para explicarlo en pantalla. */
  reason: string | null;
  /** Vuelve a pedir el permiso; sin efecto si está bloqueado en el sistema. */
  request: () => Promise<void>;
  /** Posición fresca y de alta precisión, para el momento de validar. */
  getFreshPosition: () => Promise<Coordinates | null>;
}

const DENIED_REASON =
  "Necesitamos tu ubicación para confirmar que estás en el lugar del problema.";
const BLOCKED_REASON =
  "El permiso de ubicación está bloqueado. Habilitalo en los ajustes del sistema para poder validar.";

/**
 * Ubicación del validador (US-036 y US-037).
 *
 * Resuelve los tres casos del permiso —concedido, denegado y denegado de forma
 * permanente— y los expone con su motivo, para que la pantalla pueda explicar
 * por qué la acción está deshabilitada en lugar de esconderla.
 *
 * La posición de la lista se pide una sola vez al entrar; la de la acción de
 * validar se pide fresca y con alta precisión, porque una posición cacheada de
 * hace minutos no prueba que el validador esté en el lugar.
 */
export function useValidatorLocation(): ValidatorLocation {
  const [permission, setPermission] = useState<LocationPermissionState>("checking");
  const [coords, setCoords] = useState<Coordinates | null>(null);

  const applyStatus = useCallback(
    async (status: Location.LocationPermissionResponse) => {
      if (status.granted) {
        setPermission("granted");
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        }).catch(() => null);
        setCoords(
          position
            ? {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
              }
            : null,
        );
        return;
      }
      setPermission(status.canAskAgain ? "denied" : "blocked");
      setCoords(null);
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    async function check() {
      const status = await Location.getForegroundPermissionsAsync();
      if (cancelled) return;
      if (status.granted) {
        await applyStatus(status);
        return;
      }
      // Sin permiso todavía: lo pedimos al entrar a la sección, una sola vez.
      const requested = await Location.requestForegroundPermissionsAsync();
      if (!cancelled) await applyStatus(requested);
    }
    void check();
    return () => {
      cancelled = true;
    };
  }, [applyStatus]);

  const request = useCallback(async () => {
    const status = await Location.requestForegroundPermissionsAsync();
    await applyStatus(status);
  }, [applyStatus]);

  const getFreshPosition = useCallback(async (): Promise<Coordinates | null> => {
    const status = await Location.getForegroundPermissionsAsync();
    if (!status.granted) {
      setPermission(status.canAskAgain ? "denied" : "blocked");
      return null;
    }
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    }).catch(() => null);
    if (!position) return null;
    const fresh = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };
    setCoords(fresh);
    return fresh;
  }, []);

  const reason =
    permission === "blocked"
      ? BLOCKED_REASON
      : permission === "denied"
        ? DENIED_REASON
        : null;

  return { permission, coords, reason, request, getFreshPosition };
}
