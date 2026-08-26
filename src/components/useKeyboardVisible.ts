import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";

/**
 * Si el teclado está visible.
 *
 * En iOS escucha los eventos `Will`, que se disparan al empezar la animación:
 * el layout acompaña al teclado en vez de saltar cuando ya terminó de subir.
 * Android solo emite los `Did`.
 */
export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvent, () => setVisible(true));
    const hide = Keyboard.addListener(hideEvent, () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return visible;
}
