"use server";

import { signOut } from "@/auth";

export async function cikisYap() {
  await signOut({ redirectTo: "/giris" });
}
