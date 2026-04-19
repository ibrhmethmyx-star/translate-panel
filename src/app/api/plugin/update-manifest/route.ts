import { getPluginUpdateManifest } from "@/lib/control-plane";
import {
  assertPluginAccess,
  readInstallationToken,
  readPluginQuery,
} from "@/lib/plugin-api";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const accessError = await assertPluginAccess(request);

  if (accessError) {
    return accessError;
  }

  const input = readPluginQuery(request.url);
  const result = await getPluginUpdateManifest(
    input,
    readInstallationToken(request),
  );

  return NextResponse.json(
    {
      ok: true,
      source: result.source,
      update: result.payload.update,
      lock: result.payload.lock,
      release: result.release,
      ...(result.installation ? { installation: result.installation } : {}),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
