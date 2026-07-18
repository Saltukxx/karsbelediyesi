import { useCallback, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
  ScrollView,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { api, loadToken } from "@/lib/api";
import { enqueueChecklist, flushChecklistQueue, pendingCount } from "@/lib/offline";

type Template = {
  id: string;
  ekipmanAdi: string;
  items: Array<{ id: string; siraNo: number; kontrolKalemi: string; kategori: string }>;
};

export default function KontrolScreen() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [pending, setPending] = useState(0);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    await loadToken();
    try {
      const t = (await api.checklistTemplates()) as Template[];
      setTemplates(t);
    } catch {
      /* offline — templates may be stale */
    }
    setPending(await pendingCount());
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  async function queueDemo(template: Template) {
    setBusy(true);
    try {
      const now = new Date();
      await enqueueChecklist({
        templateId: template.id,
        vehicleId: "OFFLINE_PLACEHOLDER",
        ay: now.getMonth() + 1,
        yilDonem: now.getFullYear(),
        sorumluOperatorTeknisyen: "Mobil operatör",
        results: template.items.slice(0, 3).map((item) => ({
          templateItemId: item.id,
          periyot: "HAFTA_1",
          sonuc: "UYGUN",
        })),
      });
      Alert.alert(
        "Kuyruğa alındı",
        "Çevrimdışı kaydedildi. Bağlantı gelince senkron edilecek. (Gerçek plaka seçimi web/mobil formunda yapılır.)",
      );
      setPending(await pendingCount());
    } finally {
      setBusy(false);
    }
  }

  async function sync() {
    setBusy(true);
    try {
      const n = await flushChecklistQueue();
      Alert.alert("Senkron", `${n} kayıt gönderildi`);
      setPending(await pendingCount());
    } catch (e) {
      Alert.alert("Senkron hatası", e instanceof Error ? e.message : "Başarısız");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 12, gap: 10 }}>
      <View style={styles.banner}>
        <Text style={styles.bannerText}>Bekleyen offline: {pending}</Text>
        <Pressable style={styles.btn} onPress={sync} disabled={busy || pending === 0}>
          <Text style={styles.btnText}>Senkronize Et</Text>
        </Pressable>
      </View>
      {templates.map((t) => (
        <View key={t.id} style={styles.card}>
          <Text style={styles.title}>{t.ekipmanAdi}</Text>
          <Text style={styles.meta}>{t.items.length} kalem</Text>
          <Pressable style={styles.btnSec} onPress={() => queueDemo(t)} disabled={busy}>
            <Text>Offline örnek doldur (kuyruk)</Text>
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f5f9" },
  banner: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bannerText: { fontWeight: "600" },
  card: { backgroundColor: "#fff", borderRadius: 10, padding: 14, gap: 6 },
  title: { fontSize: 16, fontWeight: "700" },
  meta: { color: "#64748b", fontSize: 12 },
  btn: {
    backgroundColor: "#1e3a5f",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  btnSec: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "600" },
});
