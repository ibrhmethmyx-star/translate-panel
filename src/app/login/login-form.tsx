"use client";

import { useActionState } from "react";
import { loginAction, type LoginFormState } from "@/app/auth-actions";

const initialState: LoginFormState = {
  error: "",
};

export function LoginForm({
  disabled,
  nextPath,
}: Readonly<{
  disabled: boolean;
  nextPath: string;
}>) {
  const [state, action, pending] = useActionState(loginAction, initialState);

  return (
    <form action={action} className="mt-6 space-y-4">
      <input type="hidden" name="next" value={nextPath} />

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-[var(--ink-1)]">
          Username
        </span>
        <input
          autoComplete="username"
          className="w-full rounded-2xl border border-[var(--line-soft)] bg-[var(--surface-3)] px-4 py-3 text-sm text-[var(--ink-1)] outline-none transition focus:border-[var(--accent)]"
          disabled={disabled || pending}
          name="username"
          required
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-[var(--ink-1)]">
          Password
        </span>
        <input
          autoComplete="current-password"
          className="w-full rounded-2xl border border-[var(--line-soft)] bg-[var(--surface-3)] px-4 py-3 text-sm text-[var(--ink-1)] outline-none transition focus:border-[var(--accent)]"
          disabled={disabled || pending}
          name="password"
          required
          type="password"
        />
      </label>

      {state.error ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          {state.error}
        </p>
      ) : null}

      <button
        className="w-full rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        disabled={disabled || pending}
      >
        {pending ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
