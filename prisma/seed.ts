import {
  ActivationStatus,
  LicensePlan,
  LicenseStatus,
  LockLevel,
  PrismaClient,
  ReleaseChannel,
  RequestLogType,
} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const agencyLicense = await prisma.license.upsert({
    where: { key: "DST-AGENCY-ALPHA001" },
    update: {
      customerName: "Northwind Commerce",
      plan: LicensePlan.AGENCY,
      status: LicenseStatus.ACTIVE,
      maxDomains: 25,
      expiresAt: null,
    },
    create: {
      key: "DST-AGENCY-ALPHA001",
      customerName: "Northwind Commerce",
      plan: LicensePlan.AGENCY,
      status: LicenseStatus.ACTIVE,
      maxDomains: 25,
    },
  });

  const proLicense = await prisma.license.upsert({
    where: { key: "DST-PRO-BRAVO002" },
    update: {
      customerName: "Atelier Fera",
      plan: LicensePlan.PRO,
      status: LicenseStatus.ACTIVE,
      maxDomains: 3,
      expiresAt: null,
    },
    create: {
      key: "DST-PRO-BRAVO002",
      customerName: "Atelier Fera",
      plan: LicensePlan.PRO,
      status: LicenseStatus.ACTIVE,
      maxDomains: 3,
    },
  });

  const suspendedLicense = await prisma.license.upsert({
    where: { key: "DST-PRO-SUSPEND003" },
    update: {
      customerName: "Legacy Shop Group",
      plan: LicensePlan.PRO,
      status: LicenseStatus.SUSPENDED,
      maxDomains: 2,
      expiresAt: null,
    },
    create: {
      key: "DST-PRO-SUSPEND003",
      customerName: "Legacy Shop Group",
      plan: LicensePlan.PRO,
      status: LicenseStatus.SUSPENDED,
      maxDomains: 2,
    },
  });

  await prisma.addonEntitlement.upsert({
    where: {
      licenseId_addonSlug: {
        licenseId: agencyLicense.id,
        addonSlug: "woocommerce_local_pricing",
      },
    },
    update: {},
    create: {
      licenseId: agencyLicense.id,
      addonSlug: "woocommerce_local_pricing",
    },
  });

  await prisma.addonEntitlement.upsert({
    where: {
      licenseId_addonSlug: {
        licenseId: suspendedLicense.id,
        addonSlug: "woocommerce_local_pricing",
      },
    },
    update: {},
    create: {
      licenseId: suspendedLicense.id,
      addonSlug: "woocommerce_local_pricing",
    },
  });

  await prisma.licenseActivation.upsert({
    where: {
      siteHost_instanceHash: {
        siteHost: "northwind.example",
        instanceHash: "inst-alpha",
      },
    },
    update: {
      licenseId: agencyLicense.id,
      siteUrl: "https://northwind.example",
      pluginVersion: "0.3.0",
      status: ActivationStatus.HEALTHY,
      lastSeenAt: new Date("2026-04-19T09:00:00.000Z"),
    },
    create: {
      licenseId: agencyLicense.id,
      siteUrl: "https://northwind.example",
      siteHost: "northwind.example",
      instanceHash: "inst-alpha",
      pluginVersion: "0.3.0",
      status: ActivationStatus.HEALTHY,
      lastSeenAt: new Date("2026-04-19T09:00:00.000Z"),
    },
  });

  await prisma.licenseActivation.upsert({
    where: {
      siteHost_instanceHash: {
        siteHost: "atelier-fera.example",
        instanceHash: "inst-bravo",
      },
    },
    update: {
      licenseId: proLicense.id,
      siteUrl: "https://atelier-fera.example",
      pluginVersion: "0.2.4",
      status: ActivationStatus.WARNING,
      lastSeenAt: new Date("2026-04-19T08:42:00.000Z"),
    },
    create: {
      licenseId: proLicense.id,
      siteUrl: "https://atelier-fera.example",
      siteHost: "atelier-fera.example",
      instanceHash: "inst-bravo",
      pluginVersion: "0.2.4",
      status: ActivationStatus.WARNING,
      lastSeenAt: new Date("2026-04-19T08:42:00.000Z"),
    },
  });

  await prisma.licenseActivation.upsert({
    where: {
      siteHost_instanceHash: {
        siteHost: "legacy-shop.example",
        instanceHash: "inst-charlie",
      },
    },
    update: {
      licenseId: suspendedLicense.id,
      siteUrl: "https://legacy-shop.example",
      pluginVersion: "0.2.3",
      status: ActivationStatus.HARD_LOCK,
      lastSeenAt: new Date("2026-04-19T07:58:00.000Z"),
    },
    create: {
      licenseId: suspendedLicense.id,
      siteUrl: "https://legacy-shop.example",
      siteHost: "legacy-shop.example",
      instanceHash: "inst-charlie",
      pluginVersion: "0.2.3",
      status: ActivationStatus.HARD_LOCK,
      lastSeenAt: new Date("2026-04-19T07:58:00.000Z"),
    },
  });

  await prisma.release.upsert({
    where: { version: "0.3.0" },
    update: {
      channel: ReleaseChannel.STABLE,
      changelog: [
        "Adds remote release enforcement and hard-lock orchestration.",
        "Introduces signed plugin download flow hooks.",
        "Improves activation telemetry for license support.",
      ],
      zipUrl: "https://downloads.example.com/dst/plugin-0.3.0.zip",
      checksum: "sha256-demo-030",
      isMandatory: true,
      publishedAt: new Date("2026-04-19T08:00:00.000Z"),
    },
    create: {
      version: "0.3.0",
      channel: ReleaseChannel.STABLE,
      changelog: [
        "Adds remote release enforcement and hard-lock orchestration.",
        "Introduces signed plugin download flow hooks.",
        "Improves activation telemetry for license support.",
      ],
      zipUrl: "https://downloads.example.com/dst/plugin-0.3.0.zip",
      checksum: "sha256-demo-030",
      isMandatory: true,
      publishedAt: new Date("2026-04-19T08:00:00.000Z"),
    },
  });

  await prisma.release.upsert({
    where: { version: "0.2.5" },
    update: {
      channel: ReleaseChannel.STABLE,
      changelog: [
        "Stabilizes license-aware addon boot checks.",
        "Prepares plugin settings for remote validation metadata.",
      ],
      zipUrl: "https://downloads.example.com/dst/plugin-0.2.5.zip",
      checksum: "sha256-demo-025",
      isMandatory: false,
      publishedAt: new Date("2026-04-05T09:30:00.000Z"),
    },
    create: {
      version: "0.2.5",
      channel: ReleaseChannel.STABLE,
      changelog: [
        "Stabilizes license-aware addon boot checks.",
        "Prepares plugin settings for remote validation metadata.",
      ],
      zipUrl: "https://downloads.example.com/dst/plugin-0.2.5.zip",
      checksum: "sha256-demo-025",
      isMandatory: false,
      publishedAt: new Date("2026-04-05T09:30:00.000Z"),
    },
  });

  await prisma.releasePolicy.updateMany({
    data: {
      isActive: false,
    },
  });

  await prisma.releasePolicy.create({
    data: {
      minimumSupportedVersion: "0.2.5",
      enforcedFrom: new Date("2026-04-19T00:00:00.000Z"),
      graceUntil: new Date("2026-04-30T00:00:00.000Z"),
      lockLevel: LockLevel.HARD,
      message:
        "Sites below the supported version keep admin access, but runtime translation services stop after the grace window closes.",
      isActive: true,
    },
  });

  await prisma.requestLog.create({
    data: {
      type: RequestLogType.CHECK,
      licenseId: proLicense.id,
      siteUrl: "https://atelier-fera.example",
      siteHost: "atelier-fera.example",
      instanceHash: "inst-bravo",
      pluginVersion: "0.2.4",
      responseCode: 200,
      lockLevel: LockLevel.SOFT,
      payload: {
        seeded: true,
      },
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
