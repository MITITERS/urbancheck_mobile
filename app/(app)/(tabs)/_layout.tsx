import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Dimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomTabBar } from "@react-navigation/bottom-tabs";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const screenWidth = Dimensions.get("window").width;
  const horizontalMargin = screenWidth * 0.05;

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
          tabBarIcon: ({ color }) => (
            <Ionicons name="add-circle" size={32} color="#1a73e8" style={{ marginTop: -2 }} />
          ),
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            navigation.navigate("create-report");
          },
        })}
      />
      <Tabs.Screen
        name="notices"
        options={{
          title: "Avisos",
          headerTitle: "Avisos del Municipio",
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
    </Tabs>
  );
}
