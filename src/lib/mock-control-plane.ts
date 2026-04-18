import type {
  ActivationRecord,
  LicenseRecord,
  PanelStats,
  PluginApiRoute,
  PluginControlResponse,
  PluginLockState,
  PluginRequestInput,
  ReleasePolicy,
  ReleaseRecord,
} from "@/lib/contracts";
import { compareVersions } from "@/lib/version";

export const releasePolicy: ReleasePolicy = {
  id: "policy_current",
  minimumSupportedVersion: "0.2.5",
  enforcedFrom: "2026-04-19T00:00:00.000Z",
  graceUntil: "2026-04-30T00:00:00.000Z",
  lockLevel: "hard",
  message:
    "Sites below the supported version keep admin access, but runtime translation services stop after the grace window closes.",
};

export const releases: ReleaseRecord[] = [
  {
    id: "rel_030",
    version: "0.3.0",
    channel: "stable",
    changelog: [
      "Adds remote release enforcement and hard-lock orchestration.",
      "Introduces signed plugin download flow hooks.",
      "Improves activation telemetry for license support.",
    ],
    zipUrl: "https://downloads.example.com/dst/plugin-0.3.0.zip",
    checksum: "sha256-demo-030",
    isMandatory: true,
    publishedAt: "2026-04-19T08:00:00.000Z",
  },
  {
    id: "rel_025",
    version: "0.2.5",
    channel: "stable",
    changelog: [
      "Stabilizes license-aware addon boot checks.",
      "Prepares plugin settings for remote validation metadata.",
    ],
    zipUrl: "https://downloads.example.com/dst/plugin-0.2.5.zip",
    checksum: "sha256-demo-025",
    isMandatory: false,
    publishedAt: "2026-04-05T09:30:00.000Z",
  },
];

export const licenses: LicenseRecord[] = [
  {
    id: "lic_agency_1",
    key: "DST-AGENCY-ALPHA001",
    customerName: "Northwind Commerce",
    plan: "agency",
    status: "active",
    maxDomains: 25,
    addons: ["woocommerce_local_pricing"],
    expiresAt: null,
  },
  {
    id: "lic_pro_1",
    key: "DST-PRO-BRAVO002",
    customerName: "Atelier Fera",
    plan: "pro",
    status: "active",
    maxDomains: 3,
    addons: [],
    expiresAt: null,
  },
  {
    id: "lic_suspended_1",
    key: "DST-PRO-SUSPEND003",
    customerName: "Legacy Shop Group",
    plan: "pro",
    status: "suspended",
    maxDomains: 2,
    addons: ["woocommerce_local_pricing"],
    expiresAt: null,
  },
];

export const activations: ActivationRecord[] = [
  {
    id: "act_1",
    licenseId: "lic_agency_1",
    siteUrl: "https://northwind.example",
    siteHost: "northwind.example",
    instanceHash: "inst-alpha",
    pluginVersion: "0.3.0",
    lastSeenAt: "2026-04-19T09:00:00.000Z",
    status: "healthy",
  },
  {
    id: "act_2",
    licenseId: "lic_pro_1",
    siteUrl: "https://atelier-fera.example",
    siteHost: "atelier-fera.example",
    instanceHash: "inst-bravo",
    pluginVersion: "0.2.4",
    lastSeenAt: "2026-04-19T08:42:00.000Z",
    status: "warning",
  },
  {
    id: "act_3",
    licenseId: "lic_suspended_1",
    siteUrl: "https://legacy-shop.example",
    siteHost: "legacy-shop.example",
    instanceHash: "inst-charlie",
    pluginVersion: "0.2.3",
    lastSeenAt: "2026-04-19T07:58:00.000Z",
    status: "hard_lock",
  },
];

export const panelStats: PanelStats = {
  totalLicenses: licenses.length,
  activeSites: activations.length,
  outdatedSites: activations.filter(
    (activation) =>
      compareVersions(
        activation.pluginVersion,
        releasePolicy.minimumSupportedVersion,
      ) < 0,
  ).length,
  hardLockedSites: activations.filter(
    (activation) => activation.status === "hard_lock",
  ).length,
};

export const apiSurface: PluginApiRoute[] = [
  {
    method: "POST",
    path: "/api/plugin/license/activate",
    purpose: "First-time license activation and domain binding.",
  },
  {
    method: "POST",
    path: "/api/plugin/license/check",
    purpose: "Refresh license state, plan rights, and lock policy.",
  },
  {
    method: "POST",
    path: "/api/plugin/heartbeat",
    purpose: "Keep plugin version telemetry warm and re-evaluate lock state.",
  },
  {
    method: "GET",
    path: "/api/plugin/update-manifest",
    purpose: "Serve latest version metadata and minimum supported version.",
  },
  {
    method: "GET",
    path: "/api/plugin/download",
    purpose: "Resolve the approved release package URL for plugin updates.",
  },
];

export const implementationStages = [
  "Add admin authentication and protect the dashboard with role-aware access.",
  "Teach the WordPress plugin to cache control responses and respect hard lock mode.",
  "Replace plain shared-secret checks with signed request verification.",
  "Move package delivery to signed downloads or Blob-backed release assets.",
];

function getBaseUrl(): string {
  return (process.env.APP_BASE_URL ?? "https://panel.example.com").replace(/\/$/, "");
}

function normalizeLicenseState(licenseKey: string) {
  const match = licenses.find((license) => license.key === licenseKey);

  if (!match) {
    return {
      status: "inactive" as const,
      plan: "free" as const,
      addons: [],
      expiresAt: null,
    };
  }

  return {
    status: match.status,
    plan: match.plan,
    addons: match.addons,
    expiresAt: match.expiresAt,
  };
}

function resolveLockState(input: PluginRequestInput): PluginLockState {
  const license = licenses.find((entry) => entry.key === input.licenseKey);
  const now = new Date("2026-04-19T10:00:00.000Z");
  const graceUntil = new Date(releasePolicy.graceUntil);
  const isBelowMinimum =
    compareVersions(input.pluginVersion, releasePolicy.minimumSupportedVersion) < 0;

  if (license?.status === "suspended") {
    return {
      level: "hard",
      reason: "license_suspended",
      message:
        "License access is suspended. Keep the admin screen open, but stop all runtime translation services.",
    };
  }

  if (isBelowMinimum && now > graceUntil) {
    return {
      level: "hard",
      reason: "minimum_version_not_met",
      message:
        "The plugin version is below the supported floor. Keep admin access available and stop runtime services until the site updates.",
    };
  }

  if (isBelowMinimum) {
    return {
      level: "soft",
      reason: "grace_window_open",
      message:
        "A newer release is mandatory soon. Show admin warnings and prepare the plugin to enter hard lock after the grace window.",
    };
  }

  return {
    level: "none",
    reason: "runtime_allowed",
    message: "Plugin runtime services may continue.",
  };
}

export function buildPluginPayload(
  input: PluginRequestInput,
): PluginControlResponse {
  const latestRelease = releases[0];
  const license = normalizeLicenseState(input.licenseKey);
  const lock = resolveLockState(input);

  return {
    license,
    update: {
      latestVersion: latestRelease.version,
      minimumSupportedVersion: releasePolicy.minimumSupportedVersion,
      isUpdateRequired:
        compareVersions(input.pluginVersion, latestRelease.version) < 0,
      graceUntil: releasePolicy.graceUntil,
      downloadUrl: `${getBaseUrl()}/api/plugin/download?version=${latestRelease.version}`,
      checksum: latestRelease.checksum,
    },
    lock,
    checkedAt: new Date("2026-04-19T10:00:00.000Z").toISOString(),
  };
}
