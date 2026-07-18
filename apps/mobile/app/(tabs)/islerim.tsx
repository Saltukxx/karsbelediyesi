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
import type { ComplaintSummary } from "@kars/api-client";
import { api, clearSession, loadToken } from "@/lib/api";
import { router } from "expo-router";

export default function IslerimScreen() {
  const [items, setItems] = useState<ComplaintSummary[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<ComplaintSummary | null>(null);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadToken();
      const data = await api.myComplaints();
      setItems(data);
    } catch {
      await clearSession();
      router.replace("/");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function updateDurum(durum: "DEVAM_EDIYOR" | "KAPATILDI") {
    if (!selected) return;
    try {
      await api.updateComplaint(selected.id, {
        durum,
        cozumNotu: note || undefined,
      });
      setSelected(null);
      setNote("");
      await load();
    } catch (e) {
      Alert.alert("Hata", e instanceof Error ? e.message : "Güncellenemedi");
    }
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        ListEmptyComponent={<Text style={styles.empty}>Atanmış açık iş yok.</Text>}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => setSelected(item)}>
            <Text style={styles.no}>{item.sikayetNo}</Text>
            <Text style={styles.title}>{item.complaintType?.name ?? "Şikayet"}</Text>
            <Text style={styles.meta}>
              {item.neighborhood?.name ?? "—"} · {item.oncelik} · {item.durum}
            </Text>
            <Text numberOfLines={2} style={styles.desc}>
              {item.aciklama ?? item.acikAdres}
            </Text>
          </Pressable>
        )}
      />
      {selected && (
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>{selected.sikayetNo}</Text>
          <Text style={styles.desc}>{selected.aciklama}</Text>
          <TextInput
            style={styles.input}
            placeholder="Çözüm notu"
            value={note}
            onChangeText={setNote}
          />
          <View style={styles.row}>
            <Pressable style={styles.btnSec} onPress={() => updateDurum("DEVAM_EDIYOR")}>
              <Text>Devam Ediyor</Text>
            </Pressable>
            <Pressable style={styles.btn} onPress={() => updateDurum("KAPATILDI")}>
              <Text style={styles.btnText}>Kapat</Text>
            </Pressable>
          </View>
          <Pressable onPress={() => setSelected(null)}>
            <Text style={styles.cancel}>Vazgeç</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f5f9" },
  empty: { textAlign: "center", color: "#94a3b8", marginTop: 40 },
  card: {
    backgroundColor: "#fff",
    marginHorizontal: 12,
    marginTop: 10,
    padding: 14,
    borderRadius: 10,
  },
  no: { fontFamily: "monospace", fontSize: 12, color: "#64748b" },
  title: { fontSize: 16, fontWeight: "600", color: "#0f172a", marginTop: 4 },
  meta: { fontSize: 12, color: "#64748b", marginTop: 2 },
  desc: { fontSize: 13, color: "#334155", marginTop: 6 },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#fff",
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    gap: 10,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  sheetTitle: { fontWeight: "700", fontSize: 16 },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    padding: 10,
  },
  row: { flexDirection: "row", gap: 8 },
  btn: {
    flex: 1,
    backgroundColor: "#1e3a5f",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  btnSec: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "600" },
  cancel: { textAlign: "center", color: "#64748b", marginTop: 4 },
});
