import { activatePluginInstallation } from "@/lib/control-plane";
import {
  assertPluginAccess,
  pluginError,
  pluginSuccess,
  readPluginBody,
  readInstallationToken,
} from "@/lib/plugin-api";

export async function POST(request: Request) {
  const accessError = await assertPluginAccess(request);

  if (accessError) {
    return accessError;
  }

  const input = await readPluginBody(request);

  if (!input || !input.siteUrl) {
    return pluginError(
      "invalid_activation_payload",
      "siteUrl is required to activate a license.",
    );
  }

  const result = await activatePluginInstallation(
    input,
    readInstallationToken(request),
  );

  return pluginSuccess(result.payload, result.source, {
    activation: result.activation,
    ...(result.installation ? { installation: result.installation } : {}),
  });
}
