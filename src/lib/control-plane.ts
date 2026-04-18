import type {
  ActivationRecord,
  ControlPlaneDataSource,
  DashboardSnapshot,
  LicenseRecord,
  PluginControlResponse,
  PluginLockState,
  PluginRequestInput,
  ReleasePolicy,
  ReleaseRecord,
} from "@/lib/contracts";
import {
  ActivationStatus,
  LicensePlan,
  LicenseStatus,
  LockLevel,
  Prisma,
  ReleaseChannel,
  RequestLogType,
} from "@prisma/client";
import {
  activations as demoActivations,
  apiSurface,
  buildPluginPayload as buildDemoPluginPayload,
  implementationStages,
  licenses as demoLicenses,
  panelStats as demoPanelStats,
  releasePolicy as demoReleasePolicy,
  releases as demoReleases,
} from "@/lib/mock-control-plane";
import { getPrismaClient, hasDatabaseUrl } from "@/lib/prisma";
import { compareVersions } from "@/lib/version";

type LicenseWithRelations = Prisma.LicenseGetPayload<{
  include: {
    addonEntitlements: true;
    activations: {
      select: {
        siteHost: true;
        instanceHash: true;
      };
    };
  };
}>;

type PolicyRecord = Prisma.ReleasePolicyGetPayload<Record<string, never>>;
type ReleaseDbRecord = Prisma.ReleaseGetPayload<Record<string, never>>;
type ActivationDbRecord = Prisma.LicenseActivationGetPayload<Record<string, never>>;

export interface ControlPlanePluginResult {
  source: ControlPlaneDataSource;
  payload: PluginControlResponse;
}

export interface ActivationResult extends ControlPlanePluginResult {
  activation: {
    status: "bound" | "unchanged" | "rejected";
    message: string;
  };
}

export interface HeartbeatResult extends ControlPlanePluginResult {
  telemetry: {
    accepted: boolean;
    nextCheckAfterMinutes: number;
  };
}

export interface UpdateManifestResult extends ControlPlanePluginResult {
  release: {
    version: string;
    changelog: string[];
    publishedAt: string;
  };
}

export { apiSurface, implementationStages };

function toIsoString(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  return value.toISOString();
}

