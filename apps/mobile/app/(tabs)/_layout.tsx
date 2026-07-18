import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: "#1e3a5f" },
        headerTintColor: "#fff",
        tabBarActiveTintColor: "#1e3a5f",
      }}
    >
      <Tabs.Screen name="islerim" options={{ title: "İşlerim" }} />
      <Tabs.Screen name="gorevler" options={{ title: "Görevler" }} />
      <Tabs.Screen name="kontrol" options={{ title: "Kontrol" }} />
      <Tabs.Screen name="mesai" options={{ title: "Mesai" }} />
    </Tabs>
  );
}
