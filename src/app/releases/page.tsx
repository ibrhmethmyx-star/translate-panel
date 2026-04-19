import { revalidatePath } from "next/cache";
import { ReleaseChannel } from "@prisma/client";
import { getPrismaClient, hasDatabaseUrl } from "@/lib/prisma";

async function createRelease(formData: FormData) {
  "use server";

  const prisma = getPrismaClient();

  if (!prisma) {
    return;
  }

  const version = String(formData.get("version") ?? "").trim();
  const channel = String(formData.get("channel") ?? "STABLE").toUpperCase() as ReleaseChannel;
  const zipUrl = String(formData.get("zipUrl") ?? "").trim();
  const checksum = String(formData.get("checksum") ?? "").trim();
  const publishedAt = String(formData.get("publishedAt") ?? "").trim();
  const changelog = String(formData.get("changelog") ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (!version || !zipUrl) {
    return;
  }

  await prisma.release.upsert({
    where: {
      version,
    },
    update: {
      channel,
      zipUrl,
      checksum,
      changelog,
      isMandatory: formData.get("isMandatory") === "on",
      publishedAt: publishedAt ? new Date(publishedAt) : new Date(),
    },
    create: {
      version,
      channel,
      zipUrl,
      checksum,
      changelog,
      isMandatory: formData.get("isMandatory") === "on",
      publishedAt: publishedAt ? new Date(publishedAt) : new Date(),
    },
  });

  revalidatePath("/");
  revalidatePath("/releases");
}

function toDateTimeLocal(date: Date) {
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default async function ReleasesPage() {
  if (!hasDatabaseUrl()) {
    return <EmptyState message="DATABASE_URL is missing. Add the real database first." />;
  }

  const prisma = getPrismaClient();

  if (!prisma) {
    return <EmptyState message="Database client could not be created." />;
  }

  const releases = await prisma.release.findMany({
    orderBy: {
      publishedAt: "desc",
    },
  });

  return (
    <main className="space-y-8">
      <section className="rounded-[28px] border border-[var(--line-soft)] bg-white p-6 shadow-[0_20px_50px_rgba(17,33,43,0.06)]">
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--accent)]">Publish release</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--ink-1)]">
          Add or update a plugin version
        </h2>

        <form action={createRelease} className="mt-6 grid gap-4 md:grid-cols-2">
          <Field label="Version" name="version" placeholder="0.3.1" required />
          <SelectField
            label="Channel"
            name="channel"
            options={[
              { value: "STABLE", label: "Stable" },
              { value: "BETA", label: "Beta" },
            ]}
          />
          <Field label="Zip URL" name="zipUrl" type="url" placeholder="https://..." required />
          <Field label="Checksum" name="checksum" placeholder="sha256-..." />
          <Field
            label="Published at"
            name="publishedAt"
            type="datetime-local"
            defaultValue={toDateTimeLocal(new Date())}
          />
          <label className="flex items-center gap-3 rounded-2xl border border-[var(--line-soft)] bg-[var(--surface-3)] px-4 py-3">
            <input type="checkbox" name="isMandatory" />
            <span className="text-sm font-medium text-[var(--ink-1)]">Mandatory release</span>
          </label>
          <label className="md:col-span-2">
            <span className="mb-2 block text-sm font-medium text-[var(--ink-1)]">Changelog</span>
            <textarea
              name="changelog"
              rows={5}
              className="w-full rounded-2xl border border-[var(--line-soft)] bg-[var(--surface-3)] px-4 py-3 text-sm text-[var(--ink-1)] outline-none"
              placeholder="One line per change"
            />
          </label>
          <div className="md:col-span-2">
            <button className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white">
              Save release
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-[28px] border border-[var(--line-soft)] bg-white p-6 shadow-[0_20px_50px_rgba(17,33,43,0.06)]">
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--accent)]">Release history</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--ink-1)]">
          Published versions
        </h2>

        <div className="mt-6 space-y-3">
          {releases.length === 0 ? (
            <div className="rounded-[20px] border border-dashed border-[var(--line-soft)] bg-[var(--surface-3)] px-4 py-6 text-sm text-[var(--ink-2)]">
              No releases yet.
            </div>
          ) : (
            releases.map((release) => (
              <div
                key={release.id}
                className="rounded-[22px] border border-[var(--line-soft)] bg-[var(--surface-3)] px-4 py-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-[var(--ink-1)]">{release.version}</p>
                    <p className="font-mono text-xs text-[var(--ink-2)]">{release.zipUrl}</p>
                  </div>
                  <div className="flex gap-2">
                    <Badge>{release.channel.toLowerCase()}</Badge>
                    <Badge>{release.isMandatory ? "mandatory" : "optional"}</Badge>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-7 text-[var(--ink-2)]">
                  Published {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(release.publishedAt)}
                </p>
                <ul className="mt-3 space-y-2 text-sm text-[var(--ink-2)]">
                  {release.changelog.map((item, index) => (
                    <li key={`${release.id}-${index}`} className="rounded-2xl bg-white px-3 py-2">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
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
