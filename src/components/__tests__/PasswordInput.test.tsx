import { useState } from "react";
import { render, screen, userEvent } from "@testing-library/react-native";

import { PasswordInput } from "../PasswordInput";

/**
 * Campo de contraseña con opción de ver lo escrito (US-017, US-035).
 *
 * Lo usa el cambio de la contraseña temporal, donde la persona está copiando una
 * clave que le pasaron: sin poder verla, un error de tipeo es indistinguible de
 * una contraseña equivocada.
 */

jest.mock("@expo/vector-icons", () => {
  const { View } = jest.requireActual("react-native");
  return { Ionicons: View };
});

/** El componente es controlado: el test aporta el estado, como la pantalla. */
function Controlled({ startVisible = false } = {}) {
  const [value, setValue] = useState("");
  const [visible, setVisible] = useState(startVisible);
  return (
    <PasswordInput
      placeholder="Contraseña nueva"
      value={value}
      onChangeText={setValue}
      visible={visible}
      onToggle={() => setVisible((v) => !v)}
    />
  );
}

describe("PasswordInput", () => {
  it("oculta lo escrito por defecto", () => {
    render(<Controlled />);

    expect(screen.getByPlaceholderText("Contraseña nueva").props.secureTextEntry).toBe(
      true,
    );
  });

  it("el botón dice que va a mostrar la contraseña", () => {
    render(<Controlled />);

    expect(screen.getByLabelText("Mostrar contraseña")).toBeTruthy();
  });

  it("al tocarlo, revela el texto y ofrece volver a ocultarlo", async () => {
    render(<Controlled />);
    const user = userEvent.setup();

    await user.press(screen.getByLabelText("Mostrar contraseña"));

    expect(screen.getByPlaceholderText("Contraseña nueva").props.secureTextEntry).toBe(
      false,
    );
    expect(screen.getByLabelText("Ocultar contraseña")).toBeTruthy();
  });

  it("vuelve a ocultarla en el segundo toque", async () => {
    render(<Controlled startVisible />);
    const user = userEvent.setup();

    await user.press(screen.getByLabelText("Ocultar contraseña"));

    expect(screen.getByPlaceholderText("Contraseña nueva").props.secureTextEntry).toBe(
      true,
    );
  });

  it("propaga lo que se escribe", async () => {
    const onChangeText = jest.fn();
    render(
      <PasswordInput
        placeholder="Contraseña actual"
        value=""
        onChangeText={onChangeText}
        visible={false}
        onToggle={jest.fn()}
      />,
    );

    await userEvent.setup().type(screen.getByPlaceholderText("Contraseña actual"), "abc");

    expect(onChangeText).toHaveBeenCalled();
  });

  it("no autocorrige ni pone mayúscula inicial", () => {
    // Las dos ayudas del teclado que corrompen una contraseña en silencio.
    render(<Controlled />);
    const input = screen.getByPlaceholderText("Contraseña nueva");

    expect(input.props.autoCapitalize).toBe("none");
    expect(input.props.autoCorrect).toBe(false);
  });
})
