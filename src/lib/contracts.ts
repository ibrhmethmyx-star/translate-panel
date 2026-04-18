export type LicensePlan = "free" | "pro" | "agency";

export type LicenseStatus =
  | "active"
  | "inactive"
  | "invalid"
  | "expired"
  | "suspended";

export type LockLevel = "none" | "soft" | "hard" | "blocked";

export type ControlPlaneDataSource = "demo" | "database";

export type ActivationHealth = "healthy" | "warning" | "hard_lock";

export interface PanelStats {
  totalLicenses: number;
  activeSites: number;
  outdatedSites: number;
  hardLockedSites: number;
}

export interface LicenseRecord {
  id: string;
  key: string;
  customerName: string;
  plan: LicensePlan;
  status: LicenseStatus;
  maxDomains: number;
  addons: string[];
  expiresAt: string | null;
}

export interface ActivationRecord {
  id: string;
  licenseId: string;
  siteUrl: string;
  siteHost: string;
  instanceHash: string;
  pluginVersion: string;
  lastSeenAt: string;
  status: ActivationHealth;
}

export interface ReleaseRecord {
  id: string;
  version: string;
  channel: "stable" | "beta";
  changelog: string[];
  zipUrl: string;
  checksum: string;
  isMandatory: boolean;
  publishedAt: string;
}

export interface ReleasePolicy {
  id: string;
  minimumSupportedVersion: string;
  enforcedFrom: string;
  graceUntil: string;
  lockLevel: LockLevel;
  message: string;
}

export interface PluginRequestInput {
  licenseKey: string;
  siteUrl: string;
  instanceHash: string;
  pluginVersion: string;
}

export interface PluginLicenseState {
  status: LicenseStatus;
  plan: LicensePlan;
  addons: string[];
  expiresAt: string | null;
}

export interface PluginUpdateState {
  latestVersion: string;
  minimumSupportedVersion: string;
  isUpdateRequired: boolean;
  graceUntil: string;
  downloadUrl: string;
  checksum: string;
}

export interface PluginLockState {
  level: LockLevel;
  reason: string;
  message: string;
}

export interface PluginControlResponse {
  license: PluginLicenseState;
  update: PluginUpdateState;
  lock: PluginLockState;
  checkedAt: string;
}

export interface DashboardSnapshot {
  dataSource: ControlPlaneDataSource;
  panelStats: PanelStats;
  licenses: LicenseRecord[];
  activations: ActivationRecord[];
  releases: ReleaseRecord[];
  releasePolicy: ReleasePolicy;
}

export interface PluginApiRoute {
  method: "GET" | "POST";
  path: string;
  purpose: string;
}
