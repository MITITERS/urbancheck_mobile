import { router } from "expo-router";
import { act, renderRouter, screen } from "expo-router/testing-library";
import { Text } from "react-native";

import TabsLayout from "../../../app/(app)/(tabs)/_layout";
import type { UserProfile } from "../../api/users";

jest.mock("@expo/vector-icons", () => {
  const { View } = jest.requireActual("react-native");
  return { Ionicons: View };
});

const CITIZEN: Partial<UserProfile> = { id: 1, role: "ciudadano", must_change_password: false };
jest.mock("../../auth/AuthContext", () => ({
  useAuth: () => ({ user: CITIZEN }),
}));
jest.mock("../../notifications/UnreadContext", () => ({
  ...jest.requireActual("../../notifications/UnreadContext"),
  useUnread: () => ({ unread: 0, refresh: jest.fn() }),
}));

function Plain(label: string) {
  return function Placeholder() {
    return <Text>{label}</Text>;
  };
}

/**
 * El detalle de un reporte es una pestaña que no se ve en la barra. Con
 * expo-router 58, ocultarla con `href: null` la volvía inalcanzable y ningún
 * reporte abría su detalle: el `push` no hacía nada.
 */
it("desde el feed se abre el detalle de un reporte", async () => {
  const result = await renderRouter(
    {
      "(tabs)/_layout": TabsLayout,
      "(tabs)/index": Plain("FEED"),
      "(tabs)/map": Plain("MAPA"),
      "(tabs)/create-tab": Plain("ALTA"),
      "(tabs)/validate": Plain("VALIDAR"),
      "(tabs)/work": Plain("TRABAJOS"),
      "(tabs)/notices": Plain("AVISOS"),
      "(tabs)/profile": Plain("PERFIL"),
      "(tabs)/report/[id]": Plain("DETALLE"),
    },
    { initialUrl: "/" },
  );
  await screen.findByText("FEED");

  await act(() => router.push("/(tabs)/report/5"));

  expect(await screen.findByText("DETALLE")).toBeTruthy();
  expect(result.getPathname()).toBe("/report/5");
});
