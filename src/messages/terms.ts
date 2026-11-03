/**
 * Textos de la aceptación de los términos y condiciones y la política de
 * privacidad (RN-10). Se aceptan juntos, así que cada texto nombra a los dos.
 */
export const termsMessages = {
  checkbox: "Leí y acepto los términos y condiciones y la política de privacidad",
  open: "Ver términos y política de privacidad",
  required:
    "Para crear la cuenta tenés que aceptar los términos y condiciones y la política de privacidad.",
  modalTitle: "Términos y privacidad",
  modalClose: "Cerrar",
  version: (version: string) => `Versión ${version}`,
  gateTitle: "Términos y privacidad",
  gateIntro:
    "Para seguir usando UrbanCheck tenés que leer y aceptar los términos y condiciones y la política de privacidad vigentes.",
  accept: "Acepto",
  signOut: "Cerrar sesión",
  loadError: "No pudimos cargar los términos y la política de privacidad.",
  retry: "Reintentar",
  acceptError: "No pudimos registrar tu aceptación. Probá de nuevo.",
} as const;
