import { redirect } from "next/navigation";
import { LoginForm } from "@/app/login/login-form";
import {
  getAdminSession,
  getAuthSetupProblems,
  sanitizeNextPath,
} from "@/lib/auth";

export default async function LoginPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ next?: string }>;
}>) {
  const params = await searchParams;
  const nextPath = sanitizeNextPath(params.next);
  const session = await getAdminSession();

  if (session) {
    redirect(nextPath);
  }

  const setupProblems = getAuthSetupProblems();
  const isSetupBlocked = setupProblems.length > 0;

  return (
    <main className="mx-auto grid min-h-screen max-w-6xl items-center gap-8 px-6 py-10 md:grid-cols-[0.95fr_1.05fr] md:px-10">
      <section className="space-y-5">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">
          Dynamic SEO Translator
        </p>
        <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-[var(--ink-1)] md:text-5xl">
          Admin access is protected now.
        </h1>
        <p className="max-w-xl text-sm leading-7 text-[var(--ink-2)]">
          Sign in to manage licenses, releases, sites, and enforcement policies.
        </p>
      </section>

      <section className="rounded-[28px] border border-[var(--line-soft)] bg-white p-6 shadow-[0_20px_50px_rgba(17,33,43,0.08)] md:p-8">
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--accent)]">
          Control panel
        </p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--ink-1)]">
          Sign in
        </h2>

        {isSetupBlocked ? (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-7 text-amber-950">
            <p className="font-semibold">Server setup is incomplete.</p>
            <ul className="mt-2 list-disc pl-5">
              {setupProblems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <LoginForm disabled={isSetupBlocked} nextPath={nextPath} />
      </section>
    </main>
  );
}
