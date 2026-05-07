import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  type AdminSession,
  createAdminSessionToken,
  getAuthSetupProblems,
  isAuthConfigured,
  readAdminSessionToken,
  sanitizeNextPath,
  validateAdminCredentials,
} from "@/lib/auth-session";

export {
  getAuthSetupProblems,
  isAuthConfigured,
  sanitizeNextPath,
  validateAdminCredentials,
};

export const getAdminSession = cache(async (): Promise<AdminSession | null> => {
  const cookieStore = await cookies();
  return readAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
});

export const requireAdminSession = cache(async (): Promise<AdminSession> => {
  const session = await getAdminSession();

  if (!session) {
    redirect("/login");
  }

  return session;
});

export async function createAdminSession(username: string): Promise<void> {
  const cookieStore = await cookies();
  const { token, expiresAt } = createAdminSessionToken(username);

  cookieStore.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
    expires: expiresAt,
  });
}

export async function clearAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_SESSION_COOKIE);
}
