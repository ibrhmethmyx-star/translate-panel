import { createHash, randomBytes } from "node:crypto";
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
  SiteInstallationRecord,
} from "@/lib/contracts";
import {
  ActivationStatus,
  LicensePlan,
  LicenseStatus,
  LockLevel,
  Prisma,
  ReleaseChannel,
  RequestLogType,
  SiteLicenseMode as DbSiteLicenseMode,
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
  sites as demoSites,
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
type SiteDbRecord = Prisma.SiteInstallationGetPayload<{
  include: {
    license: {
      select: {
        customerName: true;
        key: true;
      };
    };
  };
}>;

export interface ControlPlanePluginResult {
  source: ControlPlaneDataSource;
  payload: PluginControlResponse;
  installation?: {
    token: string;
    issuedAt: string;
  };
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

function generateInstallationToken(): string {
  return randomBytes(32).toString("base64url");
}

function hashInstallationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

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
    return siteUrl.replace(/^https?:\/\//, "").replace(/\/.*$/, "").trim();
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

function mapSiteMode(mode: DbSiteLicenseMode): SiteInstallationRecord["licenseMode"] {
  return mode === DbSiteLicenseMode.LICENSED ? "licensed" : "free";
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

function mapSiteRecord(site: SiteDbRecord): SiteInstallationRecord {
  return {
    id: site.id,
    siteUrl: site.siteUrl,
    siteHost: site.siteHost,
    instanceHash: site.instanceHash,
    pluginVersion: site.pluginVersion,
    firstSeenAt: toIsoString(site.firstSeenAt) ?? "",
    lastSeenAt: toIsoString(site.lastSeenAt) ?? "",
    licenseMode: mapSiteMode(site.licenseMode),
    licenseKey: site.licenseKey,
    licenseStatus: mapStatus(site.licenseStatus),
    plan: mapPlan(site.plan),
    lockLevel: mapLockLevel(site.runtimeLockLevel),
    health: mapActivationStatus(site.health),
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

function buildDefaultPolicy(): ReleasePolicy {
  const now = new Date().toISOString();

  return {
    id: "policy_default",
    minimumSupportedVersion: "0.0.0",
    enforcedFrom: now,
    graceUntil: now,
    lockLevel: "none",
    message: "No active release policy has been configured yet.",
  };
}

function buildEmptyDashboard(): DashboardSnapshot {
  return {
    dataSource: "database",
    panelStats: {
      totalLicenses: 0,
      totalSites: 0,
      licensedSites: 0,
      freeSites: 0,
      outdatedSites: 0,
      hardLockedSites: 0,
    },
    licenses: [],
    activations: [],
    releases: [],
    releasePolicy: buildDefaultPolicy(),
    sites: [],
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
    sites: demoSites,
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

  const distinctHosts = new Set(
    license.activations.map((activation) => activation.siteHost),
  );

  return distinctHosts.size >= license.maxDomains;
}

function buildInactiveLicenseState(input?: PluginRequestInput) {
  if (input?.licenseKey.trim()) {
    return {
      status: "invalid" as const,
      plan: "free" as const,
      addons: [],
      expiresAt: null,
    };
  }

  return {
    status: "inactive" as const,
    plan: "free" as const,
    addons: [],
    expiresAt: null,
  };
}

function buildUpdateState(
  input: PluginRequestInput,
  latestRelease: ReleaseDbRecord | null,
  policy: PolicyRecord | null,
) {
  const latestVersion = latestRelease?.version ?? input.pluginVersion;
  const minimumSupportedVersion =
    policy?.minimumSupportedVersion ?? latestVersion ?? "0.0.0";

  return {
    latestVersion,
    minimumSupportedVersion,
    isUpdateRequired: latestRelease
      ? compareVersions(input.pluginVersion, latestRelease.version) < 0
      : false,
    graceUntil: toIsoString(policy?.graceUntil) ?? "",
    downloadUrl: latestRelease ? buildDownloadUrl(latestRelease.version) : "",
    checksum: latestRelease?.checksum ?? "",
  };
}

function buildLockStateFromDatabase(params: {
  input: PluginRequestInput;
  policy: PolicyRecord | null;
  license: LicenseWithRelations | null;
}): PluginLockState {
  const { input, policy, license } = params;

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

  if (!policy) {
    return {
      level: "none",
      reason: "no_policy_configured",
      message: "No active release policy is configured yet.",
    };
  }

  const now = new Date();
  const isBelowMinimum =
    compareVersions(input.pluginVersion, policy.minimumSupportedVersion) < 0;
  const enforcedLevel = mapLockLevel(policy.lockLevel);

  if (isBelowMinimum && now > policy.graceUntil) {
    return {
      level: enforcedLevel === "none" ? "hard" : enforcedLevel,
      reason: "minimum_version_not_met",
      message:
        policy.message ||
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

function deriveActivationStatus(lockLevel: PluginLockState["level"]): ActivationStatus {
  if (lockLevel === "hard" || lockLevel === "blocked") {
    return ActivationStatus.HARD_LOCK;
  }

  if (lockLevel === "soft") {
    return ActivationStatus.WARNING;
  }

  return ActivationStatus.HEALTHY;
}

function deriveDatabaseLockLevel(lockLevel: PluginLockState["level"]): LockLevel {
  if (lockLevel === "hard") {
    return LockLevel.HARD;
  }

  if (lockLevel === "blocked") {
    return LockLevel.BLOCKED;
  }

  if (lockLevel === "soft") {
    return LockLevel.SOFT;
  }

  return LockLevel.NONE;
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
      lockLevel: deriveDatabaseLockLevel(params.lockLevel ?? "none"),
      licenseId: params.licenseId ?? null,
      payload: params.payload,
    },
  });
}

async function resolveLicenseForInput(input: PluginRequestInput) {
  const prisma = getPrismaClient();
  const normalizedKey = input.licenseKey.trim();

  if (!prisma || !normalizedKey) {
    return null;
  }

  return prisma.license.findUnique({
    where: {
      key: normalizedKey,
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
}

async function syncSiteInstallation(
  input: PluginRequestInput,
  payload: PluginControlResponse,
  installationToken = "",
) {
  const prisma = getPrismaClient();

  if (!prisma) {
    return null;
  }

  const siteHost = extractSiteHost(input.siteUrl);
  const trimmedKey = input.licenseKey.trim();
  const normalizedInstallationToken = installationToken.trim();
  const license = trimmedKey
    ? await prisma.license.findUnique({
        where: {
          key: trimmedKey,
        },
      })
    : null;

  const licenseMode = trimmedKey
    ? DbSiteLicenseMode.LICENSED
    : DbSiteLicenseMode.FREE;
  const licenseStatus = license
    ? license.status
    : trimmedKey
      ? LicenseStatus.INVALID
      : LicenseStatus.INACTIVE;
  const plan = license?.plan ?? LicensePlan.FREE;
  const existingInstallation = await prisma.siteInstallation.findUnique({
    where: {
      siteHost_instanceHash: {
        siteHost,
        instanceHash: input.instanceHash,
      },
    },
    select: {
      accessTokenHash: true,
    },
  });
  const incomingTokenHash = normalizedInstallationToken
    ? hashInstallationToken(normalizedInstallationToken)
    : "";
  const hasValidIncomingToken =
    normalizedInstallationToken !== "" &&
    existingInstallation?.accessTokenHash === incomingTokenHash;
  const issuedToken = hasValidIncomingToken ? "" : generateInstallationToken();
  const accessTokenHash = hasValidIncomingToken
    ? existingInstallation?.accessTokenHash ?? null
    : hashInstallationToken(issuedToken);
  const issuedAt = new Date().toISOString();

  await prisma.siteInstallation.upsert({
    where: {
      siteHost_instanceHash: {
        siteHost,
        instanceHash: input.instanceHash,
      },
    },
    update: {
      siteUrl: input.siteUrl,
      pluginVersion: input.pluginVersion,
      accessTokenHash,
      licenseId: license?.id ?? null,
      licenseKey: trimmedKey || null,
      licenseMode,
      licenseStatus,
      plan,
      runtimeLockLevel: deriveDatabaseLockLevel(payload.lock.level),
      health: deriveActivationStatus(payload.lock.level),
      lastSeenAt: new Date(),
    },
    create: {
      siteUrl: input.siteUrl,
      siteHost,
      instanceHash: input.instanceHash,
      pluginVersion: input.pluginVersion,
      accessTokenHash,
      licenseId: license?.id ?? null,
      licenseKey: trimmedKey || null,
      licenseMode,
      licenseStatus,
      plan,
      runtimeLockLevel: deriveDatabaseLockLevel(payload.lock.level),
      health: deriveActivationStatus(payload.lock.level),
      lastSeenAt: new Date(),
    },
  });

  return issuedToken
    ? {
        token: issuedToken,
        issuedAt,
      }
    : null;
}

async function getDatabaseSnapshot(): Promise<DashboardSnapshot> {
  const prisma = getPrismaClient();

  if (!prisma) {
    return buildDemoDashboard();
  }

  const [licenseRows, activationRows, siteRows, releaseRows, policyRow] =
    await Promise.all([
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
          createdAt: "desc",
        },
      }),
      prisma.licenseActivation.findMany({
        orderBy: {
          lastSeenAt: "desc",
        },
      }),
      prisma.siteInstallation.findMany({
        include: {
          license: {
            select: {
              customerName: true,
              key: true,
            },
          },
        },
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

  const licenses = licenseRows.map(mapLicenseRecord);
  const activations = activationRows.map(mapActivationRecord);
  const sites = siteRows.map(mapSiteRecord);
  const releases = releaseRows.map(mapReleaseRecord);
  const releasePolicy = policyRow ? mapReleasePolicy(policyRow) : buildDefaultPolicy();

  if (
    licenses.length === 0 &&
    activations.length === 0 &&
    sites.length === 0 &&
    releases.length === 0 &&
    !policyRow
  ) {
    return buildEmptyDashboard();
  }

  return {
    dataSource: "database",
    panelStats: {
      totalLicenses: licenses.length,
      totalSites: sites.length,
      licensedSites: sites.filter((site) => site.licenseMode === "licensed").length,
      freeSites: sites.filter((site) => site.licenseMode === "free").length,
      outdatedSites: sites.filter(
        (site) =>
          releasePolicy.minimumSupportedVersion !== "0.0.0" &&
          compareVersions(site.pluginVersion, releasePolicy.minimumSupportedVersion) < 0,
      ).length,
      hardLockedSites: sites.filter(
        (site) => site.lockLevel === "hard" || site.lockLevel === "blocked",
      ).length,
    },
    licenses,
    activations,
    releases,
    releasePolicy,
    sites,
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

  const normalizedKey = input.licenseKey.trim();
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
    normalizedKey
      ? prisma.license.findUnique({
          where: {
            key: normalizedKey,
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
        })
      : Promise.resolve(null),
  ]);

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
      : buildInactiveLicenseState(input),
    update: buildUpdateState(input, latestRelease, policy),
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
  installationToken = "",
): Promise<ControlPlanePluginResult> {
  if (!hasDatabaseUrl()) {
    return {
      source: "demo",
      payload: buildDemoPluginPayload(input),
    };
  }

  try {
    const result = await getDatabasePluginPayload(input);
    const installation = await syncSiteInstallation(
      input,
      result.payload,
      installationToken,
    );
    return {
      ...result,
      ...(installation ? { installation } : {}),
    };
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
  installationToken = "",
): Promise<ActivationResult> {
  const result = await getPluginControlResponse(input, installationToken);

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

  const license = await resolveLicenseForInput(input);

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

  const activationStatus = deriveActivationStatus(result.payload.lock.level);

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
  installationToken = "",
): Promise<HeartbeatResult> {
  const result = await getPluginControlResponse(input, installationToken);

  if (result.source === "database") {
    const prisma = getPrismaClient();
    const license = await resolveLicenseForInput(input);

    if (prisma && license) {
      const siteHost = extractSiteHost(input.siteUrl);
      const status = deriveActivationStatus(result.payload.lock.level);

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
  installationToken = "",
): Promise<UpdateManifestResult> {
  const result = await getPluginControlResponse(input, installationToken);
  const prisma = getPrismaClient();
  const latestRelease =
    result.source === "database" && prisma
      ? await prisma.release.findFirst({
          where: {
            channel: ReleaseChannel.STABLE,
          },
          orderBy: {
            publishedAt: "desc",
          },
        })
      : null;

  const release = latestRelease
    ? {
        version: latestRelease.version,
        changelog: latestRelease.changelog,
        publishedAt: toIsoString(latestRelease.publishedAt) ?? "",
      }
    : {
        version: input.pluginVersion,
        changelog: [],
        publishedAt: new Date().toISOString(),
      };

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
    release,
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
