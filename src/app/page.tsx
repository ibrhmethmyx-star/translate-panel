import Link from "next/link";
import { getDashboardSnapshot } from "@/lib/control-plane";
import { requireAdminSession } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function lockTone(level: string) {
  if (level === "hard" || level === "blocked") {
    return "bg-rose-100 text-rose-900";
  }

  if (level === "soft") {
    return "bg-amber-100 text-amber-900";
  }

  return "bg-emerald-100 text-emerald-900";
}

function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <div className="rounded-[24px] border border-[var(--line-soft)] bg-white p-6 shadow-[0_20px_50px_rgba(17,33,43,0.06)]">
      <p className="text-xs uppercase tracking-[0.18em] text-[var(--ink-2)]">{label}</p>
      <p className="mt-4 text-4xl font-semibold text-[var(--ink-1)]">{value}</p>
      <p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">{detail}</p>
    </div>
  );
}

export default async function Home() {
  const session = await requireAdminSession();
  const snapshot = await getDashboardSnapshot();
  const latestRelease = snapshot.releases[0];
  const recentSites = snapshot.sites.slice(0, 6);
  const recentLicenses = snapshot.licenses.slice(0, 5);

  return (
    <AppShell session={session}>
      <main className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[32px] border border-[var(--line-soft)] bg-[var(--surface-2)] p-8 text-[var(--ink-inverse)] shadow-[0_30px_80px_rgba(17,33,43,0.18)]">
          <div className="flex flex-wrap gap-3 text-xs uppercase tracking-[0.24em] text-white/70">
            <span className="rounded-full border border-white/15 px-3 py-1">
              {snapshot.dataSource === "database" ? "Database Mode" : "Demo Fallback"}
            </span>
            <span className="rounded-full border border-white/15 px-3 py-1">
              Free and licensed sites are tracked together
            </span>
          </div>

          <div className="mt-8 space-y-5">
            <p className="text-sm uppercase tracking-[0.24em] text-[var(--accent-3)]">
              Remote authority for plugin runtime
            </p>
            <h2 className="max-w-4xl text-4xl font-semibold tracking-tight md:text-5xl">
              Create keys, publish releases, and see every installed site from one place.
            </h2>
            <p className="max-w-3xl text-base leading-8 text-white/72">
              Free installs now belong in the same control plane. This dashboard shows total
              site footprint, while the management pages let you create licenses, publish new
              versions, and change the active support policy.
            </p>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/licenses"
              className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-[var(--ink-1)]"
            >
              Create license
            </Link>
            <Link
              href="/releases"
              className="rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white"
            >
              Publish release
            </Link>
            <Link
              href="/sites"
              className="rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white"
            >
              View all sites
            </Link>
          </div>
        </div>

        <div className="grid gap-4">
          <StatCard
            label="Total sites"
            value={snapshot.panelStats.totalSites}
            detail="Every installation reporting in, including free sites."
          />
          <StatCard
            label="Licensed sites"
            value={snapshot.panelStats.licensedSites}
            detail="Installs currently sending a commercial key."
          />
          <StatCard
            label="Free sites"
            value={snapshot.panelStats.freeSites}
            detail="Installed sites without a license key."
          />
          <StatCard
            label="Hard locked"
            value={snapshot.panelStats.hardLockedSites}
            detail="Sites currently blocked from runtime translation."
          />
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <section className="rounded-[28px] border border-[var(--line-soft)] bg-white p-6 shadow-[0_20px_50px_rgba(17,33,43,0.06)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--accent)]">Sites</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--ink-1)]">
                Recent check-ins
              </h3>
            </div>
            <Link href="/sites" className="text-sm font-medium text-[var(--accent)]">
              Open full site list
            </Link>
          </div>

          <div className="mt-6 space-y-3">
            {recentSites.length === 0 ? (
              <div className="rounded-[20px] border border-dashed border-[var(--line-soft)] bg-[var(--surface-3)] px-4 py-6 text-sm text-[var(--ink-2)]">
                No sites have reported in yet.
              </div>
            ) : (
              recentSites.map((site) => (
                <div
                  key={site.id}
                  className="rounded-[22px] border border-[var(--line-soft)] bg-[var(--surface-3)] px-4 py-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-[var(--ink-1)]">
                        {site.siteHost}
                      </p>
                      <p className="font-mono text-xs text-[var(--ink-2)]">{site.siteUrl}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${lockTone(site.lockLevel)}`}>
                        {site.lockLevel}
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-1)]">
                        {site.licenseMode}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3 text-sm text-[var(--ink-2)]">
                    <span>Version {site.pluginVersion}</span>
                    <span>Plan {site.plan}</span>
                    <span>Last seen {formatDate(site.lastSeenAt)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-[28px] border border-[var(--line-soft)] bg-white p-6 shadow-[0_20px_50px_rgba(17,33,43,0.06)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--accent)]">Release</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--ink-1)]">
                Active rollout
              </h3>
            </div>
            <Link href="/policies" className="text-sm font-medium text-[var(--accent)]">
              Edit policy
            </Link>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-[22px] border border-[var(--line-soft)] bg-[var(--surface-3)] p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--ink-2)]">Latest release</p>
              <p className="mt-3 text-2xl font-semibold text-[var(--ink-1)]">
                {latestRelease ? latestRelease.version : "No release yet"}
              </p>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">
                {latestRelease
                  ? `Published ${formatDate(latestRelease.publishedAt)}`
                  : "Create the first release from the Releases page."}
              </p>
            </div>
            <div className="rounded-[22px] border border-[var(--line-soft)] bg-[var(--surface-3)] p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--ink-2)]">Support floor</p>
              <p className="mt-3 text-2xl font-semibold text-[var(--ink-1)]">
                {snapshot.releasePolicy.minimumSupportedVersion}
              </p>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">
                Grace closes {formatDate(snapshot.releasePolicy.graceUntil)}
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-[22px] border border-[var(--line-soft)] bg-[var(--surface-3)] px-4 py-4 text-sm leading-7 text-[var(--ink-2)]">
            {snapshot.releasePolicy.message}
          </div>
        </section>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <section className="rounded-[28px] border border-[var(--line-soft)] bg-white p-6 shadow-[0_20px_50px_rgba(17,33,43,0.06)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--accent)]">Licenses</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--ink-1)]">
                Recent keys
              </h3>
            </div>
            <Link href="/licenses" className="text-sm font-medium text-[var(--accent)]">
              Manage licenses
            </Link>
          </div>

          <div className="mt-6 space-y-3">
            {recentLicenses.length === 0 ? (
              <div className="rounded-[20px] border border-dashed border-[var(--line-soft)] bg-[var(--surface-3)] px-4 py-6 text-sm text-[var(--ink-2)]">
                No licenses created yet.
              </div>
            ) : (
              recentLicenses.map((license) => (
                <div
                  key={license.id}
                  className="rounded-[22px] border border-[var(--line-soft)] bg-[var(--surface-3)] px-4 py-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-[var(--ink-1)]">
                        {license.customerName}
                      </p>
                      <p className="font-mono text-xs text-[var(--ink-2)]">{license.key}</p>
                    </div>
                    <div className="flex gap-2">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-1)]">
                        {license.plan}
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-1)]">
                        {license.status}
                      </span>
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">
                    Domain cap {license.maxDomains} | Addons: {license.addons.join(", ") || "core only"}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-[28px] border border-[var(--line-soft)] bg-white p-6 shadow-[0_20px_50px_rgba(17,33,43,0.06)]">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--accent)]">Next steps</p>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--ink-1)]">
            What you can control now
          </h3>
          <div className="mt-6 grid gap-3 text-sm leading-7 text-[var(--ink-2)]">
            <div className="rounded-[22px] border border-[var(--line-soft)] bg-[var(--surface-3)] px-4 py-4">
              `Licenses` creates keys and domain limits.
            </div>
            <div className="rounded-[22px] border border-[var(--line-soft)] bg-[var(--surface-3)] px-4 py-4">
              `Sites` shows every installed site, including free mode installs.
            </div>
            <div className="rounded-[22px] border border-[var(--line-soft)] bg-[var(--surface-3)] px-4 py-4">
              `Releases` lets you publish a new plugin version and download URL.
            </div>
            <div className="rounded-[22px] border border-[var(--line-soft)] bg-[var(--surface-3)] px-4 py-4">
              `Policies` decides the minimum supported version and hard-lock timing.
            </div>
          </div>
        </section>
      </section>
      </main>
    </AppShell>
  );
}
