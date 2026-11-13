import { render, screen, userEvent } from "@testing-library/react-native";

import ReportFilterBar, {
  EMPTY_FILTERS,
  countActiveFilters,
  type ReportFilterState,
} from "../ReportFilterBar";
import {
  CATEGORY_LABEL,
  FILTERABLE_STATUS_VALUES,
  STATUS_LABEL,
} from "../../reports/labels";

/**
 * Barra de búsqueda y filtros compartida por el feed y el mapa (US-006, US-020).
 *
 * Es una prueba de regresión: el componente lo comparten las dos pantallas, así
 * que un cambio acá se lleva puestas ambas. El estado vive afuera —el
 * componente solo emite el próximo estado completo—, y eso es lo que se afirma.
 */

jest.mock("@expo/vector-icons", () => {
  const { View } = jest.requireActual("react-native");
  return { Ionicons: View };
});

function renderBar(filters: Partial<ReportFilterState> = {}, resultLabel?: string) {
  const onChange = jest.fn();
  render(
    <ReportFilterBar
      filters={{ ...EMPTY_FILTERS, ...filters }}
      onChange={onChange}
      resultLabel={resultLabel}
    />,
  );
  return { onChange, user: userEvent.setup() };
}

/** Despliega el panel de chips, que arranca colapsado. */
async function expand(user: ReturnType<typeof userEvent.setup>) {
  await user.press(screen.getByLabelText("Mostrar filtros"));
}

describe("countActiveFilters", () => {
  it("sin filtros cuenta cero", () => {
    expect(countActiveFilters(EMPTY_FILTERS)).toBe(0);
  });

  it("la búsqueda no cuenta como filtro", () => {
    // Tiene su propio campo visible: sumarla al contador del botón haría creer
    // que hay un chip activo que no está.
    expect(countActiveFilters({ ...EMPTY_FILTERS, search: "bache" })).toBe(0);
  });

  it("suma categorías y estados", () => {
    expect(
      countActiveFilters({
        search: "",
        categories: ["bache", "basura"],
        statuses: ["reportado"],
      }),
    ).toBe(3);
  });
});

describe("ReportFilterBar, búsqueda", () => {
  it("emite el término escrito conservando el resto del estado", async () => {
    const { onChange, user } = renderBar({ categories: ["bache"] });

    await user.type(screen.getByPlaceholderText(/Buscar por palabra clave/), "vereda");

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ categories: ["bache"] }),
    );
  });

  it("sin texto no ofrece limpiar la búsqueda", () => {
    renderBar();

    expect(screen.queryByLabelText("Limpiar búsqueda")).toBeNull();
  });

  it("con texto, limpiar deja la búsqueda vacía sin tocar los chips", async () => {
    const { onChange, user } = renderBar({ search: "bache", statuses: ["reportado"] });

    await user.press(screen.getByLabelText("Limpiar búsqueda"));

    expect(onChange).toHaveBeenCalledWith({
      search: "",
      categories: [],
      statuses: ["reportado"],
    });
  });

  it("muestra el texto de resultados cuando la pantalla se lo pasa", () => {
    renderBar({}, "12 reportes");

    expect(screen.getByText("12 reportes")).toBeTruthy();
  });
});

describe("ReportFilterBar, panel de chips", () => {
  it("arranca colapsado: la búsqueda es lo frecuente", () => {
    renderBar();

    expect(screen.queryByText("Categoría")).toBeNull();
  });

  it("se despliega desde el botón de filtros", async () => {
    const { user } = renderBar();

    await expand(user);

    expect(screen.getByText("Categoría")).toBeTruthy();
    expect(screen.getByText("Estado")).toBeTruthy();
  });

  it("ofrece las seis categorías", async () => {
    const { user } = renderBar();

    await expand(user);

    for (const label of Object.values(CATEGORY_LABEL)) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it("no ofrece filtrar por estados que el feed nunca muestra", async () => {
    // Cancelado y archivado no viajan en el feed público: ofrecerlos sería
    // ofrecer un filtro que siempre devuelve vacío.
    const { user } = renderBar();

    await expand(user);

    expect(screen.queryByText(STATUS_LABEL.cancelado)).toBeNull();
    expect(screen.queryByText(STATUS_LABEL.archivado)).toBeNull();
    for (const status of FILTERABLE_STATUS_VALUES) {
      expect(screen.getByText(STATUS_LABEL[status])).toBeTruthy();
    }
  });

  it("tocar una categoría la agrega a las ya elegidas", async () => {
    const { onChange, user } = renderBar({ categories: ["bache"] });
    await expand(user);

    await user.press(screen.getByText(CATEGORY_LABEL.basura));

    expect(onChange).toHaveBeenCalledWith({
      search: "",
      categories: ["bache", "basura"],
      statuses: [],
    });
  });

  it("volver a tocarla la quita", async () => {
    const { onChange, user } = renderBar({ categories: ["bache", "basura"] });
    await expand(user);

    await user.press(screen.getByText(CATEGORY_LABEL.bache));

    expect(onChange).toHaveBeenCalledWith({
      search: "",
      categories: ["basura"],
      statuses: [],
    });
  });

  it("tocar un estado lo agrega", async () => {
    const { onChange, user } = renderBar();
    await expand(user);

    await user.press(screen.getByText(STATUS_LABEL.en_proceso));

    expect(onChange).toHaveBeenCalledWith({
      search: "",
      categories: [],
      statuses: ["en_proceso"],
    });
  });
});

describe("ReportFilterBar, limpiar filtros", () => {
  it("sin filtros activos no ofrece limpiarlos", async () => {
    const { user } = renderBar();
    await expand(user);

    expect(screen.queryByText("Limpiar filtros")).toBeNull();
  });

  it("limpiar descarta chips pero conserva la búsqueda escrita", async () => {
    // Son dos cosas distintas: quien buscó «Corrientes» y filtró por bache
    // espera que limpiar los chips no le borre lo que escribió.
    const { onChange, user } = renderBar({
      search: "Corrientes",
      categories: ["bache"],
      statuses: ["reportado"],
    });
    await expand(user);

    await user.press(screen.getByText("Limpiar filtros"));

    expect(onChange).toHaveBeenCalledWith({
      search: "Corrientes",
      categories: [],
      statuses: [],
    });
  });
});
