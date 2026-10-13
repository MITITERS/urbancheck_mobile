import { useState } from "react";
import { Alert } from "react-native";

import { describeApiError } from "../api/errors";
import { privacyRequestConflict, requestPrivacyReview } from "../api/reports";
import { useInvalidateReports } from "../queries/reports";

/**
 * El motivo de US-043, tal como se le presenta a quien denuncia una imagen.
 *
 * El botón *Denunciar* de US-021 (`ComplaintModal`) ofrece este mismo motivo
 * junto a los de contenido, con el catálogo que manda el servidor. Este hook
 * queda para lo que aquel no cubre: la foto de un cierre del operario, y el
 * autor que pide la revisión de su propia foto.
 */
export const PERSONAL_DATA_REASON =
  "Muestra un rostro o una patente sin difuminar";

const CONFLICT_TITLE = {
  privacy_request_pending: "Ya denunciaste esta imagen",
  image_already_removed: "La imagen ya se retiró",
} as const;

/**
 * Denunciar una imagen con un dato personal visible (US-043).
 *
 * `onSubmitted` corre después de que el vecino cierra la confirmación. Lo usa
 * el detalle para salir del reporte: para cualquiera que no sea el autor, el
 * reporte acaba de dejar de existir en las vistas públicas.
 */
export function usePrivacyReview({
  reportId,
  onSubmitted,
}: {
  reportId: number;
  onSubmitted?: () => void;
}) {
  const invalidateReports = useInvalidateReports();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(evidenceId?: number) {
    setIsSubmitting(true);
    try {
      const receipt = await requestPrivacyReview(reportId, evidenceId);
      // El reporte sale del feed y del mapa en el mismo momento.
      invalidateReports();
      Alert.alert("Solicitud recibida", receipt.detail, [
        { text: "Entendido", onPress: onSubmitted },
      ]);
    } catch (error) {
      const conflict = privacyRequestConflict(error);
      if (conflict) {
        const detail = (error as { detail?: string }).detail ?? "";
        Alert.alert(CONFLICT_TITLE[conflict], detail);
        return;
      }
      const described = describeApiError(error, "No se pudo enviar la denuncia");
      Alert.alert(described.title, described.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  /** Abre la elección de motivo. Sin `evidenceId`, es la foto del reporte. */
  function report(evidenceId?: number) {
    if (isSubmitting) return;
    Alert.alert(
      "Denunciar imagen",
      "¿Qué problema tiene esta imagen? El reporte se oculta mientras la revisamos.",
      [
        { text: PERSONAL_DATA_REASON, onPress: () => void submit(evidenceId) },
        { text: "Cancelar", style: "cancel" },
      ],
    );
  }

  return { report, isSubmitting };
}
