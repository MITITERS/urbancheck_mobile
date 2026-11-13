/**
 * Textos de compartir un reporte (US-030).
 */
export const shareMessages = {
  button: "Compartir",
  sheetTitle: "Compartir el reporte",
  sheetHint: "Sumá más vecinos al reclamo: cuantos más lo conocen, más visible es.",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  copy: "Copiar enlace",
  copied: "Enlace copiado",
  more: "Más opciones",
  cancel: "Cancelar",
  /** El texto que acompaña al enlace en el mensaje. */
  message: (category: string, address: string) =>
    address
      ? `Mirá este reclamo en UrbanCheck: ${category} en ${address}.`
      : `Mirá este reclamo en UrbanCheck: ${category}.`,
  opening: "Abriendo el reporte…",
  unavailableTitle: "Este reporte ya no está disponible",
  unavailableBody:
    "Puede haberse resuelto y archivado, o su autor lo eliminó. Gracias por interesarte en tu barrio.",
  discardedBody: "El municipio descartó este reporte. Este es el motivo:",
  signInToOpen: "Iniciá sesión para verlo en la app",
  goHome: "Ir al inicio",
} as const;
