/**
 * Medidas de la barra de pestañas flotante.
 *
 * La barra se dibuja en posición absoluta sobre el contenido (ver
 * `app/(app)/(tabs)/_layout.tsx`), así que cualquier pantalla scrolleable tiene
 * que reservar este espacio al final o su último elemento queda tapado.
 */

/** Alto de la barra, igual al `tabBarStyle.height` del layout de pestañas. */
export const TAB_BAR_HEIGHT = 65;

/** Separación de la barra respecto del borde inferior, igual que en el layout. */
function tabBarOffset(bottomInset: number): number {
  return bottomInset > 0 ? bottomInset + 4 : 12;
}

/**
 * Espacio a reservar al final de una lista o scroll para que su contenido no
 * quede debajo de la barra. Incluye un margen de respiro.
 */
export function tabBarClearance(bottomInset: number): number {
  return tabBarOffset(bottomInset) + TAB_BAR_HEIGHT + 16;
}
