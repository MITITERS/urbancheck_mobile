/** Consultas de avisos. Ver `queries/reports.ts` sobre por qué van aparte. */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getNotificationPreferences,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../api/notifications";
import { notificationKeys } from "../lib/queryKeys";

/** La bandeja de avisos. */
export function useNotifications(page = 1) {
  return useQuery({
    queryKey: notificationKeys.list({ page }),
    queryFn: () => listNotifications(page),
  });
}

/** Las preferencias de aviso del usuario. */
export function useNotificationPreferences() {
  return useQuery({
    queryKey: notificationKeys.list({ preferences: true }),
    queryFn: getNotificationPreferences,
  });
}

/**
 * Marcar como leído, con el contador y la lista al día.
 *
 * Se invalida el dominio entero y no solo la lista: el badge de la pestaña sale
 * de otra consulta, y sin esto seguía mostrando el número viejo hasta el
 * siguiente sondeo.
 */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}
