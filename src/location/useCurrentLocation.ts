import * as Location from "expo-location";
import { useCallback, useEffect, useState } from "react";

import type { Coordinates } from "./coordinates";

export type LocationPermissionState =
  | "checking"
  | "granted"
  | "denied"
  | "blocked"
  /** La pantalla no necesita ubicación: no se consultó al sistema. */
  | "disabled";

interface CurrentLocationOptions {
  /** Motivo a mostrar cuando el permiso se puede volver a pedir. */
  deniedReason: string;
  /** Motivo cuando quedó bloqueado y solo se arregla desde los ajustes. */
  blockedReason: string;
  /**
   * En `false` el hook no pide nada y queda en `disabled`. Sirve para las
   * pantallas que solo necesitan la ubicación para algunos usuarios: los hooks
   * no se pueden llamar condicionalmente, pero el permiso sí se puede no pedir.
   */
  enabled?: boolean;
}

export interface CurrentLocation {
  permission: LocationPermissionState;
  coords: Coordinates | null;
  /** Motivo legible de por qué no hay ubicación, para explicarlo en pantalla. */
  reason: string | null;
  /** Vuelve a pedir el permiso y la posición; sin efecto si está bloqueado. */
  request: () => Promise<void>;
  /** Posición fresca y de alta precisión, para el momento de actuar. */
  getFreshPosition: () => Promise<Coordinates | null>;
}

/**
 * Ubicación del dispositivo, con los tres casos del permiso resueltos.
 *
 * Vive acá y no en cada pantalla porque ya son dos las que dependen de dónde
 * está el usuario —la validación en terreno y el feed acotado al municipio— y
 * la diferencia entre ellas es únicamente el texto con el que explican para qué
 * la necesitan. El permiso denegado y el denegado de forma permanente se
 * distinguen a propósito: al primero se lo puede volver a pedir desde la app,
 * al segundo solo desde los ajustes del sistema, y son dos mensajes distintos.
 *
 * La posición se pide una vez al entrar; `getFreshPosition` existe para las
 * acciones que necesitan una lectura del momento y no una de hace minutos.
 */
export function useCurrentLocation({
  deniedReason,
  blockedReason,
  enabled = true,
}: CurrentLocationOptions): CurrentLocation {
  const [permission, setPermission] = useState<LocationPermissionState>(
    enabled ? "checking" : "disabled",
  );
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
    if (!enabled) {
      setPermission("disabled");
      setCoords(null);
      return;
    }
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
  }, [applyStatus, enabled]);

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
      ? blockedReason
      : permission === "denied"
        ? deniedReason
        : null;

  return { permission, coords, reason, request, getFreshPosition };
}
