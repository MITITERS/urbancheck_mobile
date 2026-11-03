import { fireEvent, render, screen } from "@testing-library/react-native";
import { readFileSync } from "fs";
import { Linking } from "react-native";
import { resolve } from "path";

import { Markdown } from "../Markdown";

const SAMPLE = `# Título

Un párrafo con **negrita** y *itálica*.

> **En pocas palabras**
> 1. Primero.
> 2. Segundo.

- Ítem con **énfasis**.
- Otro ítem.

| Dato | Para qué |
|---|---|
| Correo | Identificar tu cuenta. |

---

Escribinos a [soporte](mailto:soporte@example.com).
`;

describe("Markdown", () => {
  it("dibuja los elementos sin dejar marcas a la vista", () => {
    render(<Markdown>{SAMPLE}</Markdown>);

    expect(screen.getByText("Título")).toBeTruthy();
    expect(screen.getByText("negrita")).toBeTruthy();
    expect(screen.getByText("itálica")).toBeTruthy();
    expect(screen.getByText("Primero.")).toBeTruthy();
    expect(screen.getByText("2.")).toBeTruthy();
    expect(screen.getByText("Otro ítem.")).toBeTruthy();
    expect(screen.getAllByText("•")).toHaveLength(2);
    expect(screen.getByText("Correo")).toBeTruthy();
    expect(screen.getByText("Identificar tu cuenta.")).toBeTruthy();
    expect(screen.queryByText(/\*\*|^#|\|/)).toBeNull();
  });

  it("abre los enlaces", () => {
    const open = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
    render(<Markdown>{SAMPLE}</Markdown>);

    fireEvent.press(screen.getByText("soporte"));

    expect(open).toHaveBeenCalledWith("mailto:soporte@example.com");
  });

  it("los documentos del backend se interpretan sin restos de Markdown", () => {
    // Los archivos reales, si el backend está al lado: es lo que se publica.
    const legal = resolve(__dirname, "../../../../urbancheck_backend/urbancheck/legal/1.0");
    let files: string[];
    try {
      files = ["terminos.md", "privacidad.md"].map((f) =>
        readFileSync(resolve(legal, f), "utf8"),
      );
    } catch {
      return; // El repo móvil solo, sin el backend al lado (por ejemplo, en CI).
    }
    for (const text of files) {
      const { unmount } = render(<Markdown>{text}</Markdown>);
      expect(screen.queryByText(/\*\*|^#{1,6} |^\|/)).toBeNull();
      unmount();
    }
  });
});
