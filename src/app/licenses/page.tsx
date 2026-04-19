import { revalidatePath } from "next/cache";
import { LicensePlan, LicenseStatus } from "@prisma/client";
import { getPrismaClient, hasDatabaseUrl } from "@/lib/prisma";

function generateLicenseKey(plan: string) {
  const prefix =
    plan === "agency" ? "DST-AGENCY" : plan === "pro" ? "DST-PRO" : "DST-FREE";
  const random = Math.random().toString(36).toUpperCase().slice(2, 8);
  const stamp = Date.now().toString().slice(-6);
  return `${prefix}-${random}${stamp}`;
}

function parseAddons(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\n,]/g)
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  );
}

async function createLicense(formData: FormData) {
  "use server";

  const prisma = getPrismaClient();

  if (!prisma) {
    return;
  }

  const customerName = String(formData.get("customerName") ?? "").trim();
  const keyInput = String(formData.get("key") ?? "").trim().toUpperCase();
  const plan = String(formData.get("plan") ?? "pro").toUpperCase() as LicensePlan;
  const status = String(formData.get("status") ?? "ACTIVE").toUpperCase() as LicenseStatus;
  const maxDomains = Math.max(1, Number(formData.get("maxDomains") ?? 1));
  const expiresAtInput = String(formData.get("expiresAt") ?? "").trim();
  const addons = parseAddons(String(formData.get("addons") ?? ""));

  if (!customerName) {
    return;
  }

  const license = await prisma.license.create({
    data: {
      key: keyInput || generateLicenseKey(plan.toLowerCase()),
      customerName,
      plan,
      status,
      maxDomains,
      expiresAt: expiresAtInput ? new Date(expiresAtInput) : null,
    },
  });

  if (addons.length > 0) {
    await prisma.addonEntitlement.createMany({
      data: addons.map((addonSlug) => ({
        licenseId: license.id,
        addonSlug,
      })),
      skipDuplicates: true,
    });
  }

  revalidatePath("/");
  revalidatePath("/licenses");
}

export default async function LicensesPage() {
  if (!hasDatabaseUrl()) {
    return <EmptyState message="DATABASE_URL is missing. Add the real database first." />;
  }

  const prisma = getPrismaClient();

  if (!prisma) {
    return <EmptyState message="Database client could not be created." />;
  }

  const licenses = await prisma.license.findMany({
    include: {
      addonEntitlements: true,
      siteInstallations: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return (
    <main className="space-y-8">
      <section className="rounded-[28px] border border-[var(--line-soft)] bg-white p-6 shadow-[0_20px_50px_rgba(17,33,43,0.06)]">
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--accent)]">Create license</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--ink-1)]">
          Generate a new commercial key
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--ink-2)]">
          Free installs do not need keys; they appear automatically on the Sites page.
          Use this screen for Pro or Agency customers and optional addon entitlements.
        </p>

        <form action={createLicense} className="mt-6 grid gap-4 md:grid-cols-2">
          <Field label="Customer name" name="customerName" required />
          <Field label="Custom key (optional)" name="key" placeholder="Auto-generated if blank" />
          <SelectField
            label="Plan"
            name="plan"
            options={[
              { value: "PRO", label: "Pro" },
              { value: "AGENCY", label: "Agency" },
              { value: "FREE", label: "Free" },
            ]}
          />
          <SelectField
            label="Status"
            name="status"
            options={[
              { value: "ACTIVE", label: "Active" },
              { value: "INACTIVE", label: "Inactive" },
              { value: "INVALID", label: "Invalid" },
              { value: "SUSPENDED", label: "Suspended" },
              { value: "EXPIRED", label: "Expired" },
            ]}
          />
          <Field label="Max domains" name="maxDomains" type="number" defaultValue="1" />
          <Field label="Expires at" name="expiresAt" type="date" />
          <label className="md:col-span-2">
            <span className="mb-2 block text-sm font-medium text-[var(--ink-1)]">Addons</span>
            <textarea
              name="addons"
              rows={4}
              className="w-full rounded-2xl border border-[var(--line-soft)] bg-[var(--surface-3)] px-4 py-3 text-sm text-[var(--ink-1)] outline-none"
              placeholder="woocommerce_local_pricing, seo_pack"
            />
          </label>
          <div className="md:col-span-2">
            <button className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white">
              Save license
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-[28px] border border-[var(--line-soft)] bg-white p-6 shadow-[0_20px_50px_rgba(17,33,43,0.06)]">
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--accent)]">Existing keys</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--ink-1)]">
          License inventory
        </h2>

        <div className="mt-6 space-y-3">
          {licenses.length === 0 ? (
            <div className="rounded-[20px] border border-dashed border-[var(--line-soft)] bg-[var(--surface-3)] px-4 py-6 text-sm text-[var(--ink-2)]">
              No licenses yet.
            </div>
          ) : (
            licenses.map((license) => (
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
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-1)]">
                      {license.plan.toLowerCase()}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-1)]">
                      {license.status.toLowerCase()}
                    </span>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-3 text-sm text-[var(--ink-2)]">
                  <span>Domains {license.maxDomains}</span>
                  <span>Sites {license.siteInstallations.length}</span>
                  <span>
                    Addons {license.addonEntitlements.map((item) => item.addonSlug).join(", ") || "core only"}
                  </span>
                </div>
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
        defaultValue={options[0]?.value}
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
