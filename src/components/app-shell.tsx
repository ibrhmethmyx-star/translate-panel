import Link from "next/link";
import type { AdminSession } from "@/lib/auth-session";
import { logoutAction } from "@/app/auth-actions";

const navigation = [
  { href: "/", label: "Dashboard" },
  { href: "/licenses", label: "Licenses" },
  { href: "/sites", label: "Sites" },
  { href: "/releases", label: "Releases" },
  { href: "/policies", label: "Policies" },
];

export function AppShell({
  children,
  session,
}: Readonly<{
  children: React.ReactNode;
  session: AdminSession;
}>) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--line-soft)] bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between md:px-10">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">
              Dynamic SEO Translator
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--ink-1)]">
              Control Panel
            </h1>
          </div>

          <div className="flex flex-col gap-3 md:items-end">
            <nav className="flex flex-wrap gap-2">
              {navigation.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-full border border-[var(--line-soft)] bg-white px-4 py-2 text-sm font-medium text-[var(--ink-1)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--ink-2)]">
              <span>
                Signed in as{" "}
                <strong className="font-semibold text-[var(--ink-1)]">
                  {session.username}
                </strong>
              </span>
              <form action={logoutAction}>
                <button className="rounded-full border border-[var(--line-soft)] bg-[var(--surface-3)] px-4 py-2 text-sm font-semibold text-[var(--ink-1)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]">
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8 md:px-10">{children}</div>
    </div>
  );
}
