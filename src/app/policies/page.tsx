import { revalidatePath } from "next/cache";
import { LockLevel } from "@prisma/client";
import { getPrismaClient, hasDatabaseUrl } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

async function savePolicy(formData: FormData) {
  "use server";

  await requireAdminSession();

  const prisma = getPrismaClient();

  if (!prisma) {
    return;
  }

  const minimumSupportedVersion = String(formData.get("minimumSupportedVersion") ?? "").trim();
  const enforcedFrom = String(formData.get("enforcedFrom") ?? "").trim();
  const graceUntil = String(formData.get("graceUntil") ?? "").trim();
  const lockLevel = String(formData.get("lockLevel") ?? "HARD").toUpperCase() as LockLevel;
  const message = String(formData.get("message") ?? "").trim();

  if (!minimumSupportedVersion || !graceUntil) {
    return;
  }

  await prisma.$transaction([
    prisma.releasePolicy.updateMany({
      data: {
        isActive: false,
      },
    }),
    prisma.releasePolicy.create({
      data: {
        minimumSupportedVersion,
        enforcedFrom: enforcedFrom ? new Date(enforcedFrom) : new Date(),
        graceUntil: new Date(graceUntil),
        lockLevel,
        message,
        isActive: true,
      },
    }),
  ]);

  revalidatePath("/");
  revalidatePath("/policies");
}

function toDateTimeLocal(date: Date) {
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default async function PoliciesPage() {
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

  const policies = await prisma.releasePolicy.findMany({
    orderBy: {
      enforcedFrom: "desc",
    },
  });

  const activePolicy = policies.find((policy) => policy.isActive) ?? null;
  const defaultEnforcedFrom = activePolicy ? toDateTimeLocal(activePolicy.enforcedFrom) : '';
  const defaultGraceUntil = activePolicy ? toDateTimeLocal(activePolicy.graceUntil) : '';

  return (
    <AppShell session={session}>
      <main className="space-y-8">
      <section className="rounded-[28px] border border-[var(--line-soft)] bg-white p-6 shadow-[0_20px_50px_rgba(17,33,43,0.06)]">
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--accent)]">Policy control</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--ink-1)]">
          Set the supported version floor
        </h2>
        <p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">
          The active policy is what turns stale installs into warnings or hard locks while
          keeping the admin recovery screen available.
        </p>

        <form action={savePolicy} className="mt-6 grid gap-4 md:grid-cols-2">
          <Field
            label="Minimum supported version"
            name="minimumSupportedVersion"
            placeholder="0.2.5"
            required
          />
          <SelectField
            label="Lock level after grace"
            name="lockLevel"
            options={[
              { value: "SOFT", label: "Soft" },
              { value: "HARD", label: "Hard" },
              { value: "BLOCKED", label: "Blocked" },
            ]}
          />
          <Field
            label="Policy starts"
            name="enforcedFrom"
            type="datetime-local"
            defaultValue={defaultEnforcedFrom}
          />
          <Field
            label="Grace until"
            name="graceUntil"
            type="datetime-local"
            defaultValue={defaultGraceUntil}
            required
          />
          <label className="md:col-span-2">
            <span className="mb-2 block text-sm font-medium text-[var(--ink-1)]">Message</span>
            <textarea
              name="message"
              rows={4}
              className="w-full rounded-2xl border border-[var(--line-soft)] bg-[var(--surface-3)] px-4 py-3 text-sm text-[var(--ink-1)] outline-none"
              placeholder="Sites below the supported version keep admin access, but runtime translation services stop after the grace window closes."
            />
          </label>
          <div className="md:col-span-2">
            <button className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white">
              Save active policy
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-[28px] border border-[var(--line-soft)] bg-white p-6 shadow-[0_20px_50px_rgba(17,33,43,0.06)]">
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--accent)]">Policy history</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--ink-1)]">
          Saved policies
        </h2>

        {activePolicy ? (
          <div className="mt-6 rounded-[22px] border border-[var(--line-soft)] bg-[var(--surface-3)] px-4 py-4">
            <p className="text-sm font-semibold text-[var(--ink-1)]">Current active policy</p>
            <p className="mt-2 text-sm leading-7 text-[var(--ink-2)]">{activePolicy.message}</p>
          </div>
        ) : null}

        <div className="mt-6 space-y-3">
          {policies.length === 0 ? (
            <div className="rounded-[20px] border border-dashed border-[var(--line-soft)] bg-[var(--surface-3)] px-4 py-6 text-sm text-[var(--ink-2)]">
              No policies saved yet.
            </div>
          ) : (
            policies.map((policy) => (
              <div
                key={policy.id}
                className="rounded-[22px] border border-[var(--line-soft)] bg-[var(--surface-3)] px-4 py-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-base font-semibold text-[var(--ink-1)]">
                    Minimum {policy.minimumSupportedVersion}
                  </p>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-1)]">
                    {policy.isActive ? "active" : "history"}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-3 text-sm text-[var(--ink-2)]">
                  <span>Starts {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(policy.enforcedFrom)}</span>
                  <span>Grace until {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(policy.graceUntil)}</span>
                  <span>Lock {policy.lockLevel.toLowerCase()}</span>
                </div>
                <p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">{policy.message}</p>
              </div>
            ))
          )}
        </div>
      </section>
      </main>
    </AppShell>
  );
}

function Field(props: Readonly<React.InputHTMLAttributes<HTMLInputElement> & { label: string }>) {
  const { label, ...inputProps } = props;

  return (
    <label>
      <span className="mb-2 block text-sm font-medium text-[var(--ink-1)]">{label}</span>
      <input
        {...inputProps}
        className="w-full rounded-2xl border border-[var(--line-soft)] bg-[var(--surface-3)] px-4 py-3 text-sm text-[var(--ink-1)] outline-none"
      />
    </label>
  );
}

function SelectField({
  label,
  name,
  options,
}: {
  label: string;
  name: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label>
      <span className="mb-2 block text-sm font-medium text-[var(--ink-1)]">{label}</span>
      <select
        name={name}
        className="w-full rounded-2xl border border-[var(--line-soft)] bg-[var(--surface-3)] px-4 py-3 text-sm text-[var(--ink-1)] outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <main className="rounded-[28px] border border-[var(--line-soft)] bg-white p-8 text-sm text-[var(--ink-2)] shadow-[0_20px_50px_rgba(17,33,43,0.06)]">
      {message}
    </main>
  );
}
