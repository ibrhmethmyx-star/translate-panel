import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import type { PluginControlResponse, PluginRequestInput } from "@/lib/contracts";
import { getPrismaClient } from "@/lib/prisma";

function normalizeString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function readPluginBody(
  request: Request,
): Promise<PluginRequestInput | null> {
  const rawBody = await request.json().catch(() => null);

  if (!isRecord(rawBody)) {
    return null;
  }

  return {
    licenseKey: normalizeString(rawBody.licenseKey),
    siteUrl: normalizeString(rawBody.siteUrl),
    instanceHash: normalizeString(rawBody.instanceHash),
    pluginVersion: normalizeString(rawBody.pluginVersion, "0.0.0"),
  };
}

export function readPluginQuery(url: string): PluginRequestInput {
  const searchParams = new URL(url).searchParams;

  return {
    licenseKey: normalizeString(searchParams.get("licenseKey")),
    siteUrl: normalizeString(searchParams.get("siteUrl")),
    instanceHash: normalizeString(searchParams.get("instanceHash")),
    pluginVersion: normalizeString(searchParams.get("pluginVersion"), "0.0.0"),
  };
}

export function readInstallationToken(request: Request): string {
  const authorization = request.headers.get("authorization")?.trim() ?? "";

  if (authorization.toLowerCase().startsWith("bearer ")) {
    return authorization.slice(7).trim();
  }

  return (
    request.headers.get("x-dst-installation-token")?.trim() ??
    request.headers.get("x-installation-token")?.trim() ??
    ""
  );
}

function hashInstallationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function hasValidInstallationToken(token: string): Promise<boolean> {
  if (!token) {
    return false;
  }

  const prisma = getPrismaClient();

  if (!prisma) {
    return false;
  }

  const siteInstallation = await prisma.siteInstallation.findFirst({
    where: {
      accessTokenHash: hashInstallationToken(token),
    },
    select: {
      id: true,
    },
  });

  return Boolean(siteInstallation);
}

export async function assertPluginAccess(
  request: Request,
  options: {
    requireInstallationToken?: boolean;
  } = {},
): Promise<NextResponse | null> {
  const expectedSecret = process.env.PLUGIN_SHARED_SECRET?.trim();
  const providedToken = readInstallationToken(request);

  if (providedToken && (await hasValidInstallationToken(providedToken))) {
    return null;
  }

  if (expectedSecret) {
    const providedSecret =
      request.headers.get("x-dst-plugin-secret")?.trim() ??
      request.headers.get("x-plugin-secret")?.trim() ??
      "";

    if (providedSecret === expectedSecret) {
      return null;
    }
  }

  if (!options.requireInstallationToken) {
    return null;
  }

  return pluginError(
    "unauthorized_plugin_request",
    "Missing or invalid installation token.",
    401,
  );
}

export function pluginError(
  code: string,
  message: string,
  status = 400,
): NextResponse {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code,
        message,
      },
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

export function pluginSuccess(
  payload: PluginControlResponse,
  source: string,
  extras: Record<string, unknown> = {},
): NextResponse {
  return NextResponse.json(
    {
      ok: true,
      source,
      ...payload,
      ...extras,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
