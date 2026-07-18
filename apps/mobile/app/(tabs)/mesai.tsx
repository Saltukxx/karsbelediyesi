import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
} from "react-native";
import { api, clearSession, loadToken } from "@/lib/api";
import { router } from "expo-router";
import * as Notifications from "expo-notifications";

export default function MesaiScreen() {
  const [giris, setGiris] = useState("08:00");
  const [cikis, setCikis] = useState("17:00");
  const [is, setIs] = useState("");
  const [busy, setBusy] = useState(false);

  async function kaydet() {
    setBusy(true);
    try {
      await loadToken();
      await api.createWorkLog({
        girisSaati: giris,
        cikisSaati: cikis,
        yapilanIs: is || undefined,
      });
      Alert.alert("Kaydedildi", "Günlük mesai sunucuya yazıldı");
    } catch (e) {
      Alert.alert("Hata", e instanceof Error ? e.message : "Kaydedilemedi");
    } finally {
      setBusy(false);
    }
  }

  async function enablePush() {
    const { status } = await Notifications.requestPermissionsAsync();
    Alert.alert(
      "Bildirimler",
      status === "granted"
        ? "İzin verildi. EAS build sonrası push token kaydı eklenecek."
        : "İzin reddedildi",
    );
  }

  async function logout() {
    await clearSession();
    router.replace("/");
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Giriş saati</Text>
      <TextInput style={styles.input} value={giris} onChangeText={setGiris} />
      <Text style={styles.label}>Çıkış saati</Text>
      <TextInput style={styles.input} value={cikis} onChangeText={setCikis} />
      <Text style={styles.label}>Yapılan iş</Text>
      <TextInput style={styles.input} value={is} onChangeText={setIs} />
      <Pressable style={styles.btn} onPress={kaydet} disabled={busy}>
        <Text style={styles.btnText}>Mesai Kaydet</Text>
      </Pressable>
      <Pressable style={styles.btnSec} onPress={enablePush}>
        <Text>Push bildirimi izni</Text>
      </Pressable>
      <Pressable style={styles.btnSec} onPress={logout}>
        <Text>Çıkış Yap</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f5f9", padding: 16, gap: 8 },
  label: { fontSize: 12, color: "#64748b", marginTop: 4 },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    padding: 12,
  },
  btn: {
    backgroundColor: "#1e3a5f",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginTop: 12,
  },
  btnSec: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "600" },
});
