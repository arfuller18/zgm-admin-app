"use server";

import { signIn } from "@/lib/auth";

export async function googleSignIn() {
  await signIn("google", { redirectTo: "/" });
}

export async function devSignIn(formData: FormData) {
  const email = formData.get("email");
  if (typeof email !== "string" || !email) return;
  await signIn("dev-login", { email, redirectTo: "/" });
}
