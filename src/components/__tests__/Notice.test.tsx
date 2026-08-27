import { render, screen, userEvent } from "@testing-library/react-native";

import { Notice } from "../Notice";

jest.mock("@expo/vector-icons", () => {
  const { View } = jest.requireActual("react-native");
  return { Ionicons: View };
});

describe("Notice", () => {
  it("muestra el título y el mensaje por separado", () => {
    render(
      <Notice
        visible
        title="Revisá la ubicación"
        message="La ubicación está fuera del área de cobertura."
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByText("Revisá la ubicación")).toBeTruthy();
    expect(screen.getByText("La ubicación está fuera del área de cobertura.")).toBeTruthy();
  });

  it("se cierra desde el botón", async () => {
    const onClose = jest.fn();
    render(<Notice visible title="Título" message="Mensaje" onClose={onClose} />);

    await userEvent.press(screen.getByText("Entendido"));

    expect(onClose).toHaveBeenCalled();
  });

  it("oculto no renderiza nada", () => {
    render(
      <Notice visible={false} title="Título" message="Mensaje" onClose={jest.fn()} />,
    );

    expect(screen.queryByText("Título")).toBeNull();
  });
});
