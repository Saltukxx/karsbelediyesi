import { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  RefreshControl,
  Alert,
  TextInput,
} from "react-native";
import { useFocusEffect } from "expo-router";
import type { VehicleTaskSummary } from "@kars/api-client";
import { api, loadToken } from "@/lib/api";

export default function GorevlerScreen() {
  const [items, setItems] = useState<VehicleTaskSummary[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [km, setKm] = useState("");

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadToken();
      setItems(await api.myTasks());
    } catch (e) {
      Alert.alert("Hata", e instanceof Error ? e.message : "Yüklenemedi");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function start(id: string) {
    try {
      await api.startTask(id, km ? Number(km) : undefined);
      setKm("");
      await load();
    } catch (e) {
      Alert.alert("Hata", e instanceof Error ? e.message : "Başlatılamadı");
    }
  }

  async function close(id: string) {
    try {
      await api.closeTask(id, {
        kmSayacGiris: km ? Number(km) : undefined,
        durum: "TAMAMLANDI",
      });
      setKm("");
      await load();
    } catch (e) {
      Alert.alert("Hata", e instanceof Error ? e.message : "Kapatılamadı");
    }
  }

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="KM / Saat sayaç"
        keyboardType="decimal-pad"
        value={km}
        onChangeText={setKm}
      />
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        ListEmptyComponent={<Text style={styles.empty}>Aktif görev yok.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.no}>{item.gorevNo}</Text>
            <Text style={styles.title}>{item.vehicle.plaka}</Text>
            <Text style={styles.meta}>
              {item.gorevYeri ?? "—"} · {item.durum}
            </Text>
            <Text style={styles.desc}>{item.gorevTanimi}</Text>
            <View style={styles.row}>
              {item.durum === "PLANLANDI" && (
                <Pressable style={styles.btn} onPress={() => start(item.id)}>
                  <Text style={styles.btnText}>Çıkış / Başlat</Text>
                </Pressable>
              )}
              {(item.durum === "PLANLANDI" || item.durum === "DEVAM_EDIYOR") && (
                <Pressable style={styles.btnSec} onPress={() => close(item.id)}>
                  <Text>Giriş / Kapat</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f5f9", paddingTop: 8 },
  input: {
    marginHorizontal: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    padding: 10,
    marginBottom: 4,
  },
  empty: { textAlign: "center", color: "#94a3b8", marginTop: 40 },
  card: {
    backgroundColor: "#fff",
    marginHorizontal: 12,
    marginTop: 10,
    padding: 14,
    borderRadius: 10,
    gap: 4,
  },
  no: { fontSize: 12, color: "#64748b" },
  title: { fontSize: 16, fontWeight: "700" },
  meta: { fontSize: 12, color: "#64748b" },
  desc: { fontSize: 13, color: "#334155" },
  row: { flexDirection: "row", gap: 8, marginTop: 8 },
  btn: {
    flex: 1,
    backgroundColor: "#1e3a5f",
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  btnSec: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "600" },
});
