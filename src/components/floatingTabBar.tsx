import { BottomTabBar, type BottomTabBarProps } from "expo-router/js-tabs";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * La barra de pestañas flotante (la «isla» inferior) y sus medidas.
 *
 * La barra está posicionada en absoluto sobre el contenido, así que no le quita
 * espacio a las pantallas: cada una tiene que reservárselo con
 * `useFloatingTabBarInset()` o el final de su contenido queda tapado.
 */

/** Alto de la barra en sí (`tabBarStyle.height`). */
export const TAB_BAR_HEIGHT = 65;

/** Separación con el borde inferior de la pantalla, con y sin safe area. */
export const TAB_BAR_GAP_WITH_SAFE_AREA = 4;
export const TAB_BAR_GAP_WITHOUT_SAFE_AREA = 12;

/** Aire entre el final del contenido y la barra, para que no queden pegados. */
export const TAB_BAR_CONTENT_BREATHING_ROOM = 16;

/** A qué distancia del borde inferior arranca la barra. */
export function useFloatingTabBarBottom(): number {
  const insets = useSafeAreaInsets();
  return insets.bottom > 0
    ? insets.bottom + TAB_BAR_GAP_WITH_SAFE_AREA
    : TAB_BAR_GAP_WITHOUT_SAFE_AREA;
}

/**
 * Espacio que una pantalla scrolleable tiene que dejar libre abajo para que su
 * último elemento quede por encima de la barra y siga siendo usable.
 */
export function useFloatingTabBarInset(): number {
  return (
    useFloatingTabBarBottom() + TAB_BAR_HEIGHT + TAB_BAR_CONTENT_BREATHING_ROOM
  );
}

/**
 * La isla: la barra flotando sobre el contenido.
 *
 * Dos cosas que no son obvias, y que juntas hacían desaparecer el badge de la
 * campana:
 *
 * 1. **El safe area se cuenta una sola vez.** Este contenedor ya levanta la
 *    barra por encima del home indicator (`useFloatingTabBarBottom()`), pero
 *    `BottomTabBar` agrega además `paddingBottom: insets.bottom` por su cuenta.
 *    Con `height: 65` y `paddingTop: 8` fijados desde `tabBarStyle`, esos ~34px
 *    de más dejaban 23px de alto útil para íconos de 28: todo se comprimía y se
 *    iba hacia arriba. Por eso se le pasan los insets con el `bottom` en cero.
 *
 * 2. **Nada de `overflow: "hidden"`.** El badge se dibuja en `top: -3` respecto
 *    del ícono, o sea deliberadamente fuera de su caja: recortar el contenedor
 *    lo borra. Las esquinas redondeadas las da este contenedor, que es el que
 *    pinta el fondo; la barra va transparente encima (`tabBarStyle`).
 *
 * Y una tercera, que solo se ve en Android: `BottomTabBar` trae `elevation: 8`
 * en su propio estilo. La elevación de Android dibuja la sombra con la forma
 * del borde del elemento, y ese elemento es un rectángulo: aparecía una sombra
 * recta cruzando las esquinas redondeadas de la isla. Se apaga desde
 * `tabBarStyle` —que se aplica último y gana—; la sombra la pone esta isla, que
 * sí es redondeada. En iOS no se notaba porque `elevation` no hace nada ahí.
 */
export function FloatingTabBar(props: BottomTabBarProps) {
  const bottom = useFloatingTabBarBottom();
  // `useWindowDimensions` y no `Dimensions.get()`: aquel se lee una sola vez y
  // no vuelve a mirar. Al rotar, en pantalla dividida o en un plegable, la isla
  // se quedaba con los márgenes de la medida vieja y terminaba descentrada o
  // saliéndose de la pantalla.
  const { width } = useWindowDimensions();
  const horizontalMargin = width * 0.05;

  return (
    <View
      style={[
        styles.island,
        { bottom, left: horizontalMargin, right: horizontalMargin },
      ]}
    >
      <BottomTabBar {...props} insets={{ ...props.insets, bottom: 0 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  island: {
    position: "absolute",
    borderRadius: 32,
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: "#f0f0f0",
  },
});
