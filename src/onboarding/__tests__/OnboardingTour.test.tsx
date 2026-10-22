import { fireEvent, render, screen, userEvent } from "@testing-library/react-native";
import { Dimensions } from "react-native";
import { SafeAreaProvider, type Metrics } from "react-native-safe-area-context";

import { ONBOARDING_STEPS } from "../steps";
import { OnboardingTour } from "../OnboardingTour";

/** US-051 — el recorrido de bienvenida: pasos, navegación y salidas. */

jest.mock("@expo/vector-icons", () => {
  const { View } = jest.requireActual("react-native");
  return { Ionicons: View };
});

const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function renderTour(props: Partial<Parameters<typeof OnboardingTour>[0]> = {}) {
  const onFinish = props.onFinish ?? jest.fn();
  render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <OnboardingTour onFinish={onFinish} {...props} />
    </SafeAreaProvider>,
  );
  return { onFinish };
}

describe("OnboardingTour", () => {
  it("CP-051-M01 (US-051) · tiene los cuatro pasos de la historia, en orden", () => {
    renderTour();

    expect(ONBOARDING_STEPS).toHaveLength(4);
    for (const step of ONBOARDING_STEPS) {
      expect(screen.getByText(step.title)).toBeTruthy();
      expect(screen.getByText(step.body)).toBeTruthy();
    }
    expect(screen.getByText("Paso 1 de 4")).toBeTruthy();
  });

  it("CP-051-M02 (US-051 E2) · avanza y retrocede con los botones e indica el paso", async () => {
    const user = userEvent.setup();
    renderTour();

    expect(screen.queryByText("Anterior")).toBeNull();
    await user.press(screen.getByText("Siguiente"));
    expect(screen.getByText("Paso 2 de 4")).toBeTruthy();
    await user.press(screen.getByText("Anterior"));
    expect(screen.getByText("Paso 1 de 4")).toBeTruthy();
  });

  it("CP-051-M03 (US-051 E2) · deslizar también cambia de paso", () => {
    renderTour();

    fireEvent(screen.getByTestId("onboarding-pager"), "momentumScrollEnd", {
      nativeEvent: { contentOffset: { x: Dimensions.get("window").width * 2, y: 0 } },
    });

    expect(screen.getByText("Paso 3 de 4")).toBeTruthy();
  });

  it("CP-051-M04 (US-051 E3) · en el último paso Empezar reemplaza a Omitir y cierra", async () => {
    const user = userEvent.setup();
    const { onFinish } = renderTour();

    for (let i = 0; i < 3; i += 1) {
      expect(screen.getByText("Omitir")).toBeTruthy();
      await user.press(screen.getByText("Siguiente"));
    }

    expect(screen.queryByText("Omitir")).toBeNull();
    expect(screen.queryByText("Siguiente")).toBeNull();
    await user.press(screen.getByText("Empezar"));
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it("CP-051-M05 (US-051 E4) · Omitir desde cualquier paso sale igual que terminar", async () => {
    const user = userEvent.setup();
    const { onFinish } = renderTour();

    await user.press(screen.getByText("Siguiente"));
    await user.press(screen.getByText("Omitir"));

    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it("CP-051-M06 (US-051 E7) · al volver a verlo no hay Omitir, se cierra", async () => {
    const user = userEvent.setup();
    const { onFinish } = renderTour({ replay: true });

    expect(screen.queryByText("Omitir")).toBeNull();
    await user.press(screen.getByLabelText("Cerrar"));

    expect(onFinish).toHaveBeenCalledTimes(1);
  });
});
