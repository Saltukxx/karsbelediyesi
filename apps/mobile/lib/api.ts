import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { KarsApiClient } from "@kars/api-client";

const apiUrl =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ||
  process.env.EXPO_PUBLIC_API_URL ||
  "http://localhost:3000";

export const api = new KarsApiClient(apiUrl);

export async function loadToken() {
  const token = await SecureStore.getItemAsync("mobile_token");
  if (token) api.setToken(token);
  return token;
}

export async function saveSession(token: string) {
  await SecureStore.setItemAsync("mobile_token", token);
  api.setToken(token);
}

export async function clearSession() {
  await SecureStore.deleteItemAsync("mobile_token");
  api.setToken(undefined);
}
