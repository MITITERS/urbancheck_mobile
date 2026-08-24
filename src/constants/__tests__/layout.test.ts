import { TAB_BAR_HEIGHT, tabBarClearance } from "../layout";

/**
 * La barra de pestañas es flotante. Este espacio es el que evita que el último
 * elemento de una lista —o el campo de comentario del detalle— quede tapado.
 */

describe("tabBarClearance", () => {
  it("reserves more than the bar height so the last item breathes", () => {
    expect(tabBarClearance(0)).toBeGreaterThan(TAB_BAR_HEIGHT);
  });

  it("adds the safe-area inset on devices that have one", () => {
    expect(tabBarClearance(34)).toBeGreaterThan(tabBarClearance(0));
  });

  it("uses a fixed margin when there is no inset", () => {
    expect(tabBarClearance(0)).toBe(12 + TAB_BAR_HEIGHT + 16);
  });

  it("grows with the inset", () => {
    expect(tabBarClearance(34)).toBe(34 + 4 + TAB_BAR_HEIGHT + 16);
  });

  it("never returns a negative value", () => {
    expect(tabBarClearance(-10)).toBeGreaterThan(0);
  });
});
