import { useCallback, useEffect, useRef } from "react";
import { useWindowDimensions } from "react-native";
import type { NativeScrollEvent, NativeSyntheticEvent, ScrollView } from "react-native";

import { useKeyboardOffset } from "./useKeyboardVisible";

/** Aire entre el campo enfocado y el borde superior del teclado. */
const BREATHING_ROOM = 16;

/** Lo único que se le pide al campo: poder decir dónde quedó en pantalla. */
type Measurable = {
  measureInWindow(
    callback: (x: number, y: number, width: number, height: number) => void,
  ): void;
};

/**
 * Mantiene visible el campo enfocado cuando se abre el teclado.
 *
 * El problema que resuelve: en un formulario largo, los campos de abajo quedan
 * tapados por el teclado y uno escribe a ciegas. `KeyboardAvoidingView` no
 * alcanza —solo hace lugar, no mueve el scroll hasta el campo— y encima se
 * comporta distinto en cada plataforma.
 *
 * Acá no se deduce nada de `Platform.OS`: se **mide**. `useKeyboardOffset()`
 * dice cuánto tapa el teclado de verdad, contemplando que en Android
 * *edge-to-edge* la ventana no se achica; después se mide dónde quedó el campo
 * y se scrollea solo lo que falta. Por eso funciona igual en iOS y en Android
 * sin una sola rama por plataforma.
 *
 * El scroll se corrige cuando cambia el alto del teclado y no al enfocar,
 * porque al momento del `focus` el teclado todavía no ocupa nada: corregir ahí
 * daría cero.
 */
export function useKeyboardAwareScroll() {
  const scrollRef = useRef<ScrollView>(null);
  const scrollOffset = useRef(0);
  const focusedField = useRef<Measurable | null>(null);
  const keyboardOffset = useKeyboardOffset();
  const { height: windowHeight } = useWindowDimensions();

  const revealFocusedField = useCallback(() => {
    const field = focusedField.current;
    if (!field || keyboardOffset === 0) return;

    field.measureInWindow((_x, y, _width, height) => {
      const keyboardTop = windowHeight - keyboardOffset;
      const hiddenBy = y + height + BREATHING_ROOM - keyboardTop;
      // Solo se mueve si de verdad está tapado: un campo que ya se ve no tiene
      // por qué saltar cuando aparece el teclado.
      if (hiddenBy > 0) {
        scrollRef.current?.scrollTo({
          y: scrollOffset.current + hiddenBy,
          animated: true,
        });
      }
    });
  }, [keyboardOffset, windowHeight]);

  useEffect(revealFocusedField, [revealFocusedField]);

  /** Se llama desde el `onFocus` del campo, con su ref. */
  const focusField = useCallback(
    (field: { current: Measurable | null }) => {
      focusedField.current = field.current;
      // Saltar de un campo a otro con el teclado ya abierto no cambia su alto,
      // así que el efecto de arriba no se dispara y hay que corregir acá.
      revealFocusedField();
    },
    [revealFocusedField],
  );

  return {
    /**
     * Cuánto tapa el teclado. Se suma al `paddingBottom` del contenido: sin ese
     * espacio extra el scroll no tiene a dónde ir y el último campo no puede
     * subir por encima del teclado.
     */
    keyboardOffset,
    focusField,
    scrollViewProps: {
      ref: scrollRef,
      onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        scrollOffset.current = event.nativeEvent.contentOffset.y;
      },
      scrollEventThrottle: 16,
      // Un tap sobre una sugerencia no tiene que perderse cerrando el teclado.
      keyboardShouldPersistTaps: "handled" as const,
    },
  };
}
