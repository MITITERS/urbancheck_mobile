import { createBottomTabNavigator } from "expo-router/js-tabs";
import { NavigationContainer } from "expo-router/react-navigation";
import { render, renderHook, screen } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";
import { SafeAreaProvider, type Metrics } from "react-native-safe-area-context";

import {
  FloatingTabBar,
  TAB_BAR_CONTENT_BREATHING_ROOM,
  TAB_BAR_GAP_WITHOUT_SAFE_AREA,
  TAB_BAR_HEIGHT,
  useFloatingTabBarBottom,
  useFloatingTabBarInset,
} from "../floatingTabBar";

const Tab = createBottomTabNavigator();

const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  // Un dispositivo con home indicator: es donde se rompía.
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function renderIsland(badge?: string) {
  return render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <NavigationContainer>
        <Tab.Navigator
          tabBar={(props) => <FloatingTabBar {...props} />}
          screenOptions={{
            tabBarStyle: {
              borderTopWidth: 0,
              backgroundColor: "transparent",
              height: TAB_BAR_HEIGHT,
              paddingTop: 8,
            },
          }}
        >
          <Tab.Screen name="feed" component={Feed} />
          <Tab.Screen
            name="notices"
            component={Feed}
            options={{ tabBarBadge: badge }}
          />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>,
  );
}

function Feed() {
  return <Text>contenido</Text>;
}

/**
 * Estilo efectivo de todo lo que envuelve a la fila de pestañas: es la cadena
 * de contenedores que decide si el badge se ve o se recorta.
 */
function islandStyle(): Record<string, unknown> {
  type Node = ReturnType<typeof screen.UNSAFE_getByProps>;
  let node: Node | null = screen.UNSAFE_getByProps({ role: "tablist" });
  const styles: StyleProp<ViewStyle>[] = [];
  while (node) {
    const { style } = node.props as { style?: StyleProp<ViewStyle> };
    if (style) styles.push(style);
    node = node.parent;
  }
  return StyleSheet.flatten(styles) as Record<string, unknown>;
}

describe("FloatingTabBar", () => {
  it("muestra el badge de la campana", async () => {
    renderIsland("5");

    expect(await screen.findByText("5")).toBeTruthy();
  });

  it("no recorta el contenido: el badge se dibuja fuera de la caja del ícono", () => {
    // `overflow: "hidden"` en cualquier ancestro borra el badge, que va en
    // `top: -3` respecto del ícono. Es el bug que tenía la isla.
    renderIsland("5");

    expect(islandStyle().overflow).not.toBe("hidden");
  });

  it("no cuenta el safe area dos veces", () => {
    // La isla ya se levanta por encima del home indicator; si además le dejamos
    // a `BottomTabBar` su `paddingBottom: insets.bottom`, quedan 23px de alto
    // útil para íconos de 28 y el badge se va por arriba del borde.
    renderIsland("5");
    const style = islandStyle();

    expect(style.paddingBottom ?? 0).toBe(0);
    expect(style.height).toBe(TAB_BAR_HEIGHT);
  });

  it("deja alto suficiente para el ícono y su badge", () => {
    renderIsland("5");
    const style = islandStyle();
    const usableHeight =
      (style.height as number) -
      ((style.paddingTop as number) ?? 0) -
      ((style.paddingBottom as number) ?? 0);

    // 28 es el alto del contenedor del ícono (`TabBarIcon`), y el badge asoma
    // 3px por encima.
    expect(usableHeight).toBeGreaterThanOrEqual(28 + 3);
  });

  it("sin avisos pendientes no dibuja nada", () => {
    renderIsland(undefined);

    expect(screen.queryByText("5")).toBeNull();
  });
});

function metrics(bottomInset: number): Metrics {
  return {
    frame: { x: 0, y: 0, width: 390, height: 844 },
    insets: { top: 47, left: 0, right: 0, bottom: bottomInset },
  };
}

function wrapperWith(bottomInset: number) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <SafeAreaProvider initialMetrics={metrics(bottomInset)}>
        {children}
      </SafeAreaProvider>
    );
  };
}

describe("useFloatingTabBarBottom", () => {
  it("respeta la safe area cuando el dispositivo la tiene", () => {
    const { result } = renderHook(useFloatingTabBarBottom, {
      wrapper: wrapperWith(34),
    });

    expect(result.current).toBe(38); // 34 + 4
  });

  it("usa una separación fija cuando no la tiene", () => {
    const { result } = renderHook(useFloatingTabBarBottom, {
      wrapper: wrapperWith(0),
    });

    expect(result.current).toBe(TAB_BAR_GAP_WITHOUT_SAFE_AREA);
  });
});

describe("useFloatingTabBarInset", () => {
  it("reserva el alto de la barra, su separación y el aire", () => {
    // Es el espacio que una pantalla scrolleable tiene que dejar libre para que
    // su último elemento no quede debajo de la barra flotante.
    const { result } = renderHook(useFloatingTabBarInset, {
      wrapper: wrapperWith(34),
    });

    expect(result.current).toBe(
      38 + TAB_BAR_HEIGHT + TAB_BAR_CONTENT_BREATHING_ROOM,
    );
  });

  it("siempre deja el contenido por encima de la barra", () => {
    for (const bottomInset of [0, 20, 34, 48]) {
      const { result } = renderHook(useFloatingTabBarInset, {
        wrapper: wrapperWith(bottomInset),
      });
      const { result: bottom } = renderHook(useFloatingTabBarBottom, {
        wrapper: wrapperWith(bottomInset),
      });

      expect(result.current).toBeGreaterThan(bottom.current + TAB_BAR_HEIGHT);
    }
  });
});
