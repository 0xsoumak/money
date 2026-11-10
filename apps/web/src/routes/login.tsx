import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { Button, fieldClass } from "../components/ui";
import { authClient } from "../lib/api";
import { sessionQuery } from "../lib/queries";

export const Route = createFileRoute("/login")({
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.fetchQuery({ ...sessionQuery, staleTime: 0 });
    if (session) throw redirect({ to: "/" });
  },
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { queryClient } = Route.useRouteContext();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    const { error } = await authClient.signIn.email({
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
    });
    setBusy(false);
    if (error) {
      setError(
        error.status === 429
          ? "Too many attempts. Wait a minute and try again."
          : "Wrong email or password.",
      );
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["session"] });
    await navigate({ to: "/" });
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-12">
      <p className="text-xl font-bold uppercase tracking-wide">
        Money<span className="text-accent">.</span>
      </p>
      <h1 className="mt-10 text-5xl font-bold tracking-[-0.04em]">Sign in</h1>
      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm font-bold uppercase tracking-[0.12em] text-muted">
          Email
          <input
            name="email"
            type="email"
            autoComplete="username"
            required
            autoFocus
            className={fieldClass}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-bold uppercase tracking-[0.12em] text-muted">
          Password
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className={fieldClass}
          />
        </label>
        {error && (
          <p role="alert" className="font-semibold text-danger">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy} className="mt-2 h-14">
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </main>
  );
}
