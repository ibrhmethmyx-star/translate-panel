"use server";

import {
  clearAdminSession,
  createAdminSession,
  isAuthConfigured,
  sanitizeNextPath,
  validateAdminCredentials,
} from "@/lib/auth";
import { redirect } from "next/navigation";

export type LoginFormState = {
  error: string;
};

export async function loginAction(
  _state: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const nextPath = sanitizeNextPath(formData.get("next"));

  if (!isAuthConfigured()) {
    return {
      error: "Admin login is not configured on the server yet.",
    };
  }

  if (!validateAdminCredentials(username, password)) {
    return {
      error: "Username or password is incorrect.",
    };
  }

  await createAdminSession(username);
  redirect(nextPath);
}

export async function logoutAction(): Promise<void> {
  await clearAdminSession();
  redirect("/login");
}
