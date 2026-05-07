import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_SESSION_COOKIE = "dst_admin_session";
export const ADMIN_SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

export type AdminSession = {
  username: string;
  role: "admin";
  expiresAt: number;
  fingerprint: string;
};

function getAdminUsername(): string {
  return process.env.ADMIN_USERNAME?.trim() ?? "";
}

function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD ?? "";
}

function getAdminPasswordHash(): string {
  return process.env.ADMIN_PASSWORD_SHA256?.trim().toLowerCase() ?? "";
}

function getAuthSecret(): string {
  return process.env.AUTH_SECRET?.trim() ?? "";
}

export function getAuthSetupProblems(): string[] {
  const problems: string[] = [];

  if (!getAdminUsername()) {
    problems.push("ADMIN_USERNAME is missing.");
  }

  if (!getAdminPassword() && !getAdminPasswordHash()) {
    problems.push("ADMIN_PASSWORD or ADMIN_PASSWORD_SHA256 is missing.");
  }

  if (getAuthSecret().length < 32) {
    problems.push("AUTH_SECRET must be at least 32 characters.");
  }

  return problems;
}

export function isAuthConfigured(): boolean {
  return getAuthSetupProblems().length === 0;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function safeCompare(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  const length = Math.max(leftBuffer.length, rightBuffer.length, 1);
  const paddedLeft = Buffer.alloc(length);
  const paddedRight = Buffer.alloc(length);

  leftBuffer.copy(paddedLeft);
  rightBuffer.copy(paddedRight);

  return (
    timingSafeEqual(paddedLeft, paddedRight) &&
    leftBuffer.length === rightBuffer.length
  );
}

function sign(payload: string): string {
  return createHmac("sha256", getAuthSecret()).update(payload).digest("base64url");
}

function getCredentialFingerprint(): string {
  return createHmac("sha256", getAuthSecret())
    .update(`${getAdminUsername()}:${getAdminPasswordHash() || sha256(getAdminPassword())}`)
    .digest("base64url");
}

export function validateAdminCredentials(username: string, password: string): boolean {
  if (!isAuthConfigured()) {
    return false;
  }

  const isUsernameValid = safeCompare(username.trim(), getAdminUsername());
  const configuredPasswordHash = getAdminPasswordHash();
  const isPasswordValid = configuredPasswordHash
    ? safeCompare(sha256(password), configuredPasswordHash)
    : safeCompare(password, getAdminPassword());

  return isUsernameValid && isPasswordValid;
}

export function createAdminSessionToken(username: string): {
  token: string;
  expiresAt: Date;
} {
  const expiresAt = new Date(Date.now() + ADMIN_SESSION_MAX_AGE_SECONDS * 1000);
  const session: AdminSession = {
    username,
    role: "admin",
    expiresAt: expiresAt.getTime(),
    fingerprint: getCredentialFingerprint(),
  };
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");

  return {
    token: `${payload}.${sign(payload)}`,
    expiresAt,
  };
}

export function readAdminSessionToken(token: string | undefined | null): AdminSession | null {
  if (!token || !isAuthConfigured()) {
    return null;
  }

  const [payload, signature, extra] = token.split(".");

  if (!payload || !signature || extra) {
    return null;
  }

  if (!safeCompare(signature, sign(payload))) {
    return null;
  }

  try {
    const session = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as Partial<AdminSession>;

    if (
      session.role !== "admin" ||
      typeof session.username !== "string" ||
      typeof session.expiresAt !== "number" ||
      typeof session.fingerprint !== "string"
    ) {
      return null;
    }

    if (session.expiresAt <= Date.now()) {
      return null;
    }

    if (
      !safeCompare(session.username, getAdminUsername()) ||
      !safeCompare(session.fingerprint, getCredentialFingerprint())
    ) {
      return null;
    }

    return session as AdminSession;
  } catch {
    return null;
  }
}

export function sanitizeNextPath(value: FormDataEntryValue | string | null | undefined): string {
  const path = typeof value === "string" ? value : "";

  if (
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.startsWith("/api") ||
    path.startsWith("/login")
  ) {
    return "/";
  }

  return path;
}
