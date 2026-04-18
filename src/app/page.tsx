import {
  apiSurface,
  getDashboardSnapshot,
  implementationStages,
} from "@/lib/control-plane";

function toneClass(tone: "healthy" | "warning" | "hard_lock") {
  switch (tone) {
    case "healthy":
      return "bg-emerald-100 text-emerald-900";
    case "warning":
      return "bg-amber-100 text-amber-900";
    case "hard_lock":
      return "bg-rose-100 text-rose-900";
    default:
      return "bg-slate-200 text-slate-900";
  }
}

export default async function Home() {
  const snapshot = await getDashboardSnapshot();
  const {
    activations,
    dataSource,
    licenses,
    panelStats,
    releasePolicy,
    releases,
  } = snapshot;
  const latestRelease = releases[0];

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-6 py-8 md:px-10 lg:px-12">
      <section className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="overflow-hidden rounded-[32px] border border-[var(--line-soft)] bg-[var(--surface-2)] p-8 text-[var(--ink-inverse)] shadow-[0_30px_80px_rgba(17,33,43,0.18)] md:p-10">
          <div className="mb-10 flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.24em] text-white/70">
            <span className="rounded-full border border-white/15 px-3 py-1">
              Dynamic SEO Translator
            </span>
            <span className="rounded-full border border-white/15 px-3 py-1">
              {dataSource === "database" ? "Database Mode" : "Demo Fallback"}
            </span>
          </div>

          <div className="space-y-6">
            <p className="max-w-2xl text-sm uppercase tracking-[0.24em] text-[var(--accent-3)]">
              License validation, release enforcement, and runtime lock orchestration
            </p>
            <h1 className="max-w-4xl text-4xl font-semibold tracking-tight md:text-6xl">
              Keep admin recovery open while unsupported plugin versions stop translating.
            </h1>
            <p className="max-w-2xl text-base leading-8 text-white/72 md:text-lg">
              This panel is the remote authority for licenses, release policy, and
              hard-lock decisions. The WordPress plugin stays lightweight and obeys
              the panel response instead of carrying local business rules forever.
            </p>
            <p className="max-w-2xl text-sm leading-7 text-white/55">
              {dataSource === "database"
                ? "Live rows are loading from Prisma + Postgres."
                : "DATABASE_URL is not configured yet, so the panel is safely rendering seeded demo data."}
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
              <p className="text-sm text-white/65">Latest release</p>
              <p className="mt-2 text-3xl font-semibold">{latestRelease.version}</p>
              <p className="mt-2 text-sm text-white/65">
                Mandatory rollout with signed package delivery next.
              </p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
              <p className="text-sm text-white/65">Minimum supported</p>
              <p className="mt-2 text-3xl font-semibold">
                {releasePolicy.minimumSupportedVersion}
              </p>
              <p className="mt-2 text-sm text-white/65">
                Hard lock begins after {releasePolicy.graceUntil.slice(0, 10)}.
              </p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
              <p className="text-sm text-white/65">Lock policy</p>
              <p className="mt-2 text-3xl font-semibold uppercase">
                {releasePolicy.lockLevel}
              </p>
              <p className="mt-2 text-sm text-white/65">
                Frontend runtime stops, admin remains available.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          <StatCard
            label="Licenses"
            value={panelStats.totalLicenses}
            detail="Tracked inside the control plane."
          />
          <StatCard
            label="Active sites"
            value={panelStats.activeSites}
            detail="Instances sending license checks and heartbeats."
          />
          <StatCard
            label="Outdated sites"
            value={panelStats.outdatedSites}
            detail="Below the current supported floor."
          />
          <StatCard
            label="Hard locked"
            value={panelStats.hardLockedSites}
            detail="Runtime services stopped until update."
            tone="alert"
          />
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <PanelCard
          eyebrow="Release control"
          title="Current rollout rule"
          description={releasePolicy.message}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[24px] border border-[var(--line-soft)] bg-white/70 p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--ink-2)]">
                Changelog highlights
              </p>
              <ul className="mt-4 space-y-3 text-sm leading-7 text-[var(--ink-1)]">
                {latestRelease.changelog.map((item) => (
                  <li key={item} className="rounded-2xl bg-[var(--surface-3)] px-4 py-3">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-[24px] border border-[var(--line-soft)] bg-[var(--surface-3)] p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--ink-2)]">
                Enforcement window
              </p>
              <div className="mt-4 space-y-4 text-sm text-[var(--ink-1)]">
                <div>
                  <p className="text-[var(--ink-2)]">Policy starts</p>
                  <p className="mt-1 font-mono text-base">{releasePolicy.enforcedFrom}</p>
                </div>
                <div>
                  <p className="text-[var(--ink-2)]">Grace closes</p>
                  <p className="mt-1 font-mono text-base">{releasePolicy.graceUntil}</p>
                </div>
                <div>
                  <p className="text-[var(--ink-2)]">Expected runtime action</p>
                  <p className="mt-1 text-base font-semibold capitalize">
                    {releasePolicy.lockLevel} lock with admin access kept online
                  </p>
                </div>
              </div>
            </div>
          </div>
        </PanelCard>

        <PanelCard
          eyebrow="Plugin API"
          title="Remote endpoints the WordPress plugin will call"
          description="These routes already support Prisma-backed data when a database is configured, and they safely fall back to demo mode otherwise."
        >
          <div className="space-y-3">
            {apiSurface.map((endpoint) => (
              <div
                key={endpoint.path}
                className="rounded-[22px] border border-[var(--line-soft)] bg-white/65 px-4 py-4"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full bg-[var(--surface-2)] px-3 py-1 font-mono text-xs text-white">
                    {endpoint.method}
                  </span>
                  <code className="font-mono text-sm text-[var(--ink-1)]">
                    {endpoint.path}
                  </code>
                </div>
                <p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">
                  {endpoint.purpose}
                </p>
              </div>
            ))}
          </div>
        </PanelCard>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <PanelCard
          eyebrow="Licenses"
          title="Commercial rights"
          description="Plan rights stay remote so feature access can change without shipping another plugin build."
        >
          <div className="space-y-3">
            {licenses.map((license) => (
              <div
                key={license.id}
                className="rounded-[22px] border border-[var(--line-soft)] bg-white/75 px-4 py-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-[var(--ink-1)]">
                      {license.customerName}
                    </p>
                    <p className="font-mono text-xs text-[var(--ink-2)]">{license.key}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em]">
                    <span className="rounded-full bg-[var(--surface-3)] px-3 py-1 text-[var(--ink-1)]">
                      {license.plan}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[var(--ink-1)]">
                      {license.status}
                    </span>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">
                  Domain cap: {license.maxDomains} | Addons:{" "}
                  {license.addons.join(", ") || "core only"}
                </p>
              </div>
            ))}
          </div>
        </PanelCard>

        <PanelCard
          eyebrow="Activations"
          title="Sites currently reporting in"
          description="The plugin heartbeat keeps release adoption visible and lets us enter hard lock without killing admin recovery."
        >
          <div className="space-y-3">
            {activations.map((activation) => (
              <div
                key={activation.id}
                className="rounded-[22px] border border-[var(--line-soft)] bg-white/75 px-4 py-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-[var(--ink-1)]">
                      {activation.siteHost}
                    </p>
                    <p className="font-mono text-xs text-[var(--ink-2)]">
                      {activation.siteUrl}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${toneClass(
                      activation.status,
                    )}`}
                  >
                    {activation.status.replace("_", " ")}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-3 text-sm text-[var(--ink-2)]">
                  <span>Version {activation.pluginVersion}</span>
                  <span>Last seen {activation.lastSeenAt}</span>
                  <span className="font-mono">{activation.instanceHash}</span>
                </div>
              </div>
            ))}
          </div>
        </PanelCard>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <PanelCard
          eyebrow="Next implementation pass"
          title="What we wire next"
          description="This scaffold is intentionally thin. The next pass turns it into the production control plane."
        >
          <ol className="space-y-3 text-sm leading-7 text-[var(--ink-2)]">
            {implementationStages.map((stage, index) => (
              <li
                key={stage}
                className="flex gap-3 rounded-[22px] border border-[var(--line-soft)] bg-white/70 px-4 py-4"
              >
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-xs font-semibold text-white">
                  {index + 1}
                </span>
                <span>{stage}</span>
              </li>
            ))}
          </ol>
        </PanelCard>

        <PanelCard
          eyebrow="Runtime rule"
          title="Hard lock semantics"
          description="This is the user-friendly behavior we agreed on for stale or suspended sites."
        >
          <div className="grid gap-3 text-sm leading-7 text-[var(--ink-2)]">
            <RuleItem title="Frontend translation">Disable output translation hooks and engine boot.</RuleItem>
            <RuleItem title="Addon runtime">Prevent premium addons from registering hooks.</RuleItem>
            <RuleItem title="Admin recovery">Keep settings, license tab, and update notice available.</RuleItem>
            <RuleItem title="Upgrade path">Surface the latest release and signed package URL from the control plane.</RuleItem>
          </div>
        </PanelCard>
      </section>
    </main>
  );
}

function StatCard({
  label,
  value,
  detail,
  tone = "default",
}: {
  label: string;
  value: number;
  detail: string;
  tone?: "default" | "alert";
}) {
  return (
    <div
      className={`rounded-[28px] border p-6 shadow-[0_20px_50px_rgba(17,33,43,0.08)] ${
        tone === "alert"
          ? "border-rose-200 bg-rose-50"
          : "border-[var(--line-soft)] bg-[var(--surface-1)]"
      }`}
    >
      <p className="text-sm uppercase tracking-[0.2em] text-[var(--ink-2)]">{label}</p>
      <p className="mt-4 text-4xl font-semibold text-[var(--ink-1)]">{value}</p>
      <p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">{detail}</p>
    </div>
  );
}

function PanelCard({
  eyebrow,
  title,
  description,
  children,
}: Readonly<{
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}>) {
  return (
    <section className="rounded-[32px] border border-[var(--line-soft)] bg-[var(--surface-1)] p-6 shadow-[0_24px_60px_rgba(17,33,43,0.08)] md:p-8">
      <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">{eyebrow}</p>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--ink-1)] md:text-3xl">
        {title}
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--ink-2)]">
        {description}
      </p>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function RuleItem({
  title,
  children,
}: Readonly<{
  title: string;
  children: React.ReactNode;
}>) {
  return (
    <div className="rounded-[22px] border border-[var(--line-soft)] bg-white/70 px-4 py-4">
      <p className="text-base font-semibold text-[var(--ink-1)]">{title}</p>
      <p className="mt-2">{children}</p>
    </div>
  );
}
