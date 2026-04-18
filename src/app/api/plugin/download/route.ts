import { resolveReleaseDownload } from "@/lib/control-plane";
import { assertPluginAccess, pluginError } from "@/lib/plugin-api";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const accessError = assertPluginAccess(request);

  if (accessError) {
    return accessError;
  }

  const url = new URL(request.url);
  const requestedVersion = url.searchParams.get("version")?.trim() ?? "";

  if (!requestedVersion) {
    return pluginError(
      "missing_release_version",
      "A release version is required to resolve the download.",
    );
  }

  const resolvedRelease = await resolveReleaseDownload(requestedVersion);

  if (!resolvedRelease) {
    return pluginError(
      "release_not_found",
      "No release could be found for the requested version.",
      404,
    );
  }

  return NextResponse.redirect(resolvedRelease.release.zipUrl, {
    status: 307,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
