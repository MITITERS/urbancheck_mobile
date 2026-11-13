import { act, renderHook } from "@testing-library/react-native";
import { Keyboard } from "react-native";

import { useKeyboardOffset } from "../useKeyboardVisible";

// El alto de la ventana lo controla el test: es la mitad del cálculo, y es
// justo lo que distingue a una plataforma que achica la ventana de una que no.
const windowHeight = { current: 800 };
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
  default: () => ({ width: 400, height: windowHeight.current, scale: 2, fontScale: 1 }),
}));

const KEYBOARD = 300;

/** Los listeners que registró el hook, para poder dispararlos desde el test. */
const listeners: Record<string, (event: unknown) => void> = {};

function showKeyboard() {
  act(() => {
    // El nombre del evento depende de la plataforma (`Will` en iOS, `Did` en
    // Android): se dispara el que el hook haya registrado.
    for (const event of Object.keys(listeners)) {
      if (event.endsWith("Show")) {
        listeners[event]({ endCoordinates: { height: KEYBOARD } });
      }
    }
  });
}

beforeEach(() => {
  windowHeight.current = 800;
  for (const key of Object.keys(listeners)) delete listeners[key];
  jest.spyOn(Keyboard, "addListener").mockImplementation((event, callback) => {
    listeners[event] = callback as (e: unknown) => void;
    return { remove: jest.fn() } as never;
  });
});

describe("useKeyboardOffset", () => {
  it("levanta el alto completo si la ventana no se achica", () => {
    // El caso de iOS, y el de Android en modo edge-to-edge: el teclado se
    // dibuja encima y la ventana queda igual.
    const { result } = renderHook(() => useKeyboardOffset());

    showKeyboard();

    expect(result.current).toBe(KEYBOARD);
  });

  it("no levanta nada si la ventana ya se achicó sola", () => {
    // El `adjustResize` clásico de Android: sumarle el alto del teclado dejaría
    // el cajón flotando a media pantalla.
    const { result, rerender } = renderHook(() => useKeyboardOffset());

    windowHeight.current = 800 - KEYBOARD;
    showKeyboard();
    rerender({});

    expect(result.current).toBe(0);
  });

  it("con el teclado cerrado no levanta nada", () => {
    const { result } = renderHook(() => useKeyboardOffset());

    expect(result.current).toBe(0);
  });
});
