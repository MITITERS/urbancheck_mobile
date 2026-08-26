import { Tabs, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Pressable } from "react-native";

import { participatesAsCitizen, canValidate } from "../../../src/api/users";
import { useAuth } from "../../../src/auth/AuthContext";
import {
  FloatingTabBar,
  TAB_BAR_HEIGHT,
} from "../../../src/components/floatingTabBar";
import {
  formatUnreadBadge,
  useUnread,
} from "../../../src/notifications/UnreadContext";

export default function TabsLayout() {
  const router = useRouter();
  const { user } = useAuth();
  // La bandeja de validación solo existe para validadores activos (US-037).
  // `Tabs.Protected` la saca de la navegación, así que tampoco se alcanza
  // escribiendo la ruta a mano.
  const showValidation = canValidate(user);
  // Las cuentas de trabajo no reportan: la pestaña de alta no existe para
  // ellas, ni siquiera escribiendo la ruta.
  const showCreate = participatesAsCitizen(user);
  const { unread } = useUnread();

  return (
    <Tabs
      // La barra flota sobre el contenido: las pantallas se reservan el espacio
      // con `useFloatingTabBarInset()`.
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        tabBarActiveTintColor: "#1a73e8",
        tabBarInactiveTintColor: "#777",
        tabBarStyle: {
          borderTopWidth: 0,
          // El fondo y las esquinas redondeadas los pinta la isla: un fondo
          // opaco acá taparía esas esquinas con un rectángulo.
          backgroundColor: "transparent",
          height: TAB_BAR_HEIGHT,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "600",
        },
        headerShown: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Reportes",
          headerTitle: "Reportes UrbanCheck",
          tabBarLabel: "Feed",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "list" : "list-outline"} size={25} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: "Mapa",
          headerTitle: "Mapa de Incidentes",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "map" : "map-outline"} size={25} color={color} />
          ),
        }}
      />
      <Tabs.Protected guard={showCreate}>
        <Tabs.Screen
          name="create-tab"
          options={{
            title: "Reportar",
            headerShown: false,
            tabBarIcon: ({ color }) => (
              <Ionicons name="add-circle" size={32} color="#1a73e8" style={{ marginTop: -2 }} />
            ),
          }}
        />
      </Tabs.Protected>
      <Tabs.Protected guard={showValidation}>
        <Tabs.Screen
          name="validate"
          options={{
            title: "Validar",
            headerTitle: "Pendientes de validación",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "shield-checkmark" : "shield-checkmark-outline"}
                size={25}
                color={color}
              />
            ),
          }}
        />
      </Tabs.Protected>
      <Tabs.Screen
        name="notices"
        options={{
          title: "Avisos",
          headerTitle: "Avisos del Municipio",
          // Sin avisos pendientes tiene que ser `undefined`: con `0` o `""` el
          // badge se dibuja igual, vacío, y queda un punto rojo permanente.
          tabBarBadge: formatUnreadBadge(unread),
          tabBarBadgeStyle: {
            backgroundColor: "#e53935",
            color: "#fff",
            fontSize: 10,
            fontWeight: "700",
          },
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "notifications" : "notifications-outline"} size={25} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Perfil",
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "person" : "person-outline"} size={25} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="report/[id]"
        options={{
          href: null,
          headerShown: true,
          headerTitle: "Detalle del reporte",
          headerLeft: () => (
            <Pressable
              onPress={() => router.back()}
              hitSlop={12}
              style={{ paddingHorizontal: 12 }}
            >
              <Ionicons name="arrow-back" size={24} color="#1a73e8" />
            </Pressable>
          ),
        }}
      />
    </Tabs>
  );
}