function getBaseUrl(): string {
  return (process.env.APP_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

function extractSiteHost(siteUrl: string): string {
  try {
    return new URL(siteUrl).host;
  } catch {
    return siteUrl
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "")
      .trim();
  }
}

function mapPlan(plan: LicensePlan): LicenseRecord["plan"] {
  switch (plan) {
    case LicensePlan.PRO:
      return "pro";
    case LicensePlan.AGENCY:
      return "agency";
    case LicensePlan.FREE:
    default:
      return "free";
  }
}

function mapStatus(status: LicenseStatus): LicenseRecord["status"] {
  switch (status) {
    case LicenseStatus.ACTIVE:
      return "active";
    case LicenseStatus.INVALID:
      return "invalid";
    case LicenseStatus.EXPIRED:
      return "expired";
    case LicenseStatus.SUSPENDED:
      return "suspended";
    case LicenseStatus.INACTIVE:
    default:
      return "inactive";
  }
}

function mapLockLevel(level: LockLevel): PluginLockState["level"] {
  switch (level) {
    case LockLevel.SOFT:
      return "soft";
    case LockLevel.HARD:
      return "hard";
    case LockLevel.BLOCKED:
      return "blocked";
    case LockLevel.NONE:
    default:
      return "none";
  }
}

function mapActivationStatus(
  status: ActivationStatus,
): ActivationRecord["status"] {
  switch (status) {
    case ActivationStatus.WARNING:
      return "warning";
    case ActivationStatus.HARD_LOCK:
      return "hard_lock";
    case ActivationStatus.HEALTHY:
    default:
      return "healthy";
  }
}

function mapLicenseRecord(license: LicenseWithRelations): LicenseRecord {
  return {
    id: license.id,
    key: license.key,
    customerName: license.customerName,
    plan: mapPlan(license.plan),
    status: mapStatus(license.status),
    maxDomains: license.maxDomains,
    addons: license.addonEntitlements.map((entitlement) => entitlement.addonSlug),
    expiresAt: toIsoString(license.expiresAt),
  };
}

function mapActivationRecord(activation: ActivationDbRecord): ActivationRecord {
  return {
    id: activation.id,
    licenseId: activation.licenseId,
    siteUrl: activation.siteUrl,
    siteHost: activation.siteHost,
    instanceHash: activation.instanceHash,
    pluginVersion: activation.pluginVersion,
    lastSeenAt: toIsoString(activation.lastSeenAt) ?? "",
    status: mapActivationStatus(activation.status),
  };
}

function mapReleaseRecord(release: ReleaseDbRecord): ReleaseRecord {
  return {
    id: release.id,
    version: release.version,
    channel: release.channel === ReleaseChannel.BETA ? "beta" : "stable",
    changelog: release.changelog,
    zipUrl: release.zipUrl,
    checksum: release.checksum,
    isMandatory: release.isMandatory,
    publishedAt: toIsoString(release.publishedAt) ?? "",
  };
}

function mapReleasePolicy(policy: PolicyRecord): ReleasePolicy {
  return {
    id: policy.id,
    minimumSupportedVersion: policy.minimumSupportedVersion,
    enforcedFrom: toIsoString(policy.enforcedFrom) ?? "",
    graceUntil: toIsoString(policy.graceUntil) ?? "",
    lockLevel: mapLockLevel(policy.lockLevel),
    message: policy.message,
  };
}

function buildDemoDashboard(): DashboardSnapshot {
  return {
    dataSource: "demo",
    panelStats: demoPanelStats,
    licenses: demoLicenses,
    activations: demoActivations,
    releases: demoReleases,
    releasePolicy: demoReleasePolicy,
  };
}

function buildDownloadUrl(version: string): string {
  return `${getBaseUrl()}/api/plugin/download?version=${encodeURIComponent(version)}`;
}

function hasReachedDomainLimit(
  license: LicenseWithRelations,
  siteHost: string,
  instanceHash: string,
): boolean {
  if (license.maxDomains <= 0) {
    return false;
  }

  const existingSite = license.activations.some(
    (activation) =>
      activation.siteHost === siteHost || activation.instanceHash === instanceHash,
  );

  if (existingSite) {
    return false;
  }

  const distinctHosts = new Set(license.activations.map((activation) => activation.siteHost));

  return distinctHosts.size >= license.maxDomains;
}

function buildInactiveLicenseState() {
  return {
    status: "inactive" as const,
    plan: "free" as const,
    addons: [],
    expiresAt: null,
  };
}

function buildLockStateFromDatabase(params: {
  input: PluginRequestInput;
  policy: PolicyRecord;
  license: LicenseWithRelations | null;
}): PluginLockState {
  const { input, policy, license } = params;
  const now = new Date();
  const isBelowMinimum =
    compareVersions(input.pluginVersion, policy.minimumSupportedVersion) < 0;

  if (
    license &&
    (license.status === LicenseStatus.SUSPENDED ||
      license.status === LicenseStatus.EXPIRED)
  ) {
    return {
      level: "hard",
      reason: "license_unavailable",
      message:
        "This license is not in a usable state. Keep the admin screen available, but stop all runtime translation services.",
    };
  }

  if (license) {
    const siteHost = extractSiteHost(input.siteUrl);

    if (hasReachedDomainLimit(license, siteHost, input.instanceHash)) {
      return {
        level: "hard",
        reason: "domain_limit_reached",
        message:
          "The license has no remaining domain slots. Keep admin access available and block runtime services until the site is re-assigned.",
      };
    }
  }

  if (isBelowMinimum && now > policy.graceUntil) {
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

async function logRequest(params: {
  type: RequestLogType;
  input: PluginRequestInput;
  responseCode: number;
  lockLevel?: PluginLockState["level"];
  licenseId?: string | null;
  payload?: Prisma.InputJsonValue;
}) {
  const prisma = getPrismaClient();

  if (!prisma) {
    return;
  }

  await prisma.requestLog.create({
    data: {
      type: params.type,
      siteUrl: params.input.siteUrl || null,
      siteHost: extractSiteHost(params.input.siteUrl) || null,
      instanceHash: params.input.instanceHash || null,
      pluginVersion: params.input.pluginVersion || null,
      responseCode: params.responseCode,
      lockLevel:
        params.lockLevel === "soft"
          ? LockLevel.SOFT
          : params.lockLevel === "hard"
            ? LockLevel.HARD
            : params.lockLevel === "blocked"
              ? LockLevel.BLOCKED
              : LockLevel.NONE,
      licenseId: params.licenseId ?? null,
      payload: params.payload,
    },
  });
}

async function getDatabaseSnapshot(): Promise<DashboardSnapshot> {
  const prisma = getPrismaClient();

  if (!prisma) {
    return buildDemoDashboard();
  }

  const [licenseRows, activationRows, releaseRows, policyRow] = await Promise.all([
    prisma.license.findMany({
      include: {
        addonEntitlements: true,
        activations: {
          select: {
            siteHost: true,
            instanceHash: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    }),
    prisma.licenseActivation.findMany({
      orderBy: {
        lastSeenAt: "desc",
      },
    }),
    prisma.release.findMany({
      orderBy: {
        publishedAt: "desc",
      },
    }),
    prisma.releasePolicy.findFirst({
      where: {
        isActive: true,
      },
      orderBy: {
        enforcedFrom: "desc",
      },
    }),
  ]);

  if (!policyRow || releaseRows.length === 0) {
    return buildDemoDashboard();
  }

  const licenses = licenseRows.map(mapLicenseRecord);
  const activations = activationRows.map(mapActivationRecord);
  const releases = releaseRows.map(mapReleaseRecord);
  const releasePolicy = mapReleasePolicy(policyRow);

  return {
    dataSource: "database",
    panelStats: {
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
    },
    licenses,
    activations,
    releases,
    releasePolicy,
  };
}

async function getDatabasePluginPayload(
  input: PluginRequestInput,
): Promise<ControlPlanePluginResult> {
  const prisma = getPrismaClient();

  if (!prisma) {
    return {
      source: "demo",
      payload: buildDemoPluginPayload(input),
    };
  }

  const [latestRelease, policy, license] = await Promise.all([
    prisma.release.findFirst({
      where: {
        channel: ReleaseChannel.STABLE,
      },
      orderBy: {
        publishedAt: "desc",
      },
    }),
    prisma.releasePolicy.findFirst({
      where: {
        isActive: true,
      },
      orderBy: {
        enforcedFrom: "desc",
      },
    }),
    prisma.license.findUnique({
      where: {
        key: input.licenseKey,
      },
      include: {
        addonEntitlements: true,
        activations: {
          select: {
            siteHost: true,
            instanceHash: true,
          },
        },
      },
    }),
  ]);

  if (!latestRelease || !policy) {
    return {
      source: "demo",
      payload: buildDemoPluginPayload(input),
    };
  }

  const payload: PluginControlResponse = {
    license: license
      ? {
          status: mapStatus(license.status),
          plan: mapPlan(license.plan),
          addons: license.addonEntitlements.map(
            (entitlement) => entitlement.addonSlug,
          ),
          expiresAt: toIsoString(license.expiresAt),
        }
      : buildInactiveLicenseState(),
    update: {
      latestVersion: latestRelease.version,
      minimumSupportedVersion: policy.minimumSupportedVersion,
      isUpdateRequired:
        compareVersions(input.pluginVersion, latestRelease.version) < 0,
      graceUntil: toIsoString(policy.graceUntil) ?? "",
      downloadUrl: buildDownloadUrl(latestRelease.version),
      checksum: latestRelease.checksum,
    },
    lock: buildLockStateFromDatabase({
      input,
      policy,
      license,
    }),
    checkedAt: new Date().toISOString(),
  };

  await logRequest({
    type: RequestLogType.CHECK,
    input,
    responseCode: 200,
    lockLevel: payload.lock.level,
    licenseId: license?.id,
    payload: {
      licenseStatus: payload.license.status,
      plan: payload.license.plan,
      latestVersion: payload.update.latestVersion,
    },
  });

  return {
    source: "database",
    payload,
  };
}

export async function getDashboardSnapshot(): Promise<DashboardSnapshot> {
  if (!hasDatabaseUrl()) {
    return buildDemoDashboard();
  }

  try {
    return await getDatabaseSnapshot();
  } catch (error) {
    console.error("Falling back to demo dashboard snapshot:", error);
    return buildDemoDashboard();
  }
}

export async function getPluginControlResponse(
  input: PluginRequestInput,
): Promise<ControlPlanePluginResult> {
  if (!hasDatabaseUrl()) {
    return {
      source: "demo",
      payload: buildDemoPluginPayload(input),
    };
  }

  try {
    return await getDatabasePluginPayload(input);
  } catch (error) {
    console.error("Falling back to demo plugin payload:", error);
    return {
      source: "demo",
      payload: buildDemoPluginPayload(input),
    };
  }
}

export async function activatePluginInstallation(
  input: PluginRequestInput,
): Promise<ActivationResult> {
  const result = await getPluginControlResponse(input);

  if (result.source === "demo") {
    return {
      ...result,
      activation: {
        status: "bound",
        message: "Demo mode accepted this site activation.",
      },
    };
  }

  const prisma = getPrismaClient();

  if (!prisma) {
    return {
      ...result,
      activation: {
        status: "unchanged",
        message: "No database client available.",
      },
    };
  }

  const license = await prisma.license.findUnique({
    where: {
      key: input.licenseKey,
    },
    include: {
      addonEntitlements: true,
      activations: {
        select: {
          siteHost: true,
          instanceHash: true,
        },
      },
    },
  });

  if (!license) {
    return {
      ...result,
      activation: {
        status: "rejected",
        message: "No matching license was found for activation.",
      },
    };
  }

  const siteHost = extractSiteHost(input.siteUrl);

  if (hasReachedDomainLimit(license, siteHost, input.instanceHash)) {
    await logRequest({
      type: RequestLogType.ACTIVATE,
      input,
      responseCode: 409,
      lockLevel: "hard",
      licenseId: license.id,
      payload: {
        reason: "domain_limit_reached",
      },
    });

    return {
      ...result,
      activation: {
        status: "rejected",
        message: "License domain limit reached for this site.",
      },
    };
  }

  const activationStatus =
    result.payload.lock.level === "hard"
      ? ActivationStatus.HARD_LOCK
      : result.payload.lock.level === "soft"
        ? ActivationStatus.WARNING
        : ActivationStatus.HEALTHY;

  await prisma.licenseActivation.upsert({
    where: {
      siteHost_instanceHash: {
        siteHost,
        instanceHash: input.instanceHash,
      },
    },
    update: {
      licenseId: license.id,
      siteUrl: input.siteUrl,
      pluginVersion: input.pluginVersion,
      status: activationStatus,
      lastSeenAt: new Date(),
    },
    create: {
      licenseId: license.id,
      siteUrl: input.siteUrl,
      siteHost,
      instanceHash: input.instanceHash,
      pluginVersion: input.pluginVersion,
      status: activationStatus,
      lastSeenAt: new Date(),
    },
  });

  await logRequest({
    type: RequestLogType.ACTIVATE,
    input,
    responseCode: 200,
    lockLevel: result.payload.lock.level,
    licenseId: license.id,
    payload: {
      activationStatus,
    },
  });

  return {
    ...result,
    activation: {
      status: "bound",
      message: "License activated for this site instance.",
    },
  };
}

export async function recordPluginHeartbeat(
  input: PluginRequestInput,
): Promise<HeartbeatResult> {
  const result = await getPluginControlResponse(input);

  if (result.source === "database") {
    const prisma = getPrismaClient();
    const license = prisma
      ? await prisma.license.findUnique({
          where: {
            key: input.licenseKey,
          },
        })
      : null;

    if (prisma && license) {
      const siteHost = extractSiteHost(input.siteUrl);
      const status =
        result.payload.lock.level === "hard"
          ? ActivationStatus.HARD_LOCK
          : result.payload.lock.level === "soft"
            ? ActivationStatus.WARNING
            : ActivationStatus.HEALTHY;

      await prisma.licenseActivation.upsert({
        where: {
          siteHost_instanceHash: {
            siteHost,
            instanceHash: input.instanceHash,
          },
        },
        update: {
          licenseId: license.id,
          siteUrl: input.siteUrl,
          pluginVersion: input.pluginVersion,
          status,
          lastSeenAt: new Date(),
        },
        create: {
          licenseId: license.id,
          siteUrl: input.siteUrl,
          siteHost,
          instanceHash: input.instanceHash,
          pluginVersion: input.pluginVersion,
          status,
          lastSeenAt: new Date(),
        },
      });
    }

    await logRequest({
      type: RequestLogType.HEARTBEAT,
      input,
      responseCode: 200,
      lockLevel: result.payload.lock.level,
      licenseId: license?.id,
      payload: {
        accepted: true,
      },
    });
  }

  return {
    ...result,
    telemetry: {
      accepted: true,
      nextCheckAfterMinutes: 720,
    },
  };
}

export async function getPluginUpdateManifest(
  input: PluginRequestInput,
): Promise<UpdateManifestResult> {
  const result = await getPluginControlResponse(input);
  const releases =
    result.source === "database"
      ? await getDashboardSnapshot().then((snapshot) => snapshot.releases)
      : demoReleases;
  const release = releases[0];

  if (result.source === "database") {
    await logRequest({
      type: RequestLogType.UPDATE_MANIFEST,
      input,
      responseCode: 200,
      lockLevel: result.payload.lock.level,
      payload: {
        latestVersion: release.version,
      },
    });
  }

  return {
    ...result,
    release: {
      version: release.version,
      changelog: release.changelog,
      publishedAt: release.publishedAt,
    },
  };
}

export async function resolveReleaseDownload(version: string) {
  if (!hasDatabaseUrl()) {
    const release =
      demoReleases.find((entry) => entry.version === version) ?? demoReleases[0];
    return release ? { source: "demo" as const, release } : null;
  }

  const prisma = getPrismaClient();

  if (!prisma) {
    return null;
  }

  const release = await prisma.release.findUnique({
    where: {
      version,
    },
  });

  if (!release) {
    return null;
  }

  return {
    source: "database" as const,
    release: mapReleaseRecord(release),
  };
}
