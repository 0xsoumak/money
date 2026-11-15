import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useToast } from "../../components/Toast";
import { Button, SectionHeader } from "../../components/ui";
import { authClient, queryClient } from "../../lib/api";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const toast = useToast();
  const navigate = useNavigate();

  async function signOut() {
    await authClient.signOut();
    queryClient.clear();
    await navigate({ to: "/login" });
  }

  return (
    <div className="flex max-w-xl flex-col gap-10">
      <h1 className="text-5xl font-bold tracking-[-0.04em]">Settings</h1>

      <section className="flex flex-col gap-3">
        <SectionHeader title="Organise" />
        <Link
          to="/categories"
          className="flex min-h-14 items-center justify-between border-b border-line text-lg font-semibold hover:text-accent"
        >
          Categories and investment buckets
          <span aria-hidden="true" className="text-muted">
            →
          </span>
        </Link>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader title="Your data" />
        <p className="text-muted">
          Everything you've logged (categories, transactions, budgets and settings) as one JSON
          file. Worth keeping a copy each month.
        </p>
        <div>
          <a
            href="/api/export"
            download
            className="inline-flex min-h-12 items-center justify-center rounded-lg border-2 border-line-strong/30 px-5 text-[15px] font-bold uppercase tracking-wider text-ink transition hover:border-line-strong/70"
          >
            Download my data
          </a>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader title="Account" />
        <div>
          <Button variant="outline" onClick={signOut}>
            Sign out
          </Button>
        </div>
      </section>
    </div>
  );
}
