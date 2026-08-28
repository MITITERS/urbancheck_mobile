import { useEffect, useState } from "react";
import { Keyboard, Platform, useWindowDimensions } from "react-native";

/**
 * Alto del teclado en píxeles, o 0 si está cerrado.
 *
 * Se expone el alto y no solo un booleano porque en iOS la ventana no se
 * achica al abrirse el teclado: para dejar algo justo por encima de él hay que
 * saber cuánto ocupa. Medirlo del evento es exacto y no depende de calcular
 * marcos ni de restar el alto de un header, que es donde fallaba el
 * `KeyboardAvoidingView` que había antes.
 *
 * En iOS se escuchan los eventos `Will`, que se disparan al empezar la
 * animación: el layout acompaña al teclado en vez de saltar cuando ya terminó
 * de subir. Android solo emite los `Did`.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvent, (event) =>
      setHeight(event.endCoordinates.height),
    );
    const hide = Keyboard.addListener(hideEvent, () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return height;
}

/** Si el teclado está visible. */
export function useKeyboardVisible(): boolean {
  return useKeyboardHeight() > 0;
}

/**
 * Cuánto hay que levantar un elemento anclado abajo para que el teclado no lo
 * tape.
 *
 * No es lo mismo que el alto del teclado, y depende de algo que **no se puede
 * decidir por plataforma**: si la ventana se achica sola al abrirse el teclado
 * o no.
 *
 * - En iOS nunca se achica: hay que levantar el alto completo.
 * - En Android depende del modo de la ventana. Con `adjustResize` clásico se
 *   achica y no hay que levantar nada; con el modo *edge-to-edge* —el que Expo
 *   activa por defecto desde el SDK 54— la ventana queda del mismo alto y el
 *   teclado se dibuja encima, así que hay que levantarlo igual que en iOS.
 *
 * En vez de adivinar cuál de los dos casos es, se mide: se compara el alto de
 * la ventana con el teclado cerrado contra el actual. Lo que la ventana ya se
 * achicó es espacio que no hay que volver a descontar.
 */
export function useKeyboardOffset(): number {
  const keyboardHeight = useKeyboardHeight();
  const { height: windowHeight } = useWindowDimensions();
  const [heightWithoutKeyboard, setHeightWithoutKeyboard] = useState(windowHeight);

  useEffect(() => {
    // Se toma como referencia el alto con el teclado cerrado, y se vuelve a
    // tomar cada vez que se cierra: así una rotación no deja el valor viejo.
    if (keyboardHeight === 0) setHeightWithoutKeyboard(windowHeight);
  }, [keyboardHeight, windowHeight]);

  const alreadyShrunk = Math.max(0, heightWithoutKeyboard - windowHeight);
  return Math.max(0, keyboardHeight - alreadyShrunk);
}
