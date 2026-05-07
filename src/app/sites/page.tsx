import { getPrismaClient, hasDatabaseUrl } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function SitesPage() {
  const session = await requireAdminSession();

  if (!hasDatabaseUrl()) {
    return (
      <AppShell session={session}>
        <EmptyState message="DATABASE_URL is missing. Add the real database first." />
      </AppShell>
    );
  }

  const prisma = getPrismaClient();

  if (!prisma) {
    return (
      <AppShell session={session}>
        <EmptyState message="Database client could not be created." />
      </AppShell>
    );
  }

  const sites = await prisma.siteInstallation.findMany({
    orderBy: {
      lastSeenAt: "desc",
    },
  });

  const totalSites = sites.length;
  const freeSites = sites.filter((site) => site.licenseMode === "FREE").length;
  const licensedSites = sites.filter((site) => site.licenseMode === "LICENSED").length;
  const hardLocked = sites.filter(
    (site) => site.runtimeLockLevel === "HARD" || site.runtimeLockLevel === "BLOCKED",
  ).length;

  return (
    <AppShell session={session}>
      <main className="space-y-8">
      <section className="grid gap-4 md:grid-cols-4">
        <StatCard label="Total sites" value={totalSites} />
        <StatCard label="Licensed" value={licensedSites} />
        <StatCard label="Free" value={freeSites} />
        <StatCard label="Hard locked" value={hardLocked} />
      </section>

      <section className="rounded-[28px] border border-[var(--line-soft)] bg-white p-6 shadow-[0_20px_50px_rgba(17,33,43,0.06)]">
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--accent)]">Install footprint</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--ink-1)]">
          All installed sites
        </h2>
        <p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">
          This page tracks every site that talks to the control plane, even when no license
          key is configured yet.
        </p>

        <div className="mt-6 space-y-3">
          {sites.length === 0 ? (
            <div className="rounded-[20px] border border-dashed border-[var(--line-soft)] bg-[var(--surface-3)] px-4 py-6 text-sm text-[var(--ink-2)]">
              No sites have reported in yet.
            </div>
          ) : (
            sites.map((site) => (
              <div
                key={site.id}
                className="rounded-[22px] border border-[var(--line-soft)] bg-[var(--surface-3)] px-4 py-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-[var(--ink-1)]">{site.siteHost}</p>
                    <p className="font-mono text-xs text-[var(--ink-2)]">{site.siteUrl}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge>{site.licenseMode.toLowerCase()}</Badge>
                    <Badge>{site.plan.toLowerCase()}</Badge>
                    <Badge>{site.runtimeLockLevel.toLowerCase()}</Badge>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-3 text-sm text-[var(--ink-2)]">
                  <span>Version {site.pluginVersion}</span>
                  <span>Status {site.licenseStatus.toLowerCase()}</span>
                  <span>First seen {formatDate(site.firstSeenAt)}</span>
                  <span>Last seen {formatDate(site.lastSeenAt)}</span>
                </div>
                <p className="mt-2 text-xs font-mono text-[var(--ink-2)]">
                  {site.licenseKey || "No license key"}
                </p>
              </div>
            ))
          )}
        </div>
      </section>
      </main>
    </AppShell>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[24px] border border-[var(--line-soft)] bg-white p-6 shadow-[0_20px_50px_rgba(17,33,43,0.06)]">
      <p className="text-xs uppercase tracking-[0.18em] text-[var(--ink-2)]">{label}</p>
      <p className="mt-4 text-4xl font-semibold text-[var(--ink-1)]">{value}</p>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-1)]">
      {children}
    </span>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <main className="rounded-[28px] border border-[var(--line-soft)] bg-white p-8 text-sm text-[var(--ink-2)] shadow-[0_20px_50px_rgba(17,33,43,0.06)]">
      {message}
    </main>
  );
}
