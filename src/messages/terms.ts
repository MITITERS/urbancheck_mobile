/**
 * Textos de la aceptación de los términos y condiciones (RN-10).
 */
export const termsMessages = {
  checkbox: "Leí y acepto los términos y condiciones",
  open: "Ver términos y condiciones",
  required: "Para crear la cuenta tenés que aceptar los términos y condiciones.",
  modalTitle: "Términos y condiciones",
  modalClose: "Cerrar",
  version: (version: string) => `Versión ${version}`,
  gateTitle: "Términos y condiciones",
  gateIntro:
    "Para seguir usando UrbanCheck tenés que leer y aceptar los términos y condiciones vigentes.",
  accept: "Acepto",
  signOut: "Cerrar sesión",
  loadError: "No pudimos cargar los términos y condiciones.",
  retry: "Reintentar",
  acceptError: "No pudimos registrar tu aceptación. Probá de nuevo.",
} as const;
