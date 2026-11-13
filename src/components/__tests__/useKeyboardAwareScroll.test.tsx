import { act, renderHook } from "@testing-library/react-native";
import { Keyboard } from "react-native";

import { useKeyboardAwareScroll } from "../useKeyboardAwareScroll";

/**
 * Mantener visible el campo enfocado cuando sube el teclado.
 *
 * La ventana no se achica —el caso de iOS y el de Android *edge-to-edge*—, así
 * que el teclado tapa los últimos 300 px de los 800 de alto: todo lo que quede
 * por debajo de y=500 hay que subirlo.
 */
jest.mock("react-native/src/private/specs_DEPRECATED/modules/NativeDeviceInfo", () => ({
  __esModule: true,
  default: {
    getConstants: () => ({
      window: { width: 400, height: 800, scale: 2, fontScale: 1 },
      screen: { width: 400, height: 800, scale: 2, fontScale: 1 },
    }),
  },
}));
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: 400, height: 800, scale: 2, fontScale: 1 }),
}));

const WINDOW = 800;
const KEYBOARD = 300;
const KEYBOARD_TOP = WINDOW - KEYBOARD;
/** El mismo aire que deja el hook entre el campo y el teclado. */
const BREATHING_ROOM = 16;

const listeners: Record<string, (event: unknown) => void> = {};

function showKeyboard() {
  act(() => {
    for (const event of Object.keys(listeners)) {
      if (event.endsWith("Show")) {
        listeners[event]({ endCoordinates: { height: KEYBOARD } });
      }
    }
  });
}

/** Un campo que dice estar en `y`, como lo diría un `TextInput` real. */
function fieldAt(y: number, height = 44) {
  return {
    current: {
      measureInWindow: (
        callback: (x: number, y: number, width: number, height: number) => void,
      ) => callback(0, y, 300, height),
    },
  };
}

/** El `scrollTo` que el hook le pide al ScrollView. */
function attachScrollView(result: { current: ReturnType<typeof useKeyboardAwareScroll> }) {
  const scrollTo = jest.fn();
  // El ref es el mismo objeto que el hook expone en `scrollViewProps`.
  (result.current.scrollViewProps.ref as { current: unknown }).current = { scrollTo };
  return scrollTo;
}

beforeEach(() => {
  for (const key of Object.keys(listeners)) delete listeners[key];
  jest.spyOn(Keyboard, "addListener").mockImplementation((event, callback) => {
    listeners[event] = callback as (e: unknown) => void;
    return { remove: jest.fn() } as never;
  });
});

describe("useKeyboardAwareScroll", () => {
  it("sube el campo que el teclado tapa", () => {
    const { result } = renderHook(() => useKeyboardAwareScroll());
    const scrollTo = attachScrollView(result);

    // Un campo abajo de todo: la dirección del formulario de reporte.
    act(() => result.current.focusField(fieldAt(700)));
    showKeyboard();

    const hiddenBy = 700 + 44 + BREATHING_ROOM - KEYBOARD_TOP;
    expect(scrollTo).toHaveBeenCalledWith({ y: hiddenBy, animated: true });
  });

  it("no mueve nada si el campo ya se ve por encima del teclado", () => {
    const { result } = renderHook(() => useKeyboardAwareScroll());
    const scrollTo = attachScrollView(result);

    act(() => result.current.focusField(fieldAt(100)));
    showKeyboard();

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("con el teclado cerrado no scrollea aunque se enfoque un campo", () => {
    // Al enfocar, el teclado todavía no ocupa nada: corregir ahí daría cero.
    const { result } = renderHook(() => useKeyboardAwareScroll());
    const scrollTo = attachScrollView(result);

    act(() => result.current.focusField(fieldAt(700)));

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("acompaña el salto de un campo a otro con el teclado ya abierto", () => {
    // No cambia el alto del teclado, así que no alcanza con reaccionar a eso.
    const { result } = renderHook(() => useKeyboardAwareScroll());
    const scrollTo = attachScrollView(result);
    act(() => result.current.focusField(fieldAt(100)));
    showKeyboard();
    expect(scrollTo).not.toHaveBeenCalled();

    act(() => result.current.focusField(fieldAt(700)));

    expect(scrollTo).toHaveBeenCalledTimes(1);
  });

  it("cuenta desde dónde está el scroll, no desde el principio", () => {
    const { result } = renderHook(() => useKeyboardAwareScroll());
    const scrollTo = attachScrollView(result);
    act(() =>
      result.current.scrollViewProps.onScroll({
        nativeEvent: { contentOffset: { y: 250 } },
      } as never),
    );

    act(() => result.current.focusField(fieldAt(700)));
    showKeyboard();

    const hiddenBy = 700 + 44 + BREATHING_ROOM - KEYBOARD_TOP;
    expect(scrollTo).toHaveBeenCalledWith({ y: 250 + hiddenBy, animated: true });
  });

  it("expone cuánto tapa el teclado, para hacerle lugar abajo", () => {
    const { result } = renderHook(() => useKeyboardAwareScroll());

    showKeyboard();

    expect(result.current.keyboardOffset).toBe(KEYBOARD);
  });
});
