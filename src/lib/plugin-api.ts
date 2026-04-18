import { NextResponse } from "next/server";
import type { PluginControlResponse, PluginRequestInput } from "@/lib/contracts";

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

export function assertPluginAccess(request: Request): NextResponse | null {
  const expectedSecret = process.env.PLUGIN_SHARED_SECRET?.trim();

  if (!expectedSecret) {
    return null;
  }

  const providedSecret =
    request.headers.get("x-dst-plugin-secret")?.trim() ??
    request.headers.get("x-plugin-secret")?.trim() ??
    "";

  if (providedSecret === expectedSecret) {
    return null;
  }

  return pluginError(
    "unauthorized_plugin_request",
    "Missing or invalid plugin shared secret.",
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
