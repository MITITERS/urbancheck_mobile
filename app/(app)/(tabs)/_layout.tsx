import { Tabs, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useEffect } from "react";
import { AppState, Dimensions, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomTabBar } from "@react-navigation/bottom-tabs";

import { refreshUnread, useUnreadCount } from "../../../src/notifications/unreadStore";

// Cada cuánto se refresca el contador de avisos sin leer con la app en primer plano.
const UNREAD_POLL_MS = 60_000;

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const screenWidth = Dimensions.get("window").width;
  const horizontalMargin = screenWidth * 0.05;
  // El valor vive en un store compartido con la bandeja de avisos, así el badge
  // se actualiza apenas el usuario lee algo en vez de esperar al próximo sondeo.
  const unread = useUnreadCount();

  // US-009: el badge avisa que llegaron comentarios nuevos sin obligar a entrar
  // a la pestaña. Se sondea en vez de usar push porque el backend todavía no
  // tiene canal de notificaciones en tiempo real.
  useEffect(() => {
    void refreshUnread();
    const timer = setInterval(() => void refreshUnread(), UNREAD_POLL_MS);
    // Al volver del segundo plano el contador puede estar viejo: se refresca ya.
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refreshUnread();
    });

    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);

  return (
    <Tabs
      tabBar={(props) => (
        <View
          style={{
            position: "absolute",
            bottom: insets.bottom > 0 ? insets.bottom + 4 : 12,
            left: horizontalMargin,
            right: horizontalMargin,
            borderRadius: 32,
            overflow: "hidden",
            backgroundColor: "#ffffff",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.1,
            shadowRadius: 12,
            elevation: 8,
            borderWidth: 1,
            borderColor: "#f0f0f0",
          }}
        >
          <BottomTabBar {...props} />
        </View>
      )}
      screenOptions={{
        tabBarActiveTintColor: "#1a73e8",
        tabBarInactiveTintColor: "#777",
        tabBarStyle: {
          borderTopWidth: 0,
          backgroundColor: "#ffffff",
          height: 65,
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
      <Tabs.Screen
        name="notices"
        options={{
          title: "Avisos",
          headerTitle: "Mis avisos",
          tabBarBadge: unread > 0 ? (unread > 99 ? "99+" : unread) : undefined,
          tabBarBadgeStyle: { backgroundColor: "#e53935", fontSize: 10 },
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
