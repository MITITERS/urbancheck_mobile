/**
 * Textos del descarte por moderación municipal y su apelación (US-049).
 *
 * El motivo del descarte es público: cualquier vecino que abra el reporte lo
 * lee. La apelación es solo del autor; la resuelven el municipio o la
 * plataforma.
 */
export const moderationMessages = {
  bannerTitle: "El municipio descartó este reporte",
  noticeTitle: "Reporte descartado",
  noticeBody:
    "El municipio revisó denuncias de otros vecinos sobre este reporte y lo descartó. Ya no aparece en el feed ni en el mapa.",
  reasonLabel: "Motivo",
  decidedAt: (date: string) => `Decidido el ${date}`,
  appealButton: "Apelar la decisión",
  appealHint:
    "Si creés que es un reclamo legítimo, podés apelar. Tu apelación se revisa de nuevo, y es una sola.",
  appealPending:
    "Apelaste esta decisión y la estamos revisando. Mientras tanto el reporte sigue descartado.",
  appealRejected: "Revisamos tu apelación y se mantuvo el descarte.",
  appealResolutionLabel: "Respuesta",
  formTitle: "Apelar el descarte",
  formIntro:
    "Contá por qué tu reporte es un reclamo legítimo. Se va a revisar de nuevo la decisión.",
  formWarning:
    "Podés apelar una sola vez. Si se mantiene el descarte, la decisión es definitiva.",
  formPlaceholder: "Por ejemplo: el problema existe, lo ves si pasás por la esquina",
  formSubmit: "Enviar apelación",
  missingReasonTitle: "Falta el motivo",
  missingReasonBody: "Contá por qué tu reporte es un reclamo legítimo.",
  submitError: "No pudimos registrar tu apelación",
} as const;
