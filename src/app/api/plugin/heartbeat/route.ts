import { recordPluginHeartbeat } from "@/lib/control-plane";
import {
  assertPluginAccess,
  pluginError,
  pluginSuccess,
  readPluginBody,
} from "@/lib/plugin-api";

export async function POST(request: Request) {
  const accessError = assertPluginAccess(request);

  if (accessError) {
    return accessError;
  }

  const input = await readPluginBody(request);

  if (!input || !input.siteUrl) {
    return pluginError(
      "invalid_heartbeat_payload",
      "Heartbeat payload must include siteUrl and pluginVersion.",
    );
  }

  const result = await recordPluginHeartbeat(input);

  return pluginSuccess(result.payload, result.source, {
    telemetry: result.telemetry,
  });
}
