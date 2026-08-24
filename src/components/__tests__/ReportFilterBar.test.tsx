import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";

import ReportFilterBar, {
  EMPTY_FILTERS,
  countActiveFilters,
  type ReportFilterState,
} from "../ReportFilterBar";

// Los íconos son decorativos y arrastran expo-font, que necesita el runtime nativo.
// Lo que se prueba acá es el comportamiento de los filtros, no el glifo.
jest.mock("@expo/vector-icons", () => {
  const { View } = require("react-native");
  return { Ionicons: View };
});

/**
 * US-006 y US-020: la barra la comparten el feed y el mapa, así que un cambio de
 * comportamiento acá afecta a las dos pantallas a la vez.
 */

const SEARCH_PLACEHOLDER = "Buscar por palabra clave o zona…";

function setup(filters: ReportFilterState = EMPTY_FILTERS, resultLabel?: string) {
  const onChange = jest.fn();
  render(
    <ReportFilterBar filters={filters} onChange={onChange} resultLabel={resultLabel} />,
  );
  return { onChange };
}

describe("countActiveFilters", () => {
  it("counts nothing when no chip is selected", () => {
    expect(countActiveFilters(EMPTY_FILTERS)).toBe(0);
  });

  it("adds categories and statuses together", () => {
    expect(
      countActiveFilters({
        search: "bache",
        categories: ["bache", "basura"],
        statuses: ["resuelto"],
      }),
    ).toBe(3);
  });

  it("ignores the search term", () => {
    expect(countActiveFilters({ ...EMPTY_FILTERS, search: "bache" })).toBe(0);
  });
});

describe("ReportFilterBar search", () => {
  it("reports each keystroke upwards", () => {
    const { onChange } = setup();
    fireEvent.changeText(screen.getByPlaceholderText(SEARCH_PLACEHOLDER), "bache");
    expect(onChange).toHaveBeenCalledWith({ ...EMPTY_FILTERS, search: "bache" });
  });

  it("keeps the chips when the term changes", () => {
    const filters: ReportFilterState = {
      search: "",
      categories: ["bache"],
      statuses: ["resuelto"],
    };
    const { onChange } = setup(filters);
    fireEvent.changeText(screen.getByPlaceholderText(SEARCH_PLACEHOLDER), "sabattini");
    expect(onChange).toHaveBeenCalledWith({ ...filters, search: "sabattini" });
  });

  it("hides the clear button when the box is empty", () => {
    setup();
    expect(screen.queryByLabelText("Limpiar búsqueda")).toBeNull();
  });

  it("clears the term with the X (US-020: volver a ver todo)", () => {
    const { onChange } = setup({ ...EMPTY_FILTERS, search: "bache" });
    fireEvent.press(screen.getByLabelText("Limpiar búsqueda"));
    expect(onChange).toHaveBeenCalledWith({ ...EMPTY_FILTERS, search: "" });
  });
});

describe("ReportFilterBar chips", () => {
  it("starts collapsed so the search box gets the room", () => {
    setup();
    expect(screen.queryByText("Categoría")).toBeNull();
  });

  it("opens the panel with the filters button", () => {
    setup();
    fireEvent.press(screen.getByLabelText("Mostrar filtros"));
    expect(screen.getByText("Categoría")).toBeTruthy();
    expect(screen.getByText("Estado")).toBeTruthy();
  });

  it("selects a category (US-006)", () => {
    const { onChange } = setup();
    fireEvent.press(screen.getByLabelText("Mostrar filtros"));
    fireEvent.press(screen.getByText("Bache"));
    expect(onChange).toHaveBeenCalledWith({ ...EMPTY_FILTERS, categories: ["bache"] });
  });

  it("deselects a category that was already active", () => {
    const { onChange } = setup({ ...EMPTY_FILTERS, categories: ["bache"] });
    fireEvent.press(screen.getByLabelText("Mostrar filtros"));
    fireEvent.press(screen.getByText("Bache"));
    expect(onChange).toHaveBeenCalledWith({ ...EMPTY_FILTERS, categories: [] });
  });

  it("accumulates several categories", () => {
    const { onChange } = setup({ ...EMPTY_FILTERS, categories: ["bache"] });
    fireEvent.press(screen.getByLabelText("Mostrar filtros"));
    fireEvent.press(screen.getByText("Basura"));
    expect(onChange).toHaveBeenCalledWith({
      ...EMPTY_FILTERS,
      categories: ["bache", "basura"],
    });
  });

  it("selects a status", () => {
    const { onChange } = setup();
    fireEvent.press(screen.getByLabelText("Mostrar filtros"));
    fireEvent.press(screen.getByText("Resuelto"));
    expect(onChange).toHaveBeenCalledWith({ ...EMPTY_FILTERS, statuses: ["resuelto"] });
  });

  it("does not offer cancelado or archivado", () => {
    setup();
    fireEvent.press(screen.getByLabelText("Mostrar filtros"));
    expect(screen.queryByText("Cancelado")).toBeNull();
    expect(screen.queryByText("Archivado")).toBeNull();
  });

  it("shows how many filters are active", () => {
    setup({ search: "", categories: ["bache", "basura"], statuses: ["resuelto"] });
    expect(screen.getByText("3")).toBeTruthy();
  });

  it("clears every chip but keeps the search term", () => {
    const { onChange } = setup({
      search: "bache",
      categories: ["bache"],
      statuses: ["resuelto"],
    });
    fireEvent.press(screen.getByLabelText("Mostrar filtros"));
    fireEvent.press(screen.getByText("Limpiar filtros"));
    expect(onChange).toHaveBeenCalledWith({
      search: "bache",
      categories: [],
      statuses: [],
    });
  });

  it("hides the clear button when nothing is selected", () => {
    setup();
    fireEvent.press(screen.getByLabelText("Mostrar filtros"));
    expect(screen.queryByText("Limpiar filtros")).toBeNull();
  });
});

describe("ReportFilterBar result label", () => {
  it("shows the result count the map passes in", () => {
    setup(EMPTY_FILTERS, "3 reportes encontrados");
    expect(screen.getByText("3 reportes encontrados")).toBeTruthy();
  });

  it("shows nothing when the screen does not pass one", () => {
    setup();
    expect(screen.queryByText(/reportes encontrados/)).toBeNull();
  });
});
