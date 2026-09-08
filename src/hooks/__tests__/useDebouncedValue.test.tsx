import { act, renderHook } from "@testing-library/react-native";

import { useDebouncedValue } from "../useDebouncedValue";

/**
 * US-006 y US-020: la barra de búsqueda del feed y del mapa no debe disparar una
 * petición por cada tecla.
 */

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("useDebouncedValue", () => {
  it("returns the initial value straight away", () => {
    const { result } = renderHook(() => useDebouncedValue("bache"));
    expect(result.current).toBe("bache");
  });

  it("does not expose the new value before the delay elapses", () => {
    const { result, rerender } = renderHook<string, { value: string }>(
      ({ value }) => useDebouncedValue(value, 400),
      { initialProps: { value: "" } },
    );

    rerender({ value: "b" });
    act(() => {
      jest.advanceTimersByTime(399);
    });

    expect(result.current).toBe("");
  });

  it("exposes the value once the delay elapses", () => {
    const { result, rerender } = renderHook<string, { value: string }>(
      ({ value }) => useDebouncedValue(value, 400),
      { initialProps: { value: "" } },
    );

    rerender({ value: "bache" });
    act(() => {
      jest.advanceTimersByTime(400);
    });

    expect(result.current).toBe("bache");
  });

  it("keystrokes in a row settle on the last one only", () => {
    const { result, rerender } = renderHook<string, { value: string }>(
      ({ value }) => useDebouncedValue(value, 400),
      { initialProps: { value: "" } },
    );

    for (const value of ["b", "ba", "bac", "bach", "bache"]) {
      rerender({ value });
      act(() => {
        jest.advanceTimersByTime(100);
      });
    }
    expect(result.current).toBe("");

    act(() => {
      jest.advanceTimersByTime(400);
    });
    expect(result.current).toBe("bache");
  });

  it("clearing the box also goes through the debounce", () => {
    const { result, rerender } = renderHook<string, { value: string }>(
      ({ value }) => useDebouncedValue(value, 400),
      { initialProps: { value: "bache" } },
    );

    rerender({ value: "" });
    act(() => {
      jest.advanceTimersByTime(400);
    });

    expect(result.current).toBe("");
  });

  it("cancels the pending timer when unmounted", () => {
    const clearSpy = jest.spyOn(global, "clearTimeout");
    const { unmount, rerender } = renderHook<string, { value: string }>(
      ({ value }) => useDebouncedValue(value, 400),
      { initialProps: { value: "" } },
    );

    rerender({ value: "bache" });
    unmount();

    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });

  it("works with a non-string value", () => {
    const { result, rerender } = renderHook<string[], { value: string[] }>(
      ({ value }) => useDebouncedValue(value, 200),
      { initialProps: { value: ["bache"] } },
    );

    rerender({ value: ["bache", "basura"] });
    act(() => {
      jest.advanceTimersByTime(200);
    });

    expect(result.current).toEqual(["bache", "basura"]);
  });
});
