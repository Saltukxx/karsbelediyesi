import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { api, loadToken, saveSession } from "@/lib/api";

export default function LoginScreen() {
  const [phone, setPhone] = useState("05000000000");
  const [password, setPassword] = useState("admin123");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadToken().then((t) => {
      if (t) router.replace("/(tabs)/islerim");
      else setLoading(false);
    });
  }, []);

  async function onLogin() {
    setSubmitting(true);
    try {
      const session = await api.login(phone.trim(), password);
      await saveSession(session.token);
      router.replace("/(tabs)/islerim");
    } catch (e) {
      Alert.alert("Giriş başarısız", e instanceof Error ? e.message : "Hata");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1e3a5f" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.brand}>Kars Belediyesi</Text>
      <Text style={styles.sub}>Saha Operasyon</Text>
      <TextInput
        style={styles.input}
        value={phone}
        onChangeText={setPhone}
        placeholder="Telefon"
        keyboardType="phone-pad"
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        placeholder="Şifre"
        secureTextEntry
      />
      <Pressable style={styles.btn} onPress={onLogin} disabled={submitting}>
        <Text style={styles.btnText}>{submitting ? "…" : "Giriş Yap"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f1f5f9" },
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#f1f5f9",
    gap: 12,
  },
  brand: { fontSize: 28, fontWeight: "700", color: "#1e3a5f", textAlign: "center" },
  sub: { fontSize: 14, color: "#64748b", textAlign: "center", marginBottom: 16 },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  btn: {
    backgroundColor: "#1e3a5f",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  btnText: { color: "#fff", fontWeight: "600", fontSize: 16 },
});
