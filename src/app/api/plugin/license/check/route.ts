import { getPluginControlResponse } from "@/lib/control-plane";
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

  if (!input) {
    return pluginError(
      "invalid_check_payload",
      "Expected JSON payload with license and site metadata.",
    );
  }

  const result = await getPluginControlResponse(input);

  return pluginSuccess(result.payload, result.source);
}
